//! WebSocket engine. One connection per tab: `ws_connect` runs until the socket closes,
//! frames and the close arrive on an IPC channel, `ws_send` and `ws_close` reach the
//! running connection through a command queue.

use std::{
    collections::HashMap,
    future::pending,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use http::{header::HeaderName, HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel as IpcChannel, State};
use tokio::{sync::mpsc, time::Interval};
use tokio_tungstenite::{
    client_async_tls_with_config,
    tungstenite::{
        self,
        client::IntoClientRequest,
        protocol::{frame::coding::CloseCode, CloseFrame},
        Message,
    },
    Connector,
};

use crate::{grpc::tls_config, http::Kv};

const USER_AGENT: &str = concat!("voidHTTP/", env!("CARGO_PKG_VERSION"));
/// How long a close we started waits for the server's close before the socket is dropped.
const CLOSE_GRACE: Duration = Duration::from_secs(3);
/// A refused handshake's body is shown, not kept whole.
const MAX_REFUSED_BODY: usize = 64 * 1024;

// ---------- wire types (camelCase to the webview) ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsRequest {
    /// client id, used to send and close
    pub id: String,
    /// ws:// or wss:// (http:// and https:// are read as those; no scheme picks by host)
    pub url: String,
    #[serde(default)]
    pub headers: Vec<Kv>,
    /// offered in Sec-WebSocket-Protocol, unless a header already sets it
    #[serde(default)]
    pub subprotocols: Vec<String>,
    #[serde(default)]
    pub insecure: bool,
    /// keep-alive ping every this many seconds; 0 sends none
    #[serde(default)]
    pub ping_sec: u64,
    /// limit for the handshake; 0 waits as long as the OS does
    #[serde(default)]
    pub timeout_ms: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "type")]
pub enum WsEvent {
    /// the handshake succeeded (101)
    Open {
        status: u16,
        status_text: String,
        request_headers: Vec<Kv>,
        response_headers: Vec<Kv>,
        /// the subprotocol the server picked
        protocol: Option<String>,
        elapsed_ms: u64,
    },
    /// the server answered the upgrade with plain HTTP; the connection ends here
    Refused {
        status: u16,
        status_text: String,
        request_headers: Vec<Kv>,
        response_headers: Vec<Kv>,
        body: String,
        elapsed_ms: u64,
    },
    Message {
        /// "in" from the server, "out" to it
        dir: &'static str,
        /// "text", or "binary" with `data` in base64
        kind: &'static str,
        data: String,
        size: usize,
        /// ms since the socket opened
        at_ms: u64,
    },
    Close {
        code: u16,
        reason: String,
        /// "server" or "client" closed it; "lost" when it dropped without a close
        by: &'static str,
        /// ms the socket was open
        elapsed_ms: u64,
    },
}

// ---------- state ----------

enum Cmd {
    Send(String),
    Close,
}

#[derive(Default)]
pub struct WsState {
    conns: Mutex<HashMap<String, mpsc::Sender<Cmd>>>,
}

/// Removes the connection when it ends, however it ends.
struct ConnGuard<'a> {
    state: &'a WsState,
    id: String,
}

impl Drop for ConnGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut conns) = self.state.conns.lock() {
            conns.remove(&self.id);
        }
    }
}

// ---------- commands ----------

/// Opens the socket and runs it until it closes. Err only when it never opened:
/// bad URL or header, no connection, TLS failure, timeout, or cancelled while connecting.
#[tauri::command]
pub async fn ws_connect(state: State<'_, WsState>, request: WsRequest, on_event: IpcChannel<WsEvent>) -> Result<(), String> {
    let req = build_request(&request)?;
    let request_headers = header_list(req.headers());
    let secure = req.uri().scheme_str() == Some("wss");
    let connector = if secure {
        Connector::Rustls(Arc::new(tls_config(request.insecure)))
    } else {
        Connector::Plain
    };
    let host = req.uri().host().unwrap_or_default().to_string();
    let port = req.uri().port_u16().unwrap_or(if secure { 443 } else { 80 });

    let (tx, mut rx) = mpsc::channel::<Cmd>(64);
    state.conns.lock().map_err(|e| e.to_string())?.insert(request.id.clone(), tx);
    let _guard = ConnGuard { state: &state, id: request.id.clone() };

    let started = Instant::now();
    // the socket comes from Settings > Network (secure DNS, proxy); tungstenite does TLS and the upgrade
    let connect = async move {
        let stream = crate::net::current().connect(&host, port).await.map_err(tungstenite::Error::Io)?;
        client_async_tls_with_config(req, stream, None, Some(connector)).await
    };
    let timeout = async {
        if request.timeout_ms > 0 {
            tokio::time::sleep(Duration::from_millis(request.timeout_ms)).await
        } else {
            pending::<()>().await
        }
    };
    // Disconnect while the handshake runs stops it; a send before the socket is open has nowhere to go
    let cancelled = async {
        loop {
            match rx.recv().await {
                Some(Cmd::Close) | None => return,
                Some(Cmd::Send(_)) => {}
            }
        }
    };
    let elapsed = || started.elapsed().as_millis() as u64;

    let (socket, response) = tokio::select! {
        res = connect => match res {
            Ok(ok) => ok,
            Err(tungstenite::Error::Http(res)) => {
                let body = res.body().as_deref().map(|b| {
                    let cut = &b[..b.len().min(MAX_REFUSED_BODY)];
                    String::from_utf8_lossy(cut).into_owned()
                });
                let _ = on_event.send(WsEvent::Refused {
                    status: res.status().as_u16(),
                    status_text: res.status().canonical_reason().unwrap_or("").to_string(),
                    request_headers,
                    response_headers: header_list(res.headers()),
                    body: body.unwrap_or_default(),
                    elapsed_ms: elapsed(),
                });
                return Ok(());
            }
            Err(e) => return Err(connect_error(&e)),
        },
        _ = timeout => return Err(format!("Timed out after {} ms waiting for the handshake", request.timeout_ms)),
        _ = cancelled => return Err("Connection cancelled".into()),
    };

    let protocol = response
        .headers()
        .get("sec-websocket-protocol")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let _ = on_event.send(WsEvent::Open {
        status: response.status().as_u16(),
        status_text: response.status().canonical_reason().unwrap_or("").to_string(),
        request_headers,
        response_headers: header_list(response.headers()),
        protocol,
        elapsed_ms: elapsed(),
    });

    run(socket, rx, &on_event, request.ping_sec).await;
    Ok(())
}

/// Sends one text message on an open socket.
#[tauri::command]
pub async fn ws_send(state: State<'_, WsState>, id: String, message: String) -> Result<(), String> {
    let tx = state
        .conns
        .lock()
        .map_err(|e| e.to_string())?
        .get(&id)
        .cloned()
        .ok_or("The connection is closed")?;
    tx.send(Cmd::Send(message)).await.map_err(|_| "The connection is closed".to_string())
}

/// Starts a normal close (1000), or stops a handshake still running.
#[tauri::command]
pub async fn ws_close(state: State<'_, WsState>, id: String) -> Result<(), String> {
    let tx = state.conns.lock().map_err(|e| e.to_string())?.get(&id).cloned();
    if let Some(tx) = tx {
        let _ = tx.send(Cmd::Close).await;
    }
    Ok(())
}

// ---------- the open socket ----------

async fn run<S>(socket: tokio_tungstenite::WebSocketStream<S>, mut rx: mpsc::Receiver<Cmd>, events: &IpcChannel<WsEvent>, ping_sec: u64)
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    let opened = Instant::now();
    let at = || opened.elapsed().as_millis() as u64;
    let (mut sink, mut stream) = socket.split();
    let mut ping = (ping_sec > 0).then(|| {
        let every = Duration::from_secs(ping_sec);
        tokio::time::interval_at(tokio::time::Instant::now() + every, every)
    });
    // set once we sent our close: the server's close (or the grace period) ends the loop
    let mut closing: Option<tokio::time::Instant> = None;
    // the close frame the server sent, if any
    let mut server_close: Option<(u16, String)> = None;
    let mut commands_open = true;

    let close = loop {
        tokio::select! {
            cmd = rx.recv(), if commands_open && closing.is_none() => match cmd {
                Some(Cmd::Send(text)) => {
                    let size = text.len();
                    if let Err(e) = sink.send(Message::text(text.clone())).await {
                        break lost(&e);
                    }
                    let _ = events.send(WsEvent::Message { dir: "out", kind: "text", data: text, size, at_ms: at() });
                }
                Some(Cmd::Close) | None => {
                    commands_open = false;
                    let frame = CloseFrame { code: CloseCode::Normal, reason: "".into() };
                    if sink.send(Message::Close(Some(frame))).await.is_err() {
                        break (1000, String::new(), "client");
                    }
                    closing = Some(tokio::time::Instant::now() + CLOSE_GRACE);
                }
            },
            msg = stream.next() => match msg {
                Some(Ok(Message::Text(t))) => {
                    let data = t.as_str().to_string();
                    let _ = events.send(WsEvent::Message { dir: "in", kind: "text", size: data.len(), data, at_ms: at() });
                }
                Some(Ok(Message::Binary(b))) => {
                    let data = base64::engine::general_purpose::STANDARD.encode(&b);
                    let _ = events.send(WsEvent::Message { dir: "in", kind: "binary", data, size: b.len(), at_ms: at() });
                }
                Some(Ok(Message::Close(frame))) => {
                    // tungstenite answers the close; the stream ends once that is sent
                    let (code, reason) = frame.map(|f| (u16::from(f.code), f.reason.as_str().to_string())).unwrap_or((1005, String::new()));
                    if closing.is_none() {
                        server_close = Some((code, reason));
                    } else {
                        break (code, reason, "client");
                    }
                }
                Some(Ok(_)) => {} // ping, pong (answered by tungstenite), raw frames
                Some(Err(tungstenite::Error::ConnectionClosed)) | None => {
                    break match (server_close.take(), closing) {
                        (Some((code, reason)), _) => (code, reason, "server"),
                        (None, Some(_)) => (1000, String::new(), "client"),
                        (None, None) => (1006, "The connection dropped without a close".into(), "lost"),
                    };
                }
                Some(Err(e)) => {
                    break match server_close.take() {
                        Some((code, reason)) => (code, reason, "server"),
                        None => lost(&e),
                    };
                }
            },
            _ = tick(&mut ping) => {
                if let Err(e) = sink.send(Message::Ping(Default::default())).await {
                    break lost(&e);
                }
            }
            _ = until(closing) => break (1000, String::new(), "client"),
        }
    };

    let (code, reason, by) = close;
    let _ = events.send(WsEvent::Close { code, reason, by, elapsed_ms: at() });
}

fn lost(e: &tungstenite::Error) -> (u16, String, &'static str) {
    (1006, crate::http::root_cause(e), "lost")
}

async fn tick(ping: &mut Option<Interval>) {
    match ping {
        Some(i) => {
            i.tick().await;
        }
        None => pending().await,
    }
}

async fn until(deadline: Option<tokio::time::Instant>) {
    match deadline {
        Some(d) => tokio::time::sleep_until(d).await,
        None => pending().await,
    }
}

// ---------- the handshake request ----------

fn build_request(r: &WsRequest) -> Result<tungstenite::handshake::client::Request, String> {
    let url = normalize_url(&r.url)?;
    let mut req = url.as_str().into_client_request().map_err(|e| format!("Invalid URL: {e}"))?;
    let headers = req.headers_mut();
    for h in &r.headers {
        let name = HeaderName::from_bytes(h.key.trim().as_bytes()).map_err(|_| format!("Invalid header name: {}", h.key))?;
        // the handshake's own headers stay as tungstenite wrote them
        if is_handshake_header(&name) {
            continue;
        }
        let value = HeaderValue::from_str(&h.value).map_err(|_| format!("Invalid value for header {}", h.key))?;
        headers.append(name, value);
    }
    let offered: Vec<&str> = r.subprotocols.iter().map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    if !offered.is_empty() && !headers.contains_key("sec-websocket-protocol") {
        let v = HeaderValue::from_str(&offered.join(", ")).map_err(|_| "Invalid subprotocol name".to_string())?;
        headers.insert("sec-websocket-protocol", v);
    }
    if !headers.contains_key("user-agent") {
        headers.insert("user-agent", HeaderValue::from_static(USER_AGENT));
    }
    Ok(req)
}

fn is_handshake_header(name: &HeaderName) -> bool {
    matches!(
        name.as_str(),
        "host" | "connection" | "upgrade" | "sec-websocket-key" | "sec-websocket-version"
    )
}

/// ws:// and wss:// as typed; http(s):// read as ws(s)://; no scheme: ws:// for this machine, wss:// otherwise.
fn normalize_url(raw: &str) -> Result<String, String> {
    let s = raw.trim();
    if s.is_empty() {
        return Err("Enter a ws:// or wss:// URL".into());
    }
    let lower = s.to_ascii_lowercase();
    Ok(if lower.starts_with("ws://") || lower.starts_with("wss://") {
        s.to_string()
    } else if lower.starts_with("http://") {
        format!("ws://{}", &s[7..])
    } else if lower.starts_with("https://") {
        format!("wss://{}", &s[8..])
    } else if lower.contains("://") {
        return Err(format!("Not a WebSocket URL: {s}"));
    } else if ["localhost", "127.", "0.0.0.0", "[::1]"].iter().any(|p| lower.starts_with(p)) {
        format!("ws://{s}")
    } else {
        format!("wss://{s}")
    })
}

fn header_list(h: &HeaderMap) -> Vec<Kv> {
    h.iter()
        .map(|(k, v)| Kv { key: k.as_str().to_string(), value: String::from_utf8_lossy(v.as_bytes()).into_owned() })
        .collect()
}

fn connect_error(e: &tungstenite::Error) -> String {
    match e {
        tungstenite::Error::Url(u) => format!("Invalid URL: {u}"),
        _ => format!("Connection failed: {}", crate::http::root_cause(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req(url: &str) -> WsRequest {
        WsRequest { id: "t".into(), url: url.into(), headers: vec![], subprotocols: vec![], insecure: false, ping_sec: 0, timeout_ms: 0 }
    }

    #[test]
    fn url_schemes() {
        assert_eq!(normalize_url("wss://a.b/x").unwrap(), "wss://a.b/x");
        assert_eq!(normalize_url("https://a.b/x").unwrap(), "wss://a.b/x");
        assert_eq!(normalize_url("http://a.b").unwrap(), "ws://a.b");
        assert_eq!(normalize_url("localhost:8080/ws").unwrap(), "ws://localhost:8080/ws");
        assert_eq!(normalize_url("echo.example.com").unwrap(), "wss://echo.example.com");
        assert!(normalize_url("ftp://a").is_err());
        assert!(normalize_url("  ").is_err());
    }

    #[test]
    fn handshake_headers_are_kept_and_extras_added() {
        let mut r = req("ws://localhost:9/ws");
        r.headers = vec![
            Kv { key: "Authorization".into(), value: "Bearer x".into() },
            Kv { key: "Upgrade".into(), value: "nope".into() },
        ];
        r.subprotocols = vec!["graphql-ws".into(), " ".into(), "json".into()];
        let built = build_request(&r).unwrap();
        let h = built.headers();
        assert_eq!(h["authorization"], "Bearer x");
        assert_eq!(h["upgrade"], "websocket");
        assert_eq!(h["sec-websocket-protocol"], "graphql-ws, json");
        assert!(h.contains_key("sec-websocket-key"));
        assert!(h.contains_key("user-agent"));
    }

    #[test]
    fn bad_header_is_an_error() {
        let mut r = req("ws://localhost:9");
        r.headers = vec![Kv { key: "bad header".into(), value: "x".into() }];
        assert!(build_request(&r).is_err());
    }

    /// A local echo server: open, echo, close by either side.
    #[tokio::test]
    async fn echo_and_close() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (tcp, _) = listener.accept().await.unwrap();
            let mut ws = tokio_tungstenite::accept_async(tcp).await.unwrap();
            while let Some(Ok(m)) = ws.next().await {
                if m.is_text() || m.is_binary() {
                    ws.send(m).await.unwrap();
                }
            }
        });

        let req = build_request(&req(&format!("ws://{addr}/"))).unwrap();
        let (socket, res) = tokio_tungstenite::connect_async_tls_with_config(req, None, true, Some(Connector::Plain)).await.unwrap();
        assert_eq!(res.status().as_u16(), 101);

        let (tx, rx) = mpsc::channel(8);
        let seen = Arc::new(Mutex::new(Vec::<WsEvent>::new()));
        let sink = seen.clone();
        let events: IpcChannel<WsEvent> = IpcChannel::new(move |body| {
            if let tauri::ipc::InvokeResponseBody::Json(j) = body {
                let v: serde_json::Value = serde_json::from_str(&j).unwrap();
                let e = match v["type"].as_str().unwrap() {
                    "message" => WsEvent::Message {
                        dir: if v["dir"] == "in" { "in" } else { "out" },
                        kind: "text",
                        data: v["data"].as_str().unwrap().into(),
                        size: 0,
                        at_ms: 0,
                    },
                    _ => WsEvent::Close {
                        code: v["code"].as_u64().unwrap() as u16,
                        reason: String::new(),
                        by: if v["by"] == "client" { "client" } else { "other" },
                        elapsed_ms: 0,
                    },
                };
                sink.lock().unwrap().push(e);
            }
            Ok(())
        });
        let runner = tokio::spawn(async move { run(socket, rx, &events, 0).await });
        tx.send(Cmd::Send("hello".into())).await.unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;
        tx.send(Cmd::Close).await.unwrap();
        runner.await.unwrap();

        let seen = seen.lock().unwrap();
        let texts: Vec<_> = seen
            .iter()
            .filter_map(|e| match e {
                WsEvent::Message { dir, data, .. } => Some(format!("{dir}:{data}")),
                _ => None,
            })
            .collect();
        assert_eq!(texts, ["out:hello", "in:hello"]);
        assert!(matches!(seen.last(), Some(WsEvent::Close { code: 1000, by: "client", .. })));
    }
}
