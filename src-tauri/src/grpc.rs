//! gRPC engine. Messages are built at runtime from a schema (server reflection or
//! .proto files compiled in-process by protox), so no code is generated per service.
//! Every call, whatever its shape, goes over tonic's bidirectional `streaming` call:
//! on the wire a unary call is a stream with one message each way.

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use base64::Engine;
use http::uri::PathAndQuery;
use prost::Message as _;
use prost_reflect::{
    DeserializeOptions, DescriptorPool, DynamicMessage, FieldDescriptor, Kind, MessageDescriptor,
    MethodDescriptor, SerializeOptions,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use tauri::{ipc::Channel as IpcChannel, State};
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tokio_util::sync::CancellationToken;
use tonic::{
    codec::{Codec, DecodeBuf, Decoder, EncodeBuf, Encoder},
    metadata::{AsciiMetadataValue, BinaryMetadataValue, KeyAndValueRef, MetadataKey, MetadataMap},
    transport::{Channel, Endpoint},
    Status,
};

use crate::http::{root_cause, Kv};

const USER_AGENT: &str = concat!("voidHTTP/", env!("CARGO_PKG_VERSION"));
/// Largest message accepted either way.
const MAX_MESSAGE: usize = 64 * 1024 * 1024;

// ---------- wire types (camelCase to the webview) ----------

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Target {
    /// host:port, optionally with http:// or https:// (which then decides TLS)
    pub address: String,
    pub tls: bool,
    #[serde(default)]
    pub insecure: bool,
    #[serde(default)]
    pub metadata: Vec<Kv>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "source")]
pub enum SchemaSource {
    Reflection,
    Protos {
        files: Vec<String>,
        #[serde(default)]
        import_paths: Vec<String>,
    },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaInfo {
    pub services: Vec<ServiceInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceInfo {
    pub name: String,
    pub methods: Vec<MethodInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MethodInfo {
    pub name: String,
    pub stream: &'static str,
    pub input_type: String,
    pub output_type: String,
    /// every field of the input with a sample value, as pretty JSON
    pub example: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvokeRequest {
    /// client id, used to send further messages, end sending, and cancel
    pub id: String,
    pub target: Target,
    pub schema: SchemaSource,
    /// full service name, e.g. customer.v1.CustomerService
    pub service: String,
    pub method: String,
    /// the request message for unary and server-streaming calls; ignored when the client streams
    pub message: String,
    /// deadline for unary calls; streams run until ended or cancelled
    pub timeout_ms: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "type")]
pub enum GrpcEvent {
    /// the server's response headers
    Headers { metadata: Vec<Kv> },
    Message {
        /// "in" from the server, "out" to it
        dir: &'static str,
        json: String,
        size: usize,
        at_ms: u64,
    },
    End {
        code: i32,
        status: String,
        message: String,
        /// google.rpc.Status details, decoded when the types are known
        details: Option<String>,
        trailers: Vec<Kv>,
        elapsed_ms: u64,
    },
}

// ---------- state ----------

struct Call {
    token: CancellationToken,
    /// open while the client may still send
    sender: Option<mpsc::Sender<DynamicMessage>>,
    input: MessageDescriptor,
    started: Instant,
    events: IpcChannel<GrpcEvent>,
}

#[derive(Default)]
pub struct GrpcState {
    /// schemas by source key; reflection results stay until reloaded
    pools: Mutex<HashMap<String, DescriptorPool>>,
    calls: Mutex<HashMap<String, Call>>,
}

/// Removes the call when it finishes, however it ends.
struct CallGuard<'a> {
    state: &'a GrpcState,
    id: String,
}

impl Drop for CallGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut calls) = self.state.calls.lock() {
            calls.remove(&self.id);
        }
    }
}

// ---------- commands ----------

/// Loads the schema (fresh, replacing any cached copy) and lists its services and methods.
#[tauri::command]
pub async fn grpc_describe(
    state: State<'_, GrpcState>,
    target: Target,
    schema: SchemaSource,
) -> Result<SchemaInfo, String> {
    let pool = load_pool(&target, &schema).await?;
    let info = describe(&pool);
    state
        .pools
        .lock()
        .map_err(|e| e.to_string())?
        .insert(pool_key(&target, &schema), pool);
    Ok(info)
}

/// Runs one call to its end. Messages and status arrive on `on_event`.
/// Err only when the call could not start: bad address, unknown method, invalid message, no connection.
#[tauri::command]
pub async fn grpc_invoke(
    state: State<'_, GrpcState>,
    request: InvokeRequest,
    on_event: IpcChannel<GrpcEvent>,
) -> Result<(), String> {
    let pool = cached_pool(&state, &request.target, &request.schema).await?;
    let method = find_method(&pool, &request.service, &request.method)?;
    let client_streams = method.is_client_streaming();

    // the first (or only) message is checked before connecting, so a typo fails fast
    let first = if client_streams {
        None
    } else {
        Some(parse_message(method.input(), &request.message)?)
    };

    let token = CancellationToken::new();
    let (tx, rx) = mpsc::channel::<DynamicMessage>(64);
    let started = Instant::now();
    state.calls.lock().map_err(|e| e.to_string())?.insert(
        request.id.clone(),
        Call {
            token: token.clone(),
            sender: if client_streams { Some(tx.clone()) } else { None },
            input: method.input(),
            started,
            events: on_event.clone(),
        },
    );
    let _guard = CallGuard {
        state: &state,
        id: request.id.clone(),
    };

    if let Some(msg) = first {
        emit_message(&on_event, "out", &msg, started);
        tx.send(msg).await.map_err(|_| "Could not queue the message".to_string())?;
    }
    // unary and server-streaming: the one message is all the client sends
    drop(tx);

    let run = run_call(&request, &method, rx, &on_event, started);
    tokio::select! {
        res = run => res,
        _ = token.cancelled() => {
            let _ = on_event.send(GrpcEvent::End {
                code: 1,
                status: "CANCELLED".into(),
                message: "Cancelled by you".into(),
                details: None,
                trailers: vec![],
                elapsed_ms: started.elapsed().as_millis() as u64,
            });
            Ok(())
        }
    }
}

/// Sends one more message on an open client or bidi stream.
#[tauri::command]
pub async fn grpc_send(state: State<'_, GrpcState>, id: String, message: String) -> Result<(), String> {
    let (sender, input, started, events) = {
        let calls = state.calls.lock().map_err(|e| e.to_string())?;
        let call = calls.get(&id).ok_or("The call has ended")?;
        let sender = call.sender.clone().ok_or("Sending has ended for this call")?;
        (sender, call.input.clone(), call.started, call.events.clone())
    };
    let msg = parse_message(input, &message)?;
    emit_message(&events, "out", &msg, started);
    sender.send(msg).await.map_err(|_| "The call has ended".to_string())
}

/// Half-closes a client or bidi stream: no more messages from the client, replies keep coming.
#[tauri::command]
pub fn grpc_end(state: State<'_, GrpcState>, id: String) -> Result<(), String> {
    if let Some(call) = state.calls.lock().map_err(|e| e.to_string())?.get_mut(&id) {
        call.sender = None;
    }
    Ok(())
}

#[tauri::command]
pub fn grpc_cancel(state: State<'_, GrpcState>, id: String) -> Result<(), String> {
    if let Some(call) = state.calls.lock().map_err(|e| e.to_string())?.get(&id) {
        call.token.cancel();
    }
    Ok(())
}

// ---------- the call ----------

async fn run_call(
    request: &InvokeRequest,
    method: &MethodDescriptor,
    rx: mpsc::Receiver<DynamicMessage>,
    events: &IpcChannel<GrpcEvent>,
    started: Instant,
) -> Result<(), String> {
    let channel = connect(&request.target).await?;
    let mut grpc = tonic::client::Grpc::new(channel)
        .max_decoding_message_size(MAX_MESSAGE)
        .max_encoding_message_size(MAX_MESSAGE);
    grpc.ready().await.map_err(|e| format!("Connection failed: {}", root_cause(&e)))?;

    let mut req = tonic::Request::new(ReceiverStream::new(rx));
    apply_metadata(req.metadata_mut(), &request.target.metadata)?;
    // only a unary call gets a deadline: streams stay open as long as someone is sending or listening
    if !method.is_server_streaming() && !method.is_client_streaming() && request.timeout_ms > 0 {
        req.set_timeout(Duration::from_millis(request.timeout_ms));
    }
    let path = PathAndQuery::try_from(format!("/{}/{}", method.parent_service().full_name(), method.name()))
        .map_err(|e| format!("Invalid method path: {e}"))?;
    let codec = DynamicCodec { output: method.output() };
    let elapsed = || started.elapsed().as_millis() as u64;

    let end_with = |status: &Status, pool: &DescriptorPool| GrpcEvent::End {
        code: status.code() as i32,
        status: code_name(status.code() as i32).into(),
        message: status.message().to_string(),
        details: decode_details(status.details(), pool),
        trailers: metadata_list(status.metadata()),
        elapsed_ms: elapsed(),
    };
    let pool = method.parent_pool();

    let response = match grpc.streaming(req, path, codec).await {
        Ok(r) => r,
        Err(status) => {
            let _ = events.send(end_with(&status, pool));
            return Ok(());
        }
    };
    let _ = events.send(GrpcEvent::Headers { metadata: metadata_list(response.metadata()) });
    let mut stream = response.into_inner();
    loop {
        match stream.message().await {
            Ok(Some(msg)) => emit_message(events, "in", &msg, started),
            Ok(None) => break,
            Err(status) => {
                let _ = events.send(end_with(&status, pool));
                return Ok(());
            }
        }
    }
    let trailers = match stream.trailers().await {
        Ok(t) => t.map(|m| metadata_list(&m)).unwrap_or_default(),
        Err(status) => {
            let _ = events.send(end_with(&status, pool));
            return Ok(());
        }
    };
    let _ = events.send(GrpcEvent::End {
        code: 0,
        status: "OK".into(),
        message: String::new(),
        details: None,
        trailers,
        elapsed_ms: elapsed(),
    });
    Ok(())
}

fn emit_message(events: &IpcChannel<GrpcEvent>, dir: &'static str, msg: &DynamicMessage, started: Instant) {
    let _ = events.send(GrpcEvent::Message {
        dir,
        json: to_json(msg),
        size: msg.encoded_len(),
        at_ms: started.elapsed().as_millis() as u64,
    });
}

fn find_method(pool: &DescriptorPool, service: &str, method: &str) -> Result<MethodDescriptor, String> {
    let svc = pool
        .get_service_by_name(service)
        .ok_or_else(|| format!("Service {service} is not in the schema"))?;
    let found = svc.methods().find(|m| m.name() == method);
    found.ok_or_else(|| format!("Method {method} is not in {service}"))
}

fn parse_message(desc: MessageDescriptor, text: &str) -> Result<DynamicMessage, String> {
    let text = if text.trim().is_empty() { "{}" } else { text };
    let mut de = serde_json::Deserializer::from_str(text);
    let msg = DynamicMessage::deserialize_with_options(desc.clone(), &mut de, &DeserializeOptions::new())
        .map_err(|e| format!("Message does not fit {}: {e}", desc.full_name()))?;
    de.end().map_err(|e| format!("Invalid JSON: {e}"))?;
    Ok(msg)
}

fn to_json(msg: &DynamicMessage) -> String {
    let opts = SerializeOptions::new().use_proto_field_name(true).skip_default_fields(false);
    let mut out = Vec::new();
    let mut ser = serde_json::Serializer::new(&mut out);
    match msg.serialize_with_options(&mut ser, &opts) {
        Ok(()) => String::from_utf8(out).unwrap_or_default(),
        Err(e) => json!({ "error": format!("Could not show this message: {e}") }).to_string(),
    }
}

fn apply_metadata(map: &mut MetadataMap, metadata: &[Kv]) -> Result<(), String> {
    for kv in metadata.iter().filter(|kv| !kv.key.trim().is_empty()) {
        let key = kv.key.trim().to_lowercase();
        if key.ends_with("-bin") {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(kv.value.trim())
                .map_err(|_| format!("Metadata {key} ends in -bin, so its value must be base64"))?;
            let k = MetadataKey::from_bytes(key.as_bytes()).map_err(|_| format!("Invalid metadata key: {key}"))?;
            map.append_bin(k, BinaryMetadataValue::from_bytes(&bytes));
        } else {
            let k = MetadataKey::from_bytes(key.as_bytes()).map_err(|_| format!("Invalid metadata key: {key}"))?;
            let v: AsciiMetadataValue = kv
                .value
                .parse()
                .map_err(|_| format!("Invalid value for metadata {key}"))?;
            map.append(k, v);
        }
    }
    Ok(())
}

/// Metadata as shown: the status keys are left out, the status line already says them.
fn metadata_list(map: &MetadataMap) -> Vec<Kv> {
    map.iter()
        .filter(|entry| {
            let key = match entry {
                KeyAndValueRef::Ascii(k, _) => k.as_str(),
                KeyAndValueRef::Binary(k, _) => k.as_str(),
            };
            !matches!(key, "grpc-status" | "grpc-message" | "grpc-status-details-bin")
        })
        .map(|entry| match entry {
            KeyAndValueRef::Ascii(k, v) => Kv {
                key: k.to_string(),
                value: String::from_utf8_lossy(v.as_encoded_bytes()).into_owned(),
            },
            KeyAndValueRef::Binary(k, v) => Kv {
                key: k.to_string(),
                value: String::from_utf8_lossy(v.as_encoded_bytes()).into_owned(),
            },
        })
        .collect()
}

pub fn code_name(code: i32) -> &'static str {
    match code {
        0 => "OK",
        1 => "CANCELLED",
        2 => "UNKNOWN",
        3 => "INVALID_ARGUMENT",
        4 => "DEADLINE_EXCEEDED",
        5 => "NOT_FOUND",
        6 => "ALREADY_EXISTS",
        7 => "PERMISSION_DENIED",
        8 => "RESOURCE_EXHAUSTED",
        9 => "FAILED_PRECONDITION",
        10 => "ABORTED",
        11 => "OUT_OF_RANGE",
        12 => "UNIMPLEMENTED",
        13 => "INTERNAL",
        14 => "UNAVAILABLE",
        15 => "DATA_LOSS",
        16 => "UNAUTHENTICATED",
        _ => "UNKNOWN",
    }
}

// ---------- error details (grpc-status-details-bin) ----------

#[derive(Clone, PartialEq, prost::Message)]
struct RpcStatus {
    #[prost(int32, tag = "1")]
    code: i32,
    #[prost(string, tag = "2")]
    message: String,
    #[prost(message, repeated, tag = "3")]
    details: Vec<prost_types::Any>,
}

/// The standard error payloads, so ErrorInfo, BadRequest and friends read as JSON
/// even when the server's schema does not include them.
const ERROR_DETAILS_PROTO: &str = include_str!("grpc/error_details.proto");

fn error_details_pool() -> Option<DescriptorPool> {
    use std::sync::OnceLock;
    static POOL: OnceLock<Option<DescriptorPool>> = OnceLock::new();
    POOL.get_or_init(|| {
        let mut resolver = protox::file::ChainFileResolver::new();
        resolver.add(EmbeddedFile { name: "google/rpc/error_details.proto", source: ERROR_DETAILS_PROTO });
        resolver.add(protox::file::GoogleFileResolver::new());
        let mut compiler = protox::Compiler::with_file_resolver(resolver);
        compiler.include_imports(true);
        compiler.open_file("google/rpc/error_details.proto").ok()?;
        Some(compiler.descriptor_pool())
    })
    .clone()
}

struct EmbeddedFile {
    name: &'static str,
    source: &'static str,
}

impl protox::file::FileResolver for EmbeddedFile {
    fn open_file(&self, name: &str) -> Result<protox::file::File, protox::Error> {
        if name == self.name {
            protox::file::File::from_source(name, self.source)
        } else {
            Err(protox::Error::file_not_found(name))
        }
    }
}

fn decode_details(bytes: &[u8], pool: &DescriptorPool) -> Option<String> {
    if bytes.is_empty() {
        return None;
    }
    let status = RpcStatus::decode(bytes).ok()?;
    if status.details.is_empty() {
        return None;
    }
    let fallback = error_details_pool();
    let list: Vec<Value> = status
        .details
        .iter()
        .map(|any| {
            let name = any.type_url.rsplit('/').next().unwrap_or("");
            let desc = pool
                .get_message_by_name(name)
                .or_else(|| fallback.as_ref().and_then(|p| p.get_message_by_name(name)));
            let decoded = desc
                .and_then(|d| DynamicMessage::decode(d, any.value.as_slice()).ok())
                .and_then(|m| serde_json::from_str::<Value>(&to_json(&m)).ok());
            let mut obj = Map::new();
            obj.insert("@type".into(), Value::String(any.type_url.clone()));
            match decoded {
                Some(Value::Object(fields)) => obj.extend(fields),
                _ => {
                    obj.insert(
                        "value".into(),
                        Value::String(base64::engine::general_purpose::STANDARD.encode(&any.value)),
                    );
                }
            }
            Value::Object(obj)
        })
        .collect();
    serde_json::to_string(&list).ok()
}

// ---------- codec: dynamic messages in and out ----------

struct DynamicCodec {
    output: MessageDescriptor,
}

impl Codec for DynamicCodec {
    type Encode = DynamicMessage;
    type Decode = DynamicMessage;
    type Encoder = DynamicEncoder;
    type Decoder = DynamicDecoder;

    fn encoder(&mut self) -> Self::Encoder {
        DynamicEncoder
    }
    fn decoder(&mut self) -> Self::Decoder {
        DynamicDecoder(self.output.clone())
    }
}

struct DynamicEncoder;

impl Encoder for DynamicEncoder {
    type Item = DynamicMessage;
    type Error = Status;

    fn encode(&mut self, item: Self::Item, dst: &mut EncodeBuf<'_>) -> Result<(), Self::Error> {
        item.encode(dst).map_err(|e| Status::internal(format!("Could not encode the message: {e}")))
    }
}

struct DynamicDecoder(MessageDescriptor);

impl Decoder for DynamicDecoder {
    type Item = DynamicMessage;
    type Error = Status;

    fn decode(&mut self, src: &mut DecodeBuf<'_>) -> Result<Option<Self::Item>, Self::Error> {
        DynamicMessage::decode(self.0.clone(), src)
            .map(Some)
            .map_err(|e| Status::internal(format!("Could not decode the reply as {}: {e}", self.0.full_name())))
    }
}

// ---------- connection ----------

/// host:port and whether to use TLS. A scheme in the address wins over the TLS switch.
fn parse_address(address: &str, tls: bool) -> Result<(String, bool), String> {
    let raw = address.trim();
    if raw.is_empty() {
        return Err("Server address is empty".into());
    }
    let (rest, tls) = if let Some(r) = raw.strip_prefix("https://") {
        (r, true)
    } else if let Some(r) = raw.strip_prefix("http://") {
        (r, false)
    } else if let Some(r) = raw.strip_prefix("grpc://") {
        (r, tls)
    } else {
        (raw, tls)
    };
    let authority = rest.split('/').next().unwrap_or("").trim();
    if authority.is_empty() {
        return Err("Server address has no host".into());
    }
    // a port is needed; IPv6 literals keep their brackets
    let has_port = match authority.rfind(']') {
        Some(end) => authority[end..].contains(':'),
        None => authority.contains(':'),
    };
    let authority = if has_port {
        authority.to_string()
    } else {
        format!("{authority}:{}", if tls { 443 } else { 80 })
    };
    Ok((authority, tls))
}

async fn connect(target: &Target) -> Result<Channel, String> {
    let (authority, tls) = parse_address(&target.address, target.tls)?;
    let uri = format!("{}://{authority}", if tls { "https" } else { "http" });
    let endpoint = Endpoint::from_shared(uri)
        .map_err(|e| format!("Invalid server address: {e}"))?
        .user_agent(USER_AGENT)
        .map_err(|e| e.to_string())?
        .connect_timeout(Duration::from_secs(10))
        .tcp_nodelay(true);

    let mut http = hyper_util::client::legacy::connect::HttpConnector::new();
    http.enforce_http(false);
    http.set_nodelay(true);
    let connector = hyper_rustls::HttpsConnectorBuilder::new()
        .with_tls_config(tls_config(target.insecure))
        .https_or_http()
        .enable_http2()
        .wrap_connector(http);

    endpoint
        .connect_with_connector(connector)
        .await
        .map_err(|e| format!("Connection failed: {}", root_cause(&e)))
}

fn tls_config(insecure: bool) -> rustls::ClientConfig {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let builder = rustls::ClientConfig::builder_with_provider(provider.clone())
        .with_safe_default_protocol_versions()
        .expect("ring supports the default protocol versions");
    if insecure {
        builder
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(NoVerify(provider)))
            .with_no_client_auth()
    } else {
        let roots = rustls::RootCertStore { roots: webpki_roots::TLS_SERVER_ROOTS.to_vec() };
        builder.with_root_certificates(roots).with_no_client_auth()
    }
}

/// "Skip TLS verification" from Settings: accepts any certificate, still checks signatures.
#[derive(Debug)]
struct NoVerify(Arc<rustls::crypto::CryptoProvider>);

impl rustls::client::danger::ServerCertVerifier for NoVerify {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &rustls::pki_types::CertificateDer<'_>,
        dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls12_signature(message, cert, dss, &self.0.signature_verification_algorithms)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &rustls::pki_types::CertificateDer<'_>,
        dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls13_signature(message, cert, dss, &self.0.signature_verification_algorithms)
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        self.0.signature_verification_algorithms.supported_schemes()
    }
}

// ---------- schema ----------

fn pool_key(target: &Target, schema: &SchemaSource) -> String {
    match schema {
        SchemaSource::Reflection => {
            let (authority, tls) = parse_address(&target.address, target.tls).unwrap_or_default();
            format!("reflection|{tls}|{authority}")
        }
        SchemaSource::Protos { files, import_paths } => format!("protos|{}|{}", files.join(","), import_paths.join(",")),
    }
}

async fn cached_pool(state: &GrpcState, target: &Target, schema: &SchemaSource) -> Result<DescriptorPool, String> {
    let key = pool_key(target, schema);
    if let Some(pool) = state.pools.lock().map_err(|e| e.to_string())?.get(&key) {
        return Ok(pool.clone());
    }
    let pool = load_pool(target, schema).await?;
    state.pools.lock().map_err(|e| e.to_string())?.insert(key, pool.clone());
    Ok(pool)
}

async fn load_pool(target: &Target, schema: &SchemaSource) -> Result<DescriptorPool, String> {
    match schema {
        SchemaSource::Reflection => reflect(target).await,
        SchemaSource::Protos { files, import_paths } => {
            let files = files.clone();
            let imports = import_paths.clone();
            tokio::task::spawn_blocking(move || compile_protos(&files, &imports))
                .await
                .map_err(|e| e.to_string())?
        }
    }
}

/// Compiles .proto files with protox. A file outside every import path brings its own folder in.
fn compile_protos(files: &[String], import_paths: &[String]) -> Result<DescriptorPool, String> {
    if files.is_empty() {
        return Err("Add at least one .proto file".into());
    }
    let files: Vec<PathBuf> = files.iter().map(|f| home(f)).collect();
    let mut includes: Vec<PathBuf> = import_paths.iter().map(|p| home(p)).collect();
    for p in &files {
        if !includes.iter().any(|inc| p.starts_with(inc)) {
            if let Some(parent) = p.parent() {
                includes.push(parent.to_path_buf());
            }
        }
    }
    let mut compiler = protox::Compiler::new(&includes).map_err(|e| e.to_string())?;
    compiler.include_imports(true);
    compiler.open_files(&files).map_err(|e| e.to_string())?;
    Ok(compiler.descriptor_pool())
}

/// `~/x` as pasted from a shell, made absolute.
fn home(path: &str) -> PathBuf {
    match (path.strip_prefix("~/"), std::env::var_os("HOME")) {
        (Some(rest), Some(h)) => PathBuf::from(h).join(rest),
        _ => PathBuf::from(path),
    }
}

/// Server reflection: v1 first, then v1alpha, which many servers still only offer.
async fn reflect(target: &Target) -> Result<DescriptorPool, String> {
    let channel = connect(target).await?;
    match reflect_v1(channel.clone(), &target.metadata).await {
        Ok(pool) => Ok(pool),
        Err(ReflectError::Unimplemented(_)) => reflect_v1alpha(channel, &target.metadata)
            .await
            .map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    }
}

enum ReflectError {
    Unimplemented(String),
    Other(String),
}

impl std::fmt::Display for ReflectError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ReflectError::Unimplemented(m) | ReflectError::Other(m) => f.write_str(m),
        }
    }
}

impl From<Status> for ReflectError {
    fn from(s: Status) -> Self {
        let msg = format!("{} {}: {}", s.code() as i32, code_name(s.code() as i32), s.message());
        if s.code() == tonic::Code::Unimplemented {
            ReflectError::Unimplemented(msg)
        } else {
            ReflectError::Other(msg)
        }
    }
}

/// The same walk for both reflection versions: list services, fetch the file of each,
/// then every file those import that the server did not send along.
macro_rules! reflect_impl {
    ($name:ident, $pb:path) => {
        async fn $name(channel: Channel, metadata: &[Kv]) -> Result<DescriptorPool, ReflectError> {
            use $pb as pb;
            use pb::server_reflection_client::ServerReflectionClient;
            use pb::server_reflection_request::MessageRequest;
            use pb::server_reflection_response::MessageResponse;

            let mut client = ServerReflectionClient::new(channel).max_decoding_message_size(MAX_MESSAGE);
            let (tx, rx) = mpsc::channel::<pb::ServerReflectionRequest>(16);
            let mut req = tonic::Request::new(ReceiverStream::new(rx));
            apply_metadata(req.metadata_mut(), metadata).map_err(ReflectError::Other)?;
            let ask = |m: MessageRequest| pb::ServerReflectionRequest { host: String::new(), message_request: Some(m) };
            tx.send(ask(MessageRequest::ListServices(String::new())))
                .await
                .map_err(|_| ReflectError::Other("reflection stream closed".into()))?;
            let mut stream = client.server_reflection_info(req).await?.into_inner();

            let next = |m: Option<pb::ServerReflectionResponse>| -> Result<MessageResponse, ReflectError> {
                match m.and_then(|r| r.message_response) {
                    Some(MessageResponse::ErrorResponse(e)) => Err(ReflectError::Other(format!(
                        "{} {}: {}",
                        e.error_code,
                        code_name(e.error_code),
                        e.error_message
                    ))),
                    Some(r) => Ok(r),
                    None => Err(ReflectError::Other("the server closed reflection early".into())),
                }
            };

            let services = match next(stream.message().await?)? {
                MessageResponse::ListServicesResponse(l) => l.service.into_iter().map(|s| s.name).collect::<Vec<_>>(),
                _ => return Err(ReflectError::Other("unexpected reflection reply".into())),
            };

            let mut files: HashMap<String, prost_types::FileDescriptorProto> = HashMap::new();
            let take = |protos: Vec<Vec<u8>>, files: &mut HashMap<String, prost_types::FileDescriptorProto>| {
                for bytes in protos {
                    if let Ok(fd) = prost_types::FileDescriptorProto::decode(bytes.as_slice()) {
                        files.entry(fd.name().to_string()).or_insert(fd);
                    }
                }
            };
            for svc in services.iter().filter(|s| !s.starts_with("grpc.reflection.")) {
                tx.send(ask(MessageRequest::FileContainingSymbol(svc.clone())))
                    .await
                    .map_err(|_| ReflectError::Other("reflection stream closed".into()))?;
                match next(stream.message().await?) {
                    Ok(MessageResponse::FileDescriptorResponse(r)) => take(r.file_descriptor_proto, &mut files),
                    Ok(_) => {}
                    // one broken service should not hide the others
                    Err(_) => {}
                }
            }
            // imports the server did not send along: ask by file name, else use protox's google/protobuf copies
            loop {
                let missing: Vec<String> = files
                    .values()
                    .flat_map(|f| f.dependency.iter().cloned())
                    .filter(|d| !files.contains_key(d))
                    .collect::<std::collections::BTreeSet<_>>()
                    .into_iter()
                    .collect();
                if missing.is_empty() {
                    break;
                }
                for name in missing {
                    tx.send(ask(MessageRequest::FileByFilename(name.clone())))
                        .await
                        .map_err(|_| ReflectError::Other("reflection stream closed".into()))?;
                    let got = match next(stream.message().await?) {
                        Ok(MessageResponse::FileDescriptorResponse(r)) => {
                            take(r.file_descriptor_proto, &mut files);
                            files.contains_key(&name)
                        }
                        _ => false,
                    };
                    if !got {
                        let google = protox::file::FileResolver::open_file(&protox::file::GoogleFileResolver::new(), &name)
                            .map_err(|_| ReflectError::Other(format!("the server did not send {name}, which its schema imports")))?;
                        files.insert(name.clone(), google.file_descriptor_proto().clone());
                    }
                }
            }
            drop(tx);

            let mut pool = DescriptorPool::new();
            pool.add_file_descriptor_protos(files.into_values())
                .map_err(|e| ReflectError::Other(format!("the server's schema is not valid: {e}")))?;
            Ok(pool)
        }
    };
}

reflect_impl!(reflect_v1, tonic_reflection::pb::v1);
reflect_impl!(reflect_v1alpha, tonic_reflection::pb::v1alpha);

fn describe(pool: &DescriptorPool) -> SchemaInfo {
    let mut services: Vec<ServiceInfo> = pool
        .services()
        .filter(|s| !s.full_name().starts_with("grpc.reflection."))
        .map(|s| ServiceInfo {
            name: s.full_name().to_string(),
            methods: s
                .methods()
                .map(|m| MethodInfo {
                    name: m.name().to_string(),
                    stream: match (m.is_client_streaming(), m.is_server_streaming()) {
                        (false, false) => "unary",
                        (false, true) => "server",
                        (true, false) => "client",
                        (true, true) => "bidi",
                    },
                    input_type: m.input().full_name().to_string(),
                    output_type: m.output().full_name().to_string(),
                    example: serde_json::to_string_pretty(&example(&m.input(), 0)).unwrap_or_else(|_| "{}".into()),
                })
                .collect(),
        })
        .collect();
    services.sort_by(|a, b| a.name.cmp(&b.name));
    SchemaInfo { services }
}

// ---------- example messages ----------

/// A message with every field filled with a plausible value, in proto JSON form.
/// Only the first field of each oneof is filled; nesting stops after a few levels.
fn example(desc: &MessageDescriptor, depth: usize) -> Value {
    if let Some(v) = well_known_example(desc.full_name()) {
        return v;
    }
    let mut obj = Map::new();
    if depth > 4 {
        return Value::Object(obj);
    }
    let mut oneofs_seen = std::collections::HashSet::new();
    for field in desc.fields() {
        if let Some(o) = field.containing_oneof() {
            // proto3 optional fields sit in a synthetic oneof of their own
            if !o.is_synthetic() && !oneofs_seen.insert(o.full_name().to_string()) {
                continue;
            }
        }
        let value = if field.is_map() {
            let entry = match field.kind() {
                Kind::Message(m) => m,
                _ => continue,
            };
            let key = entry.map_entry_key_field();
            let val = entry.map_entry_value_field();
            let key_text = match key.kind() {
                Kind::String => "key".to_string(),
                Kind::Bool => "true".to_string(),
                _ => "0".to_string(),
            };
            let mut m = Map::new();
            m.insert(key_text, scalar_example(&val, depth));
            Value::Object(m)
        } else if field.is_list() {
            Value::Array(vec![scalar_example(&field, depth)])
        } else {
            scalar_example(&field, depth)
        };
        obj.insert(field.name().to_string(), value);
    }
    Value::Object(obj)
}

fn scalar_example(field: &FieldDescriptor, depth: usize) -> Value {
    match field.kind() {
        Kind::Double | Kind::Float => json!(0.0),
        Kind::Int32 | Kind::Sint32 | Kind::Sfixed32 | Kind::Uint32 | Kind::Fixed32 => json!(0),
        // proto JSON writes 64-bit integers as strings
        Kind::Int64 | Kind::Sint64 | Kind::Sfixed64 | Kind::Uint64 | Kind::Fixed64 => json!("0"),
        Kind::Bool => json!(false),
        Kind::String => json!(""),
        Kind::Bytes => json!(""),
        Kind::Enum(e) => {
            let v = e.values().find(|v| v.number() != 0).or_else(|| e.values().next());
            v.map(|v| json!(v.name())).unwrap_or(Value::Null)
        }
        Kind::Message(m) => example(&m, depth + 1),
    }
}

fn well_known_example(name: &str) -> Option<Value> {
    Some(match name {
        "google.protobuf.Timestamp" => json!("2026-01-01T00:00:00Z"),
        "google.protobuf.Duration" => json!("1s"),
        "google.protobuf.FieldMask" => json!(""),
        "google.protobuf.Struct" => json!({}),
        "google.protobuf.Value" => Value::Null,
        "google.protobuf.ListValue" => json!([]),
        "google.protobuf.Empty" => json!({}),
        "google.protobuf.Any" => json!({}),
        "google.protobuf.StringValue" | "google.protobuf.BytesValue" => json!(""),
        "google.protobuf.BoolValue" => json!(false),
        "google.protobuf.Int64Value" | "google.protobuf.UInt64Value" => json!("0"),
        "google.protobuf.Int32Value" | "google.protobuf.UInt32Value" => json!(0),
        "google.protobuf.DoubleValue" | "google.protobuf.FloatValue" => json!(0.0),
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wire_names_are_camel_case() {
        let s: SchemaSource = serde_json::from_value(json!({"source":"protos","files":["a.proto"],"importPaths":["/x"]})).unwrap();
        assert!(matches!(s, SchemaSource::Protos { ref import_paths, .. } if import_paths == &vec!["/x".to_string()]));
        let e = serde_json::to_value(GrpcEvent::Message { dir: "in", json: "{}".into(), size: 2, at_ms: 5 }).unwrap();
        assert_eq!(e, json!({"type":"message","dir":"in","json":"{}","size":2,"atMs":5}));
    }

    /// A real .proto from disk, as a pasted grpcurl command names it:
    /// `VOIDHTTP_PROTO=/path/a.proto VOIDHTTP_METHOD=pkg.Service/Method cargo test -- --ignored local_proto`
    #[test]
    #[ignore]
    fn local_proto_compiles_and_takes_the_message() {
        let file = std::env::var("VOIDHTTP_PROTO").expect("set VOIDHTTP_PROTO");
        let target = std::env::var("VOIDHTTP_METHOD").expect("set VOIDHTTP_METHOD");
        let dir = std::path::Path::new(&file).parent().unwrap().to_string_lossy().into_owned();
        let pool = compile_protos(&[file], &[dir]).unwrap();
        let (service, method) = target.rsplit_once('/').unwrap();
        let m = find_method(&pool, service, method).unwrap();
        let shape = describe(&pool).services.into_iter().flat_map(|s| s.methods).find(|x| x.name == method).unwrap();
        println!("{service}/{method}: {} → {} ({})\nexample: {}", m.input().full_name(), m.output().full_name(), shape.stream, shape.example);
        if let Ok(msg) = std::env::var("VOIDHTTP_MESSAGE") {
            let parsed = parse_message(m.input(), &msg).unwrap();
            println!("message ok: {}", to_json(&parsed));
        }
    }

    #[test]
    fn tilde_paths_expand() {
        let h = std::env::var("HOME").unwrap();
        assert_eq!(home("~/protos/a.proto"), PathBuf::from(&h).join("protos/a.proto"));
        assert_eq!(home("/abs/a.proto"), PathBuf::from("/abs/a.proto"));
    }

    #[test]
    fn address_gets_scheme_and_port() {
        assert_eq!(parse_address("localhost:50051", false).unwrap(), ("localhost:50051".into(), false));
        assert_eq!(parse_address("api.example.com", true).unwrap(), ("api.example.com:443".into(), true));
        assert_eq!(parse_address("https://api.example.com/x", false).unwrap(), ("api.example.com:443".into(), true));
        assert_eq!(parse_address("http://10.0.0.1", true).unwrap(), ("10.0.0.1:80".into(), false));
        assert_eq!(parse_address("[::1]:9000", false).unwrap(), ("[::1]:9000".into(), false));
        assert!(parse_address("  ", true).is_err());
    }

    fn sample_pool() -> DescriptorPool {
        let dir = std::env::temp_dir().join(format!("voidhttp-grpc-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("demo.proto");
        std::fs::write(
            &file,
            r#"syntax = "proto3";
package demo.v1;
import "google/protobuf/timestamp.proto";
enum View { VIEW_UNSPECIFIED = 0; VIEW_FULL = 1; }
message Req { string id = 1; View view = 2; repeated int64 ids = 3; map<string, Inner> tags = 4;
  oneof pick { string a = 5; string b = 6; } google.protobuf.Timestamp at = 7; optional bool flag = 8; }
message Inner { bool on = 1; }
service Demo { rpc Get(Req) returns (Inner); rpc Watch(Req) returns (stream Inner); rpc Sync(stream Req) returns (stream Inner); }
"#,
        )
        .unwrap();
        compile_protos(&[file.to_string_lossy().into_owned()], &[]).unwrap()
    }

    #[test]
    fn protos_compile_and_describe() {
        let info = describe(&sample_pool());
        let svc = &info.services[0];
        assert_eq!(svc.name, "demo.v1.Demo");
        let shapes: Vec<_> = svc.methods.iter().map(|m| (m.name.as_str(), m.stream)).collect();
        assert_eq!(shapes, vec![("Get", "unary"), ("Watch", "server"), ("Sync", "bidi")]);
        let ex: Value = serde_json::from_str(&svc.methods[0].example).unwrap();
        assert_eq!(ex["view"], "VIEW_FULL");
        assert_eq!(ex["ids"], json!(["0"]));
        assert_eq!(ex["tags"]["key"]["on"], false);
        assert_eq!(ex["at"], "2026-01-01T00:00:00Z");
        assert!(ex.get("a").is_some() && ex.get("b").is_none(), "one field per oneof");
        assert_eq!(ex["flag"], false);
    }

    #[test]
    fn messages_round_trip_through_json() {
        let pool = sample_pool();
        let req = pool.get_message_by_name("demo.v1.Req").unwrap();
        let msg = parse_message(req.clone(), r#"{"id":"x","view":"VIEW_FULL","ids":["5"]}"#).unwrap();
        let back: Value = serde_json::from_str(&to_json(&msg)).unwrap();
        assert_eq!(back["id"], "x");
        assert_eq!(back["view"], "VIEW_FULL");
        assert_eq!(back["ids"], json!(["5"]));
        assert!(parse_message(req.clone(), r#"{"nope":1}"#).is_err());
        assert!(parse_message(req, "{} trailing").is_err());
    }

    #[test]
    fn error_details_decode() {
        let pool = DescriptorPool::new();
        let info = error_details_pool().unwrap().get_message_by_name("google.rpc.ErrorInfo").unwrap();
        let mut m = DynamicMessage::new(info);
        m.set_field_by_name("reason", prost_reflect::Value::String("CUSTOMER_NOT_FOUND".into()));
        let status = RpcStatus {
            code: 5,
            message: "nope".into(),
            details: vec![prost_types::Any {
                type_url: "type.googleapis.com/google.rpc.ErrorInfo".into(),
                value: m.encode_to_vec(),
            }],
        };
        let out: Value = serde_json::from_str(&decode_details(&status.encode_to_vec(), &pool).unwrap()).unwrap();
        assert_eq!(out[0]["@type"], "type.googleapis.com/google.rpc.ErrorInfo");
        assert_eq!(out[0]["reason"], "CUSTOMER_NOT_FOUND");
    }
    /// Talks to grpcb.in, a public test server: `cargo test -- --ignored live_`
    #[tokio::test]
    #[ignore]
    async fn live_reflection_and_calls() {
        use std::sync::Mutex as StdMutex;
        for (address, tls) in [("grpcb.in:9000", false), ("grpcb.in:9001", true)] {
            let target = Target { address: address.into(), tls, insecure: false, metadata: vec![] };
            let pool = reflect(&target).await.unwrap_or_else(|e| panic!("{address}: {e}"));
            let names: Vec<_> = describe(&pool).services.into_iter().map(|s| s.name).collect();
            assert!(names.iter().any(|n| n == "hello.HelloService"), "{names:?}");

            let events = Arc::new(StdMutex::new(Vec::<Value>::new()));
            let sink = events.clone();
            let channel: IpcChannel<GrpcEvent> = IpcChannel::new(move |body| {
                if let tauri::ipc::InvokeResponseBody::Json(j) = body {
                    sink.lock().unwrap().push(serde_json::from_str(&j).unwrap());
                }
                Ok(())
            });
            let run = |method: &str, message: &str| InvokeRequest {
                id: "t".into(),
                target: target.clone(),
                schema: SchemaSource::Reflection,
                service: "hello.HelloService".into(),
                method: method.into(),
                message: message.into(),
                timeout_ms: 10_000,
            };
            // unary
            let req = run("SayHello", r#"{"greeting":"void"}"#);
            let m = find_method(&pool, &req.service, &req.method).unwrap();
            let (tx, rx) = mpsc::channel(4);
            tx.send(parse_message(m.input(), &req.message).unwrap()).await.unwrap();
            drop(tx);
            run_call(&req, &m, rx, &channel, Instant::now()).await.unwrap();
            // server streaming
            let req = run("LotsOfReplies", r#"{"greeting":"void"}"#);
            let m = find_method(&pool, &req.service, &req.method).unwrap();
            let (tx, rx) = mpsc::channel(4);
            tx.send(parse_message(m.input(), &req.message).unwrap()).await.unwrap();
            drop(tx);
            run_call(&req, &m, rx, &channel, Instant::now()).await.unwrap();

            // bidi: two messages a moment apart, then end sending
            let req = run("BidiHello", "");
            let m = find_method(&pool, &req.service, &req.method).unwrap();
            assert!(m.is_client_streaming() && m.is_server_streaming());
            let (tx, rx) = mpsc::channel(4);
            let input = m.input();
            tokio::spawn(async move {
                for word in ["one", "two"] {
                    tx.send(parse_message(input.clone(), &format!(r#"{{"greeting":"{word}"}}"#)).unwrap()).await.unwrap();
                    tokio::time::sleep(Duration::from_millis(200)).await;
                }
            });
            run_call(&req, &m, rx, &channel, Instant::now()).await.unwrap();

            // an error status reaches the end event with its code and message
            let req = InvokeRequest { service: "grpcbin.GRPCBin".into(), ..run("SpecificError", r#"{"code":5,"reason":"nope"}"#) };
            let m = find_method(&pool, &req.service, &req.method).unwrap();
            let (tx, rx) = mpsc::channel(1);
            tx.send(parse_message(m.input(), &req.message).unwrap()).await.unwrap();
            drop(tx);
            run_call(&req, &m, rx, &channel, Instant::now()).await.unwrap();
            {
                let ev = events.lock().unwrap();
                let last = ev.last().unwrap();
                assert_eq!((last["code"].as_i64(), last["status"].as_str()), (Some(5), Some("NOT_FOUND")), "{last}");
                println!("{address} error: {last}");
            }
            events.lock().unwrap().pop();

            let ev = events.lock().unwrap().clone();
            println!("{address}: {}", serde_json::to_string(&ev).unwrap());
            let ends: Vec<_> = ev.iter().filter(|e| e["type"] == "end").collect();
            assert!(ev.iter().any(|e| e.get("atMs").is_some()), "camelCase fields");
            assert_eq!(ends.len(), 3);
            assert!(ev.iter().any(|e| e["type"] == "message" && e["json"].as_str().unwrap().contains("two")), "bidi reply to the second message");
            assert!(ends.iter().all(|e| e["code"] == 0), "{ends:?}");
            let replies = ev.iter().filter(|e| e["type"] == "message" && e["dir"] == "in").count();
            assert!(replies >= 3, "unary reply plus several streamed ones, got {replies}");
        }
    }
}

