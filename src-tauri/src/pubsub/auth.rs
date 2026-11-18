//! Google credentials for Pub/Sub: a service account key (a JWT signed here with ring, traded for a
//! token), Application Default Credentials (user login, service account or impersonation file),
//! impersonation on top of either through IAM Credentials, a pasted access token, or none for the
//! emulator. Tokens are kept process wide until five minutes before they expire, so a reconnect or
//! a project list doesn't sign in again.

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::{google_error, Clients};

pub const SCOPE: &str = "https://www.googleapis.com/auth/cloud-platform";
const TOKEN_URI: &str = "https://oauth2.googleapis.com/token";
const IAM_CREDENTIALS: &str = "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts";
/// A token this close to expiry is fetched again.
const MARGIN: Duration = Duration::from_secs(300);

/// How the request signs in, as the Auth tab sets it.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthReq {
    /// "key", "adc", "token" or "emulator"
    #[serde(default)]
    pub kind: String,
    /// key: the key file; adc: the credentials file, empty for the default one
    #[serde(default)]
    pub file: String,
    /// a service account to work as, for key and adc
    #[serde(default)]
    pub impersonate: String,
    #[serde(default)]
    pub token: String,
    #[serde(default)]
    pub emulator_host: String,
}

impl AuthReq {
    pub fn emulator(&self) -> bool {
        self.kind == "emulator"
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct SaKey {
    pub client_email: String,
    pub private_key: String,
    pub private_key_id: Option<String>,
    pub token_uri: String,
    pub project_id: Option<String>,
}

/// A credentials file, by its `type`.
#[derive(Debug, Clone, PartialEq)]
pub enum Creds {
    ServiceAccount(SaKey),
    User {
        client_id: String,
        client_secret: String,
        refresh_token: String,
        token_uri: String,
        quota_project: Option<String>,
    },
    Impersonated {
        source: Box<Creds>,
        target: String,
        delegates: Vec<String>,
    },
}

fn text(v: &Value, k: &str) -> Option<String> {
    v.get(k).and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty()).map(String::from)
}

fn need(v: &Value, k: &str) -> Result<String, String> {
    text(v, k).ok_or_else(|| format!("The credentials file has no \"{k}\""))
}

/// Reads a credentials file's JSON. Workload Identity Federation (external_account) is not built yet.
pub fn parse_creds(raw: &str) -> Result<Creds, String> {
    let v: Value = serde_json::from_str(raw).map_err(|e| format!("Not a JSON credentials file: {e}"))?;
    parse_value(&v)
}

fn parse_value(v: &Value) -> Result<Creds, String> {
    let Some(kind) = text(v, "type") else {
        return Err("Not a Google credentials file (it has no \"type\")".into());
    };
    match kind.as_str() {
        "service_account" => Ok(Creds::ServiceAccount(SaKey {
            client_email: need(v, "client_email")?,
            private_key: need(v, "private_key")?,
            private_key_id: text(v, "private_key_id"),
            token_uri: text(v, "token_uri").unwrap_or_else(|| TOKEN_URI.into()),
            project_id: text(v, "project_id"),
        })),
        "authorized_user" => Ok(Creds::User {
            client_id: need(v, "client_id")?,
            client_secret: need(v, "client_secret")?,
            refresh_token: need(v, "refresh_token")?,
            token_uri: text(v, "token_uri").unwrap_or_else(|| TOKEN_URI.into()),
            quota_project: text(v, "quota_project_id"),
        }),
        "impersonated_service_account" => {
            let url = need(v, "service_account_impersonation_url")?;
            let target = target_from_url(&url).ok_or_else(|| format!("Can't read the service account from {url}"))?;
            let source = v.get("source_credentials").ok_or("The credentials file has no \"source_credentials\"")?;
            let delegates = v
                .get("delegates")
                .and_then(Value::as_array)
                .map(|a| a.iter().filter_map(Value::as_str).map(String::from).collect())
                .unwrap_or_default();
            Ok(Creds::Impersonated { source: Box::new(parse_value(source)?), target, delegates })
        }
        "external_account" | "external_account_authorized_user" => Err("Workload Identity Federation is not supported yet".into()),
        other => Err(format!("Unknown credentials type \"{other}\"")),
    }
}

/// ".../serviceAccounts/NAME@PROJECT.iam.gserviceaccount.com:generateAccessToken" -> the email
fn target_from_url(url: &str) -> Option<String> {
    let rest = url.split("/serviceAccounts/").nth(1)?;
    let email = rest.split(':').next()?.trim();
    (!email.is_empty()).then(|| email.to_string())
}

// ---------- files on this Mac ----------

fn home() -> Option<PathBuf> {
    std::env::var_os("HOME").filter(|h| !h.is_empty()).map(PathBuf::from)
}

/// "~/keys/x.json" -> "/Users/me/keys/x.json"
pub fn expand(path: &str) -> PathBuf {
    let p = path.trim();
    if p == "~" {
        return home().unwrap_or_else(|| PathBuf::from(p));
    }
    if let (Some(rest), Some(h)) = (p.strip_prefix("~/"), home()) {
        return h.join(rest);
    }
    PathBuf::from(p)
}

/// gcloud's own folder: $CLOUDSDK_CONFIG, else ~/.config/gcloud
fn gcloud_dir() -> Option<PathBuf> {
    match std::env::var_os("CLOUDSDK_CONFIG").filter(|v| !v.is_empty()) {
        Some(d) => Some(PathBuf::from(d)),
        None => home().map(|h| h.join(".config").join("gcloud")),
    }
}

/// The ADC file: the path given, $GOOGLE_APPLICATION_CREDENTIALS, or the one gcloud writes.
pub fn adc_path(given: &str) -> Option<PathBuf> {
    if !given.trim().is_empty() {
        return Some(expand(given));
    }
    if let Some(p) = std::env::var_os("GOOGLE_APPLICATION_CREDENTIALS").filter(|v| !v.is_empty()) {
        return Some(PathBuf::from(p));
    }
    gcloud_dir().map(|d| d.join("application_default_credentials.json"))
}

/// The credentials file for key and adc; None for token and emulator.
pub fn file_of(auth: &AuthReq) -> Result<Option<PathBuf>, String> {
    match auth.kind.as_str() {
        "key" if auth.file.trim().is_empty() => Err("Choose a service account key file".into()),
        "key" => Ok(Some(expand(&auth.file))),
        "adc" => adc_path(&auth.file).map(Some).ok_or_else(|| "Can't find the Application Default Credentials file".into()),
        _ => Ok(None),
    }
}

pub fn load(path: &PathBuf) -> Result<Creds, String> {
    let raw = std::fs::read_to_string(path).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound && path.ends_with("application_default_credentials.json") {
            format!("{} doesn't exist. Run `gcloud auth application-default login` first.", path.display())
        } else {
            format!("Can't read {}: {e}", path.display())
        }
    })?;
    parse_creds(&raw)
}

/// `project` under `[core]` in a gcloud configuration file.
pub fn ini_project(raw: &str) -> Option<String> {
    let mut core = false;
    for line in raw.lines() {
        let l = line.trim();
        if l.starts_with('[') {
            core = l.trim_matches(['[', ']']).trim() == "core";
        } else if core {
            if let Some((k, v)) = l.split_once('=') {
                if k.trim() == "project" && !v.trim().is_empty() {
                    return Some(v.trim().to_string());
                }
            }
        }
    }
    None
}

/// The project `gcloud config set project` chose, in the active configuration.
pub fn gcloud_project() -> Option<String> {
    let dir = gcloud_dir()?;
    let name = std::fs::read_to_string(dir.join("active_config")).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let name = name.unwrap_or_else(|| "default".into());
    ini_project(&std::fs::read_to_string(dir.join("configurations").join(format!("config_{name}"))).ok()?)
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct LocalProject {
    pub id: String,
    pub source: &'static str,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Inspect {
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    pub projects: Vec<LocalProject>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn kind_label(c: &Creds) -> &'static str {
    match c {
        Creds::ServiceAccount(_) => "service account",
        Creds::User { .. } => "user login",
        Creds::Impersonated { .. } => "impersonation",
    }
}

/// What the credentials say without going online: who, and which projects they name.
pub fn inspect(auth: &AuthReq) -> Inspect {
    let mut out = Inspect::default();
    let source = if auth.kind == "key" { "key file" } else { "ADC file" };
    match file_of(auth).and_then(|p| p.map(|p| load(&p)).transpose()) {
        Ok(Some(c)) => {
            out.kind = kind_label(&c).into();
            match &c {
                Creds::ServiceAccount(k) => {
                    out.email = Some(k.client_email.clone());
                    if let Some(p) = &k.project_id {
                        out.projects.push(LocalProject { id: p.clone(), source });
                    }
                }
                Creds::User { quota_project, .. } => {
                    if let Some(p) = quota_project {
                        out.projects.push(LocalProject { id: p.clone(), source });
                    }
                }
                Creds::Impersonated { target, .. } => out.email = Some(target.clone()),
            }
        }
        Ok(None) => {}
        Err(e) => out.error = Some(e),
    }
    let imp = auth.impersonate.trim();
    if !imp.is_empty() && matches!(auth.kind.as_str(), "key" | "adc") {
        out.kind = "impersonation".into();
        out.email = Some(imp.to_string());
    }
    if let Some(p) = gcloud_project() {
        if !out.projects.iter().any(|x| x.id == p) {
            out.projects.push(LocalProject { id: p, source: "gcloud config" });
        }
    }
    out
}

// ---------- signing ----------

pub fn b64url(bytes: &[u8]) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

/// The DER inside a PEM block; PKCS#8 ("PRIVATE KEY") or PKCS#1 ("RSA PRIVATE KEY").
fn pem_der(pem: &str) -> Result<(Vec<u8>, bool), String> {
    let pkcs1 = pem.contains("BEGIN RSA PRIVATE KEY");
    let body: String = pem.lines().map(str::trim).filter(|l| !l.is_empty() && !l.starts_with("-----")).collect();
    let der = base64::engine::general_purpose::STANDARD
        .decode(body)
        .map_err(|e| format!("The private key in the key file is not valid: {e}"))?;
    Ok((der, pkcs1))
}

/// The signed assertion a service account trades for a token (RFC 7523).
pub fn jwt(key: &SaKey, scope: &str, now: u64) -> Result<String, String> {
    let mut header = json!({ "alg": "RS256", "typ": "JWT" });
    if let Some(kid) = &key.private_key_id {
        header["kid"] = json!(kid);
    }
    let claims = json!({ "iss": key.client_email, "scope": scope, "aud": key.token_uri, "iat": now, "exp": now + 3600 });
    let input = format!("{}.{}", b64url(header.to_string().as_bytes()), b64url(claims.to_string().as_bytes()));
    let (der, pkcs1) = pem_der(&key.private_key)?;
    let pair = if pkcs1 { ring::signature::RsaKeyPair::from_der(&der) } else { ring::signature::RsaKeyPair::from_pkcs8(&der) }
        .map_err(|e| format!("The private key in the key file can't be used: {e}"))?;
    let mut sig = vec![0; pair.public().modulus_len()];
    pair.sign(&ring::signature::RSA_PKCS1_SHA256, &ring::rand::SystemRandom::new(), input.as_bytes(), &mut sig)
        .map_err(|_| "Signing with the key failed".to_string())?;
    Ok(format!("{input}.{}", b64url(&sig)))
}

// ---------- tokens ----------

#[derive(Clone)]
struct Cached {
    token: String,
    until: Instant,
}

fn cache() -> &'static Mutex<HashMap<String, Cached>> {
    static C: OnceLock<Mutex<HashMap<String, Cached>>> = OnceLock::new();
    C.get_or_init(Default::default)
}

/// One cache slot per file (and its last change) and impersonation target.
fn cache_key(auth: &AuthReq, path: &PathBuf) -> String {
    let mtime = std::fs::metadata(path).and_then(|m| m.modified()).ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis());
    format!("{}|{}|{:?}|{}", auth.kind, path.display(), mtime, auth.impersonate.trim())
}

/// Sign-in failed: the message, and whether the key itself was refused (for the hint).
#[derive(Debug, Clone)]
pub struct AuthError {
    pub message: String,
    pub hint: Option<String>,
}

impl From<String> for AuthError {
    fn from(message: String) -> Self {
        Self { message, hint: None }
    }
}

/// The token to send, or None for the emulator.
pub async fn access_token(clients: &Clients, auth: &AuthReq) -> Result<Option<String>, AuthError> {
    match auth.kind.as_str() {
        "emulator" => return Ok(None),
        "token" => {
            let t = auth.token.trim();
            let t = t.strip_prefix("Bearer ").unwrap_or(t).trim();
            if t.is_empty() {
                return Err("Paste an access token".to_string().into());
            }
            return Ok(Some(t.to_string()));
        }
        "key" | "adc" => {}
        other => return Err(format!("Unknown sign-in kind \"{other}\"").into()),
    }
    let path = file_of(auth)?.ok_or("No credentials file".to_string())?;
    let key = cache_key(auth, &path);
    if let Some(c) = cache().lock().ok().and_then(|m| m.get(&key).cloned()) {
        if c.until > Instant::now() + MARGIN {
            return Ok(Some(c.token));
        }
    }
    let creds = load(&path)?;
    let (mut token, mut life) = fetch(clients, &creds).await.map_err(|m| AuthError { hint: refused_hint(&creds, &m), message: m })?;
    let imp = auth.impersonate.trim();
    if !imp.is_empty() {
        (token, life) = impersonate(clients, &token, imp, &[]).await.map_err(|m| AuthError {
            hint: m.contains("PERMISSION_DENIED").then(|| format!("Your account needs Service Account Token Creator on {imp}.")),
            message: m,
        })?;
    }
    if let Ok(mut m) = cache().lock() {
        m.insert(key, Cached { token: token.clone(), until: Instant::now() + life });
    }
    Ok(Some(token))
}

/// The quota project to bill user-login calls to (x-goog-user-project). Resource Manager refuses
/// a user login without one.
pub fn quota_project(auth: &AuthReq) -> Option<String> {
    if auth.kind != "adc" {
        return None;
    }
    match load(&adc_path(&auth.file)?).ok()? {
        Creds::User { quota_project, .. } => quota_project,
        _ => None,
    }
}

/// Who the credentials are without asking Google: a service account's email or the impersonated one.
pub fn identity(auth: &AuthReq) -> Option<String> {
    let imp = auth.impersonate.trim();
    if !imp.is_empty() && matches!(auth.kind.as_str(), "key" | "adc") {
        return Some(imp.to_string());
    }
    match load(&file_of(auth).ok()??).ok()? {
        Creds::ServiceAccount(k) => Some(k.client_email),
        Creds::Impersonated { target, .. } => Some(target),
        Creds::User { .. } => None,
    }
}

fn refused_hint(creds: &Creds, msg: &str) -> Option<String> {
    if msg.contains("invalid_grant") {
        return Some(match creds {
            Creds::ServiceAccount(_) => "Google refused the key. It was most likely deleted or disabled in IAM. Make a new key, or sign in with Application Default and act as the service account.".into(),
            _ => "The gcloud login has expired or was revoked. Run `gcloud auth application-default login` again.".into(),
        });
    }
    if msg.contains("invalid_client") {
        return Some("The credentials file's client is not valid. Run `gcloud auth application-default login` again.".into());
    }
    None
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn form(pairs: &[(&str, &str)]) -> String {
    let mut s = url::form_urlencoded::Serializer::new(String::new());
    for (k, v) in pairs {
        s.append_pair(k, v);
    }
    s.finish()
}

/// A token and how long it lives. Boxed because impersonation fetches its source the same way.
type Fetch<'a> = std::pin::Pin<Box<dyn std::future::Future<Output = Result<(String, Duration), String>> + Send + 'a>>;

/// A token from the credentials themselves, and how long it lives.
fn fetch<'a>(clients: &'a Clients, creds: &'a Creds) -> Fetch<'a> {
    Box::pin(async move {
        match creds {
            Creds::ServiceAccount(k) => {
                let assertion = jwt(k, SCOPE, now_secs())?;
                let body = form(&[("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"), ("assertion", &assertion)]);
                token_post(clients, &k.token_uri, body).await
            }
            Creds::User { client_id, client_secret, refresh_token, token_uri, .. } => {
                let body = form(&[("grant_type", "refresh_token"), ("client_id", client_id), ("client_secret", client_secret), ("refresh_token", refresh_token)]);
                token_post(clients, token_uri, body).await
            }
            Creds::Impersonated { source, target, delegates } => {
                let (t, _) = fetch(clients, source).await?;
                impersonate(clients, &t, target, delegates).await
            }
        }
    })
}

/// POSTs a token request; `{access_token, expires_in}` back, or `{error, error_description}`.
async fn token_post(clients: &Clients, uri: &str, body: String) -> Result<(String, Duration), String> {
    let res = clients
        .get(uri)?
        .post(uri)
        .header(reqwest::header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(body)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Couldn't reach {}: {}", host_of(uri), crate::http::root_cause(&e)))?;
    let status = res.status().as_u16();
    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    if status >= 400 {
        return Err(google_error(status, &bytes));
    }
    let v: Value = serde_json::from_slice(&bytes).map_err(|e| format!("The token answer is not JSON: {e}"))?;
    let token = text(&v, "access_token").ok_or("The token answer has no access_token")?;
    let life = v.get("expires_in").and_then(Value::as_u64).unwrap_or(3600);
    Ok((token, Duration::from_secs(life)))
}

/// Trades `source` for a token of `target` (IAM Credentials generateAccessToken).
async fn impersonate(clients: &Clients, source: &str, target: &str, delegates: &[String]) -> Result<(String, Duration), String> {
    let url = format!("{IAM_CREDENTIALS}/{target}:generateAccessToken");
    let mut body = json!({ "scope": [SCOPE], "lifetime": "3600s" });
    if !delegates.is_empty() {
        let d: Vec<String> = delegates
            .iter()
            .map(|d| if d.starts_with("projects/") { d.clone() } else { format!("projects/-/serviceAccounts/{d}") })
            .collect();
        body["delegates"] = json!(d);
    }
    let res = clients
        .get(&url)?
        .post(&url)
        .bearer_auth(source)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(body.to_string())
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Couldn't reach iamcredentials.googleapis.com: {}", crate::http::root_cause(&e)))?;
    let status = res.status().as_u16();
    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    if status >= 400 {
        return Err(google_error(status, &bytes));
    }
    let v: Value = serde_json::from_slice(&bytes).map_err(|e| format!("The impersonation answer is not JSON: {e}"))?;
    let token = text(&v, "accessToken").ok_or("The impersonation answer has no accessToken")?;
    Ok((token, Duration::from_secs(3600)))
}

/// The email behind a token, if Google says (needs the email scope; gcloud logins have it).
pub async fn token_email(clients: &Clients, token: &str) -> Option<String> {
    let url = format!("https://oauth2.googleapis.com/tokeninfo?access_token={token}");
    let res = clients.get(&url).ok()?.get(&url).timeout(Duration::from_secs(5)).send().await.ok()?;
    if !res.status().is_success() {
        return None;
    }
    let v: Value = serde_json::from_slice(&res.bytes().await.ok()?).ok()?;
    text(&v, "email")
}

fn host_of(uri: &str) -> String {
    url::Url::parse(uri).ok().and_then(|u| u.host_str().map(String::from)).unwrap_or_else(|| uri.to_string())
}
