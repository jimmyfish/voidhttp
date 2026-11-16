//! Kafka client. One connection per tab: `kafka_connect` reads a topic until Disconnect, and
//! records, produce acks and topic facts arrive on an IPC channel. `kafka_produce`, `kafka_seek`,
//! `kafka_pause`, `kafka_refresh` and `kafka_close` reach the running connection through a queue.
//!
//! It reads WITHOUT a consumer group: every partition is fetched directly from its leader and no
//! offset is ever committed, so a service reading the same topic never loses a record and no
//! rebalance starts. rskafka supplies the wire protocol (messages, record batches, compression,
//! SASL); the connections are our own, so Settings > Network (secure DNS, proxy) and
//! Settings > Certificates apply to every broker, the same as for HTTP, WebSocket and gRPC.

use std::{
    collections::{BTreeMap, HashMap},
    sync::Arc,
    time::{Duration, Instant},
};

use base64::Engine;
use rskafka::{
    client::{Credentials, SaslConfig},
    messenger::Messenger,
    protocol::{
        error::Error as ApiError,
        messages::{
            FetchRequest, FetchRequestPartition, FetchRequestTopic, FetchResponsePartition, IsolationLevel, ListOffsetsRequest,
            ListOffsetsRequestPartition, ListOffsetsRequestTopic, MetadataRequest, MetadataResponse, ProduceRequest,
            ProduceRequestPartitionData, ProduceRequestTopicData, NORMAL_CONSUMER,
        },
        primitives::{Boolean, Int16, Int32, Int64, NullableString, Records, String_},
        record::{ControlBatchOrRecords, Record as WireRecord, RecordBatch, RecordBatchCompression, RecordBatchTimestampType, RecordHeader},
    },
};
use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel as IpcChannel, State};
use tokio::{
    io::{AsyncRead, AsyncWrite},
    sync::mpsc,
};

use crate::ws::Conns;

/// Largest frame a broker may send us (a fetch answer included).
const MAX_FRAME: usize = 64 * 1024 * 1024;
/// How long a fetch waits on the broker for new records before it answers empty.
const FETCH_WAIT_MS: i32 = 500;
/// Bytes asked for per partition and per fetch.
const PARTITION_BYTES: i32 = 512 * 1024;
const FETCH_BYTES: i32 = 4 * 1024 * 1024;
/// While paused, how often the count of records waiting on the topic is refreshed.
const PAUSED_TICK: Duration = Duration::from_secs(3);
/// Fetch failures in a row before the connection counts as lost.
const MAX_FAILS: u32 = 3;
/// Limit when Settings has none (0).
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

// ---------- wire types (camelCase to the webview) ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KafkaRequest {
    /// client id, used to produce, seek and close
    pub id: String,
    /// bootstrap brokers, host:port separated by commas, spaces or new lines
    pub brokers: String,
    pub topic: String,
    #[serde(default)]
    pub client_id: String,
    /// "none", "plain", "scram-sha-256" or "scram-sha-512"
    #[serde(default)]
    pub sasl: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub tls: bool,
    #[serde(default)]
    pub insecure: bool,
    /// where reading starts
    pub from: Seek,
    /// 0 none, 1 the leader, -1 all in-sync replicas
    #[serde(default = "acks_default")]
    pub acks: i16,
    /// "none", "gzip", "lz4", "snappy" or "zstd", for produced records
    #[serde(default)]
    pub compression: String,
    #[serde(default)]
    pub timeout_ms: u64,
}

fn acks_default() -> i16 {
    -1
}

/// Where reading starts: the newest end, the oldest kept record, the last n of each partition,
/// a point in time (ms since the epoch), or one partition at an offset.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "kind")]
pub enum Seek {
    Latest,
    Earliest,
    Last { n: i64 },
    Time { ms: i64 },
    Offset { partition: i32, offset: i64 },
}

/// A record to produce. The key comes as base64 (the webview turned String / JSON / Base64 / Hex
/// into bytes); the value is the editor's text.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Produce {
    pub seq: u64,
    #[serde(default)]
    pub key: Option<String>,
    #[serde(default)]
    pub value: Option<String>,
    #[serde(default)]
    pub headers: Vec<crate::http::Kv>,
    /// None picks one: from the key (Kafka's murmur2, like the Java client), else round robin
    #[serde(default)]
    pub partition: Option<i32>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Broker {
    pub id: i32,
    pub host: String,
    pub port: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rack: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PartitionInfo {
    pub partition: i32,
    pub leader: i32,
    pub replicas: Vec<i32>,
    pub isr: Vec<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub earliest: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// What the Topic tab shows: the cluster, then the topic's partitions with their offsets.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Cluster {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cluster_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub controller_id: Option<i32>,
    pub brokers: Vec<Broker>,
    pub topic: String,
    pub partitions: Vec<PartitionInfo>,
    /// every topic name on the cluster, for the Topic field's suggestions
    pub topics: Vec<String>,
    /// the bootstrap broker that answered, host:port
    pub bootstrap: String,
    /// "SCRAM-SHA-512" and so on; None without SASL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sasl: Option<String>,
    pub tls: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Header {
    pub key: String,
    /// text, or base64 when `bin`
    pub value: String,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub bin: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "type")]
pub enum KafkaEvent {
    /// the cluster answered and the topic exists; reading starts now
    Connected { cluster: Cluster, from: Seek, elapsed_ms: u64 },
    /// fresh topic facts (Refresh on the Topic tab)
    Topic { cluster: Cluster },
    /// a record read ("in", kind "record"), one produced ("out", kind "record"), or the broker's answer to a produce ("in", kind "ack")
    Message {
        dir: &'static str,
        kind: &'static str,
        partition: i32,
        #[serde(skip_serializing_if = "Option::is_none")]
        offset: Option<i64>,
        /// the record's own time, ms since the epoch
        #[serde(skip_serializing_if = "Option::is_none")]
        ts: Option<i64>,
        /// text, or base64 when `key_bin`; None for a record without a key
        #[serde(skip_serializing_if = "Option::is_none")]
        key: Option<String>,
        #[serde(skip_serializing_if = "std::ops::Not::not")]
        key_bin: bool,
        /// the value: text, or base64 when `value_bin`
        data: String,
        #[serde(skip_serializing_if = "std::ops::Not::not")]
        value_bin: bool,
        /// a tombstone: the record has no value at all
        #[serde(skip_serializing_if = "std::ops::Not::not")]
        value_null: bool,
        #[serde(skip_serializing_if = "Vec::is_empty")]
        headers: Vec<Header>,
        /// a produced record and its ack share this
        #[serde(skip_serializing_if = "Option::is_none")]
        ack_id: Option<u64>,
        /// an ack: how long the broker took
        #[serde(skip_serializing_if = "Option::is_none")]
        ack_ms: Option<u64>,
        /// an ack: the acks setting it was sent with
        #[serde(skip_serializing_if = "Option::is_none")]
        acks: Option<i16>,
        /// an ack: the produce failed
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
        size: usize,
        /// ms since the connection was made
        at_ms: u64,
    },
    /// reading moved: the list starts over
    Seeked { from: Seek, at_ms: u64 },
    Paused { paused: bool, at_ms: u64 },
    /// while paused: records on the topic past where reading stopped
    Waiting { count: i64 },
    /// something to say that doesn't end the connection (a seek that could not be done)
    Notice { message: String },
    /// the connection never got to reading; it ends here
    Failed {
        /// "connect" (no bootstrap broker), "tls", "sasl", "broker" (a leader the cluster named), "topic"
        stage: &'static str,
        #[serde(skip_serializing_if = "Option::is_none")]
        broker: Option<String>,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        hint: Option<String>,
        /// topic names on the cluster, when the topic was not found
        #[serde(skip_serializing_if = "Vec::is_empty")]
        topics: Vec<String>,
        elapsed_ms: u64,
    },
    Close {
        /// "client" (Disconnect) or "lost"
        by: &'static str,
        reason: String,
        /// ms the connection was open
        elapsed_ms: u64,
    },
}

// ---------- state ----------

enum Cmd {
    Produce(Produce),
    Seek(Seek),
    Pause(bool),
    Refresh,
    Close,
}

#[derive(Default)]
pub struct KafkaState {
    conns: Conns<Cmd>,
}

// ---------- commands ----------

/// Connects, finds the topic, then reads until Disconnect. Err only for input that can't be used
/// (no broker, bad port); a cluster that can't be reached ends with a Failed event instead.
#[tauri::command]
pub async fn kafka_connect(state: State<'_, KafkaState>, request: KafkaRequest, on_event: IpcChannel<KafkaEvent>) -> Result<(), String> {
    let bootstraps = parse_brokers(&request.brokers)?;
    let topic = request.topic.trim().to_string();
    if topic.is_empty() {
        return Err("Enter a topic".into());
    }
    let (mut rx, _guard) = state.conns.open(&request.id)?;
    let opts = Arc::new(Opts::from(&request)?);
    let started = Instant::now();

    // Disconnect while connecting stops it; anything else sent before the topic is found has nowhere to go
    let cancelled = async {
        loop {
            match rx.recv().await {
                Some(Cmd::Close) | None => return,
                Some(_) => {}
            }
        }
    };
    let setup = tokio::select! {
        s = Session::start(opts.clone(), bootstraps, topic, request.from.clone()) => s,
        _ = cancelled => {
            let _ = on_event.send(KafkaEvent::Close { by: "client", reason: "Cancelled".into(), elapsed_ms: started.elapsed().as_millis() as u64 });
            return Ok(());
        }
    };
    let (mut session, cluster) = match setup {
        Ok(s) => s,
        Err(f) => {
            let _ = on_event.send(f.event(started));
            return Ok(());
        }
    };
    let _ = on_event.send(KafkaEvent::Connected { cluster, from: request.from, elapsed_ms: started.elapsed().as_millis() as u64 });
    session.run(&mut rx, &on_event).await;
    Ok(())
}

#[tauri::command]
pub async fn kafka_produce(state: State<'_, KafkaState>, id: String, record: Produce) -> Result<(), String> {
    send(&state, &id, Cmd::Produce(record)).await
}

#[tauri::command]
pub async fn kafka_seek(state: State<'_, KafkaState>, id: String, from: Seek) -> Result<(), String> {
    send(&state, &id, Cmd::Seek(from)).await
}

#[tauri::command]
pub async fn kafka_pause(state: State<'_, KafkaState>, id: String, paused: bool) -> Result<(), String> {
    send(&state, &id, Cmd::Pause(paused)).await
}

#[tauri::command]
pub async fn kafka_refresh(state: State<'_, KafkaState>, id: String) -> Result<(), String> {
    send(&state, &id, Cmd::Refresh).await
}

/// Disconnect, or stop a connect still running.
#[tauri::command]
pub async fn kafka_close(state: State<'_, KafkaState>, id: String) -> Result<(), String> {
    match state.conns.get(&id) {
        Some(tx) => {
            let _ = tx.send(Cmd::Close).await;
            Ok(())
        }
        None => Ok(()),
    }
}

async fn send(state: &State<'_, KafkaState>, id: &str, cmd: Cmd) -> Result<(), String> {
    let tx = state.conns.get(id).ok_or("The connection is closed")?;
    tx.send(cmd).await.map_err(|_| "The connection is closed".to_string())
}

// ---------- connections ----------

trait Io: AsyncRead + AsyncWrite + Send + Unpin {}
impl<T: AsyncRead + AsyncWrite + Send + Unpin> Io for T {}

type Conn = Arc<Messenger<Box<dyn Io>>>;
/// A leader, its connection, and the partitions (with their positions) one fetch asks it for.
type FetchJob = (i32, Option<Conn>, Vec<(i32, i64)>);

/// Everything a broker connection needs, from the request and Settings.
struct Opts {
    client_id: Arc<str>,
    sasl: Option<(String, String, String)>,
    tls: bool,
    insecure: bool,
    acks: i16,
    compression: RecordBatchCompression,
    timeout: Duration,
}

impl Opts {
    fn from(r: &KafkaRequest) -> Result<Self, String> {
        let mech = r.sasl.trim().to_ascii_lowercase();
        let sasl = match mech.as_str() {
            "" | "none" => None,
            "plain" | "scram-sha-256" | "scram-sha-512" => Some((mech, r.username.clone(), r.password.clone())),
            other => return Err(format!("Unknown SASL mechanism: {other}")),
        };
        let compression = match r.compression.as_str() {
            "gzip" => RecordBatchCompression::Gzip,
            "lz4" => RecordBatchCompression::Lz4,
            "snappy" => RecordBatchCompression::Snappy,
            "zstd" => RecordBatchCompression::Zstd,
            _ => RecordBatchCompression::NoCompression,
        };
        let id = r.client_id.trim();
        Ok(Self {
            client_id: Arc::from(if id.is_empty() { "voidhttp" } else { id }),
            sasl,
            tls: r.tls,
            insecure: r.insecure,
            acks: match r.acks {
                0 => 0,
                1 => 1,
                _ => -1,
            },
            compression,
            timeout: if r.timeout_ms > 0 { Duration::from_millis(r.timeout_ms) } else { DEFAULT_TIMEOUT },
        })
    }

    fn sasl_label(&self) -> Option<String> {
        self.sasl.as_ref().map(|(m, _, _)| m.to_ascii_uppercase())
    }

    fn sasl_config(&self) -> Option<SaslConfig> {
        let (m, u, p) = self.sasl.as_ref()?;
        let c = Credentials::new(u.clone(), p.clone());
        Some(match m.as_str() {
            "plain" => SaslConfig::Plain(c),
            "scram-sha-256" => SaslConfig::ScramSha256(c),
            _ => SaslConfig::ScramSha512(c),
        })
    }
}

/// Why a connection to one broker failed, and at which step.
struct Failure {
    stage: &'static str,
    broker: Option<String>,
    message: String,
    hint: Option<String>,
    topics: Vec<String>,
}

impl Failure {
    fn new(stage: &'static str, broker: Option<String>, message: impl Into<String>, hint: Option<String>) -> Self {
        Self { stage, broker, message: message.into(), hint, topics: Vec::new() }
    }

    fn event(self, started: Instant) -> KafkaEvent {
        KafkaEvent::Failed {
            stage: self.stage,
            broker: self.broker,
            message: self.message,
            hint: self.hint,
            topics: self.topics,
            elapsed_ms: started.elapsed().as_millis() as u64,
        }
    }
}

/// One broker connection: TCP through Settings > Network, TLS with Settings > Certificates,
/// the API version handshake, then the SASL login.
async fn open(opts: &Opts, host: &str, port: u16) -> Result<Conn, Failure> {
    let addr = format!("{host}:{port}");
    let step = |stage: &'static str, e: String| Failure::new(stage, Some(addr.clone()), e.clone(), hint_for(stage, &e, opts, host));
    let within = |what: &str| format!("Timed out after {} ms {what}", opts.timeout.as_millis());

    let tcp = tokio::time::timeout(opts.timeout, crate::net::current().connect(host, port))
        .await
        .map_err(|_| step("connect", within("connecting")))?
        .map_err(|e| step("connect", e.to_string()))?;
    let _ = tcp.set_nodelay(true);
    let io: Box<dyn Io> = if opts.tls {
        let config = crate::certs::tls_config(opts.insecure, host, port).map_err(|e| step("tls", e))?;
        let name = rustls::pki_types::ServerName::try_from(host.trim_matches(['[', ']']).to_string()).map_err(|e| step("tls", e.to_string()))?;
        let tls = tokio::time::timeout(opts.timeout, tokio_rustls::TlsConnector::from(Arc::new(config)).connect(name, tcp))
            .await
            .map_err(|_| step("tls", within("in the TLS handshake")))?
            .map_err(|e| step("tls", e.to_string()))?;
        Box::new(tls)
    } else {
        Box::new(tcp)
    };

    let mut m = Messenger::new(io, MAX_FRAME, opts.client_id.clone());
    tokio::time::timeout(opts.timeout, m.sync_versions())
        .await
        .map_err(|_| step("connect", within("waiting for the broker to answer")))?
        .map_err(|e| step("connect", e.to_string()))?;
    if let Some(sasl) = opts.sasl_config() {
        tokio::time::timeout(opts.timeout, m.do_sasl(sasl))
            .await
            .map_err(|_| step("sasl", within("in the SASL login")))?
            .map_err(|e| step("sasl", e.to_string()))?;
    }
    Ok(Arc::new(m))
}

/// What to do about a failure, in plain words.
fn hint_for(stage: &str, e: &str, opts: &Opts, host: &str) -> Option<String> {
    let lower = e.to_ascii_lowercase();
    match stage {
        "tls" => {
            if lower.contains("corrupt") || lower.contains("invalidcontenttype") || lower.contains("record overflow") {
                Some("The broker doesn't speak TLS on this port. Turn TLS off in Auth, or use the broker's TLS port.".into())
            } else {
                crate::certs::tls_hint(e).map(str::to_string)
            }
        }
        "sasl" => Some(if e.contains("SaslAuthenticationFailed") {
            "The connection worked; the username or password did not.".into()
        } else if lower.contains("unsupported sasl mechanism") || e.contains("UnsupportedSaslMechanism") {
            format!("The broker doesn't offer {}. Pick the mechanism the cluster uses in Auth.", opts.sasl_label().unwrap_or_default())
        } else if e.contains("IllegalSaslState") {
            "The broker isn't set up for SASL on this port. Set the mechanism to None in Auth, or use the SASL port.".into()
        } else {
            "The SASL login did not finish. Check the mechanism, username and password in Auth.".into()
        }),
        _ => {
            if lower.contains("refused") {
                Some("Nothing is listening there. Check the host and port of the broker.".into())
            } else if lower.contains("not found") || lower.contains("nodename") || lower.contains("no address") || lower.contains("failed to lookup") {
                Some(if host.contains('.') {
                    "The name doesn't resolve from this Mac. Intranet hosts need the VPN, or add the domain to Settings › Network › Always use system DNS for.".into()
                } else {
                    "The name doesn't resolve from this Mac. A name like this is often a Docker container name.".into()
                })
            } else if !opts.tls && (lower.contains("eof") || lower.contains("reset") || lower.contains("too large") || lower.contains("poisoned")) {
                Some("The broker closed the connection. It may want TLS or a SASL login: check Auth.".into())
            } else if opts.tls && (lower.contains("eof") || lower.contains("reset")) && opts.sasl.is_none() {
                Some("The broker closed the connection. It may want a SASL login: check Auth.".into())
            } else {
                None
            }
        }
    }
}

/// host:port list from what was typed. A missing port means 9092.
fn parse_brokers(raw: &str) -> Result<Vec<(String, u16)>, String> {
    let mut out = Vec::new();
    for part in raw.split([',', ' ', '\n', '\t', ';']).map(str::trim).filter(|s| !s.is_empty()) {
        let part = part.trim_start_matches("kafka://").trim_start_matches("PLAINTEXT://").trim_start_matches("SSL://").trim_end_matches('/');
        let (host, port) = if let Some(rest) = part.strip_prefix('[') {
            // [v6]:port
            let (h, p) = rest.split_once(']').ok_or_else(|| format!("Bad broker address: {part}"))?;
            (h.to_string(), p.trim_start_matches(':'))
        } else {
            match part.rsplit_once(':') {
                Some((h, p)) if !h.contains(':') => (h.to_string(), p),
                _ => (part.to_string(), ""),
            }
        };
        let port = if port.is_empty() { 9092 } else { port.parse::<u16>().map_err(|_| format!("Bad port in broker address: {part}"))? };
        if host.is_empty() {
            return Err(format!("Bad broker address: {part}"));
        }
        out.push((host, port));
    }
    if out.is_empty() {
        return Err("Enter at least one broker, host:port".into());
    }
    Ok(out)
}

// ---------- the session ----------

struct Leader {
    partition: i32,
    leader: i32,
}

struct Session {
    opts: Arc<Opts>,
    bootstraps: Vec<(String, u16)>,
    /// the connection metadata comes from, and its host:port
    meta: (Conn, String),
    brokers: HashMap<i32, (String, u16)>,
    conns: HashMap<i32, Conn>,
    topic: String,
    leaders: Vec<Leader>,
    /// where the next fetch of each partition starts; a partition not here is not read
    positions: BTreeMap<i32, i64>,
    paused: bool,
    /// produce without a key and without a partition: round robin
    rr: usize,
    started: Instant,
}

impl Session {
    async fn start(opts: Arc<Opts>, bootstraps: Vec<(String, u16)>, topic: String, from: Seek) -> Result<(Self, Cluster), Failure> {
        let meta = Self::bootstrap(&opts, &bootstraps).await?;
        let mut s = Self {
            opts,
            bootstraps,
            meta,
            brokers: HashMap::new(),
            conns: HashMap::new(),
            topic,
            leaders: Vec::new(),
            positions: BTreeMap::new(),
            paused: false,
            rr: 0,
            started: Instant::now(),
        };
        let cluster = s.refresh().await?;
        s.seek(&from, &cluster).await.map_err(|e| Failure::new("topic", None, e, None))?;
        s.started = Instant::now();
        Ok((s, cluster))
    }

    /// The first bootstrap broker that answers. Every failure is kept for the message.
    async fn bootstrap(opts: &Opts, bootstraps: &[(String, u16)]) -> Result<(Conn, String), Failure> {
        let mut last: Option<Failure> = None;
        for (host, port) in bootstraps {
            match open(opts, host, *port).await {
                Ok(c) => return Ok((c, format!("{host}:{port}"))),
                // a refused login won't get better on the next broker
                Err(f) if f.stage == "sasl" => return Err(f),
                Err(f) => last = Some(f),
            }
        }
        Err(last.unwrap_or_else(|| Failure::new("connect", None, "No broker to connect to", None)))
    }

    /// Metadata for every topic: no topic is named, so none is ever created on the way.
    async fn metadata(&mut self) -> Result<MetadataResponse, Failure> {
        let req = MetadataRequest { topics: None, allow_auto_topic_creation: None };
        if let Ok(Ok(r)) = tokio::time::timeout(self.opts.timeout, self.meta.0.request(req)).await {
            return Ok(r);
        }
        // the metadata broker went away: any bootstrap broker will do
        self.meta = Self::bootstrap(&self.opts, &self.bootstraps).await?;
        let req = MetadataRequest { topics: None, allow_auto_topic_creation: None };
        tokio::time::timeout(self.opts.timeout, self.meta.0.request(req))
            .await
            .map_err(|_| Failure::new("connect", Some(self.meta.1.clone()), "Timed out waiting for metadata", None))?
            .map_err(|e| Failure::new("connect", Some(self.meta.1.clone()), e.to_string(), None))
    }

    /// Metadata, a connection to every leader of the topic, and each partition's offsets.
    async fn refresh(&mut self) -> Result<Cluster, Failure> {
        let md = self.metadata().await?;
        self.brokers = md.brokers.iter().map(|b| (b.node_id.0, (b.host.0.clone(), b.port.0 as u16))).collect();
        let mut topics: Vec<String> = md
            .topics
            .iter()
            .filter(|t| !matches!(t.is_internal, Some(Boolean(true))) && !t.name.0.starts_with("__"))
            .map(|t| t.name.0.clone())
            .collect();
        topics.sort();
        let Some(t) = md.topics.iter().find(|t| t.name.0 == self.topic) else {
            let mut f = Failure::new(
                "topic",
                None,
                format!("Topic {} doesn't exist on this cluster", self.topic),
                Some("Check the topic name. voidHTTP never creates topics.".into()),
            );
            f.topics = topics;
            return Err(f);
        };
        if let Some(e) = &t.error {
            let hint = match e {
                ApiError::TopicAuthorizationFailed => Some(format!("This user may not read {}.", self.topic)),
                ApiError::UnknownTopicOrPartition => Some("Check the topic name. voidHTTP never creates topics.".into()),
                _ => None,
            };
            let mut f = Failure::new("topic", None, format!("{}: {e}", self.topic), hint);
            f.topics = topics;
            return Err(f);
        }

        let mut parts: Vec<PartitionInfo> = t
            .partitions
            .iter()
            .map(|p| PartitionInfo {
                partition: p.partition_index.0,
                leader: p.leader_id.0,
                replicas: p.replica_nodes.0.clone().unwrap_or_default().into_iter().map(|x| x.0).collect(),
                isr: p.isr_nodes.0.clone().unwrap_or_default().into_iter().map(|x| x.0).collect(),
                earliest: None,
                latest: None,
                error: p.error.as_ref().map(|e| e.to_string()),
            })
            .collect();
        parts.sort_by_key(|p| p.partition);
        self.leaders = parts.iter().filter(|p| p.leader >= 0).map(|p| Leader { partition: p.partition, leader: p.leader }).collect();

        // a connection to every leader now, so an unreachable advertised address shows up front
        let mut ids: Vec<i32> = self.leaders.iter().map(|l| l.leader).collect();
        ids.sort();
        ids.dedup();
        for id in ids {
            self.conn(id).await?;
        }

        let earliest = self.offsets(-2, &parts.iter().map(|p| p.partition).collect::<Vec<_>>()).await;
        let latest = self.offsets(-1, &parts.iter().map(|p| p.partition).collect::<Vec<_>>()).await;
        for p in &mut parts {
            p.earliest = earliest.get(&p.partition).copied();
            p.latest = latest.get(&p.partition).copied();
        }

        let mut brokers: Vec<Broker> = md
            .brokers
            .iter()
            .map(|b| Broker { id: b.node_id.0, host: b.host.0.clone(), port: b.port.0, rack: b.rack.as_ref().and_then(|r| r.0.clone()) })
            .collect();
        brokers.sort_by_key(|b| b.id);
        Ok(Cluster {
            cluster_id: md.cluster_id.and_then(|c| c.0),
            controller_id: md.controller_id.map(|c| c.0).filter(|c| *c >= 0),
            brokers,
            topic: self.topic.clone(),
            partitions: parts,
            topics,
            bootstrap: self.meta.1.clone(),
            sasl: self.opts.sasl_label(),
            tls: self.opts.tls,
        })
    }

    /// The connection to broker `id`, opened on first use.
    async fn conn(&mut self, id: i32) -> Result<Conn, Failure> {
        if let Some(c) = self.conns.get(&id) {
            return Ok(c.clone());
        }
        let (host, port) = self.brokers.get(&id).cloned().ok_or_else(|| Failure::new("broker", None, format!("Broker {id} is not in the metadata"), None))?;
        match open(&self.opts, &host, port).await {
            Ok(c) => {
                self.conns.insert(id, c.clone());
                Ok(c)
            }
            Err(mut f) => {
                if f.stage == "connect" {
                    // the cluster answered, so this is the address the broker advertises
                    f.stage = "broker";
                    f.broker = Some(format!("{id} · {host}:{port}"));
                    let why = "Kafka clients talk to each broker at the address it advertises, not the one you typed.";
                    let fix = if host.contains('.') {
                        format!("Broker {id} advertises {host}:{port}. Connect over the VPN, or add its domain to Settings › Network › Always use system DNS for.")
                    } else {
                        format!("Broker {id} advertises {host}:{port}, likely a Docker container name. Set the broker's advertised listener to an address this Mac reaches, such as localhost:9092.")
                    };
                    f.hint = Some(format!("{why} {fix}"));
                }
                Err(f)
            }
        }
    }

    /// ListOffsets for the given partitions: -2 earliest, -1 latest, else the first offset at or after that time.
    /// A partition whose leader can't answer is left out.
    async fn offsets(&mut self, at: i64, partitions: &[i32]) -> HashMap<i32, i64> {
        let mut by_leader: HashMap<i32, Vec<i32>> = HashMap::new();
        for l in &self.leaders {
            if partitions.contains(&l.partition) {
                by_leader.entry(l.leader).or_default().push(l.partition);
            }
        }
        let mut out = HashMap::new();
        for (leader, parts) in by_leader {
            let Ok(conn) = self.conn(leader).await else { continue };
            let req = ListOffsetsRequest {
                replica_id: NORMAL_CONSUMER,
                isolation_level: Some(IsolationLevel::ReadCommitted),
                topics: vec![ListOffsetsRequestTopic {
                    name: String_(self.topic.clone()),
                    partitions: parts
                        .iter()
                        .map(|p| ListOffsetsRequestPartition { partition_index: Int32(*p), timestamp: Int64(at), max_num_offsets: Some(Int32(1)) })
                        .collect(),
                }],
            };
            let Ok(Ok(res)) = tokio::time::timeout(self.opts.timeout, conn.request(req)).await else {
                self.conns.remove(&leader);
                continue;
            };
            for t in res.topics {
                for p in t.partitions {
                    if p.error_code.is_some() {
                        continue;
                    }
                    let offset = p.offset.map(|o| o.0).or_else(|| p.old_style_offsets.and_then(|a| a.0).and_then(|v| v.first().map(|o| o.0)));
                    if let Some(o) = offset {
                        out.insert(p.partition_index.0, o);
                    }
                }
            }
        }
        out
    }

    /// Sets where each partition is read from.
    async fn seek(&mut self, from: &Seek, cluster: &Cluster) -> Result<(), String> {
        let all: Vec<i32> = cluster.partitions.iter().map(|p| p.partition).collect();
        let earliest: HashMap<i32, i64> = cluster.partitions.iter().filter_map(|p| Some((p.partition, p.earliest?))).collect();
        let latest: HashMap<i32, i64> = cluster.partitions.iter().filter_map(|p| Some((p.partition, p.latest?))).collect();
        self.positions.clear();
        match from {
            Seek::Latest => self.positions.extend(latest),
            Seek::Earliest => self.positions.extend(earliest),
            Seek::Last { n } => {
                for (p, l) in &latest {
                    let lo = earliest.get(p).copied().unwrap_or(0);
                    self.positions.insert(*p, (l - n.max(&0)).max(lo));
                }
            }
            Seek::Time { ms } => {
                let found = self.offsets(*ms, &all).await;
                for p in &all {
                    // -1: nothing at or after that time, so start at the end
                    match found.get(p) {
                        Some(o) if *o >= 0 => {
                            self.positions.insert(*p, *o);
                        }
                        _ => {
                            if let Some(l) = latest.get(p) {
                                self.positions.insert(*p, *l);
                            }
                        }
                    }
                }
            }
            Seek::Offset { partition, offset } => {
                if !all.contains(partition) {
                    return Err(format!("{} has no partition {partition}", self.topic));
                }
                let lo = earliest.get(partition).copied().unwrap_or(0);
                let hi = latest.get(partition).copied().unwrap_or(*offset);
                self.positions.insert(*partition, (*offset).clamp(lo, hi.max(lo)));
            }
        }
        Ok(())
    }

    fn at_ms(&self) -> u64 {
        self.started.elapsed().as_millis() as u64
    }

    async fn run(&mut self, rx: &mut mpsc::Receiver<Cmd>, out: &IpcChannel<KafkaEvent>) {
        let mut fails = 0u32;
        loop {
            if self.paused || self.positions.is_empty() {
                // nothing to fetch: wait for a command, and while paused count what is piling up
                let tick = tokio::time::sleep(if self.paused { PAUSED_TICK } else { Duration::from_secs(3600) });
                tokio::select! {
                    cmd = rx.recv() => {
                        if !self.command(cmd, out).await {
                            return;
                        }
                    }
                    _ = tick => {
                        if self.paused {
                            let parts: Vec<i32> = self.positions.keys().copied().collect();
                            let latest = self.offsets(-1, &parts).await;
                            let count: i64 = self.positions.iter().map(|(p, pos)| (latest.get(p).copied().unwrap_or(*pos) - pos).max(0)).sum();
                            let _ = out.send(KafkaEvent::Waiting { count });
                        }
                    }
                }
                continue;
            }

            let round = fetch_all(self.fetch_jobs(), self.topic.clone(), self.opts.timeout + Duration::from_millis(FETCH_WAIT_MS as u64));
            tokio::pin!(round);
            let step = loop {
                tokio::select! {
                    res = &mut round => break Step::Fetched(res),
                    cmd = rx.recv() => {
                        // produce while a fetch runs; a seek, pause, refresh or close drops the fetch,
                        // whose records would land in the wrong place
                        match cmd {
                            Some(Cmd::Produce(p)) => self.produce(p, out),
                            other => break Step::Command(other),
                        }
                    }
                }
            };
            match step {
                Step::Fetched(Ok(parts)) => {
                    fails = 0;
                    self.take(parts, out).await;
                }
                Step::Fetched(Err(e)) => {
                    fails += 1;
                    if fails >= MAX_FAILS {
                        let _ = out.send(KafkaEvent::Close { by: "lost", reason: e, elapsed_ms: self.at_ms() });
                        return;
                    }
                    // a leader moved or a connection dropped: look again
                    self.conns.clear();
                    tokio::time::sleep(Duration::from_millis(300 * fails as u64)).await;
                    if let Err(f) = self.refresh().await {
                        let _ = out.send(KafkaEvent::Close { by: "lost", reason: f.message, elapsed_ms: self.at_ms() });
                        return;
                    }
                }
                Step::Command(cmd) => {
                    if !self.command(cmd, out).await {
                        return;
                    }
                }
            }
        }
    }

    /// What one fetch round asks each leader for: its partitions and where they stand.
    fn fetch_jobs(&self) -> Vec<FetchJob> {
        let mut by_leader: HashMap<i32, Vec<(i32, i64)>> = HashMap::new();
        for l in &self.leaders {
            if let Some(pos) = self.positions.get(&l.partition) {
                by_leader.entry(l.leader).or_default().push((l.partition, *pos));
            }
        }
        by_leader.into_iter().map(|(id, parts)| (id, self.conns.get(&id).cloned(), parts)).collect()
    }

    /// Records of one fetch round onto the channel; each partition moves past what it got.
    async fn take(&mut self, parts: Vec<FetchResponsePartition>, out: &IpcChannel<KafkaEvent>) {
        let at_ms = self.at_ms();
        let mut reset = Vec::new();
        let mut moved = false;
        for p in parts {
            let partition = p.partition_index.0;
            let Some(&from) = self.positions.get(&partition) else { continue };
            match p.error_code {
                // retention removed what we were about to read: start at what is kept
                Some(ApiError::OffsetOutOfRange) => {
                    reset.push(partition);
                    continue;
                }
                Some(ApiError::NotLeaderOrFollower) | Some(ApiError::LeaderNotAvailable) | Some(ApiError::FencedLeaderEpoch) | Some(ApiError::UnknownTopicOrPartition) => {
                    moved = true;
                    continue;
                }
                Some(_) => continue,
                None => {}
            }
            let mut next = from;
            for batch in p.records.0 {
                let RecordBatch { base_offset, first_timestamp, records, .. } = batch;
                let ControlBatchOrRecords::Records(records) = records else {
                    // a transaction marker: nothing to show, but it takes an offset
                    next = next.max(base_offset + 1);
                    continue;
                };
                for r in records {
                    let offset = base_offset + r.offset_delta as i64;
                    if offset < from {
                        continue;
                    }
                    next = next.max(offset + 1);
                    let _ = out.send(record_event("in", partition, Some(offset), Some(first_timestamp + r.timestamp_delta), r, None, at_ms));
                }
            }
            self.positions.insert(partition, next);
        }
        if !reset.is_empty() {
            let earliest = self.offsets(-2, &reset).await;
            for p in reset {
                if let Some(o) = earliest.get(&p) {
                    self.positions.insert(p, *o);
                }
            }
        }
        if moved {
            self.conns.clear();
            let _ = self.refresh().await;
        }
    }

    /// Commands that change what is read. False when the session ends.
    async fn command(&mut self, cmd: Option<Cmd>, out: &IpcChannel<KafkaEvent>) -> bool {
        match cmd {
            Some(Cmd::Seek(from)) => {
                match self.refresh().await {
                    Ok(cluster) => match self.seek(&from, &cluster).await {
                        Ok(()) => {
                            // reading starts over, so a pause ends too
                            self.paused = false;
                            let _ = out.send(KafkaEvent::Topic { cluster });
                            let _ = out.send(KafkaEvent::Seeked { from, at_ms: self.at_ms() });
                        }
                        Err(message) => {
                            // reading carries on where it was
                            let _ = out.send(KafkaEvent::Notice { message });
                        }
                    },
                    Err(f) => {
                        let _ = out.send(KafkaEvent::Close { by: "lost", reason: f.message, elapsed_ms: self.at_ms() });
                        return false;
                    }
                }
                true
            }
            Some(Cmd::Pause(paused)) => {
                self.paused = paused;
                let _ = out.send(KafkaEvent::Paused { paused, at_ms: self.at_ms() });
                true
            }
            Some(Cmd::Refresh) => {
                match self.refresh().await {
                    Ok(cluster) => {
                        let _ = out.send(KafkaEvent::Topic { cluster });
                    }
                    Err(f) => {
                        let _ = out.send(KafkaEvent::Close { by: "lost", reason: f.message, elapsed_ms: self.at_ms() });
                        return false;
                    }
                }
                true
            }
            other => self.command_now(other, out),
        }
    }

    /// Commands that never wait on the broker here: produce (it runs on its own) and close.
    fn command_now(&mut self, cmd: Option<Cmd>, out: &IpcChannel<KafkaEvent>) -> bool {
        match cmd {
            Some(Cmd::Produce(p)) => {
                self.produce(p, out);
                true
            }
            Some(Cmd::Pause(paused)) => {
                self.paused = paused;
                let _ = out.send(KafkaEvent::Paused { paused, at_ms: self.at_ms() });
                true
            }
            Some(Cmd::Close) | None => {
                let _ = out.send(KafkaEvent::Close { by: "client", reason: "Disconnected".into(), elapsed_ms: self.at_ms() });
                false
            }
            // handled by `command`
            Some(Cmd::Seek(_)) | Some(Cmd::Refresh) => true,
        }
    }

    /// Shows the record as sent, then produces it on its own task; the ack (or the error) follows.
    fn produce(&mut self, p: Produce, out: &IpcChannel<KafkaEvent>) {
        let at_ms = self.at_ms();
        let key = match p.key.as_deref().map(|k| base64::engine::general_purpose::STANDARD.decode(k)) {
            Some(Ok(k)) => Some(k),
            Some(Err(_)) => {
                let _ = out.send(ack_event(p.seq, -1, None, None, Some("The key is not valid base64".into()), self.opts.acks, at_ms));
                return;
            }
            None => None,
        };
        let n = self.leaders.len().max(1);
        let partition = match p.partition {
            Some(x) => x,
            None => match &key {
                Some(k) => ((murmur2(k) & 0x7fff_ffff) as usize % n) as i32,
                None => {
                    self.rr = self.rr.wrapping_add(1);
                    (self.rr % n) as i32
                }
            },
        };
        let value = p.value.map(String::into_bytes);
        let headers: Vec<(String, Vec<u8>)> = p.headers.into_iter().filter(|h| !h.key.is_empty()).map(|h| (h.key, h.value.into_bytes())).collect();
        let build = || WireRecord {
            timestamp_delta: 0,
            offset_delta: 0,
            key: key.clone(),
            value: value.clone(),
            headers: headers.iter().map(|(k, v)| RecordHeader { key: k.clone(), value: v.clone() }).collect(),
        };
        let record = build();
        let now = chrono_now_ms();
        let _ = out.send(record_event("out", partition, None, Some(now), build(), Some(p.seq), at_ms));

        let leader = self.leaders.iter().find(|l| l.partition == partition).map(|l| l.leader);
        let conn = leader.and_then(|l| self.conns.get(&l).cloned());
        let (seq, acks, topic, compression, timeout, out, started) =
            (p.seq, self.opts.acks, self.topic.clone(), self.opts.compression, self.opts.timeout, out.clone(), self.started);
        let Some(conn) = conn else {
            let msg = if leader.is_none() { format!("{topic} has no partition {partition}") } else { format!("No connection to the leader of partition {partition}") };
            let _ = out.send(ack_event(seq, partition, None, None, Some(msg), acks, at_ms));
            return;
        };
        tokio::spawn(async move {
            let sent = Instant::now();
            let req = ProduceRequest {
                transactional_id: NullableString(None),
                acks: Int16(acks),
                timeout_ms: Int32(timeout.as_millis().min(i32::MAX as u128) as i32),
                topic_data: vec![ProduceRequestTopicData {
                    name: String_(topic),
                    partition_data: vec![ProduceRequestPartitionData {
                        index: Int32(partition),
                        records: Records(vec![RecordBatch {
                            base_offset: 0,
                            partition_leader_epoch: 0,
                            last_offset_delta: 0,
                            first_timestamp: now,
                            max_timestamp: now,
                            producer_id: -1,
                            producer_epoch: -1,
                            base_sequence: -1,
                            records: ControlBatchOrRecords::Records(vec![record]),
                            compression,
                            is_transactional: false,
                            timestamp_type: RecordBatchTimestampType::CreateTime,
                        }]),
                    }],
                }],
            };
            let at = || started.elapsed().as_millis() as u64;
            if acks == 0 {
                // no answer comes with acks 0: the record is on the wire, that's all we learn
                let _ = tokio::time::timeout(Duration::from_millis(200), conn.request(req)).await;
                let _ = out.send(ack_event(seq, partition, None, Some(sent.elapsed().as_millis() as u64), None, acks, at()));
                return;
            }
            let res = tokio::time::timeout(timeout, conn.request(req)).await;
            let ms = Some(sent.elapsed().as_millis() as u64);
            let ev = match res {
                Err(_) => ack_event(seq, partition, None, ms, Some(format!("No answer within {} ms", timeout.as_millis())), acks, at()),
                Ok(Err(e)) => ack_event(seq, partition, None, ms, Some(e.to_string()), acks, at()),
                Ok(Ok(r)) => {
                    let p = r.responses.into_iter().flat_map(|t| t.partition_responses).next();
                    match p {
                        Some(p) if p.error.is_none() => ack_event(seq, partition, Some(p.base_offset.0), ms, None, acks, at()),
                        Some(p) => ack_event(seq, partition, None, ms, Some(produce_error(p.error.unwrap())), acks, at()),
                        None => ack_event(seq, partition, None, ms, Some("The broker answered without the partition".into()), acks, at()),
                    }
                }
            };
            let _ = out.send(ev);
        });
    }
}

enum Step {
    Fetched(Result<Vec<FetchResponsePartition>, String>),
    Command(Option<Cmd>),
}

/// One fetch per leader, all at once. Err when a leader could not be asked at all.
async fn fetch_all(jobs: Vec<FetchJob>, topic: String, timeout: Duration) -> Result<Vec<FetchResponsePartition>, String> {
    let calls = jobs.into_iter().map(|(id, conn, parts)| {
        let topic = topic.clone();
        async move {
            let conn = conn.ok_or_else(|| format!("No connection to broker {id}"))?;
            let req = FetchRequest {
                replica_id: NORMAL_CONSUMER,
                max_wait_ms: Int32(FETCH_WAIT_MS),
                min_bytes: Int32(1),
                max_bytes: Some(Int32(FETCH_BYTES)),
                isolation_level: Some(IsolationLevel::ReadCommitted),
                topics: vec![FetchRequestTopic {
                    topic: String_(topic),
                    partitions: parts
                        .iter()
                        .map(|(p, o)| FetchRequestPartition { partition: Int32(*p), fetch_offset: Int64(*o), partition_max_bytes: Int32(PARTITION_BYTES) })
                        .collect(),
                }],
            };
            let res = tokio::time::timeout(timeout, conn.request(req))
                .await
                .map_err(|_| format!("Broker {id} stopped answering"))?
                .map_err(|e| format!("Broker {id}: {e}"))?;
            Ok::<_, String>(res.responses.into_iter().flat_map(|t| t.partitions).collect::<Vec<_>>())
        }
    });
    let mut all = Vec::new();
    for r in futures_util::future::join_all(calls).await {
        all.extend(r?);
    }
    Ok(all)
}

fn produce_error(e: ApiError) -> String {
    match e {
        ApiError::NotEnoughReplicas | ApiError::NotEnoughReplicasAfterAppend => format!("{e}: fewer in-sync replicas than the topic's min.insync.replicas. Try Acks: Leader."),
        ApiError::MessageTooLarge | ApiError::RecordListTooLarge => format!("{e}: the record is bigger than the topic allows"),
        ApiError::TopicAuthorizationFailed => format!("{e}: this user may not write to the topic"),
        other => other.to_string(),
    }
}

fn chrono_now_ms() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

/// Text when the bytes are UTF-8, else base64 and a flag.
fn show(bytes: &[u8]) -> (String, bool) {
    match std::str::from_utf8(bytes) {
        Ok(s) => (s.to_string(), false),
        Err(_) => (base64::engine::general_purpose::STANDARD.encode(bytes), true),
    }
}

fn record_event(dir: &'static str, partition: i32, offset: Option<i64>, ts: Option<i64>, r: WireRecord, ack_id: Option<u64>, at_ms: u64) -> KafkaEvent {
    let size = r.key.as_ref().map_or(0, Vec::len) + r.value.as_ref().map_or(0, Vec::len) + r.headers.iter().map(|h| h.key.len() + h.value.len()).sum::<usize>();
    let (key, key_bin) = match &r.key {
        Some(k) => {
            let (s, b) = show(k);
            (Some(s), b)
        }
        None => (None, false),
    };
    let (data, value_bin) = r.value.as_deref().map(show).unwrap_or_default();
    KafkaEvent::Message {
        dir,
        kind: "record",
        partition,
        offset,
        ts,
        key,
        key_bin,
        data,
        value_bin,
        value_null: r.value.is_none(),
        headers: r
            .headers
            .into_iter()
            .map(|h| {
                let (value, bin) = show(&h.value);
                Header { key: h.key, value, bin }
            })
            .collect(),
        ack_id,
        ack_ms: None,
        acks: None,
        error: None,
        size,
        at_ms,
    }
}

fn ack_event(seq: u64, partition: i32, offset: Option<i64>, ms: Option<u64>, error: Option<String>, acks: i16, at_ms: u64) -> KafkaEvent {
    KafkaEvent::Message {
        dir: "in",
        kind: "ack",
        partition,
        offset,
        ts: None,
        key: None,
        key_bin: false,
        data: String::new(),
        value_bin: false,
        value_null: false,
        headers: Vec::new(),
        ack_id: Some(seq),
        ack_ms: ms,
        acks: Some(acks),
        error,
        size: 0,
        at_ms,
    }
}

/// Kafka's default partitioner hash (murmur2, as in the Java client), so a key lands on the
/// partition the services producing it would pick.
fn murmur2(data: &[u8]) -> i32 {
    const SEED: u32 = 0x9747_b28c;
    const M: u32 = 0x5bd1_e995;
    const R: u32 = 24;
    let len = data.len();
    let mut h: u32 = SEED ^ (len as u32);
    let chunks = len / 4;
    for i in 0..chunks {
        let j = i * 4;
        let mut k = u32::from_le_bytes([data[j], data[j + 1], data[j + 2], data[j + 3]]);
        k = k.wrapping_mul(M);
        k ^= k >> R;
        k = k.wrapping_mul(M);
        h = h.wrapping_mul(M);
        h ^= k;
    }
    let tail = chunks * 4;
    let rest = len % 4;
    if rest == 3 {
        h ^= (data[tail + 2] as u32) << 16;
    }
    if rest >= 2 {
        h ^= (data[tail + 1] as u32) << 8;
    }
    if rest >= 1 {
        h ^= data[tail] as u32;
        h = h.wrapping_mul(M);
    }
    h ^= h >> 13;
    h = h.wrapping_mul(M);
    h ^= h >> 15;
    h as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn murmur2_matches_the_java_client() {
        // vectors from Kafka's UtilsTest
        assert_eq!(murmur2(b"21"), -973932308);
        assert_eq!(murmur2(b"foobar"), -790332482);
        assert_eq!(murmur2(b"a-little-bit-long-string"), -985981536);
        assert_eq!(murmur2(b"a-little-bit-longer-string"), -1486304829);
        assert_eq!(murmur2(b"lkjh234lh9fiuh90y23oiuhsafujhadof229phr9h19h89h8"), -58897971);
        assert_eq!(murmur2(b"abc"), 479470107);
    }

    #[test]
    fn broker_lists() {
        assert_eq!(parse_brokers("a:9092, b:9093").unwrap(), vec![("a".into(), 9092), ("b".into(), 9093)]);
        assert_eq!(parse_brokers("localhost").unwrap(), vec![("localhost".into(), 9092)]);
        assert_eq!(parse_brokers("kafka://b-1.x.internal:9096\nSSL://b-2:9094").unwrap(), vec![("b-1.x.internal".into(), 9096), ("b-2".into(), 9094)]);
        assert_eq!(parse_brokers("[::1]:9092").unwrap(), vec![("::1".into(), 9092)]);
        assert!(parse_brokers("  ").is_err());
        assert!(parse_brokers("a:port").is_err());
    }

    #[test]
    fn text_or_base64() {
        assert_eq!(show(b"hello"), ("hello".to_string(), false));
        assert_eq!(show(&[0xff, 0x00]), ("/wA=".to_string(), true));
    }
}
