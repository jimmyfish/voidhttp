//! HTTP engine. The webview never touches the network: every request is
//! executed here with reqwest, so there are no CORS limits and no Node/Electron
//! runtime sitting in between.

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use base64::Engine;
use reqwest::{
    cookie::Jar,
    header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE},
    multipart, redirect, Client, Method,
};
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio_util::sync::CancellationToken;

const USER_AGENT: &str = concat!("voidHTTP/", env!("CARGO_PKG_VERSION"));

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Kv {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultipartField {
    pub key: String,
    pub value: String,
    /// "text" or "file" (value is an absolute path for files).
    pub kind: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum RequestBody {
    Text { content: String },
    FormUrlEncoded { fields: Vec<Kv> },
    Multipart { fields: Vec<MultipartField> },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestOptions {
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    #[serde(default = "default_true")]
    pub follow_redirects: bool,
    #[serde(default)]
    pub insecure: bool,
}

fn default_timeout() -> u64 {
    30_000
}
fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequest {
    /// Client-generated id used for cancellation.
    pub id: String,
    pub method: String,
    pub url: String,
    pub headers: Vec<Kv>,
    pub body: Option<RequestBody>,
    pub options: RequestOptions,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub http_version: String,
    pub url: String,
    pub headers: Vec<Kv>,
    /// UTF-8 text, or base64 when the payload is not valid UTF-8.
    pub body: String,
    pub body_encoding: &'static str,
    pub size: usize,
    pub elapsed_ms: u64,
}

/// Shared HTTP state: pooled clients and in-flight cancellation tokens.
pub struct HttpState {
    jar: Arc<Jar>,
    clients: Mutex<HashMap<(bool, bool), Client>>,
    inflight: Mutex<HashMap<String, CancellationToken>>,
}

impl Default for HttpState {
    fn default() -> Self {
        Self {
            jar: Arc::new(Jar::default()),
            clients: Mutex::new(HashMap::new()),
            inflight: Mutex::new(HashMap::new()),
        }
    }
}

impl HttpState {
    /// One pooled client per (follow_redirects, insecure) combination so
    /// keep-alive connections are reused across sends.
    fn client(&self, follow_redirects: bool, insecure: bool) -> Result<Client, String> {
        let mut clients = self.clients.lock().map_err(|e| e.to_string())?;
        if let Some(c) = clients.get(&(follow_redirects, insecure)) {
            return Ok(c.clone());
        }
        let policy = if follow_redirects {
            redirect::Policy::limited(10)
        } else {
            redirect::Policy::none()
        };
        let client = Client::builder()
            .user_agent(USER_AGENT)
            .redirect(policy)
            .danger_accept_invalid_certs(insecure)
            .cookie_provider(self.jar.clone())
            .build()
            .map_err(|e| format!("failed to build HTTP client: {e}"))?;
        clients.insert((follow_redirects, insecure), client.clone());
        Ok(client)
    }
}

/// Removes the cancellation token when the request finishes, however it ends.
struct InflightGuard<'a> {
    state: &'a HttpState,
    id: String,
}

impl Drop for InflightGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut map) = self.state.inflight.lock() {
            map.remove(&self.id);
        }
    }
}

#[tauri::command]
pub async fn send_request(
    state: State<'_, HttpState>,
    request: HttpRequest,
) -> Result<HttpResponse, String> {
    let token = CancellationToken::new();
    state
        .inflight
        .lock()
        .map_err(|e| e.to_string())?
        .insert(request.id.clone(), token.clone());
    let _guard = InflightGuard {
        state: &state,
        id: request.id.clone(),
    };

    tokio::select! {
        res = execute(&state, request) => res,
        _ = token.cancelled() => Err("Request cancelled".into()),
    }
}

#[tauri::command]
pub fn cancel_request(state: State<'_, HttpState>, id: String) -> Result<(), String> {
    if let Some(token) = state.inflight.lock().map_err(|e| e.to_string())?.get(&id) {
        token.cancel();
    }
    Ok(())
}

async fn execute(state: &HttpState, req: HttpRequest) -> Result<HttpResponse, String> {
    let method = Method::from_bytes(req.method.trim().to_uppercase().as_bytes())
        .map_err(|_| format!("Invalid HTTP method: {}", req.method))?;

    let url = normalize_url(&req.url)?;
    let client = state.client(req.options.follow_redirects, req.options.insecure)?;

    let mut headers = HeaderMap::new();
    for h in req.headers.iter().filter(|h| !h.key.trim().is_empty()) {
        let name = HeaderName::from_bytes(h.key.trim().as_bytes())
            .map_err(|_| format!("Invalid header name: {}", h.key))?;
        let value = HeaderValue::from_str(&h.value)
            .map_err(|_| format!("Invalid value for header {}", h.key))?;
        headers.append(name, value);
    }

    let mut builder = client.request(method, url);

    if let Some(body) = req.body {
        builder = match body {
            RequestBody::Text { content } => builder.body(content),
            RequestBody::FormUrlEncoded { fields } => {
                let pairs: Vec<(String, String)> =
                    fields.into_iter().map(|f| (f.key, f.value)).collect();
                if !headers.contains_key(CONTENT_TYPE) {
                    headers.insert(
                        CONTENT_TYPE,
                        HeaderValue::from_static("application/x-www-form-urlencoded"),
                    );
                }
                let encoded = url_encode_pairs(&pairs);
                builder.body(encoded)
            }
            RequestBody::Multipart { fields } => {
                // reqwest generates the boundary; a user-supplied Content-Type
                // would break it.
                headers.remove(CONTENT_TYPE);
                builder.multipart(build_multipart(fields).await?)
            }
        };
    }

    let builder = builder
        .headers(headers)
        .timeout(Duration::from_millis(req.options.timeout_ms.max(1)));

    let started = Instant::now();
    let resp = builder.send().await.map_err(describe_error)?;

    let status = resp.status();
    let http_version = format!("{:?}", resp.version());
    let final_url = resp.url().to_string();
    let headers: Vec<Kv> = resp
        .headers()
        .iter()
        .map(|(k, v)| Kv {
            key: k.to_string(),
            value: String::from_utf8_lossy(v.as_bytes()).into_owned(),
        })
        .collect();

    let bytes = resp.bytes().await.map_err(describe_error)?;
    let elapsed_ms = started.elapsed().as_millis() as u64;
    let size = bytes.len();

    let (body, body_encoding) = match String::from_utf8(bytes.to_vec()) {
        Ok(text) => (text, "utf8"),
        Err(e) => (
            base64::engine::general_purpose::STANDARD.encode(e.into_bytes()),
            "base64",
        ),
    };

    Ok(HttpResponse {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").to_string(),
        http_version,
        url: final_url,
        headers,
        body,
        body_encoding,
        size,
        elapsed_ms,
    })
}

/// Accepts `localhost:3000/x` or `example.com` like Postman does.
fn normalize_url(raw: &str) -> Result<reqwest::Url, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("URL is empty".into());
    }
    let with_scheme = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("http://{trimmed}")
    };
    reqwest::Url::parse(&with_scheme).map_err(|e| format!("Invalid URL: {e}"))
}

fn url_encode_pairs(pairs: &[(String, String)]) -> String {
    let mut ser = reqwest::Url::parse("http://x/").expect("static url");
    ser.query_pairs_mut().extend_pairs(pairs.iter());
    ser.query().unwrap_or("").to_string()
}

async fn build_multipart(fields: Vec<MultipartField>) -> Result<multipart::Form, String> {
    let mut form = multipart::Form::new();
    for f in fields {
        if f.kind == "file" {
            let bytes = tokio::fs::read(&f.value)
                .await
                .map_err(|e| format!("Cannot read file {}: {e}", f.value))?;
            let file_name = std::path::Path::new(&f.value)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| "file".into());
            let mime = mime_guess::from_path(&f.value).first_or_octet_stream();
            let part = multipart::Part::bytes(bytes)
                .file_name(file_name)
                .mime_str(mime.as_ref())
                .map_err(|e| e.to_string())?;
            form = form.part(f.key, part);
        } else {
            form = form.text(f.key, f.value);
        }
    }
    Ok(form)
}

fn describe_error(e: reqwest::Error) -> String {
    if e.is_timeout() {
        return "Request timed out".into();
    }
    if e.is_connect() {
        return format!("Connection failed: {}", root_cause(&e));
    }
    if e.is_redirect() {
        return format!("Too many redirects: {}", root_cause(&e));
    }
    root_cause(&e)
}

pub(crate) fn root_cause(e: &(dyn std::error::Error + 'static)) -> String {
    let mut msg = e.to_string();
    let mut src = e.source();
    while let Some(s) = src {
        msg = format!("{msg}: {s}");
        src = s.source();
    }
    msg
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_without_scheme_defaults_to_http() {
        assert_eq!(normalize_url("localhost:3000/x").unwrap().as_str(), "http://localhost:3000/x");
        assert_eq!(normalize_url(" https://a.b/c?d=1 ").unwrap().as_str(), "https://a.b/c?d=1");
        assert!(normalize_url("").is_err());
    }

    #[test]
    fn form_pairs_are_encoded() {
        let pairs = vec![("a b".to_string(), "c&d=é".to_string()), ("x".into(), "".into())];
        assert_eq!(url_encode_pairs(&pairs), "a+b=c%26d%3D%C3%A9&x=");
    }
}
