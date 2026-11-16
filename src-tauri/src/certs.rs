//! Settings > Certificates: CA certificates trusted on top of the public roots (dev servers with a
//! self-signed or company certificate) and client certificates for mutual TLS, picked by host and port.
//!
//! One TLS setup for the whole app: HTTP (reqwest), WebSocket, gRPC and the connection check all
//! build their rustls config here. Files are referenced by path and never copied into the workspace.
//! CA files are read when the settings are applied; a client certificate and its key are read the
//! first time a request to its host needs them. Passphrases live in the macOS Keychain.

use std::{
    collections::HashMap,
    fs,
    sync::{Arc, LazyLock, Mutex, RwLock},
};

use rustls::{
    client::{
        danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier},
        verify_server_name, WebPkiServerVerifier,
    },
    server::ParsedCertificate,
    crypto::CryptoProvider,
    pki_types::{
        pem::{PemObject, SectionKind},
        CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer, ServerName, UnixTime,
    },
    sign::CertifiedKey,
    ClientConfig, DigitallySignedStruct, RootCertStore, SignatureScheme,
};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::http::HttpState;

// ---------- configuration (camelCase from the webview) ----------

#[derive(Debug, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct CertConfig {
    /// Trust the CA files below on top of the public CAs.
    pub ca_enabled: bool,
    /// PEM (or DER) files holding one or more certificates.
    pub ca_files: Vec<String>,
    pub clients: Vec<ClientCert>,
}

#[derive(Debug, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientCert {
    /// Stable id; also the Keychain account of the passphrase.
    pub id: String,
    /// api.example.com, or *.example.com for its subdomains.
    pub host: String,
    /// None: any port.
    pub port: Option<u16>,
    /// "pem" (certificate + key files) or "pfx" (one PKCS#12 file).
    pub format: String,
    pub cert: String,
    /// Empty: the key is in the certificate file.
    pub key: String,
    pub pfx: String,
}

impl ClientCert {
    fn is_pfx(&self) -> bool {
        self.format == "pfx"
    }

    /// How well this entry fits host:port; None when it does not apply.
    /// An exact host beats a wildcard, and a set port beats any port.
    fn score(&self, host: &str, port: u16) -> Option<u8> {
        if self.port.is_some_and(|p| p != port) {
            return None;
        }
        let pat = self.host.trim().trim_end_matches('.').to_ascii_lowercase();
        let host = host.trim_end_matches('.').to_ascii_lowercase();
        let host_score = if !pat.is_empty() && pat == host {
            2
        } else if pat.strip_prefix("*.").is_some_and(|base| !base.is_empty() && host.ends_with(&format!(".{base}"))) {
            1
        } else {
            return None;
        };
        Some(host_score * 2 + u8::from(self.port.is_some()))
    }
}

// ---------- the setup in force ----------

#[derive(Debug)]
struct Identity {
    chain: Vec<CertificateDer<'static>>,
    key: PrivateKeyDer<'static>,
}

struct Certs {
    roots: Arc<RootCertStore>,
    /// The CA files' certificates as read, for a server that uses one of them as its own certificate.
    pinned: Arc<Vec<CertificateDer<'static>>>,
    clients: Vec<ClientCert>,
    /// Client certificates read so far, by id. Cleared when the settings or a passphrase change.
    loaded: Mutex<HashMap<String, Arc<Identity>>>,
}

static CERTS: LazyLock<RwLock<Arc<Certs>>> = LazyLock::new(|| RwLock::new(Arc::new(Certs::build(&CertConfig::default()))));

fn current() -> Arc<Certs> {
    match CERTS.read() {
        Ok(g) => g.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    }
}

fn provider() -> Arc<CryptoProvider> {
    Arc::new(rustls::crypto::ring::default_provider())
}

impl Certs {
    fn build(config: &CertConfig) -> Self {
        let mut roots = RootCertStore { roots: webpki_roots::TLS_SERVER_ROOTS.to_vec() };
        let mut pinned = Vec::new();
        if config.ca_enabled {
            for path in &config.ca_files {
                // a file that can't be used is reported on its row in Settings (certs_inspect_ca)
                if let Ok(certs) = read_certs(path) {
                    pinned.extend(certs.iter().cloned());
                    roots.add_parsable_certificates(certs);
                }
            }
        }
        Self {
            roots: Arc::new(roots),
            pinned: Arc::new(pinned),
            clients: config.clients.clone(),
            loaded: Mutex::new(HashMap::new()),
        }
    }

    fn client_for(&self, host: &str, port: u16) -> Option<&ClientCert> {
        let mut best: Option<(&ClientCert, u8)> = None;
        for c in &self.clients {
            if let Some(s) = c.score(host, port) {
                if best.is_none_or(|(_, b)| s > b) {
                    best = Some((c, s));
                }
            }
        }
        best.map(|(c, _)| c)
    }

    fn identity(&self, c: &ClientCert) -> Result<Arc<Identity>, String> {
        if let Some(id) = self.loaded.lock().map_err(|e| e.to_string())?.get(&c.id) {
            return Ok(id.clone());
        }
        let id = Arc::new(load_identity(c, keychain::get(&c.id)?.as_deref())?);
        self.loaded.lock().map_err(|e| e.to_string())?.insert(c.id.clone(), id.clone());
        Ok(id)
    }
}

/// The client certificate entry used for host:port, if any. HTTP keeps one pooled client per entry.
pub fn client_id_for(host: &str, port: u16) -> Option<String> {
    current().client_for(host, port).map(|c| c.id.clone())
}

/// rustls config for a connection to host:port: the public CAs plus Settings > Certificates
/// (or no checks at all with Skip TLS verification), and the matching client certificate.
pub fn tls_config(insecure: bool, host: &str, port: u16) -> Result<ClientConfig, String> {
    let certs = current();
    let provider = provider();
    let builder = ClientConfig::builder_with_provider(provider.clone())
        .with_safe_default_protocol_versions()
        .map_err(|e| format!("TLS setup failed: {e}"))?;
    let builder = if insecure {
        builder.dangerous().with_custom_certificate_verifier(Arc::new(NoVerify(provider)))
    } else if certs.pinned.is_empty() {
        builder.with_root_certificates(certs.roots.clone())
    } else {
        let inner = WebPkiServerVerifier::builder_with_provider(certs.roots.clone(), provider)
            .build()
            .map_err(|e| format!("TLS setup failed: {e}"))?;
        builder.dangerous().with_custom_certificate_verifier(Arc::new(AddedCertVerifier { inner, pinned: certs.pinned.clone() }))
    };
    let Some(client) = certs.client_for(host, port) else {
        return Ok(builder.with_no_client_auth());
    };
    let label = client_label(client);
    let id = certs.identity(client).map_err(|e| format!("Client certificate for {label}: {e}"))?;
    builder
        .with_client_auth_cert(id.chain.clone(), id.key.clone_key())
        .map_err(|e| format!("Client certificate for {label}: {}", key_error(&e)))
}

fn client_label(c: &ClientCert) -> String {
    match c.port {
        Some(p) => format!("{}:{p}", c.host.trim()),
        None => c.host.trim().to_string(),
    }
}

/// The normal checks against the public CAs and the CA files, plus the allowance Postman and browsers
/// make for a self-signed dev server: when the server's certificate is exactly one of the added files,
/// it is trusted even if it calls itself a CA (plain `openssl req -x509`) or names its host only in
/// the common name. Its dates and host are still checked, and the handshake still proves the server
/// holds its key.
#[derive(Debug)]
struct AddedCertVerifier {
    inner: Arc<WebPkiServerVerifier>,
    pinned: Arc<Vec<CertificateDer<'static>>>,
}

impl ServerCertVerifier for AddedCertVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        intermediates: &[CertificateDer<'_>],
        server_name: &ServerName<'_>,
        ocsp: &[u8],
        now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        let err = match self.inner.verify_server_cert(end_entity, intermediates, server_name, ocsp, now) {
            Ok(v) => return Ok(v),
            Err(e) => e,
        };
        if !self.pinned.iter().any(|c| c.as_ref() == end_entity.as_ref()) {
            return Err(err);
        }
        added_cert_fits(end_entity, server_name, now)?;
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        self.inner.verify_tls12_signature(message, cert, dss)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        self.inner.verify_tls13_signature(message, cert, dss)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.inner.supported_verify_schemes()
    }
}

/// Dates and host of a server certificate that is one of the added CA files. The host comes from the
/// subject alternative names, or from the common name when the certificate has none (old openssl
/// commands make those; Postman accepts them).
fn added_cert_fits(der: &CertificateDer<'_>, server_name: &ServerName<'_>, now: UnixTime) -> Result<(), rustls::Error> {
    use rustls::{CertificateError, Error::InvalidCertificate};
    let (_, cert) = x509_parser::parse_x509_certificate(der).map_err(|_| InvalidCertificate(CertificateError::BadEncoding))?;
    let now = now.as_secs() as i64;
    let validity = cert.validity();
    if now < validity.not_before.timestamp() {
        return Err(InvalidCertificate(CertificateError::NotValidYet));
    }
    if now > validity.not_after.timestamp() {
        return Err(InvalidCertificate(CertificateError::Expired));
    }
    let name_err = match verify_server_name(&ParsedCertificate::try_from(der)?, server_name) {
        Ok(()) => return Ok(()),
        Err(e) => e,
    };
    let has_san = matches!(cert.subject_alternative_name(), Ok(Some(_)));
    let host = match server_name {
        ServerName::DnsName(d) => d.as_ref().trim_end_matches('.').to_ascii_lowercase(),
        _ => return Err(name_err),
    };
    let cn_matches = cert
        .subject()
        .iter_common_name()
        .filter_map(|cn| cn.as_str().ok())
        .any(|cn| cn.trim_end_matches('.').eq_ignore_ascii_case(&host));
    if !has_san && cn_matches {
        Ok(())
    } else {
        Err(name_err)
    }
}

/// "Skip TLS verification" from Settings: accepts any certificate, still checks signatures.
#[derive(Debug)]
struct NoVerify(Arc<CryptoProvider>);

impl ServerCertVerifier for NoVerify {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls12_signature(message, cert, dss, &self.0.signature_verification_algorithms)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls13_signature(message, cert, dss, &self.0.signature_verification_algorithms)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.0.signature_verification_algorithms.supported_schemes()
    }
}

/// What to do about a TLS failure, added to the error a request shows.
pub fn tls_hint(error: &str) -> Option<&'static str> {
    if error.contains("UnknownIssuer") || error.contains("CaUsedAsEndEntity") {
        Some("The server's certificate is self-signed or from a CA voidHTTP doesn't know. Add that CA in Settings > Certificates.")
    } else if error.contains("CertificateRequired") || error.contains("HandshakeFailure") && error.contains("alert") {
        Some("The server may want a client certificate. Add one for this host in Settings > Certificates.")
    } else {
        None
    }
}

// ---------- reading files ----------

const NOT_A_CERT_KEY: &str = "This is a private key, not a certificate. Add the server's certificate or its CA's.";
const NO_CERT: &str = "No certificate in this file. Expected PEM with BEGIN CERTIFICATE.";
const MAX_FILE: u64 = 1024 * 1024;

fn read_file(path: &str) -> Result<Vec<u8>, String> {
    let name = file_name(path);
    let meta = fs::metadata(path).map_err(|e| format!("{name}: {}", io_reason(&e)))?;
    if meta.len() > MAX_FILE {
        return Err(format!("{name} is too large to be a certificate or key"));
    }
    fs::read(path).map_err(|e| format!("{name}: {}", io_reason(&e)))
}

fn io_reason(e: &std::io::Error) -> String {
    match e.kind() {
        std::io::ErrorKind::NotFound => "file not found".into(),
        std::io::ErrorKind::PermissionDenied => "permission denied".into(),
        _ => e.to_string(),
    }
}

fn file_name(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

fn is_pem(bytes: &[u8]) -> bool {
    bytes.windows(11).any(|w| w == b"-----BEGIN ")
}

/// The certificates in a PEM bundle or a single DER file.
fn read_certs(path: &str) -> Result<Vec<CertificateDer<'static>>, String> {
    certs_in(&read_file(path)?)
}

fn certs_in(bytes: &[u8]) -> Result<Vec<CertificateDer<'static>>, String> {
    if !is_pem(bytes) {
        return match x509_parser::parse_x509_certificate(bytes) {
            Ok(_) => Ok(vec![CertificateDer::from(bytes.to_vec())]),
            Err(_) => Err(NO_CERT.into()),
        };
    }
    let mut certs = Vec::new();
    let mut key = false;
    for section in <(SectionKind, Vec<u8>)>::pem_slice_iter(bytes) {
        match section {
            Ok((SectionKind::Certificate, der)) => certs.push(CertificateDer::from(der)),
            Ok((SectionKind::PrivateKey | SectionKind::RsaPrivateKey | SectionKind::EcPrivateKey, _)) => key = true,
            Ok(_) => {}
            Err(e) => return Err(format!("Not a valid PEM file: {e}")),
        }
    }
    if certs.is_empty() {
        let encrypted_key = bytes.windows(21).any(|w| w == b"ENCRYPTED PRIVATE KEY");
        return Err(if key || encrypted_key { NOT_A_CERT_KEY } else { NO_CERT }.into());
    }
    Ok(certs)
}

/// The private key in a PEM or DER file, decrypting an encrypted PKCS#8 key with the passphrase.
fn key_in(bytes: &[u8], passphrase: Option<&str>) -> Result<PrivateKeyDer<'static>, String> {
    if is_pem(bytes) {
        let text = String::from_utf8_lossy(bytes);
        if text.contains("Proc-Type: 4,ENCRYPTED") {
            return Err("This key uses the old OpenSSL encryption. Convert it with: openssl pkcs8 -topk8 -in key.pem -out key-pkcs8.pem".into());
        }
        if let Some(start) = text.find("-----BEGIN ENCRYPTED PRIVATE KEY-----") {
            let end_tag = "-----END ENCRYPTED PRIVATE KEY-----";
            let end = text[start..].find(end_tag).map(|i| start + i + end_tag.len()).ok_or("The encrypted key is cut short")?;
            let (_, der) = pkcs8::der::pem::decode_vec(text[start..end].as_bytes()).map_err(|e| format!("Not a valid encrypted key: {e}"))?;
            let pass = passphrase.filter(|p| !p.is_empty()).ok_or("The key is encrypted. Enter its passphrase.")?;
            let info = pkcs8::EncryptedPrivateKeyInfoRef::try_from(der.as_slice()).map_err(|e| format!("Not a valid encrypted key: {e}"))?;
            let doc = info.decrypt(pass).map_err(|_| "Wrong passphrase for the key")?;
            return Ok(PrivatePkcs8KeyDer::from(doc.as_bytes().to_vec()).into());
        }
        return PrivateKeyDer::from_pem_slice(bytes).map_err(|_| "No private key in this file".to_string());
    }
    PrivateKeyDer::try_from(bytes.to_vec()).map_err(|_| "No private key in this file".to_string())
}

fn load_identity(c: &ClientCert, passphrase: Option<&str>) -> Result<Identity, String> {
    let (chain, key) = if c.is_pfx() {
        let path = c.pfx.trim();
        if path.is_empty() {
            return Err("No PFX file chosen".into());
        }
        let data = read_file(path)?;
        let store = p12_keystore::KeyStore::from_pkcs12(&data, passphrase.unwrap_or_default(), p12_keystore::Pkcs12ImportPolicy::Strict)
            .map_err(|e| {
                if passphrase.is_none_or(str::is_empty) {
                    format!("Could not open the PFX file. Does it need a passphrase? ({e})")
                } else {
                    format!("Wrong passphrase, or not a PFX file ({e})")
                }
            })?;
        let (_, kc) = store.private_key_chain().ok_or("The PFX file holds no private key with a certificate")?;
        let chain: Vec<_> = kc.certs().iter().map(|c| CertificateDer::from(c.as_der().to_vec())).collect();
        (chain, PrivatePkcs8KeyDer::from(kc.key().as_der().to_vec()).into())
    } else {
        let cert_path = c.cert.trim();
        if cert_path.is_empty() {
            return Err("No certificate file chosen".into());
        }
        let cert_bytes = read_file(cert_path)?;
        let chain = certs_in(&cert_bytes).map_err(|e| if e == NOT_A_CERT_KEY { "The certificate file holds only a key".into() } else { e })?;
        let key_path = c.key.trim();
        let key = if key_path.is_empty() {
            key_in(&cert_bytes, passphrase).map_err(|_| "Choose the private key file".to_string())?
        } else {
            key_in(&read_file(key_path)?, passphrase)?
        };
        (chain, key)
    };
    if chain.is_empty() {
        return Err("No certificate found".into());
    }
    CertifiedKey::from_der(chain.clone(), key.clone_key(), &provider()).map_err(|e| key_error(&e))?;
    Ok(Identity { chain, key })
}

fn key_error(e: &rustls::Error) -> String {
    match e {
        rustls::Error::InconsistentKeys(_) => "The private key does not match the certificate".into(),
        rustls::Error::General(m) if m.contains("key") => format!("Unsupported private key: {m}"),
        other => other.to_string(),
    }
}

// ---------- what Settings shows on each row ----------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CertSummary {
    /// Common name, else organisation, else the whole subject.
    pub name: String,
    /// Unix seconds.
    pub not_after: i64,
    pub self_signed: bool,
    pub is_ca: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub certs: Vec<CertSummary>,
    pub error: Option<String>,
}

fn summarize(der: &CertificateDer<'_>) -> Option<CertSummary> {
    let (_, cert) = x509_parser::parse_x509_certificate(der).ok()?;
    let subject = cert.subject();
    let name = subject
        .iter_common_name()
        .chain(subject.iter_organization())
        .find_map(|a| a.as_str().ok().map(str::to_string))
        .unwrap_or_else(|| subject.to_string());
    Some(CertSummary {
        name,
        not_after: cert.validity().not_after.timestamp(),
        self_signed: subject.as_raw() == cert.issuer().as_raw(),
        is_ca: cert.is_ca(),
    })
}

fn info(result: Result<Vec<CertificateDer<'static>>, String>) -> FileInfo {
    match result {
        Ok(certs) => FileInfo { certs: certs.iter().filter_map(summarize).collect(), error: None },
        Err(e) => FileInfo { certs: vec![], error: Some(e) },
    }
}

// ---------- Keychain ----------

#[cfg(target_os = "macos")]
mod keychain {
    use security_framework::passwords::{delete_generic_password, get_generic_password, set_generic_password};

    const SERVICE: &str = "voidHTTP client certificate";
    /// errSecItemNotFound
    const NOT_FOUND: i32 = -25300;

    pub fn get(id: &str) -> Result<Option<String>, String> {
        match get_generic_password(SERVICE, id) {
            Ok(bytes) => String::from_utf8(bytes).map(Some).map_err(|_| "The saved passphrase is not text".into()),
            Err(e) if e.code() == NOT_FOUND => Ok(None),
            Err(e) => Err(format!("Keychain: {e}")),
        }
    }

    pub fn set(id: &str, passphrase: &str) -> Result<(), String> {
        set_generic_password(SERVICE, id, passphrase.as_bytes()).map_err(|e| format!("Keychain: {e}"))
    }

    pub fn delete(id: &str) -> Result<(), String> {
        match delete_generic_password(SERVICE, id) {
            Ok(()) => Ok(()),
            Err(e) if e.code() == NOT_FOUND => Ok(()),
            Err(e) => Err(format!("Keychain: {e}")),
        }
    }
}

/// Elsewhere passphrases last until the app quits.
#[cfg(not(target_os = "macos"))]
mod keychain {
    use std::{collections::HashMap, sync::Mutex};

    static SECRETS: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

    pub fn get(id: &str) -> Result<Option<String>, String> {
        Ok(SECRETS.lock().map_err(|e| e.to_string())?.as_ref().and_then(|m| m.get(id).cloned()))
    }

    pub fn set(id: &str, passphrase: &str) -> Result<(), String> {
        SECRETS.lock().map_err(|e| e.to_string())?.get_or_insert_with(HashMap::new).insert(id.into(), passphrase.into());
        Ok(())
    }

    pub fn delete(id: &str) -> Result<(), String> {
        if let Some(m) = SECRETS.lock().map_err(|e| e.to_string())?.as_mut() {
            m.remove(id);
        }
        Ok(())
    }
}

// ---------- commands ----------

/// Applies Settings > Certificates. Pooled HTTP connections are dropped so the next send uses it.
#[tauri::command]
pub fn certs_configure(http: State<'_, HttpState>, config: CertConfig) -> Result<(), String> {
    let certs = Certs::build(&config);
    *CERTS.write().map_err(|e| e.to_string())? = Arc::new(certs);
    http.reset_clients();
    Ok(())
}

/// What a CA file holds, for its row in Settings.
#[tauri::command]
pub async fn certs_inspect_ca(path: String) -> FileInfo {
    info(read_certs(&path))
}

/// Reads a client certificate the way a request would (Keychain passphrase included) and
/// reports its certificate, or why it can't be used.
#[tauri::command]
pub async fn certs_inspect_client(client: ClientCert) -> FileInfo {
    let loaded = keychain::get(&client.id).and_then(|pass| load_identity(&client, pass.as_deref()));
    info(loaded.map(|id| id.chain.into_iter().take(1).collect()))
}

/// Saves (Some) or forgets (None or empty) the passphrase of a client certificate.
#[tauri::command]
pub fn certs_set_passphrase(http: State<'_, HttpState>, id: String, passphrase: Option<String>) -> Result<(), String> {
    match passphrase.as_deref().filter(|p| !p.is_empty()) {
        Some(p) => keychain::set(&id, p)?,
        None => keychain::delete(&id)?,
    }
    if let Ok(mut loaded) = current().loaded.lock() {
        loaded.remove(&id);
    }
    http.reset_clients();
    Ok(())
}

#[tauri::command]
pub fn certs_has_passphrase(id: String) -> Result<bool, String> {
    Ok(keychain::get(&id)?.is_some())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(host: &str, port: Option<u16>) -> ClientCert {
        ClientCert { id: host.into(), host: host.into(), port, format: "pem".into(), ..Default::default() }
    }

    #[test]
    fn host_matching_prefers_exact_host_and_set_port() {
        let certs = Certs {
            roots: Arc::new(RootCertStore::empty()),
            pinned: Arc::default(),
            clients: vec![entry("*.dev.local", None), entry("api.dev.local", None), entry("api.dev.local", Some(8443))],
            loaded: Mutex::new(HashMap::new()),
        };
        let pick = |h: &str, p: u16| certs.client_for(h, p).map(|c| (c.host.clone(), c.port));
        assert_eq!(pick("api.dev.local", 8443), Some(("api.dev.local".into(), Some(8443))));
        assert_eq!(pick("API.dev.local", 443), Some(("api.dev.local".into(), None)));
        assert_eq!(pick("web.dev.local", 443), Some(("*.dev.local".into(), None)));
        assert_eq!(pick("dev.local", 443), None);
        assert_eq!(pick("evil-dev.local", 443), None);
        assert_eq!(pick("example.com", 443), None);
    }

    #[test]
    fn a_private_key_is_not_taken_for_a_ca() {
        let key = b"-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIHZ8\n-----END PRIVATE KEY-----\n";
        assert_eq!(certs_in(key).unwrap_err(), NOT_A_CERT_KEY);
        let enc = b"-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n-----END ENCRYPTED PRIVATE KEY-----\n";
        assert_eq!(certs_in(enc).unwrap_err(), NOT_A_CERT_KEY);
        assert_eq!(certs_in(b"hello").unwrap_err(), NO_CERT);
    }

    #[test]
    fn tls_failures_point_to_settings() {
        assert!(tls_hint("invalid peer certificate: UnknownIssuer").unwrap().contains("Add that CA"));
        assert!(tls_hint("received fatal alert: CertificateRequired").unwrap().contains("client certificate"));
        assert_eq!(tls_hint("connection refused"), None);
    }

    /// A dev CA, a localhost server certificate and a client certificate, all signed by the CA.
    struct Pki {
        ca_pem: String,
        server_chain: Vec<CertificateDer<'static>>,
        server_key: PrivateKeyDer<'static>,
        client_pem: String,
        client_key_pem: String,
        client_der: CertificateDer<'static>,
        client_key_der: Vec<u8>,
    }

    fn pki() -> Pki {
        use rcgen::{BasicConstraints, CertificateParams, DnType, IsCa, Issuer, KeyPair};
        let mut ca_params = CertificateParams::new(Vec::<String>::new()).unwrap();
        ca_params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
        ca_params.distinguished_name.push(DnType::CommonName, "voidHTTP Test CA");
        let ca_key = KeyPair::generate().unwrap();
        let ca = ca_params.self_signed(&ca_key).unwrap();
        let issuer = Issuer::new(ca_params, &ca_key);

        let server_key = KeyPair::generate().unwrap();
        let server = CertificateParams::new(vec!["localhost".to_string()]).unwrap().signed_by(&server_key, &issuer).unwrap();

        let mut client_params = CertificateParams::new(Vec::<String>::new()).unwrap();
        client_params.distinguished_name.push(DnType::CommonName, "amarbank-dev");
        let client_key = KeyPair::generate().unwrap();
        let client = client_params.signed_by(&client_key, &issuer).unwrap();

        Pki {
            ca_pem: ca.pem(),
            server_chain: vec![server.der().clone()],
            server_key: PrivatePkcs8KeyDer::from(server_key.serialize_der()).into(),
            client_pem: client.pem(),
            client_key_pem: client_key.serialize_pem(),
            client_der: client.der().clone(),
            client_key_der: client_key.serialize_der(),
        }
    }

    /// One TLS connection to a localhost server that requires a client certificate from the test CA.
    /// Ok holds the client certificate's common name as the server saw it.
    async fn handshake(pki: &Pki) -> Result<String, String> {
        use rustls::server::WebPkiClientVerifier;
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let mut roots = RootCertStore::empty();
        roots.add_parsable_certificates(certs_in(pki.ca_pem.as_bytes()).unwrap());
        let verifier = WebPkiClientVerifier::builder_with_provider(Arc::new(roots), provider()).build().unwrap();
        let server = rustls::ServerConfig::builder_with_provider(provider())
            .with_safe_default_protocol_versions()
            .unwrap()
            .with_client_cert_verifier(verifier)
            .with_single_cert(pki.server_chain.clone(), pki.server_key.clone_key())
            .unwrap();
        let acceptor = tokio_rustls::TlsAcceptor::from(Arc::new(server));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let serve = tokio::spawn(async move {
            let (tcp, _) = listener.accept().await.unwrap();
            let mut tls = acceptor.accept(tcp).await.map_err(|e| e.to_string())?;
            let peer = tls.get_ref().1.peer_certificates().and_then(|c| c.first()).and_then(summarize).map(|s| s.name);
            tls.write_all(b"ok").await.map_err(|e| e.to_string())?;
            tls.shutdown().await.ok();
            peer.ok_or_else(|| "no client certificate".to_string())
        });

        let client = async {
            let config = tls_config(false, "localhost", port)?;
            let tcp = tokio::net::TcpStream::connect(("127.0.0.1", port)).await.map_err(|e| e.to_string())?;
            let name = ServerName::try_from("localhost").unwrap();
            let mut tls = tokio_rustls::TlsConnector::from(Arc::new(config)).connect(name, tcp).await.map_err(|e| e.to_string())?;
            let mut buf = Vec::new();
            tls.read_to_end(&mut buf).await.map_err(|e| e.to_string())?;
            Ok::<_, String>(buf)
        };
        let client = client.await;
        if client.is_err() && !serve.is_finished() {
            // the client may have failed before connecting; the server would wait forever
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            serve.abort();
        }
        let served = serve.await.unwrap_or_else(|_| Err("never connected".into()));
        match (client, served) {
            (Ok(buf), Ok(name)) if buf == b"ok" => Ok(name),
            (Err(e), _) => Err(format!("client: {e}")),
            (_, Err(e)) => Err(format!("server: {e}")),
            (Ok(_), Ok(_)) => Err("no reply".into()),
        }
    }

    fn configure(config: &CertConfig) {
        *CERTS.write().unwrap() = Arc::new(Certs::build(config));
    }

    #[tokio::test]
    async fn a_dev_ca_and_a_client_certificate_reach_a_mutual_tls_server() {
        let pki = pki();
        let dir = std::env::temp_dir().join(format!("voidhttp-certs-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let file = |name: &str, body: &str| {
            let p = dir.join(name);
            fs::write(&p, body).unwrap();
            p.to_string_lossy().into_owned()
        };
        let ca = file("rootCA.pem", &pki.ca_pem);
        let crt = file("client.crt", &pki.client_pem);
        let key = file("client.key", &pki.client_key_pem);
        let both = file("client-both.pem", &format!("{}{}", pki.client_pem, pki.client_key_pem));
        let entry = |cert: &str, key: &str| ClientCert {
            id: "voidhttp-test-no-keychain-item".into(),
            host: "localhost".into(),
            port: None,
            format: "pem".into(),
            cert: cert.into(),
            key: key.into(),
            pfx: String::new(),
        };

        // the public CAs alone don't know the dev CA
        configure(&CertConfig::default());
        let err = handshake(&pki).await.unwrap_err();
        assert!(err.contains("UnknownIssuer"), "{err}");

        // the CA file switched off: still unknown
        configure(&CertConfig { ca_enabled: false, ca_files: vec![ca.clone()], clients: vec![] });
        assert!(handshake(&pki).await.unwrap_err().contains("UnknownIssuer"));

        // CA trusted, but no client certificate: the server refuses
        configure(&CertConfig { ca_enabled: true, ca_files: vec![ca.clone()], clients: vec![] });
        assert!(handshake(&pki).await.is_err());

        // CA trusted and a client certificate for localhost, key in its own file or in the same one
        for (c, k) in [(crt.as_str(), key.as_str()), (both.as_str(), "")] {
            configure(&CertConfig { ca_enabled: true, ca_files: vec![ca.clone()], clients: vec![entry(c, k)] });
            assert_eq!(handshake(&pki).await, Ok("amarbank-dev".into()));
        }

        // a key that belongs to another certificate
        let other = file("other.key", &rcgen::KeyPair::generate().unwrap().serialize_pem());
        configure(&CertConfig { ca_enabled: true, ca_files: vec![ca.clone()], clients: vec![entry(&crt, &other)] });
        let err = handshake(&pki).await.unwrap_err();
        assert!(err.contains("does not match"), "{err}");

        configure(&CertConfig::default());
        let _ = fs::remove_dir_all(&dir);
    }

    /// One TLS connection to a localhost server using `chain`, no client certificate asked.
    async fn plain_handshake(chain: Vec<CertificateDer<'static>>, key: PrivateKeyDer<'static>) -> Result<(), String> {
        let server = rustls::ServerConfig::builder_with_provider(provider())
            .with_safe_default_protocol_versions()
            .unwrap()
            .with_no_client_auth()
            .with_single_cert(chain, key)
            .unwrap();
        let acceptor = tokio_rustls::TlsAcceptor::from(Arc::new(server));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let serve = tokio::spawn(async move {
            let (tcp, _) = listener.accept().await.unwrap();
            let _ = acceptor.accept(tcp).await;
        });
        let config = tls_config(false, "localhost", port)?;
        let tcp = tokio::net::TcpStream::connect(("127.0.0.1", port)).await.map_err(|e| e.to_string())?;
        let name = ServerName::try_from("localhost").unwrap();
        let result = tokio_rustls::TlsConnector::from(Arc::new(config)).connect(name, tcp).await.map(|_| ()).map_err(|e| e.to_string());
        serve.abort();
        result
    }

    /// What `openssl req -x509 -subj /CN=<cn> [-addext subjectAltName=DNS:<san>]` makes: one
    /// self-signed certificate that also says CA:TRUE, used by the server directly. Connects to
    /// localhost before and after adding the certificate.
    async fn self_signed_case(cn: &str, san: Option<&str>) -> (Result<(), String>, Result<(), String>) {
        use rcgen::{BasicConstraints, CertificateParams, DnType, IsCa, KeyPair};
        let mut params = CertificateParams::new(san.map(String::from).into_iter().collect::<Vec<_>>()).unwrap();
        params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
        params.distinguished_name.push(DnType::CommonName, cn);
        let key = KeyPair::generate().unwrap();
        let cert = params.self_signed(&key).unwrap();
        let path = std::env::temp_dir().join(format!("voidhttp-selfsigned-{}-{cn}.pem", std::process::id()));
        fs::write(&path, cert.pem()).unwrap();
        let chain = vec![cert.der().clone()];
        let server_key = || PrivateKeyDer::from(PrivatePkcs8KeyDer::from(key.serialize_der()));

        configure(&CertConfig::default());
        let before = plain_handshake(chain.clone(), server_key()).await;
        configure(&CertConfig { ca_enabled: true, ca_files: vec![path.to_string_lossy().into()], clients: vec![] });
        let after = plain_handshake(chain, server_key()).await;
        configure(&CertConfig::default());
        let _ = fs::remove_file(&path);
        (before, after)
    }

    #[tokio::test]
    async fn an_openssl_self_signed_server_certificate_is_trusted_once_added() {
        // with a subject alternative name
        let (before, after) = self_signed_case("localhost", Some("localhost")).await;
        assert!(tls_hint(&before.unwrap_err()).is_some_and(|h| h.contains("Add that CA")));
        assert_eq!(after, Ok(()));

        // common name only
        let (before, after) = self_signed_case("localhost", None).await;
        assert!(tls_hint(&before.unwrap_err()).is_some_and(|h| h.contains("Add that CA")));
        assert_eq!(after, Ok(()));

        // added, but made for another host
        let (_, after) = self_signed_case("api.other.dev", None).await;
        let err = after.unwrap_err();
        assert!(err.contains("not valid for name"), "{err}");
        let (_, after) = self_signed_case("localhost", Some("api.other.dev")).await;
        let err = after.unwrap_err();
        assert!(err.contains("not valid for name"), "{err}");
    }

    #[test]
    fn a_pfx_opens_with_its_passphrase_only() {
        let pki = pki();
        let chain = p12_keystore::PrivateKeyChain::new(
            p12_keystore::LocalKeyId(vec![1]),
            p12_keystore::PrivateKey::from_der(&pki.client_key_der).unwrap(),
            [p12_keystore::Certificate::from_der(&pki.client_der).unwrap()],
        );
        let mut store = p12_keystore::KeyStore::new();
        store.add_entry("client", p12_keystore::KeyStoreEntry::PrivateKeyChain(chain));
        let pfx = store.writer("s3cret").write().unwrap();
        let path = std::env::temp_dir().join(format!("voidhttp-pfx-{}.p12", std::process::id()));
        fs::write(&path, pfx).unwrap();
        let entry = ClientCert { id: "t".into(), host: "localhost".into(), format: "pfx".into(), pfx: path.to_string_lossy().into(), ..Default::default() };

        let id = load_identity(&entry, Some("s3cret")).unwrap();
        assert_eq!(summarize(&id.chain[0]).unwrap().name, "amarbank-dev");
        assert!(load_identity(&entry, Some("wrong")).unwrap_err().starts_with("Wrong passphrase"));
        assert!(load_identity(&entry, None).unwrap_err().contains("need a passphrase"));
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn ca_file_info_names_the_certificate() {
        let pki = pki();
        let info = info(certs_in(pki.ca_pem.as_bytes()));
        assert_eq!(info.error, None);
        let c = &info.certs[0];
        assert_eq!(c.name, "voidHTTP Test CA");
        assert!(c.is_ca && c.self_signed);
    }
}
