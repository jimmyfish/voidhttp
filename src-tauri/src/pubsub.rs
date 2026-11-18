//! Google Cloud Pub/Sub client over its REST API. One connection per tab: `pubsub_connect` signs in,
//! checks the topic, then reads as the Read tab says until Disconnect; messages, publish answers and
//! topic facts arrive on an IPC channel. `pubsub_publish`, `pubsub_pull`, `pubsub_pause`,
//! `pubsub_refresh` and `pubsub_close` reach the running connection through a queue.
//!
//! Pub/Sub subscribers compete for messages, so reading is a deliberate choice: a temporary
//! subscription of our own (deleted on Disconnect, expires after 24 h if we quit first), Peek
//! (pull on demand, hand every message straight back with ack deadline 0), Consume (pull and ack,
//! like a real subscriber) or publish only. `pubsub_inspect` and `pubsub_list` fill the project,
//! topic and subscription pickers. Every call goes through reqwest clients built like the HTTP
//! engine's, so Settings > Network and Settings > Certificates apply.

mod auth;
#[cfg(test)]
mod tests;

use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use base64::Engine;
use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{ipc::Channel as IpcChannel, State};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

pub use auth::{AuthReq, Inspect};

use crate::{http::Kv, ws::Conns};

const USER_AGENT: &str = concat!("voidHTTP/", env!("CARGO_PKG_VERSION"));
const DEFAULT_ENDPOINT: &str = "pubsub.googleapis.com";
/// Limit when Settings has none (0).
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);
/// A pull is a long poll: Google holds it open until messages come or it gives up.
const PULL_WAIT: Duration = Duration::from_secs(60);
const PULL_MAX: u32 = 100;
/// Pull failures in a row before the connection counts as lost.
const MAX_FAILS: u32 = 3;
/// Pages followed when listing, at most.
const MAX_PAGES: usize = 20;

// ---------- wire types (camelCase to the webview) ----------

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PubsubRequest {
    /// client id, used to publish, pull, pause and close
    pub id: String,
    pub project: String,
    /// the short topic id
    pub topic: String,
    pub auth: AuthReq,
    /// host only; empty for pubsub.googleapis.com
    #[serde(default)]
    pub endpoint: String,
    /// "temp", "peek", "consume" or "publish"
    pub mode: String,
    /// peek and consume: the short subscription id
    #[serde(default)]
    pub subscription: String,
    /// temp: an attribute filter
    #[serde(default)]
    pub filter: String,
    /// temp: enableMessageOrdering
    #[serde(default)]
    pub ordering: bool,
    /// seconds, temp and consume
    #[serde(default = "ack_default")]
    pub ack_deadline: u32,
    /// emulator only: make the topic when it is missing
    #[serde(default)]
    pub create_topic: bool,
    #[serde(default)]
    pub insecure: bool,
    #[serde(default)]
    pub timeout_ms: u64,
}

fn ack_default() -> u32 {
    60
}

/// A message to publish. `data` is the editor's text; Google wants it base64, that happens here.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Publish {
    pub seq: u64,
    #[serde(default)]
    pub data: String,
    #[serde(default)]
    pub attributes: Vec<Kv>,
    #[serde(default)]
    pub ordering_key: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ListItem {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub disabled: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeadLetter {
    pub topic: String,
    pub max_attempts: u32,
}

/// One subscription on the topic, as the Topic tab lists it.
#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SubInfo {
    pub name: String,
    /// "Pull", "Push", "BigQuery" or "Cloud Storage"
    pub delivery: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint: Option<String>,
    pub ack_deadline: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter: Option<String>,
    /// "dead-letter-topic · 5"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dead_letter: Option<String>,
    pub ordering: bool,
}

/// What the connected line and the Topic tab show.
#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Info {
    pub project: String,
    pub topic: String,
    pub endpoint: String,
    pub emulator: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity: Option<String>,
    pub auth_kind: String,
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dead_letter: Option<DeadLetter>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retention: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kms: Option<String>,
    pub labels: Vec<Kv>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscriptions: Option<Vec<SubInfo>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subs_error: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "type")]
pub enum PubsubEvent {
    /// signed in, the topic is there and reading (if any) is set up
    Connected { info: Info, elapsed_ms: u64 },
    /// fresh topic facts (Refresh on the Topic tab)
    Topic { info: Info },
    /// a message read ("in", kind "record"), one published ("out", kind "record"), or Google's answer to a publish ("in", kind "ack")
    Message {
        dir: &'static str,
        kind: &'static str,
        /// text, or base64 when `value_bin`
        data: String,
        #[serde(skip_serializing_if = "std::ops::Not::not")]
        value_bin: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        message_id: Option<String>,
        /// the ordering key
        #[serde(skip_serializing_if = "Option::is_none")]
        key: Option<String>,
        /// the attributes
        #[serde(skip_serializing_if = "Vec::is_empty")]
        headers: Vec<Kv>,
        /// publishTime, ms since the epoch
        #[serde(skip_serializing_if = "Option::is_none")]
        ts: Option<i64>,
        /// deliveryAttempt, when the subscription counts them (dead-letter policy)
        #[serde(skip_serializing_if = "Option::is_none")]
        attempt: Option<u32>,
        /// a read message: "acked" or "returned" (Peek)
        #[serde(skip_serializing_if = "Option::is_none")]
        handed: Option<&'static str>,
        /// a published message and its answer share this
        #[serde(skip_serializing_if = "Option::is_none")]
        ack_id: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        ack_ms: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
        size: usize,
        /// ms since Connect
        at_ms: u64,
    },
    /// Peek: pull number `n` brought `count` new messages and `skipped` already shown; its messages follow
    Pulled { n: u32, count: usize, skipped: usize, at_ms: u64 },
    Paused { paused: bool, at_ms: u64 },
    /// something to say that doesn't end the connection
    Notice { message: String },
    /// the connection never got to reading; it ends here
    Failed {
        /// "auth", "topic" or "subscription"
        stage: &'static str,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        hint: Option<String>,
        elapsed_ms: u64,
    },
    Close {
        /// "client" (Disconnect) or "lost"
        by: &'static str,
        reason: String,
        elapsed_ms: u64,
    },
}

// ---------- state ----------

enum Cmd {
    Publish(Publish),
    Pull(u32),
    Pause(bool),
    Refresh,
    Close,
}

#[derive(Default)]
pub struct PubsubState {
    conns: Conns<Cmd>,
}

type Emit = Arc<dyn Fn(PubsubEvent) + Send + Sync>;

// ---------- commands ----------

/// Who the credentials are and which projects they name, read from files only.
#[tauri::command]
pub async fn pubsub_inspect(auth: AuthReq) -> Result<Inspect, String> {
    tokio::task::spawn_blocking(move || auth::inspect(&auth)).await.map_err(|e| e.to_string())
}

/// Projects, the project's topics, or the topic's subscriptions, for the pickers.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn pubsub_list(
    auth: AuthReq,
    endpoint: String,
    insecure: bool,
    timeout_ms: u64,
    what: String,
    project: String,
    topic: String,
) -> Result<Vec<ListItem>, String> {
    let api = Api::new(&auth, &endpoint, insecure, timeout_ms)?;
    api.token().await.map_err(|e| e.message)?;
    let project = project.trim();
    match what.as_str() {
        "projects" => {
            if api.emulator {
                return Err("The emulator has no project list".into());
            }
            let url = "https://cloudresourcemanager.googleapis.com/v1/projects?filter=lifecycleState:ACTIVE&pageSize=500";
            let all = api.list_all(url, "projects").await.map_err(|e| e.message)?;
            Ok(all
                .iter()
                .filter_map(|p| {
                    let id = p.get("projectId")?.as_str()?.to_string();
                    let name = p.get("name").and_then(Value::as_str).filter(|n| *n != id).map(String::from);
                    Some(ListItem { name: id, detail: name, disabled: false })
                })
                .collect())
        }
        "topics" => {
            check_id(project, "a project ID")?;
            let topics = api.list_all(&format!("{}/v1/projects/{project}/topics?pageSize=1000", api.base), "topics").await.map_err(|e| e.message)?;
            // one more call for how many subscriptions each topic has; skipped when not allowed
            let counts: Option<HashMap<String, usize>> = api.subscriptions(project).await.ok().map(|subs| {
                let mut m = HashMap::new();
                for s in subs {
                    if let Some(t) = s.get("topic").and_then(Value::as_str) {
                        *m.entry(short(t).to_string()).or_insert(0) += 1;
                    }
                }
                m
            });
            Ok(topics
                .iter()
                .filter_map(|t| t.get("name")?.as_str().map(short))
                .map(|name| ListItem {
                    detail: counts.as_ref().map(|c| plural(c.get(name).copied().unwrap_or(0), "subscription")),
                    name: name.to_string(),
                    disabled: false,
                })
                .collect())
        }
        "subscriptions" => {
            check_id(project, "a project ID")?;
            let topic = topic.trim();
            check_id(topic, "a topic")?;
            let path = topic_path(project, topic);
            let subs = api.subscriptions(project).await.map_err(|e| e.message)?;
            Ok(subs
                .iter()
                .filter(|s| s.get("topic").and_then(Value::as_str) == Some(path.as_str()))
                .filter_map(|s| {
                    let name = short(s.get("name")?.as_str()?).to_string();
                    let d = delivery(s);
                    Some(ListItem { name, detail: Some(d.into()), disabled: d != "Pull" })
                })
                .collect())
        }
        other => Err(format!("Unknown list \"{other}\"")),
    }
}

/// Signs in, checks the topic, sets reading up, then runs until Disconnect. Err only for input
/// that can't be used; a refusal from Google ends with a Failed event instead.
#[tauri::command]
pub async fn pubsub_connect(state: State<'_, PubsubState>, request: PubsubRequest, on_event: IpcChannel<PubsubEvent>) -> Result<(), String> {
    check_request(&request)?;
    let api = Arc::new(Api::new(&request.auth, &request.endpoint, request.insecure, request.timeout_ms)?);
    let (rx, _guard) = state.conns.open(&request.id)?;
    let emit: Emit = Arc::new(move |e| {
        let _ = on_event.send(e);
    });
    run(api, request, rx, emit).await;
    Ok(())
}

#[tauri::command]
pub async fn pubsub_publish(state: State<'_, PubsubState>, id: String, message: Publish) -> Result<(), String> {
    send(&state, &id, Cmd::Publish(message)).await
}

#[tauri::command]
pub async fn pubsub_pull(state: State<'_, PubsubState>, id: String, max: u32) -> Result<(), String> {
    send(&state, &id, Cmd::Pull(max)).await
}

#[tauri::command]
pub async fn pubsub_pause(state: State<'_, PubsubState>, id: String, paused: bool) -> Result<(), String> {
    send(&state, &id, Cmd::Pause(paused)).await
}

#[tauri::command]
pub async fn pubsub_refresh(state: State<'_, PubsubState>, id: String) -> Result<(), String> {
    send(&state, &id, Cmd::Refresh).await
}

#[tauri::command]
pub async fn pubsub_close(state: State<'_, PubsubState>, id: String) -> Result<(), String> {
    send(&state, &id, Cmd::Close).await
}

async fn send(state: &State<'_, PubsubState>, id: &str, cmd: Cmd) -> Result<(), String> {
    let tx = state.conns.get(id).ok_or("The connection is closed")?;
    tx.send(cmd).await.map_err(|_| "The connection is closed".to_string())
}

fn check_id(s: &str, what: &str) -> Result<(), String> {
    if s.is_empty() {
        return Err(format!("Enter {what}"));
    }
    if s.contains('/') || s.contains(char::is_whitespace) {
        return Err(format!("\"{s}\" is not a valid ID: use the short name, without spaces or slashes"));
    }
    Ok(())
}

fn check_request(r: &PubsubRequest) -> Result<(), String> {
    check_id(r.project.trim(), "a project ID")?;
    check_id(r.topic.trim(), "a topic")?;
    match r.mode.as_str() {
        "temp" | "publish" => {}
        "peek" | "consume" => check_id(r.subscription.trim(), "a subscription")?,
        other => return Err(format!("Unknown read mode \"{other}\"")),
    }
    if r.auth.emulator() && r.auth.emulator_host.trim().is_empty() {
        return Err("Enter the emulator host, e.g. localhost:8085".into());
    }
    Ok(())
}

// ---------- HTTP ----------

/// reqwest clients per host: each host gets its own TLS setup (CA list, client certificate) from
/// Settings > Certificates, and Settings > Network (secure DNS, proxy) applies to all of them.
pub struct Clients {
    insecure: bool,
    map: Mutex<HashMap<String, Client>>,
}

impl Clients {
    pub fn new(insecure: bool) -> Self {
        Self { insecure, map: Mutex::new(HashMap::new()) }
    }

    pub fn get(&self, url: &str) -> Result<Client, String> {
        let u = reqwest::Url::parse(url).map_err(|e| format!("Invalid URL {url}: {e}"))?;
        let host = u.host_str().unwrap_or_default().trim_matches(['[', ']']).to_string();
        let port = u.port_or_known_default().unwrap_or(443);
        let key = format!("{}://{host}:{port}", u.scheme());
        let mut map = self.map.lock().map_err(|e| e.to_string())?;
        if let Some(c) = map.get(&key) {
            return Ok(c.clone());
        }
        let mut builder = Client::builder().user_agent(USER_AGENT).connect_timeout(Duration::from_secs(15));
        if u.scheme() == "https" {
            let mut tls = crate::certs::tls_config(self.insecure, &host, port)?;
            tls.alpn_protocols = vec![b"h2".to_vec(), b"http/1.1".to_vec()];
            builder = builder.use_preconfigured_tls(tls);
        }
        let client = crate::net::current().apply(builder)?.build().map_err(|e| format!("failed to build HTTP client: {e}"))?;
        map.insert(key, client.clone());
        Ok(client)
    }
}

/// A failed call: the HTTP status (0 when Google never answered) and Google's own message.
#[derive(Debug, Clone)]
pub struct ApiErr {
    pub status: u16,
    pub message: String,
    pub timeout: bool,
}

/// `{"error":{"status":"PERMISSION_DENIED","message":"…"}}` -> "PERMISSION_DENIED: …";
/// `{"error":"invalid_grant","error_description":"…"}` -> "invalid_grant: …"; else the status and body.
pub fn google_error(status: u16, body: &[u8]) -> String {
    if let Ok(v) = serde_json::from_slice::<Value>(body) {
        match v.get("error") {
            Some(Value::Object(e)) => {
                let msg = e.get("message").and_then(Value::as_str).unwrap_or("").trim();
                let code = e.get("status").and_then(Value::as_str).unwrap_or("").trim();
                match (code.is_empty(), msg.is_empty()) {
                    (false, false) => return format!("{code}: {msg}"),
                    (true, false) => return msg.to_string(),
                    (false, true) => return code.to_string(),
                    _ => {}
                }
            }
            Some(Value::String(code)) => {
                return match v.get("error_description").and_then(Value::as_str).map(str::trim).filter(|d| !d.is_empty()) {
                    Some(d) => format!("{code}: {d}"),
                    None => code.clone(),
                };
            }
            _ => {}
        }
    }
    let text = String::from_utf8_lossy(body);
    let text = text.trim();
    let cut: String = text.chars().take(300).collect();
    if cut.is_empty() {
        format!("HTTP {status}")
    } else {
        format!("HTTP {status}: {cut}")
    }
}

struct Api {
    clients: Clients,
    auth: AuthReq,
    /// https://pubsub.googleapis.com, or http://localhost:8085 for the emulator
    base: String,
    /// the endpoint as shown: host[:port]
    host: String,
    emulator: bool,
    timeout: Duration,
    quota_project: Option<String>,
}

impl Api {
    fn new(auth: &AuthReq, endpoint: &str, insecure: bool, timeout_ms: u64) -> Result<Self, String> {
        let emulator = auth.emulator();
        let raw = if emulator { auth.emulator_host.trim() } else { endpoint.trim() };
        let host = raw.trim_start_matches("https://").trim_start_matches("http://").trim_end_matches('/');
        let host = if host.is_empty() { DEFAULT_ENDPOINT } else { host };
        let base = format!("{}://{host}", if emulator { "http" } else { "https" });
        reqwest::Url::parse(&base).map_err(|e| format!("Invalid endpoint {host}: {e}"))?;
        Ok(Self {
            clients: Clients::new(insecure),
            auth: auth.clone(),
            host: host.to_string(),
            base,
            emulator,
            timeout: if timeout_ms == 0 { DEFAULT_TIMEOUT } else { Duration::from_millis(timeout_ms) },
            quota_project: auth::quota_project(auth),
        })
    }

    async fn token(&self) -> Result<Option<String>, auth::AuthError> {
        auth::access_token(&self.clients, &self.auth).await
    }

    async fn call(&self, method: Method, url: &str, body: Option<Value>, timeout: Duration) -> Result<Value, ApiErr> {
        let token = self.token().await.map_err(|e| ApiErr { status: 401, message: e.message, timeout: false })?;
        let client = self.clients.get(url).map_err(|message| ApiErr { status: 0, message, timeout: false })?;
        let mut req = client.request(method, url).timeout(timeout);
        if let Some(t) = token {
            req = req.bearer_auth(t);
        }
        if let Some(q) = &self.quota_project {
            req = req.header("x-goog-user-project", q);
        }
        if let Some(b) = body {
            req = req.header(reqwest::header::CONTENT_TYPE, "application/json").body(b.to_string());
        }
        let res = req.send().await.map_err(|e| ApiErr { status: 0, message: crate::http::root_cause(&e), timeout: e.is_timeout() })?;
        let status = res.status().as_u16();
        let bytes = res.bytes().await.map_err(|e| ApiErr { status: 0, message: e.to_string(), timeout: e.is_timeout() })?;
        if status >= 400 {
            return Err(ApiErr { status, message: google_error(status, &bytes), timeout: false });
        }
        if bytes.iter().all(u8::is_ascii_whitespace) {
            return Ok(json!({}));
        }
        serde_json::from_slice(&bytes).map_err(|e| ApiErr { status, message: format!("The answer is not JSON: {e}"), timeout: false })
    }

    async fn get(&self, url: &str) -> Result<Value, ApiErr> {
        self.call(Method::GET, url, None, self.timeout).await
    }

    /// Every item of a paged list (`pageToken` / `nextPageToken`).
    async fn list_all(&self, url: &str, field: &str) -> Result<Vec<Value>, ApiErr> {
        let mut out = Vec::new();
        let mut page: Option<String> = None;
        for _ in 0..MAX_PAGES {
            let u = match &page {
                Some(p) => format!("{url}{}pageToken={p}", if url.contains('?') { "&" } else { "?" }),
                None => url.to_string(),
            };
            let v = self.get(&u).await?;
            if let Some(items) = v.get(field).and_then(Value::as_array) {
                out.extend(items.iter().cloned());
            }
            page = v.get("nextPageToken").and_then(Value::as_str).filter(|s| !s.is_empty()).map(String::from);
            if page.is_none() {
                break;
            }
        }
        Ok(out)
    }

    async fn subscriptions(&self, project: &str) -> Result<Vec<Value>, ApiErr> {
        self.list_all(&format!("{}/v1/projects/{project}/subscriptions?pageSize=1000", self.base), "subscriptions").await
    }

    fn url(&self, path: &str) -> String {
        format!("{}/v1/{path}", self.base)
    }

    async fn pull(&self, sub: &str, max: u32, immediately: bool) -> Result<Vec<Value>, ApiErr> {
        let mut body = json!({ "maxMessages": max });
        if immediately {
            // deprecated but still honoured: Peek must answer at once, not wait for traffic
            body["returnImmediately"] = json!(true);
        }
        let wait = if immediately { self.timeout } else { PULL_WAIT };
        let v = self.call(Method::POST, &self.url(&format!("{sub}:pull")), Some(body), wait).await?;
        Ok(v.get("receivedMessages").and_then(Value::as_array).cloned().unwrap_or_default())
    }

    async fn ack(&self, sub: &str, ids: Vec<String>) -> Result<(), ApiErr> {
        if ids.is_empty() {
            return Ok(());
        }
        self.call(Method::POST, &self.url(&format!("{sub}:acknowledge")), Some(json!({ "ackIds": ids })), self.timeout).await.map(|_| ())
    }

    /// Ack deadline 0: the messages go back to the subscription at once.
    async fn hand_back(&self, sub: &str, ids: Vec<String>) -> Result<(), ApiErr> {
        if ids.is_empty() {
            return Ok(());
        }
        self.call(Method::POST, &self.url(&format!("{sub}:modifyAckDeadline")), Some(json!({ "ackIds": ids, "ackDeadlineSeconds": 0 })), self.timeout)
            .await
            .map(|_| ())
    }
}

// ---------- names and values ----------

pub fn topic_path(project: &str, topic: &str) -> String {
    format!("projects/{project}/topics/{topic}")
}

pub fn sub_path(project: &str, sub: &str) -> String {
    format!("projects/{project}/subscriptions/{sub}")
}

/// "projects/p/topics/t" -> "t"
pub fn short(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

fn plural(n: usize, word: &str) -> String {
    match n {
        0 => "none".into(),
        1 => format!("1 {word}"),
        _ => format!("{n} {word}s"),
    }
}

fn nonempty(v: &Value, ptr: &str) -> Option<String> {
    v.pointer(ptr).and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty()).map(String::from)
}

/// How a subscription delivers: only Pull ones can be read here.
pub fn delivery(sub: &Value) -> &'static str {
    if nonempty(sub, "/pushConfig/pushEndpoint").is_some() {
        "Push"
    } else if nonempty(sub, "/bigqueryConfig/table").is_some() {
        "BigQuery"
    } else if nonempty(sub, "/cloudStorageConfig/bucket").is_some() {
        "Cloud Storage"
    } else {
        "Pull"
    }
}

fn dead_letter_of(sub: &Value) -> Option<DeadLetter> {
    let topic = nonempty(sub, "/deadLetterPolicy/deadLetterTopic")?;
    let max = sub.pointer("/deadLetterPolicy/maxDeliveryAttempts").and_then(Value::as_u64).unwrap_or(5) as u32;
    Some(DeadLetter { topic: short(&topic).to_string(), max_attempts: max })
}

pub fn sub_info(sub: &Value) -> Option<SubInfo> {
    let d = delivery(sub);
    Some(SubInfo {
        name: short(sub.get("name")?.as_str()?).to_string(),
        delivery: d,
        endpoint: match d {
            "Push" => nonempty(sub, "/pushConfig/pushEndpoint").map(|e| reqwest::Url::parse(&e).ok().and_then(|u| u.host_str().map(String::from)).unwrap_or(e)),
            "BigQuery" => nonempty(sub, "/bigqueryConfig/table"),
            "Cloud Storage" => nonempty(sub, "/cloudStorageConfig/bucket"),
            _ => None,
        },
        ack_deadline: sub.get("ackDeadlineSeconds").and_then(Value::as_u64).unwrap_or(10) as u32,
        filter: nonempty(sub, "/filter"),
        dead_letter: dead_letter_of(sub).map(|d| format!("{} · {}", d.topic, d.max_attempts)),
        ordering: sub.get("enableMessageOrdering").and_then(Value::as_bool).unwrap_or(false),
    })
}

/// "604800s" -> "7 days"; "3600.5s" -> "1 hour"
pub fn duration_label(s: &str) -> Option<String> {
    let secs = s.trim().trim_end_matches('s').parse::<f64>().ok()? as u64;
    if secs == 0 {
        return None;
    }
    let unit = |n: u64, w: &str| if n == 1 { format!("1 {w}") } else { format!("{n} {w}s") };
    Some(if secs.is_multiple_of(86_400) {
        unit(secs / 86_400, "day")
    } else if secs.is_multiple_of(3600) {
        unit(secs / 3600, "hour")
    } else if secs.is_multiple_of(60) {
        unit(secs / 60, "minute")
    } else {
        unit(secs, "second")
    })
}

/// RFC 3339 in UTC as Google writes it ("2026-11-18T03:14:07.312345Z") -> ms since the epoch.
pub fn rfc3339_ms(s: &str) -> Option<i64> {
    let s = s.trim();
    let (date, rest) = s.split_once('T')?;
    let mut d = date.split('-');
    let (y, m, day): (i64, i64, i64) = (d.next()?.parse().ok()?, d.next()?.parse().ok()?, d.next()?.parse().ok()?);
    let (time, offset_min) = if let Some(t) = rest.strip_suffix('Z') {
        (t, 0)
    } else {
        // +07:00 / -05:30
        let at = rest.rfind(['+', '-'])?;
        let (t, off) = rest.split_at(at);
        let sign = if off.starts_with('-') { -1 } else { 1 };
        let (oh, om) = off[1..].split_once(':')?;
        (t, sign * (oh.parse::<i64>().ok()? * 60 + om.parse::<i64>().ok()?))
    };
    let (hms, frac) = time.split_once('.').unwrap_or((time, ""));
    let mut t = hms.split(':');
    let (hh, mm, ss): (i64, i64, i64) = (t.next()?.parse().ok()?, t.next()?.parse().ok()?, t.next()?.parse().ok()?);
    let ms: i64 = if frac.is_empty() { 0 } else { format!("{:0<3}", &frac[..frac.len().min(3)]).parse().ok()? };
    // days from 1970-01-01 (Howard Hinnant's days_from_civil)
    let yy = if m <= 2 { y - 1 } else { y };
    let era = if yy >= 0 { yy } else { yy - 399 } / 400;
    let yoe = yy - era * 400;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    Some(((days * 86_400 + hh * 3600 + mm * 60 + ss - offset_min * 60) * 1000) + ms)
}

/// Google's base64 data as the list shows it: text when it is UTF-8, else base64 with `bin`.
fn data_of(b64: &str) -> (String, bool, usize) {
    match base64::engine::general_purpose::STANDARD.decode(b64.trim()) {
        Ok(bytes) => {
            let n = bytes.len();
            match String::from_utf8(bytes) {
                Ok(t) => (t, false, n),
                Err(_) => (b64.trim().to_string(), true, n),
            }
        }
        Err(_) => (b64.to_string(), true, b64.len()),
    }
}

fn attributes_of(msg: &Value) -> Vec<Kv> {
    let mut out: Vec<Kv> = msg
        .get("attributes")
        .and_then(Value::as_object)
        .map(|o| o.iter().map(|(k, v)| Kv { key: k.clone(), value: v.as_str().unwrap_or_default().to_string() }).collect())
        .unwrap_or_default();
    out.sort_by(|a, b| a.key.cmp(&b.key));
    out
}

/// A received message as an event, and its ack id.
fn received(rm: &Value, handed: &'static str, at_ms: u64) -> Option<(PubsubEvent, String, String)> {
    let ack_id = rm.get("ackId")?.as_str()?.to_string();
    let msg = rm.get("message")?;
    let id = msg.get("messageId").and_then(Value::as_str).unwrap_or_default().to_string();
    let (data, value_bin, size) = data_of(msg.get("data").and_then(Value::as_str).unwrap_or(""));
    let ev = PubsubEvent::Message {
        dir: "in",
        kind: "record",
        data,
        value_bin,
        message_id: Some(id.clone()),
        key: nonempty(msg, "/orderingKey"),
        headers: attributes_of(msg),
        ts: msg.get("publishTime").and_then(Value::as_str).and_then(rfc3339_ms),
        attempt: rm.get("deliveryAttempt").and_then(Value::as_u64).map(|n| n as u32),
        handed: Some(handed),
        ack_id: None,
        ack_ms: None,
        error: None,
        size,
        at_ms,
    };
    Some((ev, ack_id, id))
}

/// "temp" -> a fresh name nobody else uses
fn temp_name() -> String {
    use ring::rand::SecureRandom;
    let mut b = [0u8; 3];
    let _ = ring::rand::SystemRandom::new().fill(&mut b);
    format!("voidhttp-{:02x}{:02x}{:02x}", b[0], b[1], b[2])
}

// ---------- the connection ----------

struct Fail {
    stage: &'static str,
    message: String,
    hint: Option<String>,
}

impl Fail {
    fn new(stage: &'static str, e: &ApiErr, hint: Option<String>) -> Self {
        Self { stage: if e.status == 401 { "auth" } else { stage }, message: e.message.clone(), hint }
    }
}

struct Session {
    api: Arc<Api>,
    req: PubsubRequest,
    project: String,
    topic: String,
    /// the full subscription path being read
    sub: Option<String>,
    /// the subscription is ours: delete it on the way out
    temp: bool,
    info: Info,
    started: Instant,
    emit: Emit,
}

async fn run(api: Arc<Api>, req: PubsubRequest, mut rx: mpsc::Receiver<Cmd>, emit: Emit) {
    let started = Instant::now();
    let elapsed = move || started.elapsed().as_millis() as u64;
    // Disconnect while signing in stops it; anything else sent before then has nowhere to go
    let cancelled = async {
        loop {
            match rx.recv().await {
                Some(Cmd::Close) | None => return,
                Some(_) => {}
            }
        }
    };
    let setup = tokio::select! {
        s = Session::start(api, req, started, emit.clone()) => s,
        _ = cancelled => {
            emit(PubsubEvent::Close { by: "client", reason: "Cancelled".into(), elapsed_ms: elapsed() });
            return;
        }
    };
    let mut session = match setup {
        Ok(s) => s,
        Err(f) => {
            emit(PubsubEvent::Failed { stage: f.stage, message: f.message, hint: f.hint, elapsed_ms: elapsed() });
            return;
        }
    };
    emit(PubsubEvent::Connected { info: session.info.clone(), elapsed_ms: elapsed() });
    session.run(&mut rx).await;
}

impl Session {
    async fn start(api: Arc<Api>, req: PubsubRequest, started: Instant, emit: Emit) -> Result<Self, Fail> {
        let project = req.project.trim().to_string();
        let topic = req.topic.trim().to_string();
        let token = api.token().await.map_err(|e| Fail { stage: "auth", message: e.message, hint: e.hint })?;
        let identity = match (auth::identity(&req.auth), &token) {
            (Some(id), _) => Some(id),
            (None, Some(t)) => auth::token_email(&api.clients, t).await,
            (None, None) => None,
        };
        let mut s = Session {
            info: Info {
                project: project.clone(),
                topic: topic.clone(),
                endpoint: api.host.clone(),
                emulator: api.emulator,
                identity,
                auth_kind: req.auth.kind.clone(),
                mode: req.mode.clone(),
                ..Default::default()
            },
            api,
            project,
            topic,
            sub: None,
            temp: false,
            started,
            emit,
            req,
        };
        s.check_topic().await?;
        s.set_up_reading().await?;
        s.facts().await;
        Ok(s)
    }

    fn at(&self) -> u64 {
        self.started.elapsed().as_millis() as u64
    }

    fn notice(&self, message: String) {
        (self.emit)(PubsubEvent::Notice { message });
    }

    /// The topic must exist. Reading its settings may be refused (a publisher-only account): that
    /// only leaves the Topic tab emptier.
    async fn check_topic(&mut self) -> Result<(), Fail> {
        let path = topic_path(&self.project, &self.topic);
        match self.api.get(&self.api.url(&path)).await {
            Ok(_) => Ok(()),
            Err(e) if e.status == 404 && self.api.emulator && self.req.create_topic => {
                self.api.call(Method::PUT, &self.api.url(&path), Some(json!({})), self.api.timeout).await.map_err(|e| Fail::new("topic", &e, None))?;
                self.notice(format!("Made the topic {} on the emulator", self.topic));
                Ok(())
            }
            Err(e) if e.status == 404 => Err(Fail::new(
                "topic",
                &e,
                Some(format!("There is no topic {} in {}. Check the topic name and the project ID.", self.topic, self.project)),
            )),
            Err(e) if e.status == 403 => {
                self.notice(format!("Can't read the topic's settings ({}); publishing and reading may still work.", e.message));
                Ok(())
            }
            Err(e) => Err(Fail::new("topic", &e, (e.status == 0).then(|| format!("Couldn't reach {}. Check the network or proxy settings.", self.api.host)))),
        }
    }

    async fn set_up_reading(&mut self) -> Result<(), Fail> {
        match self.req.mode.as_str() {
            "temp" => {
                let name = temp_name();
                let path = sub_path(&self.project, &name);
                let mut body = json!({
                    "topic": topic_path(&self.project, &self.topic),
                    "ackDeadlineSeconds": self.req.ack_deadline.clamp(10, 600),
                    "enableMessageOrdering": self.req.ordering,
                    "expirationPolicy": { "ttl": "86400s" },
                    "messageRetentionDuration": "600s",
                    "labels": { "created-by": "voidhttp" },
                });
                if !self.req.filter.trim().is_empty() {
                    body["filter"] = json!(self.req.filter.trim());
                }
                self.api.call(Method::PUT, &self.api.url(&path), Some(body), self.api.timeout).await.map_err(|e| {
                    let hint = match e.status {
                        403 => Some(format!(
                            "The account may not create subscriptions in {}. Ask for Pub/Sub Editor, or Peek an existing subscription instead (Pub/Sub Subscriber is enough).",
                            self.project
                        )),
                        400 if !self.req.filter.trim().is_empty() => Some("Check the filter, e.g. attributes.eventType = \"transfer.completed\".".into()),
                        _ => None,
                    };
                    Fail::new("subscription", &e, hint)
                })?;
                self.sub = Some(path);
                self.temp = true;
                self.info.subscription = Some(name);
            }
            "peek" | "consume" => {
                let name = self.req.subscription.trim().to_string();
                let path = sub_path(&self.project, &name);
                match self.api.get(&self.api.url(&path)).await {
                    Ok(v) => {
                        let d = delivery(&v);
                        if d != "Pull" {
                            return Err(Fail {
                                stage: "subscription",
                                message: format!("{name} is a {d} subscription and can't be pulled"),
                                hint: Some("Peek and Consume work on Pull subscriptions only.".into()),
                            });
                        }
                        let want = topic_path(&self.project, &self.topic);
                        if let Some(t) = v.get("topic").and_then(Value::as_str).filter(|t| *t != want) {
                            self.notice(format!("{name} reads {}, not {}. Publish still goes to {}.", short(t), self.topic, self.topic));
                        }
                        self.info.dead_letter = dead_letter_of(&v);
                    }
                    Err(e) if e.status == 404 => {
                        return Err(Fail::new("subscription", &e, Some(format!("There is no subscription {name} in {}.", self.project))));
                    }
                    // Pub/Sub Subscriber may pull but not read the settings: go on without them
                    Err(e) if e.status == 403 => self.notice(format!("Can't read {name}'s settings ({}); pulling may still work.", e.message)),
                    Err(e) => return Err(Fail::new("subscription", &e, None)),
                }
                self.sub = Some(path);
                self.info.subscription = Some(name);
            }
            _ => {}
        }
        Ok(())
    }

    /// The Topic tab: the topic's settings and its subscriptions, each as far as allowed.
    async fn facts(&mut self) {
        let path = topic_path(&self.project, &self.topic);
        if let Ok(t) = self.api.get(&self.api.url(&path)).await {
            self.info.retention = t.get("messageRetentionDuration").and_then(Value::as_str).and_then(duration_label);
            self.info.schema = nonempty(&t, "/schemaSettings/schema").map(|s| short(&s).to_string());
            self.info.kms = nonempty(&t, "/kmsKeyName");
            self.info.labels = t
                .get("labels")
                .and_then(Value::as_object)
                .map(|o| o.iter().map(|(k, v)| Kv { key: k.clone(), value: v.as_str().unwrap_or_default().into() }).collect())
                .unwrap_or_default();
        }
        match self.api.subscriptions(&self.project).await {
            Ok(subs) => {
                self.info.subscriptions = Some(subs.iter().filter(|s| s.get("topic").and_then(Value::as_str) == Some(path.as_str())).filter_map(sub_info).collect());
                self.info.subs_error = None;
            }
            Err(e) => {
                self.info.subscriptions = None;
                self.info.subs_error = Some(e.message);
            }
        }
    }

    fn reads_live(&self) -> bool {
        matches!(self.req.mode.as_str(), "temp" | "consume") && self.sub.is_some()
    }

    /// Pulls until cancelled, acking what it showed. Runs beside the command loop so a publish
    /// never waits behind a long poll.
    fn start_reader(&self, lost: mpsc::UnboundedSender<String>) -> (CancellationToken, tokio::task::JoinHandle<()>) {
        let token = CancellationToken::new();
        let (api, sub, emit, started, stop) = (self.api.clone(), self.sub.clone().unwrap_or_default(), self.emit.clone(), self.started, token.clone());
        let handle = tokio::spawn(async move {
            let mut fails = 0;
            loop {
                let res = tokio::select! {
                    _ = stop.cancelled() => return,
                    r = api.pull(&sub, PULL_MAX, false) => r,
                };
                match res {
                    Ok(msgs) => {
                        fails = 0;
                        let at = started.elapsed().as_millis() as u64;
                        let mut ids = Vec::new();
                        for rm in &msgs {
                            if let Some((ev, ack, _)) = received(rm, "acked", at) {
                                emit(ev);
                                ids.push(ack);
                            }
                        }
                        if let Err(e) = api.ack(&sub, ids).await {
                            emit(PubsubEvent::Notice { message: format!("Couldn't ack: {}. Those messages will come again.", e.message) });
                        }
                    }
                    // a long poll that heard nothing
                    Err(e) if e.timeout => {}
                    Err(e) => {
                        fails += 1;
                        if fails >= MAX_FAILS || matches!(e.status, 401 | 403 | 404) {
                            let _ = lost.send(e.message);
                            return;
                        }
                        tokio::select! {
                            _ = stop.cancelled() => return,
                            _ = tokio::time::sleep(Duration::from_secs(1)) => {}
                        }
                    }
                }
            }
        });
        (token, handle)
    }

    async fn run(&mut self, rx: &mut mpsc::Receiver<Cmd>) {
        let (lost_tx, mut lost_rx) = mpsc::unbounded_channel::<String>();
        let mut reader = self.reads_live().then(|| self.start_reader(lost_tx.clone()));
        let mut seen: HashSet<String> = HashSet::new();
        let mut pulls = 0u32;
        let (by, reason) = loop {
            tokio::select! {
                cmd = rx.recv() => match cmd {
                    None | Some(Cmd::Close) => break ("client", "Disconnected".to_string()),
                    Some(Cmd::Publish(p)) => self.publish(p),
                    Some(Cmd::Pull(max)) => {
                        if self.req.mode == "peek" {
                            pulls += 1;
                            self.peek(pulls, max.clamp(1, 1000), &mut seen).await;
                        } else {
                            self.notice("Pull is for Peek; this connection reads on its own.".into());
                        }
                    }
                    Some(Cmd::Pause(paused)) => {
                        if paused {
                            if let Some((t, h)) = reader.take() {
                                t.cancel();
                                let _ = h.await;
                            }
                        } else if reader.is_none() && self.reads_live() {
                            reader = Some(self.start_reader(lost_tx.clone()));
                        }
                        (self.emit)(PubsubEvent::Paused { paused, at_ms: self.at() });
                    }
                    Some(Cmd::Refresh) => {
                        self.facts().await;
                        (self.emit)(PubsubEvent::Topic { info: self.info.clone() });
                    }
                },
                Some(why) = lost_rx.recv() => break ("lost", why),
            }
        };
        if let Some((t, h)) = reader.take() {
            t.cancel();
            let _ = h.await;
        }
        let reason = match self.delete_temp().await {
            Err(e) => format!(
                "{reason}. The temporary subscription {} could not be deleted ({e}); Google removes it after 24 hours unused.",
                self.info.subscription.clone().unwrap_or_default()
            ),
            Ok(()) => reason,
        };
        (self.emit)(PubsubEvent::Close { by, reason, elapsed_ms: self.at() });
    }

    async fn delete_temp(&mut self) -> Result<(), String> {
        if !self.temp {
            return Ok(());
        }
        let Some(path) = self.sub.clone() else { return Ok(()) };
        self.temp = false;
        match self.api.call(Method::DELETE, &self.api.url(&path), None, self.api.timeout).await {
            Ok(_) => Ok(()),
            Err(e) if e.status == 404 => Ok(()),
            Err(e) => Err(e.message),
        }
    }

    /// Shows the message, then Google's answer under it (its message ID, or why not).
    fn publish(&self, p: Publish) {
        let at = self.at();
        let key = p.ordering_key.as_deref().map(str::trim).filter(|k| !k.is_empty()).map(String::from);
        let attrs: Vec<Kv> = p.attributes.into_iter().filter(|a| !a.key.trim().is_empty()).collect();
        (self.emit)(PubsubEvent::Message {
            dir: "out",
            kind: "record",
            size: p.data.len(),
            data: p.data.clone(),
            value_bin: false,
            message_id: None,
            key: key.clone(),
            headers: attrs.clone(),
            ts: None,
            attempt: None,
            handed: None,
            ack_id: Some(p.seq),
            ack_ms: None,
            error: None,
            at_ms: at,
        });
        let mut msg = json!({ "data": base64::engine::general_purpose::STANDARD.encode(p.data.as_bytes()) });
        if !attrs.is_empty() {
            let m: serde_json::Map<String, Value> = attrs.iter().map(|a| (a.key.trim().to_string(), json!(a.value))).collect();
            msg["attributes"] = Value::Object(m);
        }
        if let Some(k) = &key {
            msg["orderingKey"] = json!(k);
        }
        let (api, emit, started, seq) = (self.api.clone(), self.emit.clone(), self.started, p.seq);
        let url = self.api.url(&format!("{}:publish", topic_path(&self.project, &self.topic)));
        tokio::spawn(async move {
            let sent = Instant::now();
            let res = api.call(Method::POST, &url, Some(json!({ "messages": [msg] })), api.timeout).await;
            let (message_id, error) = match res {
                Ok(v) => (v.pointer("/messageIds/0").and_then(Value::as_str).map(String::from), None),
                Err(e) => (None, Some(e.message)),
            };
            emit(PubsubEvent::Message {
                dir: "in",
                kind: "ack",
                data: String::new(),
                value_bin: false,
                message_id,
                key: None,
                headers: Vec::new(),
                ts: None,
                attempt: None,
                handed: None,
                ack_id: Some(seq),
                ack_ms: Some(sent.elapsed().as_millis() as u64),
                error,
                size: 0,
                at_ms: started.elapsed().as_millis() as u64,
            });
        });
    }

    /// One Peek: pull, show what's new, hand everything back at once.
    async fn peek(&self, n: u32, max: u32, seen: &mut HashSet<String>) {
        let Some(sub) = self.sub.clone() else { return };
        let msgs = match self.api.pull(&sub, max, true).await {
            Ok(m) => m,
            Err(e) => return self.notice(format!("Pull {n} failed: {}", e.message)),
        };
        let at = self.at();
        let mut fresh = Vec::new();
        let mut ids = Vec::new();
        let mut skipped = 0;
        for rm in &msgs {
            let Some((ev, ack, id)) = received(rm, "returned", at) else { continue };
            ids.push(ack);
            if seen.insert(id) {
                fresh.push(ev);
            } else {
                skipped += 1;
            }
        }
        (self.emit)(PubsubEvent::Pulled { n, count: fresh.len(), skipped, at_ms: at });
        for ev in fresh {
            (self.emit)(ev);
        }
        if let Err(e) = self.api.hand_back(&sub, ids).await {
            self.notice(format!("Couldn't hand the messages back ({}); they return after the ack deadline.", e.message));
        }
    }
}
