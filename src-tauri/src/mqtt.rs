//! MQTT client. One connection per tab: `mqtt_connect` connects, subscribes to the Topics list and
//! runs until Disconnect; messages, acks and subscription answers arrive on an IPC channel.
//! `mqtt_publish`, `mqtt_subscriptions` (the whole Topics list; the difference is subscribed or
//! unsubscribed) and `mqtt_close` reach the running connection through a queue.
//!
//! MQTT 3.1.1 and 5.0 over TCP, TLS, WebSocket and secure WebSocket. The packets are our own
//! (mqtt/packet.rs); the connections come from Settings > Network (secure DNS, proxy) and
//! Settings > Certificates, the same as for HTTP, WebSocket, gRPC and Kafka.

mod packet;

use std::{
    collections::{BTreeMap, HashMap, HashSet},
    io,
    time::Duration,
};

use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel as IpcChannel, State};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt},
    sync::mpsc,
    // tokio's clock, so keep-alive tests can run on paused time
    time::Instant,
};
use tokio_tungstenite::tungstenite::{self, client::IntoClientRequest, Message as WsFrame};

use crate::ws::Conns;
use packet::{Ack, Connect, Disconnect, Packet, Props, Publish, SubOpts, Subscribe, Unsubscribe, Version, Will};

/// Largest packet we take from a broker; MQTT 5 brokers are told so in CONNECT.
const MAX_IN: usize = 64 * 1024 * 1024;
/// Limit when Settings has none (0).
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

// ---------- wire types (camelCase to the webview) ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttRequest {
    /// the connection's id, used to publish, change subscriptions and close
    pub id: String,
    /// mqtt://, mqtts://, ws:// or wss://; host:port alone means mqtt://
    pub url: String,
    /// "5" or "3.1.1"
    #[serde(default)]
    pub version: String,
    /// empty: a random one for this connection
    #[serde(default)]
    pub client_id: String,
    #[serde(default = "yes")]
    pub clean_start: bool,
    /// seconds; 0 turns keep alive off
    #[serde(default = "keep_alive_default")]
    pub keep_alive: u16,
    /// MQTT 5: seconds the broker keeps the session after the connection ends
    #[serde(default)]
    pub session_expiry: u32,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub will: Option<WillRequest>,
    /// subscribed right after the broker accepts the connection
    #[serde(default)]
    pub subs: Vec<SubRequest>,
    /// Settings > Requests > skip TLS verification
    #[serde(default)]
    pub insecure: bool,
    #[serde(default)]
    pub timeout_ms: u64,
}

fn yes() -> bool {
    true
}
fn keep_alive_default() -> u16 {
    60
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WillRequest {
    pub topic: String,
    #[serde(default)]
    pub payload: String,
    #[serde(default)]
    pub qos: u8,
    #[serde(default)]
    pub retain: bool,
    /// MQTT 5: seconds the broker waits before publishing it
    #[serde(default)]
    pub delay: u32,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubRequest {
    pub filter: String,
    #[serde(default)]
    pub qos: u8,
    #[serde(default)]
    pub no_local: bool,
    #[serde(default)]
    pub retain_as_published: bool,
    /// 0 send retained messages, 1 only for a new subscription, 2 never
    #[serde(default)]
    pub retain_handling: u8,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UserProp {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishRequest {
    /// a publish and its ack share this
    pub seq: u64,
    pub topic: String,
    #[serde(default)]
    pub payload: String,
    #[serde(default)]
    pub qos: u8,
    #[serde(default)]
    pub retain: bool,
    /// MQTT 5 properties; empty / None are left out
    #[serde(default)]
    pub content_type: String,
    #[serde(default)]
    pub utf8: Option<bool>,
    #[serde(default)]
    pub message_expiry: Option<u32>,
    #[serde(default)]
    pub response_topic: String,
    #[serde(default)]
    pub correlation: String,
    #[serde(default)]
    pub user: Vec<UserProp>,
}

/// What the broker said about the connection, and what we asked for.
#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ConnInfo {
    /// host:port
    pub broker: String,
    /// the address the name resolved to, when Settings > Network looked it up
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    /// "TCP", "TCP + TLS", "WebSocket", "WebSocket + TLS"
    pub transport: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    pub version: String,
    pub client_id: String,
    /// the client id was made up for this connection (or by the broker)
    pub random_id: bool,
    pub assigned_id: bool,
    pub clean_start: bool,
    pub keep_alive: u16,
    /// the broker set its own keep alive (MQTT 5)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_keep_alive: Option<u16>,
    pub session_expiry: u32,
    pub session_present: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    /// "topic · QoS 1 · retained · delay 5 s"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub will: Option<String>,
    /// CONNACK properties (MQTT 5)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_qos: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retain_available: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wildcards: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shared: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_ids: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub receive_max: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_packet_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topic_alias_max: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_info: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub user: Vec<UserProp>,
    /// ms from Connect until the broker accepted
    pub connect_ms: u64,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubResult {
    pub filter: String,
    /// the QoS asked for
    pub qos: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub granted: Option<u8>,
    /// "0x87 Not authorized", or why it was never sent
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// MQTT 5 properties of a message, as the list shows them.
#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct MsgProps {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub utf8: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_expiry: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_topic: Option<String>,
    /// text, or base64 when `correlation_bin`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation: Option<String>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub correlation_bin: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub user: Vec<UserProp>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub subscription_ids: Vec<u32>,
}

impl MsgProps {
    fn of(p: &Props) -> Option<Self> {
        let (correlation, correlation_bin) = match &p.correlation {
            Some(c) => {
                let (s, bin) = show(c);
                (Some(s), bin)
            }
            None => (None, false),
        };
        let m = MsgProps {
            content_type: p.content_type.clone(),
            utf8: p.payload_format.map(|f| f == 1),
            message_expiry: p.message_expiry,
            response_topic: p.response_topic.clone(),
            correlation,
            correlation_bin,
            user: p.user.iter().map(|(k, v)| UserProp { key: k.clone(), value: v.clone() }).collect(),
            subscription_ids: p.subscription_ids.clone(),
        };
        let empty = m.content_type.is_none() && m.utf8.is_none() && m.message_expiry.is_none() && m.response_topic.is_none() && m.correlation.is_none() && m.user.is_empty() && m.subscription_ids.is_empty();
        (!empty).then_some(m)
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "type")]
pub enum MqttEvent {
    /// the broker accepted the connection
    Connected { info: ConnInfo },
    /// the broker's answer to a SUBSCRIBE, or a filter that could not be sent
    Subscribed { results: Vec<SubResult>, at_ms: u64 },
    Unsubscribed { filters: Vec<String>, at_ms: u64 },
    /// a message received ("in", kind "publish"), one published ("out", kind "publish"),
    /// or the broker's answer to a publish ("in", kind "ack")
    Message {
        dir: &'static str,
        kind: &'static str,
        #[serde(skip_serializing_if = "Option::is_none")]
        topic: Option<String>,
        qos: u8,
        #[serde(skip_serializing_if = "std::ops::Not::not")]
        retain: bool,
        #[serde(skip_serializing_if = "std::ops::Not::not")]
        dup: bool,
        /// the payload: text, or base64 when `value_bin`
        data: String,
        #[serde(skip_serializing_if = "std::ops::Not::not")]
        value_bin: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        props: Option<MsgProps>,
        /// a publish and its ack share this
        #[serde(skip_serializing_if = "Option::is_none")]
        ack_id: Option<u64>,
        /// an ack: how long the broker took
        #[serde(skip_serializing_if = "Option::is_none")]
        ack_ms: Option<u64>,
        /// an ack: "PUBACK", or "PUBREC → PUBCOMP"
        #[serde(skip_serializing_if = "Option::is_none")]
        ack: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        packet_id: Option<u16>,
        /// an ack's reason code when it isn't plain Success, e.g. "0x10 No matching subscribers"
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
        /// an ack: the publish failed
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
        size: usize,
        /// ms since the broker accepted the connection
        at_ms: u64,
    },
    /// the connection never got to the broker's yes; it ends here
    Failed {
        /// "connect", "tls", "ws", "mqtt" (no or a broken answer), "refused" (CONNACK said no)
        stage: &'static str,
        broker: String,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        hint: Option<String>,
        /// the CONNACK code when refused
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<u8>,
        elapsed_ms: u64,
    },
    Close {
        /// "client" (Disconnect), "server" (a DISCONNECT from the broker) or "lost"
        by: &'static str,
        /// the broker's DISCONNECT reason code
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<u8>,
        reason: String,
        /// ms the connection was open
        elapsed_ms: u64,
    },
}

// ---------- state ----------

enum Cmd {
    Publish(PublishRequest),
    Subs(Vec<SubRequest>),
    Close,
}

#[derive(Default)]
pub struct MqttState {
    conns: Conns<Cmd>,
}

// ---------- commands ----------

/// Connects, subscribes, then runs until Disconnect. Err only for input that can't be used
/// (a URL that isn't one); a broker that can't be reached ends with a Failed event instead.
#[tauri::command]
pub async fn mqtt_connect(state: State<'_, MqttState>, request: MqttRequest, on_event: IpcChannel<MqttEvent>) -> Result<(), String> {
    let target = Target::parse(&request.url)?;
    let opts = Opts::from(&request)?;
    let (mut rx, _guard) = state.conns.open(&request.id)?;
    let emit = |e: MqttEvent| {
        let _ = on_event.send(e);
    };
    connect_and_run(&target, &opts, &request.subs, &mut rx, &emit).await;
    Ok(())
}

#[tauri::command]
pub async fn mqtt_publish(state: State<'_, MqttState>, id: String, message: PublishRequest) -> Result<(), String> {
    send(&state, &id, Cmd::Publish(message)).await
}

/// The whole Topics list: what isn't subscribed yet is, what's gone is unsubscribed.
#[tauri::command]
pub async fn mqtt_subscriptions(state: State<'_, MqttState>, id: String, subs: Vec<SubRequest>) -> Result<(), String> {
    send(&state, &id, Cmd::Subs(subs)).await
}

/// Disconnect, or stop a connect still running.
#[tauri::command]
pub async fn mqtt_close(state: State<'_, MqttState>, id: String) -> Result<(), String> {
    if let Some(tx) = state.conns.get(&id) {
        let _ = tx.send(Cmd::Close).await;
    }
    Ok(())
}

async fn send(state: &State<'_, MqttState>, id: &str, cmd: Cmd) -> Result<(), String> {
    let tx = state.conns.get(id).ok_or("The connection is closed")?;
    tx.send(cmd).await.map_err(|_| "The connection is closed".to_string())
}

type Emit<'a> = &'a (dyn Fn(MqttEvent) + Send + Sync);

// ---------- where to connect ----------

#[derive(Debug, Clone, PartialEq, Eq)]
struct Target {
    tls: bool,
    ws: bool,
    host: String,
    port: u16,
    /// WebSocket only: the path and query
    path: String,
}

impl Target {
    fn parse(raw: &str) -> Result<Self, String> {
        let raw = raw.trim();
        if raw.is_empty() {
            return Err("Enter the broker URL, e.g. mqtt://broker.example.com:1883".into());
        }
        let (scheme, rest) = match raw.split_once("://") {
            Some((s, r)) => (s.to_ascii_lowercase(), r),
            None => ("mqtt".to_string(), raw),
        };
        let (tls, ws, port) = match scheme.as_str() {
            "mqtt" | "tcp" => (false, false, 1883),
            "mqtts" | "ssl" | "tls" | "mqtt+ssl" => (true, false, 8883),
            "ws" => (false, true, 80),
            "wss" => (true, true, 443),
            other => return Err(format!("Unknown scheme {other}://. Use mqtt://, mqtts://, ws:// or wss://")),
        };
        // the url crate splits host, port and path; a non-special scheme keeps the port as typed
        let url = url::Url::parse(&format!("{}://{rest}", if ws { scheme.as_str() } else { "mqtt" })).map_err(|e| format!("Not a broker URL: {e}"))?;
        let host = url.host_str().unwrap_or_default().trim_matches(['[', ']']).to_string();
        if host.is_empty() {
            return Err("The broker URL has no host".into());
        }
        let port = url.port().unwrap_or(port);
        // most brokers serve MQTT over WebSocket at /mqtt; a URL with no path at all means that
        let path = if !ws {
            String::new()
        } else if !rest.contains('/') && !rest.contains('?') {
            "/mqtt".into()
        } else {
            match url.query() {
                Some(q) => format!("{}?{q}", url.path()),
                None => url.path().to_string(),
            }
        };
        Ok(Self { tls, ws, host, port, path })
    }

    fn transport(&self) -> &'static str {
        match (self.ws, self.tls) {
            (false, false) => "TCP",
            (false, true) => "TCP + TLS",
            (true, false) => "WebSocket",
            (true, true) => "WebSocket + TLS",
        }
    }

    fn addr(&self) -> String {
        if self.host.contains(':') {
            format!("[{}]:{}", self.host, self.port)
        } else {
            format!("{}:{}", self.host, self.port)
        }
    }
}

// ---------- options ----------

#[derive(Debug, Clone)]
struct Opts {
    version: Version,
    client_id: String,
    random_id: bool,
    clean_start: bool,
    keep_alive: u16,
    session_expiry: u32,
    username: Option<String>,
    password: Option<String>,
    will: Option<Will>,
    insecure: bool,
    timeout: Duration,
}

impl Opts {
    fn from(r: &MqttRequest) -> Result<Self, String> {
        let version = match r.version.trim() {
            "3.1.1" | "3" | "4" => Version::V311,
            _ => Version::V5,
        };
        let id = r.client_id.trim();
        let (client_id, random_id) = if id.is_empty() { (random_client_id(), true) } else { (id.to_string(), false) };
        let username = (!r.username.is_empty()).then(|| r.username.clone());
        let password = (!r.password.is_empty()).then(|| r.password.clone());
        if version == Version::V311 && password.is_some() && username.is_none() {
            return Err("MQTT 3.1.1 sends a password only with a username. Add the username in Auth.".into());
        }
        let long = |what: &str, s: &str| (s.len() > packet::MAX_STR).then(|| format!("{what} is longer than 65 535 bytes, the most MQTT carries"));
        if let Some(e) = long("The client ID", id).or_else(|| long("The username", &r.username)).or_else(|| long("The password", &r.password)) {
            return Err(e);
        }
        if let Some(e) = r.will.as_ref().and_then(|w| long("The Last Will message", &w.payload)) {
            return Err(e);
        }
        let will = match &r.will {
            Some(w) => {
                let topic = w.topic.trim();
                if let Some(p) = packet::topic_name_problem(topic) {
                    return Err(format!("Last Will: {p}"));
                }
                Some(Will {
                    topic: topic.to_string(),
                    payload: w.payload.as_bytes().to_vec(),
                    qos: w.qos.min(2),
                    retain: w.retain,
                    props: Props { will_delay: (version == Version::V5 && w.delay > 0).then_some(w.delay), ..Default::default() },
                })
            }
            None => None,
        };
        Ok(Self {
            version,
            client_id,
            random_id,
            clean_start: r.clean_start,
            keep_alive: r.keep_alive,
            session_expiry: r.session_expiry,
            username,
            password,
            will,
            insecure: r.insecure,
            timeout: if r.timeout_ms > 0 { Duration::from_millis(r.timeout_ms) } else { DEFAULT_TIMEOUT },
        })
    }

    fn connect_packet(&self) -> Packet {
        let v5 = self.version == Version::V5;
        Packet::Connect(Connect {
            version: self.version,
            client_id: self.client_id.clone(),
            clean_start: self.clean_start,
            keep_alive: self.keep_alive,
            username: self.username.clone(),
            password: self.password.as_ref().map(|p| p.as_bytes().to_vec()),
            will: self.will.clone(),
            props: if v5 {
                Props {
                    session_expiry: (self.session_expiry > 0).then_some(self.session_expiry),
                    max_packet_size: Some(MAX_IN as u32),
                    ..Default::default()
                }
            } else {
                Props::default()
            },
        })
    }

    fn will_label(&self) -> Option<String> {
        let w = self.will.as_ref()?;
        let mut s = format!("{} · QoS {}", w.topic, w.qos);
        if w.retain {
            s.push_str(" · retained");
        }
        if let Some(d) = w.props.will_delay {
            s.push_str(&format!(" · delay {d} s"));
        }
        Some(s)
    }
}

/// "voidhttp" and 10 hex digits: letters and digits only, 18 bytes, as strict 3.1.1 brokers want.
fn random_client_id() -> String {
    use std::hash::{BuildHasher, Hasher};
    // RandomState is seeded per process from the OS; mix in the time so two connects differ
    let mut h = std::collections::hash_map::RandomState::new().build_hasher();
    h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
    format!("voidhttp{:010x}", h.finish() & 0xFF_FFFF_FFFF)
}

fn random_u16() -> u16 {
    use std::hash::{BuildHasher, Hasher};
    let mut h = std::collections::hash_map::RandomState::new().build_hasher();
    h.write_u8(0);
    h.finish() as u16
}

// ---------- the link: TCP, TLS, WebSocket ----------

trait Io: AsyncRead + AsyncWrite + Send + Unpin {}
impl<T: AsyncRead + AsyncWrite + Send + Unpin> Io for T {}

enum Link {
    Stream(Box<dyn Io>),
    Ws(Box<tokio_tungstenite::WebSocketStream<Box<dyn Io>>>),
}

impl Link {
    /// Waits for more bytes and adds them to `buf`. Ok(false) when the broker closed the link.
    /// Safe to cancel: a read that hasn't finished took nothing.
    async fn read(&mut self, buf: &mut Vec<u8>) -> io::Result<bool> {
        match self {
            Link::Stream(s) => {
                let mut chunk = [0u8; 16 * 1024];
                let n = s.read(&mut chunk).await?;
                buf.extend_from_slice(&chunk[..n]);
                Ok(n > 0)
            }
            Link::Ws(ws) => loop {
                match ws.next().await {
                    None | Some(Ok(WsFrame::Close(_))) => return Ok(false),
                    Some(Ok(WsFrame::Binary(b))) => {
                        buf.extend_from_slice(&b);
                        return Ok(true);
                    }
                    Some(Ok(WsFrame::Text(_))) => return Err(io::Error::other("the broker sent a text frame; MQTT over WebSocket uses binary frames")),
                    Some(Ok(_)) => continue,
                    Some(Err(e)) => return Err(io::Error::other(e.to_string())),
                }
            },
        }
    }

    async fn write(&mut self, bytes: Vec<u8>) -> io::Result<()> {
        match self {
            Link::Stream(s) => {
                s.write_all(&bytes).await?;
                s.flush().await
            }
            Link::Ws(ws) => ws.send(WsFrame::Binary(bytes.into())).await.map_err(|e| io::Error::other(e.to_string())),
        }
    }

    async fn shutdown(&mut self) {
        match self {
            Link::Stream(s) => {
                let _ = s.shutdown().await;
            }
            Link::Ws(ws) => {
                let _ = tokio_tungstenite::WebSocketStream::close(ws, None).await;
            }
        }
    }
}

/// Why the connection never got to the broker's yes.
#[derive(Debug)]
struct Failure {
    stage: &'static str,
    message: String,
    hint: Option<String>,
    code: Option<u8>,
}

impl Failure {
    fn new(stage: &'static str, message: impl Into<String>) -> Self {
        Self { stage, message: message.into(), hint: None, code: None }
    }
}

/// TCP through Settings > Network, TLS with Settings > Certificates, then the WebSocket upgrade.
async fn open_link(t: &Target, opts: &Opts) -> Result<(Link, Option<String>), Failure> {
    let within = |what: &str| format!("Timed out after {} ms {what}", opts.timeout.as_millis());
    let net = crate::net::current();
    // the address the name resolved to, for the Connection tab (not when a proxy resolves it)
    let ip = if net.proxy_for(&t.host).is_none() { net.lookup(&t.host).await.ok().and_then(|(ips, _)| ips.first().map(|i| i.to_string())) } else { None };
    let tcp = tokio::time::timeout(opts.timeout, net.connect(&t.host, t.port))
        .await
        .map_err(|_| Failure::new("connect", within("connecting")))?
        .map_err(|e| Failure::new("connect", e.to_string()))?;
    let _ = tcp.set_nodelay(true);
    let io: Box<dyn Io> = if t.tls {
        let config = crate::certs::tls_config(opts.insecure, &t.host, t.port).map_err(|e| Failure::new("tls", e))?;
        let name = rustls::pki_types::ServerName::try_from(t.host.clone()).map_err(|e| Failure::new("tls", e.to_string()))?;
        let tls = tokio::time::timeout(opts.timeout, tokio_rustls::TlsConnector::from(std::sync::Arc::new(config)).connect(name, tcp))
            .await
            .map_err(|_| Failure::new("tls", within("in the TLS handshake")))?
            .map_err(|e| Failure::new("tls", e.to_string()))?;
        Box::new(tls)
    } else {
        Box::new(tcp)
    };
    if !t.ws {
        return Ok((Link::Stream(io), ip));
    }
    let url = format!("{}://{}{}", if t.tls { "wss" } else { "ws" }, t.addr(), t.path);
    let mut req = url.as_str().into_client_request().map_err(|e| Failure::new("ws", e.to_string()))?;
    req.headers_mut().insert("Sec-WebSocket-Protocol", tungstenite::http::HeaderValue::from_static("mqtt"));
    // frames as big as the packets CONNECT says we take
    let config = tungstenite::protocol::WebSocketConfig::default().max_frame_size(Some(MAX_IN + 16)).max_message_size(Some(MAX_IN + 16));
    let (ws, _) = tokio::time::timeout(opts.timeout, tokio_tungstenite::client_async_with_config(req, io, Some(config)))
        .await
        .map_err(|_| Failure::new("ws", within("in the WebSocket upgrade")))?
        .map_err(|e| match e {
            tungstenite::Error::Http(res) => Failure::new("ws", format!("The server answered the upgrade with HTTP {}", res.status())),
            other => Failure::new("ws", other.to_string()),
        })?;
    Ok((Link::Ws(Box::new(ws)), ip))
}

/// What to do about a failure, in plain words.
fn hint_for(f: &Failure, t: &Target, opts: &Opts) -> Option<String> {
    let lower = f.message.to_ascii_lowercase();
    let v5 = opts.version == Version::V5;
    match f.stage {
        "connect" => {
            if lower.contains("refused") {
                Some(format!(
                    "Nothing is listening on port {}. MQTT usually listens on 1883, MQTT over TLS on 8883, WebSocket on 8083 or 9001.",
                    t.port
                ))
            } else if lower.contains("not found") || lower.contains("nodename") || lower.contains("no address") || lower.contains("failed to lookup") {
                Some(if t.host.contains('.') {
                    "The name doesn't resolve from this Mac. Intranet hosts need the VPN, or add the domain to Settings › Network › Always use system DNS for.".into()
                } else {
                    "The name doesn't resolve from this Mac. A name like this is often a Docker container name.".into()
                })
            } else {
                None
            }
        }
        "tls" => {
            if lower.contains("corrupt") || lower.contains("invalidcontenttype") || lower.contains("record overflow") || lower.contains("eof") {
                Some(format!("The broker doesn't speak TLS on port {}. Use {} for this port, or the broker's TLS port.", t.port, if t.ws { "ws://" } else { "mqtt://" }))
            } else {
                crate::certs::tls_hint(&f.message).map(str::to_string)
            }
        }
        "ws" => {
            if lower.contains("subprotocol") {
                Some("The server didn't agree to speak MQTT over this WebSocket. Check the path: brokers usually serve it at /mqtt.".into())
            } else if lower.contains("http 404") {
                Some(format!("No WebSocket endpoint at {}. Many brokers use /mqtt.", t.path))
            } else if lower.contains("http ") {
                Some("The server answered with plain HTTP. Check the port and path of the broker's WebSocket listener.".into())
            } else if lower.contains("invalidcontenttype") || lower.contains("corrupt") {
                Some("This port doesn't speak WebSocket. For a plain MQTT port use mqtt:// or mqtts://.".into())
            } else {
                None
            }
        }
        "mqtt" => Some(if lower.contains("closed") {
            if v5 {
                "The broker hung up before answering. It may only speak MQTT 3.1.1 (switch the version in Settings), or want TLS (mqtts://).".into()
            } else if !t.ws {
                "The broker hung up before answering. It may want TLS (mqtts://), or this may be a WebSocket port (ws://).".into()
            } else {
                "The broker hung up before answering. Check the version in Settings and the WebSocket path.".into()
            }
        } else if lower.contains("timed out") {
            "The port took the connection but never answered as an MQTT broker. Check the port, and TLS (mqtts://) or WebSocket (ws://).".into()
        } else {
            "This doesn't look like an MQTT broker. If it's a WebSocket port, use ws:// or wss://; if it wants TLS, mqtts://.".into()
        }),
        "refused" => {
            let c = f.code.unwrap_or(0);
            Some(match (v5, c) {
                (true, 0x84) | (false, 1) | (true, 0x01) => {
                    if v5 {
                        "The broker doesn't speak MQTT 5. Set the version to 3.1.1 in Settings.".into()
                    } else {
                        "The broker refused MQTT 3.1.1. Try 5.0 in Settings.".into()
                    }
                }
                (true, 0x85) | (false, 2) => "The broker didn't accept the client ID. Leave Client ID empty in Settings for a random one, or use one the broker allows.".into(),
                (true, 0x86) | (false, 4) => "The connection worked; the username or password did not. Check them in Auth.".into(),
                // Mosquitto answers a wrong password with Not authorized, so this one covers both
                (true, 0x87) | (false, 5) => "The broker said no to this login: the username or password is wrong, or this user may not connect. Check Auth.".into(),
                (true, 0x8C) => "The broker wants enhanced authentication (MQTT 5 AUTH), which voidHTTP doesn't do yet.".into(),
                (true, 0x8A) => "The broker banned this client.".into(),
                (true, 0x88) | (true, 0x89) | (false, 3) => "The broker is up but not taking connections now. Try again later.".into(),
                (true, 0x9C) | (true, 0x9D) => "The broker sent you to another server (see the message).".into(),
                (true, 0x9F) => "Too many connections in a short time. Wait a moment and connect again.".into(),
                _ => return None,
            })
        }
        _ => None,
    }
}

// ---------- connecting ----------

/// Opens the link, sends CONNECT, waits for CONNACK, subscribes and runs the session. Every
/// outcome ends in exactly one Failed or Close event. Close on `rx` while connecting stops it.
async fn connect_and_run(t: &Target, opts: &Opts, subs: &[SubRequest], rx: &mut mpsc::Receiver<Cmd>, emit: Emit<'_>) {
    run_over(open_link(t, opts), t, opts, subs, rx, emit).await
}

/// connect_and_run over whatever link `open` makes (tests hand in an in-memory one).
async fn run_over(
    open: impl std::future::Future<Output = Result<(Link, Option<String>), Failure>>,
    t: &Target,
    opts: &Opts,
    subs: &[SubRequest],
    rx: &mut mpsc::Receiver<Cmd>,
    emit: Emit<'_>,
) {
    let started = Instant::now();
    let fail = |f: Failure| {
        let hint = f.hint.clone().or_else(|| hint_for(&f, t, opts));
        emit(MqttEvent::Failed { stage: f.stage, broker: t.addr(), message: f.message, hint, code: f.code, elapsed_ms: started.elapsed().as_millis() as u64 });
    };
    let setup = async {
        let (mut link, ip) = open.await?;
        let hs = handshake(&mut link, opts).await?;
        Ok::<_, Failure>((link, ip, hs))
    };
    // Disconnect while connecting stops it; publishes before the broker said yes have nowhere to go
    let cancelled = async {
        loop {
            match rx.recv().await {
                Some(Cmd::Close) | None => return,
                Some(_) => {}
            }
        }
    };
    let res = tokio::select! {
        r = setup => r,
        _ = cancelled => {
            emit(MqttEvent::Close { by: "client", code: None, reason: "Cancelled".into(), elapsed_ms: 0 });
            return;
        }
    };
    let (link, ip, hs) = match res {
        Ok(x) => x,
        Err(f) => return fail(f),
    };
    let mut info = conn_info(t, opts, &hs.ack, started);
    info.ip = ip;
    let session = Session::new(link, opts, &hs, info.keep_alive);
    emit(MqttEvent::Connected { info });
    session.run(subs, rx, emit).await;
}

/// The broker's yes, and what came with it.
struct Handshake {
    ack: packet::ConnAck,
    /// bytes read after CONNACK: queued or retained messages often share its TCP segment or frame
    rest: Vec<u8>,
    /// when CONNECT went out: the broker's keep-alive clock starts there
    connect_sent: Instant,
}

/// CONNECT, then the broker's CONNACK. A CONNACK that says no is a "refused" Failure.
async fn handshake(link: &mut Link, opts: &Opts) -> Result<Handshake, Failure> {
    let v = opts.version;
    let within = |what: &str| format!("Timed out after {} ms {what}", opts.timeout.as_millis());
    tokio::time::timeout(opts.timeout, link.write(opts.connect_packet().encode(v)))
        .await
        .map_err(|_| Failure::new("mqtt", within("sending CONNECT")))?
        .map_err(|e| Failure::new("mqtt", format!("Sending CONNECT failed: {e}")))?;
    let connect_sent = Instant::now();
    let mut buf = Vec::new();
    let wait = async {
        loop {
            match packet::decode(&buf, v, MAX_IN) {
                Ok(Some((p, used))) => {
                    buf.drain(..used);
                    return Ok(p);
                }
                Ok(None) => {}
                Err(e) => return Err(Failure::new("mqtt", e.to_string())),
            }
            match link.read(&mut buf).await {
                Ok(true) => {}
                Ok(false) => return Err(Failure::new("mqtt", "The broker closed the connection without answering CONNECT")),
                Err(e) => return Err(Failure::new("mqtt", format!("The connection broke before CONNACK: {e}"))),
            }
        }
    };
    let first = tokio::time::timeout(opts.timeout, wait).await.map_err(|_| Failure::new("mqtt", within("waiting for CONNACK")))??;
    let ack = match first {
        Packet::ConnAck(a) => a,
        Packet::Disconnect(d) => {
            return Err(Failure {
                stage: "refused",
                message: format!("DISCONNECT 0x{:02X} {}{}", d.code, packet::reason(d.code), d.props.reason_string.map(|r| format!(": {r}")).unwrap_or_default()),
                hint: None,
                code: Some(d.code),
            })
        }
        Packet::Auth(_) => return Err(Failure { stage: "refused", message: "The broker started enhanced authentication (AUTH)".into(), hint: None, code: Some(0x8C) }),
        other => return Err(Failure::new("mqtt", format!("The broker answered CONNECT with {}", other.name()))),
    };
    if ack.code != 0 {
        let mut message = format!("CONNACK 0x{:02X} {}", ack.code, packet::connack_reason(v, ack.code));
        if let Some(r) = &ack.props.reason_string {
            message.push_str(&format!(": {r}"));
        }
        if let Some(s) = &ack.props.server_reference {
            message.push_str(&format!(" · use {s}"));
        }
        return Err(Failure { stage: "refused", message, hint: None, code: Some(ack.code) });
    }
    Ok(Handshake { ack, rest: buf, connect_sent })
}

fn conn_info(t: &Target, opts: &Opts, ack: &packet::ConnAck, started: Instant) -> ConnInfo {
    let p = &ack.props;
    let assigned = p.assigned_client_id.clone();
    ConnInfo {
        broker: t.addr(),
        ip: None,
        transport: t.transport().into(),
        path: t.ws.then(|| t.path.clone()),
        version: opts.version.label().into(),
        client_id: assigned.clone().unwrap_or_else(|| opts.client_id.clone()),
        random_id: opts.random_id,
        assigned_id: assigned.is_some(),
        clean_start: opts.clean_start,
        keep_alive: p.server_keep_alive.unwrap_or(opts.keep_alive),
        server_keep_alive: p.server_keep_alive.filter(|k| *k != opts.keep_alive),
        session_expiry: p.session_expiry.unwrap_or(opts.session_expiry),
        session_present: ack.session_present,
        username: opts.username.clone(),
        will: opts.will_label(),
        max_qos: p.max_qos,
        retain_available: p.retain_available.map(|b| b == 1),
        wildcards: p.wildcard_available.map(|b| b == 1),
        shared: p.shared_available.map(|b| b == 1),
        sub_ids: p.sub_ids_available.map(|b| b == 1),
        receive_max: p.receive_max,
        max_packet_size: p.max_packet_size,
        topic_alias_max: p.topic_alias_max,
        response_info: p.response_info.clone(),
        reason: p.reason_string.clone(),
        user: p.user.iter().map(|(k, v)| UserProp { key: k.clone(), value: v.clone() }).collect(),
        connect_ms: started.elapsed().as_millis() as u64,
    }
}

// ---------- the session ----------

/// A publish of ours waiting for the broker.
struct Outgoing {
    seq: u64,
    sent: Instant,
    /// QoS 2: PUBREC came, PUBREL went, waiting for PUBCOMP
    released: bool,
}

struct Session {
    link: Link,
    v: Version,
    buf: Vec<u8>,
    since: Instant,
    next_pid: u16,
    out: HashMap<u16, Outgoing>,
    /// QoS 2 messages received, waiting for the broker's PUBREL
    in_q2: HashSet<u16>,
    pending_sub: HashMap<u16, Vec<(String, SubOpts)>>,
    pending_unsub: HashMap<u16, Vec<(String, SubOpts)>>,
    /// filters subscribed (or on their way), with the options they were sent with
    subs: BTreeMap<String, SubOpts>,
    /// filters the broker refused with these options; not sent again until the options change
    denied: BTreeMap<String, SubOpts>,
    aliases: HashMap<u16, String>,
    keep_alive: Duration,
    last_sent: Instant,
    ping_sent: Option<Instant>,
    /// from CONNACK (MQTT 5)
    max_out: Option<usize>,
    receive_max: usize,
    max_qos: u8,
    retain_ok: bool,
    wildcards_ok: bool,
    shared_ok: bool,
    /// a write that takes longer than this means the broker stopped reading
    write_limit: Duration,
}

enum End {
    Client,
    Server(u8, String),
    Lost(String),
}

impl Session {
    fn new(link: Link, opts: &Opts, hs: &Handshake, keep_alive: u16) -> Self {
        let p = &hs.ack.props;
        let now = Instant::now();
        let keep = Duration::from_secs(keep_alive as u64);
        Self {
            link,
            v: opts.version,
            buf: hs.rest.clone(),
            since: now,
            // a resumed session may still hold ids from the last connection: don't start where it did
            next_pid: random_u16(),
            out: HashMap::new(),
            in_q2: HashSet::new(),
            pending_sub: HashMap::new(),
            pending_unsub: HashMap::new(),
            subs: BTreeMap::new(),
            denied: BTreeMap::new(),
            aliases: HashMap::new(),
            keep_alive: keep,
            last_sent: hs.connect_sent,
            ping_sent: None,
            max_out: p.max_packet_size.map(|n| n as usize),
            receive_max: p.receive_max.map(|n| n as usize).unwrap_or(65_535).max(1),
            max_qos: p.max_qos.unwrap_or(2),
            retain_ok: p.retain_available != Some(0),
            wildcards_ok: p.wildcard_available != Some(0),
            shared_ok: p.shared_available != Some(0),
            write_limit: if keep.is_zero() { opts.timeout } else { opts.timeout.max(keep + keep / 2) },
        }
    }

    fn at_ms(&self) -> u64 {
        self.since.elapsed().as_millis() as u64
    }

    async fn run(mut self, subs: &[SubRequest], rx: &mut mpsc::Receiver<Cmd>, emit: Emit<'_>) {
        let end = self.drive(subs, rx, emit).await;
        let elapsed_ms = self.at_ms();
        let event = match end {
            End::Client => {
                let bye = Packet::Disconnect(Disconnect { code: 0, props: Props::default() }).encode(self.v);
                let _ = tokio::time::timeout(Duration::from_secs(2), self.link.write(bye)).await;
                MqttEvent::Close { by: "client", code: None, reason: "Disconnected".into(), elapsed_ms }
            }
            End::Server(code, reason) => MqttEvent::Close { by: "server", code: Some(code), reason, elapsed_ms },
            End::Lost(reason) => MqttEvent::Close { by: "lost", code: None, reason, elapsed_ms },
        };
        let _ = tokio::time::timeout(Duration::from_secs(2), self.link.shutdown()).await;
        emit(event);
    }

    async fn drive(&mut self, subs: &[SubRequest], rx: &mut mpsc::Receiver<Cmd>, emit: Emit<'_>) -> End {
        if let Err(e) = self.sync(subs, emit).await {
            return End::Lost(e);
        }
        loop {
            // drain whole packets already read
            loop {
                match packet::decode(&self.buf, self.v, MAX_IN) {
                    Ok(Some((p, used))) => {
                        self.buf.drain(..used);
                        match self.on_packet(p, emit).await {
                            Ok(None) => {}
                            Ok(Some(end)) => return end,
                            Err(e) => return End::Lost(e),
                        }
                    }
                    Ok(None) => break,
                    Err(e) => {
                        // a broken packet ends the connection; MQTT 5 says why first
                        let code = if matches!(e, packet::Error::TooLarge(_)) { 0x95 } else { 0x81 };
                        self.say_bye(code).await;
                        return End::Lost(format!("The broker sent a packet voidHTTP can't read. {e}"));
                    }
                }
            }
            let tick = self.next_tick();
            tokio::select! {
                r = self.link.read(&mut self.buf) => match r {
                    Ok(true) => {}
                    Ok(false) => return End::Lost("The broker closed the connection".into()),
                    Err(e) => return End::Lost(format!("The connection broke: {e}")),
                },
                cmd = rx.recv() => {
                    let res = match cmd {
                        Some(Cmd::Publish(p)) => self.publish(p, emit).await,
                        Some(Cmd::Subs(list)) => self.sync(&list, emit).await,
                        Some(Cmd::Close) | None => return End::Client,
                    };
                    if let Err(e) = res {
                        return End::Lost(e);
                    }
                }
                _ = tokio::time::sleep_until(tick) => {
                    if let Some(sent) = self.ping_sent {
                        if sent.elapsed() >= self.ping_wait() {
                            return End::Lost(format!("No answer to the keep-alive ping in {} s", self.ping_wait().as_secs()));
                        }
                    } else if !self.keep_alive.is_zero() && self.last_sent.elapsed() >= self.keep_alive {
                        if let Err(e) = self.write(Packet::PingReq).await {
                            return End::Lost(e);
                        }
                        self.ping_sent = Some(Instant::now());
                    }
                }
            }
        }
    }

    /// How long a PINGRESP may take.
    fn ping_wait(&self) -> Duration {
        self.keep_alive.max(Duration::from_secs(5))
    }

    /// When the keep-alive needs a look next.
    fn next_tick(&self) -> Instant {
        if let Some(sent) = self.ping_sent {
            return sent + self.ping_wait();
        }
        if self.keep_alive.is_zero() {
            return Instant::now() + Duration::from_secs(3600);
        }
        self.last_sent + self.keep_alive
    }

    async fn write(&mut self, p: Packet) -> Result<(), String> {
        self.send_bytes(p.encode(self.v), p.name()).await
    }

    /// Writes, or gives up when the broker stops taking bytes (nothing else runs meanwhile).
    async fn send_bytes(&mut self, bytes: Vec<u8>, what: &str) -> Result<(), String> {
        match tokio::time::timeout(self.write_limit, self.link.write(bytes)).await {
            Ok(Ok(())) => {
                self.last_sent = Instant::now();
                Ok(())
            }
            Ok(Err(e)) => Err(format!("Sending {what} failed: {e}")),
            Err(_) => Err(format!("The broker stopped taking data: sending {what} stalled for {} s", self.write_limit.as_secs())),
        }
    }

    /// MQTT 5: tell the broker why we hang up.
    async fn say_bye(&mut self, code: u8) {
        if self.v == Version::V5 {
            let _ = self.write(Packet::Disconnect(Disconnect { code, props: Props::default() })).await;
        }
    }

    fn pid(&mut self) -> u16 {
        loop {
            self.next_pid = self.next_pid.wrapping_add(1);
            let id = self.next_pid;
            if id != 0 && !self.out.contains_key(&id) && !self.pending_sub.contains_key(&id) && !self.pending_unsub.contains_key(&id) {
                return id;
            }
        }
    }

    /// One packet from the broker. Some(end) when it ends the session.
    async fn on_packet(&mut self, p: Packet, emit: Emit<'_>) -> Result<Option<End>, String> {
        match p {
            Packet::Publish(mut m) => {
                // MQTT 5 topic aliases: a topic once, a number after
                if let Some(alias) = m.props.topic_alias {
                    if m.topic.is_empty() {
                        match self.aliases.get(&alias) {
                            Some(t) => m.topic = t.clone(),
                            None => {
                                self.say_bye(0x94).await;
                                return Ok(Some(End::Lost(format!("The broker used topic alias {alias} before naming it"))));
                            }
                        }
                    } else {
                        self.aliases.insert(alias, m.topic.clone());
                    }
                }
                match (m.qos, m.pid) {
                    (1, Some(pid)) => {
                        self.received(&m, emit);
                        self.write(Packet::PubAck(Ack::ok(pid))).await?;
                    }
                    (2, Some(pid)) => {
                        // a QoS 2 message comes once; a resend before PUBREL is the same message
                        if self.in_q2.insert(pid) {
                            self.received(&m, emit);
                        }
                        self.write(Packet::PubRec(Ack::ok(pid))).await?;
                    }
                    _ => self.received(&m, emit),
                }
            }
            Packet::PubRel(a) => {
                self.in_q2.remove(&a.pid);
                self.write(Packet::PubComp(Ack::ok(a.pid))).await?;
            }
            Packet::PubAck(a) => {
                if let Some(o) = self.out.remove(&a.pid) {
                    self.acked(o, &a, "PUBACK", emit);
                }
            }
            Packet::PubRec(a) => {
                if a.code >= 0x80 {
                    if let Some(o) = self.out.remove(&a.pid) {
                        self.acked(o, &a, "PUBREC", emit);
                    }
                } else if let Some(o) = self.out.get_mut(&a.pid) {
                    o.released = true;
                    self.write(Packet::PubRel(Ack::ok(a.pid))).await?;
                } else {
                    // not ours (any more): MQTT 5 says so, 3.1.1 just releases it
                    let code = if self.v == Version::V5 { 0x92 } else { 0 };
                    self.write(Packet::PubRel(Ack { pid: a.pid, code, props: Props::default() })).await?;
                }
            }
            Packet::PubComp(a) => {
                if let Some(o) = self.out.remove(&a.pid) {
                    let label = if o.released { "PUBREC → PUBCOMP" } else { "PUBCOMP" };
                    self.acked(o, &a, label, emit);
                }
            }
            Packet::SubAck(a) => {
                if let Some(asked) = self.pending_sub.remove(&a.pid) {
                    let mut results = Vec::new();
                    for (i, (filter, o)) in asked.into_iter().enumerate() {
                        let code = a.codes.get(i).copied();
                        let r = match code {
                            Some(c) if c < 0x80 => SubResult { filter, qos: o.qos, granted: Some(c), error: None },
                            Some(c) => {
                                // a later SUBSCRIBE of the same filter with other options may be on its way: leave that one be
                                if self.subs.get(&filter) == Some(&o) {
                                    self.subs.remove(&filter);
                                    self.denied.insert(filter.clone(), o.clone());
                                }
                                let words = if self.v == Version::V5 { packet::reason(c) } else { "Failure" };
                                let why = a.props.reason_string.as_ref().map(|r| format!(": {r}")).unwrap_or_default();
                                SubResult { filter, qos: o.qos, granted: None, error: Some(format!("0x{c:02X} {words}{why}")) }
                            }
                            None => SubResult { filter, qos: o.qos, granted: None, error: Some("The broker didn't answer for this filter".into()) },
                        };
                        results.push(r);
                    }
                    emit(MqttEvent::Subscribed { results, at_ms: self.at_ms() });
                }
            }
            Packet::UnsubAck(a) => {
                if let Some(asked) = self.pending_unsub.remove(&a.pid) {
                    let mut gone = Vec::new();
                    let mut refused = Vec::new();
                    for (i, (filter, o)) in asked.into_iter().enumerate() {
                        // 3.1.1 has no codes; 0x11 No subscription existed is as good as gone
                        match a.codes.get(i).copied() {
                            Some(c) if c >= 0x80 && self.v == Version::V5 => {
                                // still subscribed: keep it, so the next change tries again
                                if !self.subs.contains_key(&filter) {
                                    self.subs.insert(filter.clone(), o.clone());
                                }
                                refused.push(SubResult { filter, qos: o.qos, granted: None, error: Some(format!("Unsubscribe refused: 0x{c:02X} {}", packet::reason(c))) });
                            }
                            _ => gone.push(filter),
                        }
                    }
                    if !gone.is_empty() {
                        emit(MqttEvent::Unsubscribed { filters: gone, at_ms: self.at_ms() });
                    }
                    if !refused.is_empty() {
                        emit(MqttEvent::Subscribed { results: refused, at_ms: self.at_ms() });
                    }
                }
            }
            Packet::PingResp => self.ping_sent = None,
            Packet::Disconnect(d) => {
                let mut reason = if self.v == Version::V5 { packet::reason(d.code).to_string() } else { "The broker disconnected".into() };
                if let Some(r) = d.props.reason_string {
                    reason.push_str(&format!(": {r}"));
                }
                if let Some(s) = d.props.server_reference {
                    reason.push_str(&format!(" · use {s}"));
                }
                return Ok(Some(End::Server(d.code, reason)));
            }
            Packet::Auth(_) => {
                // we sent no authentication method, so an AUTH is a protocol error (MQTT 5 4.12)
                self.say_bye(0x82).await;
                return Ok(Some(End::Lost("The broker asked to re-authenticate (MQTT 5 AUTH), which voidHTTP doesn't do yet".into())));
            }
            other => {
                self.say_bye(0x82).await;
                return Ok(Some(End::Lost(format!("The broker sent {}, which a broker never sends", other.name()))));
            }
        }
        Ok(None)
    }

    fn received(&self, m: &Publish, emit: Emit<'_>) {
        let (data, value_bin) = show(&m.payload);
        emit(MqttEvent::Message {
            dir: "in",
            kind: "publish",
            topic: Some(m.topic.clone()),
            qos: m.qos,
            retain: m.retain,
            dup: m.dup,
            data,
            value_bin,
            props: MsgProps::of(&m.props),
            ack_id: None,
            ack_ms: None,
            ack: None,
            packet_id: m.pid,
            reason: None,
            error: None,
            size: m.payload.len(),
            at_ms: self.at_ms(),
        });
    }

    fn acked(&self, o: Outgoing, a: &Ack, label: &str, emit: Emit<'_>) {
        let why = a.props.reason_string.as_ref().map(|r| format!(": {r}")).unwrap_or_default();
        let (reason, error) = if a.code >= 0x80 {
            (None, Some(format!("{label} 0x{:02X} {}{why}", a.code, packet::reason(a.code))))
        } else if a.code != 0 {
            (Some(format!("0x{:02X} {}{why}", a.code, packet::reason(a.code))), None)
        } else {
            (None, None)
        };
        emit(ack_event(o.seq, Some(o.sent.elapsed().as_millis() as u64), Some(label.into()), Some(a.pid), reason, error, self.at_ms()));
    }

    async fn publish(&mut self, r: PublishRequest, emit: Emit<'_>) -> Result<(), String> {
        let seq = r.seq;
        let fail = |why: String, s: &Self| emit(ack_event(seq, None, None, None, None, Some(why), s.at_ms()));
        let topic = r.topic.trim().to_string();
        if let Some(p) = packet::topic_name_problem(&topic) {
            fail(p.into(), self);
            return Ok(());
        }
        let qos = r.qos.min(2);
        if qos > self.max_qos {
            fail(format!("The broker takes QoS {} at most (Connection tab)", self.max_qos), self);
            return Ok(());
        }
        if r.retain && !self.retain_ok {
            fail("The broker doesn't keep retained messages. Turn Retain off.".into(), self);
            return Ok(());
        }
        if qos > 0 && self.out.len() >= self.receive_max {
            fail(format!("{} publishes are still waiting for the broker (its receive maximum)", self.out.len()), self);
            return Ok(());
        }
        let v5 = self.v == Version::V5;
        let props = if v5 {
            Props {
                content_type: (!r.content_type.trim().is_empty()).then(|| r.content_type.trim().to_string()),
                payload_format: r.utf8.map(|u| u as u8),
                message_expiry: r.message_expiry,
                response_topic: (!r.response_topic.trim().is_empty()).then(|| r.response_topic.trim().to_string()),
                correlation: (!r.correlation.is_empty()).then(|| r.correlation.as_bytes().to_vec()),
                user: r.user.iter().filter(|u| !u.key.is_empty()).map(|u| (u.key.clone(), u.value.clone())).collect(),
                ..Default::default()
            }
        } else {
            Props::default()
        };
        let too_long = [("Content type", props.content_type.as_deref().unwrap_or("").len()), ("Correlation data", props.correlation.as_ref().map_or(0, |c| c.len()))]
            .into_iter()
            .chain(props.user.iter().flat_map(|(k, v)| [("A user property", k.len()), ("A user property", v.len())]))
            .find(|(_, n)| *n > packet::MAX_STR);
        if let Some((what, _)) = too_long {
            fail(format!("{what} is longer than 65 535 bytes, the most MQTT carries"), self);
            return Ok(());
        }
        if let Some(rt) = &props.response_topic {
            if let Some(p) = packet::topic_name_problem(rt) {
                fail(format!("Response topic: {p}"), self);
                return Ok(());
            }
        }
        let payload = r.payload.into_bytes();
        let pid = (qos > 0).then(|| self.pid());
        let shown_props = MsgProps::of(&props);
        let p = Packet::Publish(Publish { dup: false, qos, retain: r.retain, topic: topic.clone(), pid, props, payload });
        let bytes = p.encode(self.v);
        if let Some(max) = self.max_out {
            if bytes.len() > max {
                fail(format!("The message is {} bytes; the broker takes {} at most", bytes.len(), max), self);
                return Ok(());
            }
        }
        let Packet::Publish(sent) = &p else { unreachable!() };
        let (data, value_bin) = show(&sent.payload);
        emit(MqttEvent::Message {
            dir: "out",
            kind: "publish",
            topic: Some(topic),
            qos,
            retain: r.retain,
            dup: false,
            data,
            value_bin,
            props: shown_props,
            ack_id: Some(r.seq),
            ack_ms: None,
            ack: None,
            packet_id: pid,
            reason: None,
            error: None,
            size: sent.payload.len(),
            at_ms: self.at_ms(),
        });
        self.send_bytes(bytes, "PUBLISH").await?;
        if let Some(pid) = pid {
            self.out.insert(pid, Outgoing { seq: r.seq, sent: Instant::now(), released: false });
        }
        Ok(())
    }

    /// Makes the broker's subscriptions match `list`: SUBSCRIBE what's new or changed,
    /// UNSUBSCRIBE what's gone. Filters that can't be sent are answered right here.
    async fn sync(&mut self, list: &[SubRequest], emit: Emit<'_>) -> Result<(), String> {
        let v5 = self.v == Version::V5;
        let mut want: BTreeMap<String, SubOpts> = BTreeMap::new();
        let mut local: Vec<SubResult> = Vec::new();
        for s in list {
            let filter = s.filter.trim().to_string();
            if filter.is_empty() || want.contains_key(&filter) {
                continue;
            }
            let qos = s.qos.min(2);
            let shared = filter.starts_with("$share/");
            let problem = packet::topic_filter_problem(&filter)
                .or_else(|| (v5 && s.no_local && shared).then(|| "No local can't be used on a shared subscription".to_string()))
                // MQTT 5: sending what the broker said it lacks is a protocol error that drops the connection
                .or_else(|| (!self.wildcards_ok && filter.contains(['+', '#'])).then(|| "The broker doesn't take wildcard subscriptions (Connection tab)".to_string()))
                .or_else(|| (!self.shared_ok && shared).then(|| "The broker doesn't take shared subscriptions (Connection tab)".to_string()));
            if let Some(p) = problem {
                local.push(SubResult { filter, qos, granted: None, error: Some(p) });
                continue;
            }
            let o = if v5 { SubOpts { qos, no_local: s.no_local, retain_as_published: s.retain_as_published, retain_handling: s.retain_handling.min(2) } } else { SubOpts::qos(qos) };
            want.insert(filter, o);
        }
        if !local.is_empty() {
            emit(MqttEvent::Subscribed { results: local, at_ms: self.at_ms() });
        }

        // a refused filter that's gone was never subscribed: nothing to send, but the list forgets it
        let forgotten: Vec<String> = self.denied.keys().filter(|f| !want.contains_key(*f)).cloned().collect();
        self.denied.retain(|f, _| want.contains_key(f));
        if !forgotten.is_empty() {
            emit(MqttEvent::Unsubscribed { filters: forgotten, at_ms: self.at_ms() });
        }
        let gone: Vec<(String, SubOpts)> = self.subs.iter().filter(|(f, _)| !want.contains_key(*f)).map(|(f, o)| (f.clone(), o.clone())).collect();
        let new: Vec<(String, SubOpts)> = want.into_iter().filter(|(f, o)| self.subs.get(f) != Some(o) && self.denied.get(f) != Some(o)).collect();

        if !gone.is_empty() {
            for (f, _) in &gone {
                self.subs.remove(f);
            }
            let pid = self.pid();
            let filters = gone.iter().map(|(f, _)| f.clone()).collect();
            self.pending_unsub.insert(pid, gone);
            self.write(Packet::Unsubscribe(Unsubscribe { pid, props: Props::default(), filters })).await?;
        }
        if !new.is_empty() {
            for (f, o) in &new {
                self.denied.remove(f);
                self.subs.insert(f.clone(), o.clone());
            }
            let pid = self.pid();
            self.pending_sub.insert(pid, new.clone());
            self.write(Packet::Subscribe(Subscribe { pid, props: Props::default(), filters: new })).await?;
        }
        Ok(())
    }
}

fn ack_event(seq: u64, ack_ms: Option<u64>, ack: Option<String>, packet_id: Option<u16>, reason: Option<String>, error: Option<String>, at_ms: u64) -> MqttEvent {
    MqttEvent::Message {
        dir: "in",
        kind: "ack",
        topic: None,
        qos: 0,
        retain: false,
        dup: false,
        data: String::new(),
        value_bin: false,
        props: None,
        ack_id: Some(seq),
        ack_ms,
        ack,
        packet_id,
        reason,
        error,
        size: 0,
        at_ms,
    }
}

/// Bytes as text when they are UTF-8, else base64 (and true).
fn show(bytes: &[u8]) -> (String, bool) {
    match std::str::from_utf8(bytes) {
        Ok(s) => (s.to_string(), false),
        Err(_) => (base64::engine::general_purpose::STANDARD.encode(bytes), true),
    }
}

#[cfg(test)]
mod tests;
