//! Socket.IO client over the WebSocket engine (ws.rs). WebSocket transport only, no long-polling.
//! Speaks Engine.IO 4 (Socket.IO 3 and 4) and Engine.IO 3 (Socket.IO 2): the open packet,
//! heartbeats, one namespace with its handshake auth, events with one or more arguments,
//! acks and binary attachments (received only).

use std::time::{Duration, Instant};

use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{ipc::Channel as IpcChannel, State};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::{
    self,
    protocol::{frame::coding::CloseCode, CloseFrame},
    Message,
};

use crate::http::Kv;
use crate::ws::{self, Conns, Handshake, WsRequest, CLOSE_GRACE};

// ---------- wire types (camelCase to the webview) ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SioRequest {
    /// client id, used to emit and close
    pub id: String,
    /// the server: http(s):// or ws(s)://; a path on it is read as the namespace when `namespace` is empty
    pub url: String,
    #[serde(default)]
    pub headers: Vec<Kv>,
    /// where the server mounts Socket.IO; /socket.io when empty
    #[serde(default)]
    pub path: String,
    #[serde(default)]
    pub namespace: String,
    /// sent with the namespace CONNECT (Engine.IO 4 only)
    #[serde(default)]
    pub auth: Option<Value>,
    /// Engine.IO version: 4 for Socket.IO 3 and 4, 3 for Socket.IO 2
    #[serde(default = "eio_default")]
    pub eio: u8,
    #[serde(default)]
    pub insecure: bool,
    #[serde(default)]
    pub timeout_ms: u64,
}

fn eio_default() -> u8 {
    4
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "type")]
pub enum SioEvent {
    /// the WebSocket upgrade succeeded (101)
    Open(Handshake),
    /// the server answered the upgrade with plain HTTP; the connection ends here
    Refused(Handshake),
    /// Engine.IO's open packet
    Engine {
        sid: String,
        upgrades: Vec<String>,
        ping_interval: u64,
        ping_timeout: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        max_payload: Option<u64>,
        at_ms: u64,
    },
    /// the namespace accepted the CONNECT
    Joined {
        namespace: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        sid: Option<String>,
        at_ms: u64,
    },
    /// the namespace refused the CONNECT; the connection closes after it
    ConnectError {
        namespace: String,
        message: String,
        /// the error's `data`, as JSON
        #[serde(skip_serializing_if = "Option::is_none")]
        data: Option<String>,
        at_ms: u64,
    },
    Message {
        /// "in" from the server, "out" to it
        dir: &'static str,
        /// "event", or "ack" answering the emit `ack_id`
        kind: &'static str,
        #[serde(skip_serializing_if = "Option::is_none")]
        event: Option<String>,
        /// the arguments, as a JSON array
        data: String,
        argc: usize,
        /// an event: the id its sender waits on an ack for; an ack: the emit it answers
        #[serde(skip_serializing_if = "Option::is_none")]
        ack_id: Option<u64>,
        /// an emit that waits for an ack: how long, 0 for no limit
        #[serde(skip_serializing_if = "Option::is_none")]
        ack_ms: Option<u64>,
        /// the frame's size, attachments included
        size: usize,
        /// ms since the socket opened
        at_ms: u64,
    },
    /// no ack for emit `ack_id` within its limit
    AckTimeout { ack_id: u64, at_ms: u64 },
    Close {
        /// the WebSocket close code
        code: u16,
        /// Socket.IO's reason: io server disconnect, io client disconnect, transport close,
        /// transport error, ping timeout, parse error, connect_error
        reason: String,
        /// "server" or "client" ended it; "lost" when it dropped or stopped answering
        by: &'static str,
        /// ms the socket was open
        elapsed_ms: u64,
    },
}

// ---------- state ----------

enum Cmd {
    Emit { event: String, args: Vec<Value>, ack_ms: Option<u64> },
    Close,
}

#[derive(Default)]
pub struct SioState {
    conns: Conns<Cmd>,
}

// ---------- commands ----------

/// Opens the socket, joins the namespace and runs until it closes. Err only when the socket never opened.
#[tauri::command]
pub async fn sio_connect(state: State<'_, SioState>, request: SioRequest, on_event: IpcChannel<SioEvent>) -> Result<(), String> {
    let (url, nsp) = endpoint(&request.url, &request.path, &request.namespace, request.eio)?;
    let (mut rx, _guard) = state.conns.open(&request.id)?;
    let cancelled = async {
        loop {
            match rx.recv().await {
                Some(Cmd::Close) | None => return,
                Some(Cmd::Emit { .. }) => {}
            }
        }
    };
    let ws_req = WsRequest {
        id: request.id.clone(),
        url,
        headers: request.headers,
        subprotocols: vec![],
        insecure: request.insecure,
        ping_sec: 0,
        timeout_ms: request.timeout_ms,
    };
    let (socket, handshake) = ws::upgrade(&ws_req, cancelled).await?;
    let Some(socket) = socket else {
        let _ = on_event.send(SioEvent::Refused(handshake));
        return Ok(());
    };
    let _ = on_event.send(SioEvent::Open(handshake));
    let auth = if request.eio >= 4 { request.auth } else { None };
    run(socket, rx, &on_event, Session { eio: request.eio, nsp, auth }).await;
    Ok(())
}

/// Emits one event on a joined namespace; `ack_ms` asks for an ack (0 waits as long as the socket is open).
#[tauri::command]
pub async fn sio_emit(state: State<'_, SioState>, id: String, event: String, args: Vec<Value>, ack_ms: Option<u64>) -> Result<(), String> {
    if event.trim().is_empty() {
        return Err("Enter an event name".into());
    }
    let tx = state.conns.get(&id).ok_or("The connection is closed")?;
    tx.send(Cmd::Emit { event, args, ack_ms }).await.map_err(|_| "The connection is closed".to_string())
}

/// Leaves the namespace and closes the socket, or stops a handshake still running.
#[tauri::command]
pub async fn sio_close(state: State<'_, SioState>, id: String) -> Result<(), String> {
    if let Some(tx) = state.conns.get(&id) {
        let _ = tx.send(Cmd::Close).await;
    }
    Ok(())
}

// ---------- the endpoint ----------

/// The Engine.IO URL and the namespace: `https://host/chat` with an empty namespace joins /chat
/// on `wss://host/socket.io/?EIO=4&transport=websocket`, as socket.io-client reads it.
fn endpoint(raw: &str, path: &str, namespace: &str, eio: u8) -> Result<(String, String), String> {
    let ws_url = ws::normalize_url(raw)?;
    let mut u = url::Url::parse(&ws_url).map_err(|e| format!("Invalid URL: {e}"))?;
    let mount = match path.trim().trim_matches('/') {
        "" => "socket.io".to_string(),
        p => p.to_string(),
    };
    let url_path = u.path().trim_matches('/').to_string();
    let ns = namespace.trim().trim_matches('/');
    let nsp = if !ns.is_empty() {
        format!("/{ns}")
    } else if !url_path.is_empty() && url_path != mount {
        format!("/{url_path}")
    } else {
        "/".to_string()
    };
    u.set_path(&format!("/{mount}/"));
    let keep: Vec<(String, String)> = u
        .query_pairs()
        .filter(|(k, _)| k != "EIO" && k != "transport")
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect();
    u.query_pairs_mut()
        .clear()
        .extend_pairs(keep)
        .append_pair("EIO", if eio >= 4 { "4" } else { "3" })
        .append_pair("transport", "websocket");
    Ok((u.to_string(), nsp))
}

// ---------- packets ----------

/// A Socket.IO packet: `<type>[<attachments>-][<nsp>,][<id>][<json>]`.
#[derive(Debug, PartialEq)]
struct Packet {
    kind: u8,
    attachments: usize,
    nsp: String,
    id: Option<u64>,
    data: Option<Value>,
}

const CONNECT: u8 = 0;
const DISCONNECT: u8 = 1;
const EVENT: u8 = 2;
const ACK: u8 = 3;
const CONNECT_ERROR: u8 = 4;
const BINARY_EVENT: u8 = 5;
const BINARY_ACK: u8 = 6;

fn decode(s: &str) -> Option<Packet> {
    let b = s.as_bytes();
    let kind = b.first()?.checked_sub(b'0').filter(|k| *k <= 6)?;
    let mut i = 1;
    let mut attachments = 0;
    if kind == BINARY_EVENT || kind == BINARY_ACK {
        let dash = s[i..].find('-')? + i;
        attachments = s[i..dash].parse().ok()?;
        i = dash + 1;
    }
    let mut nsp = "/".to_string();
    if b.get(i) == Some(&b'/') {
        let end = s[i..].find(',').map(|e| e + i).unwrap_or(s.len());
        // Socket.IO 2 may carry a query on the namespace: /chat?token=x
        nsp = s[i..end].split('?').next().unwrap_or("/").to_string();
        i = (end + 1).min(s.len());
    }
    let digits = s[i..].bytes().take_while(u8::is_ascii_digit).count();
    let id = if digits > 0 { s[i..i + digits].parse().ok() } else { None };
    i += digits;
    let rest = &s[i..];
    let data = if rest.is_empty() { None } else { Some(serde_json::from_str(rest).ok()?) };
    Some(Packet { kind, attachments, nsp, id, data })
}

fn encode(kind: u8, nsp: &str, id: Option<u64>, data: Option<&Value>) -> String {
    let mut s = kind.to_string();
    if nsp != "/" {
        s.push_str(nsp);
        s.push(',');
    }
    if let Some(id) = id {
        s.push_str(&id.to_string());
    }
    if let Some(d) = data {
        s.push_str(&d.to_string());
    }
    s
}

/// Puts each attachment where its placeholder is, as `{"$binary": base64, "size": n}`.
fn fill_placeholders(v: &mut Value, bins: &[Vec<u8>]) {
    match v {
        Value::Object(o) if o.get("_placeholder") == Some(&Value::Bool(true)) => {
            let bin = o.get("num").and_then(Value::as_u64).and_then(|n| bins.get(n as usize));
            if let Some(b) = bin {
                *v = serde_json::json!({ "$binary": base64::engine::general_purpose::STANDARD.encode(b), "size": b.len() });
            }
        }
        Value::Object(o) => o.values_mut().for_each(|x| fill_placeholders(x, bins)),
        Value::Array(a) => a.iter_mut().for_each(|x| fill_placeholders(x, bins)),
        _ => {}
    }
}

// ---------- the open socket ----------

struct Session {
    eio: u8,
    nsp: String,
    auth: Option<Value>,
}

/// A binary packet waiting for its attachments.
struct Partial {
    packet: Packet,
    bins: Vec<Vec<u8>>,
    size: usize,
}

async fn run<S>(socket: tokio_tungstenite::WebSocketStream<S>, mut rx: mpsc::Receiver<Cmd>, events: &IpcChannel<SioEvent>, s: Session)
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    let opened = Instant::now();
    let at = || opened.elapsed().as_millis() as u64;
    let (mut sink, mut stream) = socket.split();
    let send = |text: String| Message::text(text);

    // set by Engine.IO's open packet
    let mut heartbeat: Option<(Duration, Duration)> = None;
    // the server must be heard from before this, or the socket is dead (ping timeout)
    let mut alive_until: Option<tokio::time::Instant> = None;
    // Engine.IO 3: the client pings
    let mut ping: Option<tokio::time::Interval> = None;
    let mut joined = false;
    let mut next_ack: u64 = 0;
    let mut waiting: Vec<(u64, Option<tokio::time::Instant>)> = vec![];
    let mut partial: Option<Partial> = None;
    // set once we started a close: the server's close (or the grace period) ends the loop
    let mut closing: Option<tokio::time::Instant> = None;
    // Socket.IO's reason for the close we started, or the server's
    let mut reason: Option<(&'static str, &'static str)> = None;
    let mut server_close: Option<u16> = None;
    let mut commands_open = true;

    macro_rules! start_close {
        ($why:expr, $by:expr) => {{
            reason.get_or_insert(($why, $by));
            commands_open = false;
            let frame = CloseFrame { code: CloseCode::Normal, reason: "".into() };
            if sink.send(Message::Close(Some(frame))).await.is_err() {
                break 1000;
            }
            closing = Some(tokio::time::Instant::now() + CLOSE_GRACE);
        }};
    }

    let code: u16 = loop {
        let ack_deadline = waiting.iter().filter_map(|(_, d)| *d).min();
        tokio::select! {
            cmd = rx.recv(), if commands_open && closing.is_none() => match cmd {
                Some(Cmd::Emit { event, args, ack_ms }) => {
                    if !joined {
                        continue;
                    }
                    let id = ack_ms.map(|_| {
                        next_ack += 1;
                        next_ack - 1
                    });
                    let mut list = Vec::with_capacity(args.len() + 1);
                    list.push(Value::String(event.clone()));
                    list.extend(args.iter().cloned());
                    let text = format!("4{}", encode(EVENT, &s.nsp, id, Some(&Value::Array(list))));
                    let size = text.len();
                    if let Err(e) = sink.send(send(text)).await {
                        reason = Some(("transport error", "lost"));
                        break ws::lost(&e).0;
                    }
                    if let (Some(id), Some(ms)) = (id, ack_ms) {
                        waiting.push((id, (ms > 0).then(|| tokio::time::Instant::now() + Duration::from_millis(ms))));
                    }
                    let argc = args.len();
                    let data = Value::Array(args).to_string();
                    let _ = events.send(SioEvent::Message { dir: "out", kind: "event", event: Some(event), data, argc, ack_id: id, ack_ms, size, at_ms: at() });
                }
                Some(Cmd::Close) | None => {
                    if joined {
                        let _ = sink.send(send(format!("4{}", encode(DISCONNECT, &s.nsp, None, None)))).await;
                    }
                    start_close!("io client disconnect", "client");
                }
            },
            msg = stream.next() => match msg {
                Some(Ok(Message::Text(t))) => {
                    let text = t.as_str();
                    if let Some((interval, timeout)) = heartbeat {
                        alive_until = Some(tokio::time::Instant::now() + interval + timeout);
                    }
                    match text.as_bytes().first() {
                        // open: the heartbeat, then join the namespace
                        Some(b'0') => {
                            let open: Value = serde_json::from_str(&text[1..]).unwrap_or(Value::Null);
                            let interval = Duration::from_millis(open["pingInterval"].as_u64().unwrap_or(25_000));
                            let timeout = Duration::from_millis(open["pingTimeout"].as_u64().unwrap_or(20_000));
                            heartbeat = Some((interval, timeout));
                            alive_until = Some(tokio::time::Instant::now() + interval + timeout);
                            if s.eio < 4 {
                                ping = Some(tokio::time::interval_at(tokio::time::Instant::now() + interval, interval));
                            }
                            let _ = events.send(SioEvent::Engine {
                                sid: open["sid"].as_str().unwrap_or_default().to_string(),
                                upgrades: open["upgrades"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(str::to_string)).collect()).unwrap_or_default(),
                                ping_interval: interval.as_millis() as u64,
                                ping_timeout: timeout.as_millis() as u64,
                                max_payload: open["maxPayload"].as_u64(),
                                at_ms: at(),
                            });
                            // Engine.IO 4 joins every namespace, / too; Engine.IO 3 joins / by itself
                            if s.eio >= 4 || s.nsp != "/" {
                                let join = if s.eio >= 4 {
                                    encode(CONNECT, &s.nsp, None, s.auth.as_ref())
                                } else {
                                    format!("0{},", s.nsp)
                                };
                                if let Err(e) = sink.send(send(format!("4{join}"))).await {
                                    reason = Some(("transport error", "lost"));
                                    break ws::lost(&e).0;
                                }
                            }
                        }
                        Some(b'1') => start_close!("transport close", "server"),
                        // Engine.IO 4: the server pings, we answer
                        Some(b'2') => {
                            if let Err(e) = sink.send(send(format!("3{}", &text[1..]))).await {
                                reason = Some(("transport error", "lost"));
                                break ws::lost(&e).0;
                            }
                        }
                        Some(b'4') => {
                            let Some(p) = decode(&text[1..]) else {
                                start_close!("parse error", "lost");
                                continue;
                            };
                            if p.nsp != s.nsp {
                                continue; // Socket.IO 2 joins / first; other namespaces are not ours
                            }
                            if p.attachments > 0 {
                                partial = Some(Partial { packet: p, bins: vec![], size: text.len() });
                                continue;
                            }
                            match handle(p, text.len(), &mut joined, &mut waiting, &s, events, at()) {
                                Next::Go => {}
                                Next::Close(why, by) => start_close!(why, by),
                            }
                        }
                        _ => {} // pong, noop
                    }
                }
                Some(Ok(Message::Binary(b))) => {
                    if let Some(mut part) = partial.take() {
                        // Engine.IO 3 frames binary with a leading 4
                        let bytes = if s.eio < 4 && b.first() == Some(&4) { b[1..].to_vec() } else { b.to_vec() };
                        part.size += b.len();
                        part.bins.push(bytes);
                        if part.bins.len() < part.packet.attachments {
                            partial = Some(part);
                            continue;
                        }
                        let Partial { mut packet, bins, size } = part;
                        if let Some(d) = packet.data.as_mut() {
                            fill_placeholders(d, &bins);
                        }
                        packet.kind = if packet.kind == BINARY_ACK { ACK } else { EVENT };
                        if let Next::Close(why, by) = handle(packet, size, &mut joined, &mut waiting, &s, events, at()) {
                            start_close!(why, by);
                        }
                    }
                }
                Some(Ok(Message::Close(frame))) => {
                    let code = frame.map(|f| u16::from(f.code)).unwrap_or(1005);
                    if closing.is_none() {
                        server_close = Some(code);
                    } else {
                        break code;
                    }
                }
                Some(Ok(_)) => {}
                Some(Err(tungstenite::Error::ConnectionClosed)) | None => {
                    break match (server_close.take(), closing) {
                        (Some(code), _) => {
                            reason.get_or_insert(("transport close", "server"));
                            code
                        }
                        (None, Some(_)) => 1000,
                        (None, None) => {
                            reason.get_or_insert(("transport close", "lost"));
                            1006
                        }
                    };
                }
                Some(Err(e)) => {
                    break match server_close.take() {
                        Some(code) => {
                            reason.get_or_insert(("transport close", "server"));
                            code
                        }
                        None => {
                            reason.get_or_insert(("transport error", "lost"));
                            ws::lost(&e).0
                        }
                    };
                }
            },
            _ = ws::tick(&mut ping) => {
                if let Err(e) = sink.send(send("2".into())).await {
                    reason = Some(("transport error", "lost"));
                    break ws::lost(&e).0;
                }
            }
            _ = ws::until(alive_until), if closing.is_none() => start_close!("ping timeout", "lost"),
            _ = ws::until(ack_deadline) => {
                let now = tokio::time::Instant::now();
                waiting.retain(|(id, d)| {
                    let late = d.is_some_and(|d| d <= now);
                    if late {
                        let _ = events.send(SioEvent::AckTimeout { ack_id: *id, at_ms: at() });
                    }
                    !late
                });
            }
            _ = ws::until(closing) => break 1000,
        }
    };

    let (why, by) = reason.unwrap_or(("io client disconnect", "client"));
    let _ = events.send(SioEvent::Close { code, reason: why.to_string(), by, elapsed_ms: at() });
}

enum Next {
    Go,
    Close(&'static str, &'static str),
}

/// One whole packet of our namespace.
fn handle(p: Packet, size: usize, joined: &mut bool, waiting: &mut Vec<(u64, Option<tokio::time::Instant>)>, s: &Session, events: &IpcChannel<SioEvent>, at_ms: u64) -> Next {
    match p.kind {
        CONNECT => {
            *joined = true;
            let sid = p.data.as_ref().and_then(|d| d["sid"].as_str()).map(str::to_string);
            let _ = events.send(SioEvent::Joined { namespace: s.nsp.clone(), sid, at_ms });
            Next::Go
        }
        DISCONNECT => Next::Close("io server disconnect", "server"),
        CONNECT_ERROR => {
            // Socket.IO 3+: {"message", "data"}; Socket.IO 2: a string, or any value
            let (message, data) = match p.data {
                Some(Value::Object(mut o)) => (
                    o.get("message").and_then(Value::as_str).unwrap_or("Connection refused").to_string(),
                    o.remove("data").map(|d| d.to_string()),
                ),
                Some(Value::String(m)) => (m, None),
                Some(v) => (v.to_string(), None),
                None => ("Connection refused".into(), None),
            };
            let _ = events.send(SioEvent::ConnectError { namespace: s.nsp.clone(), message, data, at_ms });
            Next::Close("connect_error", "server")
        }
        EVENT | BINARY_EVENT => {
            let mut list = match p.data {
                Some(Value::Array(a)) => a,
                _ => return Next::Go,
            };
            if list.is_empty() {
                return Next::Go;
            }
            let event = match list.remove(0) {
                Value::String(e) => e,
                other => other.to_string(),
            };
            let argc = list.len();
            let _ = events.send(SioEvent::Message {
                dir: "in",
                kind: "event",
                event: Some(event),
                data: Value::Array(list).to_string(),
                argc,
                ack_id: p.id,
                ack_ms: None,
                size,
                at_ms,
            });
            Next::Go
        }
        ACK | BINARY_ACK => {
            let Some(id) = p.id else { return Next::Go };
            waiting.retain(|(w, _)| *w != id);
            let list = match p.data {
                Some(Value::Array(a)) => a,
                Some(v) => vec![v],
                None => vec![],
            };
            let argc = list.len();
            let _ = events.send(SioEvent::Message {
                dir: "in",
                kind: "ack",
                event: None,
                data: Value::Array(list).to_string(),
                argc,
                ack_id: Some(id),
                ack_ms: None,
                size,
                at_ms,
            });
            Next::Go
        }
        _ => Next::Go,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    #[test]
    fn endpoints() {
        let e = |u: &str, p: &str, n: &str, v: u8| endpoint(u, p, n, v).unwrap();
        assert_eq!(e("https://a.b", "", "", 4), ("wss://a.b/socket.io/?EIO=4&transport=websocket".into(), "/".into()));
        assert_eq!(e("http://localhost:3000/chat", "", "", 4), ("ws://localhost:3000/socket.io/?EIO=4&transport=websocket".into(), "/chat".into()));
        assert_eq!(e("https://a.b/chat?token=x", "/rt/", "admin", 3), ("wss://a.b/rt/?token=x&EIO=3&transport=websocket".into(), "/admin".into()));
        // a pasted Engine.IO URL is not a namespace
        assert_eq!(e("wss://a.b/socket.io/?EIO=3&transport=polling", "", "/", 4), ("wss://a.b/socket.io/?EIO=4&transport=websocket".into(), "/".into()));
    }

    #[test]
    fn packets() {
        assert_eq!(decode("0"), Some(Packet { kind: 0, attachments: 0, nsp: "/".into(), id: None, data: None }));
        assert_eq!(decode("0/chat,{\"sid\":\"x\"}").unwrap().data.unwrap()["sid"], "x");
        let p = decode("2/chat,12[\"ev\",1]").unwrap();
        assert_eq!((p.kind, p.nsp.as_str(), p.id), (2, "/chat", Some(12)));
        let p = decode("51-/up,[\"f\",{\"_placeholder\":true,\"num\":0}]").unwrap();
        assert_eq!((p.kind, p.attachments, p.nsp.as_str()), (5, 1, "/up"));
        assert_eq!(decode("0/chat?token=x,").unwrap().nsp, "/chat");
        assert_eq!(decode("4\"Not authorized\"").unwrap().data.unwrap(), "Not authorized");
        assert!(decode("9").is_none());
        assert!(decode("2[oops").is_none());
        assert_eq!(encode(2, "/", Some(0), Some(&serde_json::json!(["a", 1]))), "20[\"a\",1]");
        assert_eq!(encode(1, "/chat", None, None), "1/chat,");
        let mut v = serde_json::json!(["f", {"_placeholder": true, "num": 0}]);
        fill_placeholders(&mut v, &[vec![1, 2, 3]]);
        assert_eq!(v[1]["size"], 3);
    }

    fn collect() -> (IpcChannel<SioEvent>, Arc<Mutex<Vec<Value>>>) {
        let seen = Arc::new(Mutex::new(Vec::<Value>::new()));
        let sink = seen.clone();
        let ch = IpcChannel::new(move |body| {
            if let tauri::ipc::InvokeResponseBody::Json(j) = body {
                sink.lock().unwrap().push(serde_json::from_str(&j).unwrap());
            }
            Ok(())
        });
        (ch, seen)
    }

    /// A local Engine.IO 4 server: open, join with auth, emit with ack, a server event, client disconnect.
    #[tokio::test]
    async fn join_emit_ack_disconnect() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (tcp, _) = listener.accept().await.unwrap();
            let mut ws = tokio_tungstenite::accept_async(tcp).await.unwrap();
            ws.send(Message::text(r#"0{"sid":"eio1","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}"#)).await.unwrap();
            let mut got = vec![];
            while let Some(Ok(m)) = ws.next().await {
                let Message::Text(t) = m else { continue };
                let t = t.as_str().to_string();
                got.push(t.clone());
                if t.starts_with("40/chat,") {
                    ws.send(Message::text(r#"40/chat,{"sid":"s1"}"#)).await.unwrap();
                } else if t.starts_with("42/chat,0") {
                    ws.send(Message::text(r#"43/chat,0[{"ok":true}]"#)).await.unwrap();
                    ws.send(Message::text(r#"42/chat,["news","x",2]"#)).await.unwrap();
                }
            }
            got
        });

        let url = format!("ws://{addr}/socket.io/?EIO=4&transport=websocket");
        let (socket, _) = tokio_tungstenite::connect_async(url).await.unwrap();
        let (tx, rx) = mpsc::channel(8);
        let (events, seen) = collect();
        let session = Session { eio: 4, nsp: "/chat".into(), auth: Some(serde_json::json!({"token": "t"})) };
        let runner = tokio::spawn(async move { run(socket, rx, &events, session).await });
        tokio::time::sleep(Duration::from_millis(100)).await;
        tx.send(Cmd::Emit { event: "hi".into(), args: vec![serde_json::json!({"a": 1})], ack_ms: Some(5000) }).await.unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;
        tx.send(Cmd::Close).await.unwrap();
        runner.await.unwrap();

        let got = server.await.unwrap();
        assert_eq!(got, [r#"40/chat,{"token":"t"}"#, r#"42/chat,0["hi",{"a":1}]"#, "41/chat,"]);
        let seen = seen.lock().unwrap();
        let kinds: Vec<String> = seen.iter().map(|e| format!("{}{}", e["type"].as_str().unwrap(), e["kind"].as_str().map(|k| format!(":{k}")).unwrap_or_default())).collect();
        assert_eq!(kinds, ["engine", "joined", "message:event", "message:ack", "message:event", "close"]);
        assert_eq!(seen[1]["sid"], "s1");
        assert_eq!(seen[3]["data"], r#"[{"ok":true}]"#);
        assert_eq!(seen[4]["event"], "news");
        assert_eq!(seen[4]["argc"], 2);
        assert_eq!(seen[5]["reason"], "io client disconnect");
    }

    /// Engine.IO 3: / is joined by the server; a refused namespace ends the connection.
    #[tokio::test]
    async fn v2_connect_error() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (tcp, _) = listener.accept().await.unwrap();
            let mut ws = tokio_tungstenite::accept_async(tcp).await.unwrap();
            ws.send(Message::text(r#"0{"sid":"eio1","upgrades":[],"pingInterval":25000,"pingTimeout":5000}"#)).await.unwrap();
            ws.send(Message::text("40")).await.unwrap();
            while let Some(Ok(m)) = ws.next().await {
                if m.to_text().unwrap_or_default() == "40/admin," {
                    ws.send(Message::text(r#"44/admin,"Not authorized""#)).await.unwrap();
                }
            }
        });
        let url = format!("ws://{addr}/socket.io/?EIO=3&transport=websocket");
        let (socket, _) = tokio_tungstenite::connect_async(url).await.unwrap();
        let (_tx, rx) = mpsc::channel(8);
        let (events, seen) = collect();
        run(socket, rx, &events, Session { eio: 3, nsp: "/admin".into(), auth: None }).await;
        let seen = seen.lock().unwrap();
        let types: Vec<&str> = seen.iter().map(|e| e["type"].as_str().unwrap()).collect();
        assert_eq!(types, ["engine", "connectError", "close"]);
        assert_eq!(seen[1]["message"], "Not authorized");
        assert_eq!(seen[2]["reason"], "connect_error");
        assert_eq!(seen[2]["by"], "server");
    }

    /// Against real servers: `SIO_LIVE=<port> SIO_EIO=4|3 cargo test live_server -- --ignored`.
    /// Heartbeats over a few ping intervals, join with auth, emit with ack, events with several
    /// arguments and a binary attachment, then a server disconnect; and a refused join (Engine.IO 4).
    #[tokio::test]
    #[ignore]
    async fn live_server() {
        let port: u16 = std::env::var("SIO_LIVE").unwrap().parse().unwrap();
        let eio: u8 = std::env::var("SIO_EIO").map(|v| v.parse().unwrap()).unwrap_or(4);
        let (url, nsp) = endpoint(&format!("http://localhost:{port}/chat"), "", "", eio).unwrap();
        let run_with = |auth: Option<Value>, script: Vec<Cmd>| {
            let url = url.clone();
            let nsp = nsp.clone();
            async move {
                let (socket, _) = tokio_tungstenite::connect_async(url).await.unwrap();
                let (tx, rx) = mpsc::channel(8);
                let (events, seen) = collect();
                let runner = tokio::spawn(async move { run(socket, rx, &events, Session { eio, nsp, auth }).await });
                // past pingInterval + pingTimeout (1 s + 1 s): the heartbeat must keep it open
                tokio::time::sleep(Duration::from_millis(3000)).await;
                for c in script {
                    tx.send(c).await.unwrap();
                    tokio::time::sleep(Duration::from_millis(300)).await;
                }
                tokio::time::timeout(Duration::from_secs(5), runner).await.unwrap().unwrap();
                let seen = seen.lock().unwrap().clone();
                seen
            }
        };
        let seen = run_with(
            Some(serde_json::json!({"token": "t"})),
            vec![
                Cmd::Emit { event: "hi".into(), args: vec![serde_json::json!({"a": 1})], ack_ms: Some(2000) },
                Cmd::Emit { event: "bye".into(), args: vec![], ack_ms: None },
            ],
        )
        .await;
        for e in &seen {
            println!("{e}");
        }
        let kinds: Vec<String> = seen.iter().map(|e| format!("{}{}", e["type"].as_str().unwrap(), e["event"].as_str().map(|k| format!(":{k}")).unwrap_or_default())).collect();
        assert_eq!(kinds, ["engine", "joined", "message:hi", "message", "message:news", "message:file", "message:bye", "close"]);
        assert_eq!(seen[3]["data"], r#"[{"got":{"a":1},"ok":true}]"#);
        assert_eq!(seen[4]["argc"], 2);
        assert_eq!(seen[5]["data"], r#"[{"$binary":"AQID","size":3}]"#);
        assert_eq!(seen[7]["reason"], "io server disconnect");

        if eio >= 4 {
            let seen = run_with(Some(serde_json::json!({"token": "nope"})), vec![]).await;
            assert_eq!(seen[1]["type"], "connectError");
            assert_eq!(seen[1]["message"], "Not authorized");
            assert_eq!(seen[1]["data"], r#"{"code":"TOKEN_EXPIRED"}"#);
        }
    }
}
