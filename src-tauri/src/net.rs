//! Settings > Network: secure DNS (DNS over HTTPS), an optional proxy, and the connection check.
//!
//! One configuration for the whole app. HTTP (reqwest), WebSocket and gRPC all look up hostnames
//! and open connections through here, so the switches in Settings apply to every kind of request.
//! Everything is off by default: hostnames go to the Mac's resolver and connections are direct.

use std::{
    io,
    net::{IpAddr, Ipv4Addr, SocketAddr},
    sync::{Arc, LazyLock, RwLock},
    time::{Duration, Instant},
};

use base64::Engine;
use hickory_resolver::{
    config::{NameServerConfig, NameServerConfigGroup, ResolverConfig},
    name_server::TokioConnectionProvider,
    proto::xfer::Protocol,
    TokioResolver,
};
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
    time::timeout,
};
use tokio_socks::tcp::Socks5Stream;

use crate::http::HttpState;

/// Hosts that never go through the proxy, whatever the skip list says: a local dev server
/// should not be sent out through WARP.
const ALWAYS_DIRECT: &[&str] = &["localhost", "127.0.0.1", "::1"];
const STEP_TIMEOUT: Duration = Duration::from_secs(10);

// ---------- configuration (camelCase from the webview) ----------

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct NetConfig {
    /// Look up hostnames over HTTPS instead of the Mac's resolver.
    pub secure_dns: bool,
    /// cloudflare | google | quad9 | adguard | custom
    pub provider: String,
    /// The DoH endpoint when provider is custom, e.g. https://dns.example.com/dns-query
    pub doh_url: String,
    /// When secure DNS has no answer, ask the Mac's resolver (intranet names on a VPN).
    pub fallback: bool,
    /// Domains that always use the Mac's resolver, comma separated; each covers its subdomains.
    pub system_domains: String,
    /// "" (none) | socks5 | http
    pub proxy: String,
    /// host:port, optionally user:pass@host:port
    pub proxy_addr: String,
    /// Hosts reached directly, comma separated; each covers its subdomains.
    pub proxy_skip: String,
}

impl Default for NetConfig {
    fn default() -> Self {
        Self {
            secure_dns: false,
            provider: "cloudflare".into(),
            doh_url: String::new(),
            fallback: true,
            system_domains: String::new(),
            proxy: String::new(),
            proxy_addr: String::new(),
            proxy_skip: String::new(),
        }
    }
}

struct Provider {
    id: &'static str,
    label: &'static str,
    ips: [IpAddr; 2],
    tls_name: &'static str,
}

const PROVIDERS: &[Provider] = &[
    Provider { id: "cloudflare", label: "Cloudflare", ips: [v4(1, 1, 1, 1), v4(1, 0, 0, 1)], tls_name: "cloudflare-dns.com" },
    Provider { id: "google", label: "Google", ips: [v4(8, 8, 8, 8), v4(8, 8, 4, 4)], tls_name: "dns.google" },
    Provider { id: "quad9", label: "Quad9", ips: [v4(9, 9, 9, 9), v4(149, 112, 112, 112)], tls_name: "dns.quad9.net" },
    Provider { id: "adguard", label: "AdGuard", ips: [v4(94, 140, 14, 14), v4(94, 140, 15, 15)], tls_name: "dns.adguard-dns.com" },
];

const fn v4(a: u8, b: u8, c: u8, d: u8) -> IpAddr {
    IpAddr::V4(Ipv4Addr::new(a, b, c, d))
}

// ---------- the live network setup ----------

#[derive(Clone, Copy, PartialEq)]
enum ProxyKind {
    Socks5,
    Http,
}

pub struct Proxy {
    kind: ProxyKind,
    host: String,
    port: u16,
    auth: Option<(String, String)>,
    /// as typed, for reqwest: socks5h://… lets the proxy look up names, so blocked DNS never matters
    url: String,
}

pub struct Net {
    /// the DoH resolver and its name for messages ("Cloudflare")
    doh: Option<(TokioResolver, String)>,
    fallback: bool,
    system: Vec<String>,
    proxy: Option<Proxy>,
    skip: Vec<String>,
}

static NET: LazyLock<RwLock<Arc<Net>>> = LazyLock::new(|| RwLock::new(Arc::new(Net::direct())));

/// The setup in force right now. A send keeps the one it started with.
pub fn current() -> Arc<Net> {
    match NET.read() {
        Ok(g) => g.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    }
}

impl Net {
    fn direct() -> Self {
        Self { doh: None, fallback: true, system: Vec::new(), proxy: None, skip: Vec::new() }
    }

    /// Builds the setup. A problem with one part (a bad custom URL, a bad proxy address) leaves
    /// that part off and comes back as a message for Settings; the rest still applies.
    async fn build(cfg: &NetConfig) -> (Self, Vec<String>) {
        let mut problems = Vec::new();
        let mut net = Self::direct();
        net.fallback = cfg.fallback;
        net.system = parse_list(&cfg.system_domains);
        net.skip = parse_list(&cfg.proxy_skip);
        net.skip.extend(ALWAYS_DIRECT.iter().map(|s| s.to_string()));

        if cfg.secure_dns {
            match doh_resolver(cfg).await {
                Ok(r) => net.doh = Some(r),
                Err(e) => problems.push(format!("Secure DNS is off: {e}")),
            }
        }
        let kind = match cfg.proxy.as_str() {
            "socks5" => Some(ProxyKind::Socks5),
            "http" => Some(ProxyKind::Http),
            _ => None,
        };
        if let Some(kind) = kind {
            match parse_proxy(kind, &cfg.proxy_addr) {
                Ok(p) => net.proxy = Some(p),
                Err(e) => problems.push(format!("Proxy is off: {e}")),
            }
        }
        (net, problems)
    }

    /// The proxy a connection to `host` goes through, if any.
    pub fn proxy_for(&self, host: &str) -> Option<&Proxy> {
        self.proxy.as_ref().filter(|_| !matches_any(&self.skip, host))
    }

    pub fn secure_dns(&self) -> bool {
        self.doh.is_some()
    }

    /// Looks a hostname up the way Settings says, and names where the answer came from.
    pub async fn lookup(&self, host: &str) -> io::Result<(Vec<IpAddr>, String)> {
        let bare = host.trim_start_matches('[').trim_end_matches(']');
        if let Ok(ip) = bare.parse::<IpAddr>() {
            return Ok((vec![ip], "IP address".into()));
        }
        let Some((doh, label)) = &self.doh else {
            return system_lookup(host).await.map(|ips| (ips, "system DNS".into()));
        };
        // single-label names (intranet short names), localhost and listed domains stay on the Mac
        if !host.contains('.') || host.eq_ignore_ascii_case("localhost") || matches_any(&self.system, host) {
            return system_lookup(host).await.map(|ips| (ips, "system DNS".into()));
        }
        let fqdn = format!("{}.", host.trim_end_matches('.'));
        let why = match doh.lookup_ip(fqdn).await {
            Ok(found) => {
                let ips: Vec<IpAddr> = found.iter().collect();
                if !ips.is_empty() {
                    return Ok((ips, format!("{label} over HTTPS")));
                }
                "no address".to_string()
            }
            Err(e) => e.to_string(),
        };
        if self.fallback {
            return system_lookup(host).await.map(|ips| (ips, "system DNS, after secure DNS had no answer".into()));
        }
        Err(io::Error::new(io::ErrorKind::NotFound, format!("Secure DNS ({label}) could not find {host}: {why}")))
    }

    /// A TCP connection to host:port: through the proxy when one applies, else to the looked-up address.
    pub async fn connect(&self, host: &str, port: u16) -> io::Result<TcpStream> {
        if let Some(p) = self.proxy_for(host) {
            return p.tunnel(host, port).await;
        }
        let (ips, _) = self.lookup(host).await?;
        connect_any(&ips, port).await
    }

    /// Hands secure DNS and the proxy to a reqwest client; with both off the builder is untouched.
    pub fn apply(self: &Arc<Self>, mut builder: reqwest::ClientBuilder) -> Result<reqwest::ClientBuilder, String> {
        if self.doh.is_some() {
            builder = builder.dns_resolver(Arc::new(Resolve(self.clone())));
        }
        if let Some(p) = &self.proxy {
            let proxy = reqwest::Proxy::all(&p.url)
                .map_err(|e| format!("Invalid proxy address: {e}"))?
                .no_proxy(reqwest::NoProxy::from_string(&self.skip.join(",")));
            builder = builder.proxy(proxy);
        }
        Ok(builder)
    }
}

impl Proxy {
    fn kind_label(&self) -> &'static str {
        match self.kind {
            ProxyKind::Socks5 => "SOCKS5",
            ProxyKind::Http => "HTTP",
        }
    }

    /// Opens a tunnel to host:port through the proxy. The proxy looks the name up itself.
    pub async fn tunnel(&self, host: &str, port: u16) -> io::Result<TcpStream> {
        let host = host.trim_start_matches('[').trim_end_matches(']');
        let stream = TcpStream::connect((self.host.as_str(), self.port)).await.map_err(|e| {
            io::Error::new(e.kind(), format!("{} proxy at {}:{} is not reachable: {e}", self.kind_label(), self.host, self.port))
        })?;
        let _ = stream.set_nodelay(true);
        match self.kind {
            ProxyKind::Socks5 => {
                let target = (host, port);
                let res = match &self.auth {
                    Some((user, pass)) => Socks5Stream::connect_with_password_and_socket(stream, target, user, pass).await,
                    None => Socks5Stream::connect_with_socket(stream, target).await,
                };
                res.map(Socks5Stream::into_inner).map_err(|e| io::Error::other(format!("SOCKS5 proxy: {e}")))
            }
            ProxyKind::Http => http_connect(stream, host, port, self.auth.as_ref()).await,
        }
    }
}

/// HTTP CONNECT: ask the proxy for a raw tunnel, read its answer head, keep the socket.
async fn http_connect(mut stream: TcpStream, host: &str, port: u16, auth: Option<&(String, String)>) -> io::Result<TcpStream> {
    let authority = if host.contains(':') { format!("[{host}]:{port}") } else { format!("{host}:{port}") };
    let auth = auth
        .map(|(u, p)| format!("Proxy-Authorization: Basic {}\r\n", base64::engine::general_purpose::STANDARD.encode(format!("{u}:{p}"))))
        .unwrap_or_default();
    stream
        .write_all(format!("CONNECT {authority} HTTP/1.1\r\nHost: {authority}\r\n{auth}\r\n").as_bytes())
        .await?;
    // byte by byte, so nothing after the head (the tunnel's first bytes) is read away
    let mut head = Vec::with_capacity(256);
    let mut byte = [0u8; 1];
    while !head.ends_with(b"\r\n\r\n") {
        if head.len() > 8 * 1024 {
            return Err(io::Error::other("HTTP proxy sent an oversized answer to CONNECT"));
        }
        if stream.read(&mut byte).await? == 0 {
            return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "HTTP proxy closed the connection during CONNECT"));
        }
        head.push(byte[0]);
    }
    let text = String::from_utf8_lossy(&head);
    let status = text.lines().next().unwrap_or("").trim();
    if status.split_whitespace().nth(1) == Some("200") {
        Ok(stream)
    } else {
        Err(io::Error::other(format!("HTTP proxy refused the tunnel: {status}")))
    }
}

/// reqwest's hook into `Net::lookup`.
struct Resolve(Arc<Net>);

impl reqwest::dns::Resolve for Resolve {
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let net = self.0.clone();
        let host = name.as_str().to_string();
        Box::pin(async move {
            let (ips, _) = net.lookup(&host).await?;
            let addrs: reqwest::dns::Addrs = Box::new(ips.into_iter().map(|ip| SocketAddr::new(ip, 0)));
            Ok(addrs)
        })
    }
}

async fn doh_resolver(cfg: &NetConfig) -> Result<(TokioResolver, String), String> {
    let (group, label) = if cfg.provider == "custom" {
        custom_group(&cfg.doh_url).await?
    } else {
        let p = PROVIDERS.iter().find(|p| p.id == cfg.provider).unwrap_or(&PROVIDERS[0]);
        (NameServerConfigGroup::from_ips_https(&p.ips, 443, p.tls_name.to_string(), true), p.label.to_string())
    };
    let mut builder = TokioResolver::builder_with_config(ResolverConfig::from_parts(None, vec![], group), TokioConnectionProvider::default());
    let opts = builder.options_mut();
    opts.timeout = Duration::from_secs(4);
    opts.attempts = 1;
    opts.cache_size = 256;
    Ok((builder.build(), label))
}

/// A custom DoH URL: its host is looked up once, over Cloudflare's DoH so a blocked provider name
/// still resolves, then over the Mac's resolver.
async fn custom_group(raw: &str) -> Result<(NameServerConfigGroup, String), String> {
    let raw = raw.trim();
    if raw.is_empty() {
        return Err("enter the server URL".into());
    }
    let url = reqwest::Url::parse(raw).map_err(|e| format!("invalid server URL ({e})"))?;
    if url.scheme() != "https" {
        return Err("the server URL must start with https://".into());
    }
    let host = url.host_str().ok_or("the server URL has no host")?.trim_start_matches('[').trim_end_matches(']').to_string();
    let port = url.port().unwrap_or(443);
    let path = match url.path() {
        "" | "/" => "/dns-query".to_string(),
        p => match url.query() {
            Some(q) => format!("{p}?{q}"),
            None => p.to_string(),
        },
    };
    let ips = match host.parse::<IpAddr>() {
        Ok(ip) => vec![ip],
        Err(_) => bootstrap(&host).await.map_err(|e| format!("cannot find {host}: {e}"))?,
    };
    let servers: Vec<NameServerConfig> = ips
        .into_iter()
        .take(4)
        .map(|ip| {
            let mut ns = NameServerConfig::new(SocketAddr::new(ip, port), Protocol::Https);
            ns.tls_dns_name = Some(host.clone());
            ns.http_endpoint = Some(path.clone());
            ns
        })
        .collect();
    Ok((NameServerConfigGroup::from(servers), host))
}

async fn bootstrap(host: &str) -> io::Result<Vec<IpAddr>> {
    let p = &PROVIDERS[0];
    let group = NameServerConfigGroup::from_ips_https(&p.ips, 443, p.tls_name.to_string(), true);
    let resolver = TokioResolver::builder_with_config(ResolverConfig::from_parts(None, vec![], group), TokioConnectionProvider::default()).build();
    if let Ok(Ok(found)) = timeout(Duration::from_secs(5), resolver.lookup_ip(format!("{host}."))).await {
        let ips: Vec<IpAddr> = found.iter().collect();
        if !ips.is_empty() {
            return Ok(ips);
        }
    }
    system_lookup(host).await
}

async fn system_lookup(host: &str) -> io::Result<Vec<IpAddr>> {
    let mut ips: Vec<IpAddr> = tokio::net::lookup_host((host, 0)).await?.map(|a| a.ip()).collect();
    ips.dedup();
    if ips.is_empty() {
        return Err(io::Error::new(io::ErrorKind::NotFound, format!("no address for {host}")));
    }
    Ok(ips)
}

/// Tries each address in turn; with more than one, a dead address gets 5 s before the next.
async fn connect_any(ips: &[IpAddr], port: u16) -> io::Result<TcpStream> {
    let mut last = None;
    for ip in ips {
        let attempt = TcpStream::connect((*ip, port));
        let res = if ips.len() > 1 {
            timeout(Duration::from_secs(5), attempt)
                .await
                .unwrap_or_else(|_| Err(io::Error::new(io::ErrorKind::TimedOut, format!("{ip}:{port} did not answer"))))
        } else {
            attempt.await
        };
        match res {
            Ok(s) => {
                let _ = s.set_nodelay(true);
                return Ok(s);
            }
            Err(e) => last = Some(e),
        }
    }
    Err(last.unwrap_or_else(|| io::Error::new(io::ErrorKind::NotFound, "no address to connect to")))
}

/// "host:port" or "user:pass@host:port"; a bare host gets the usual port of its kind.
fn parse_proxy(kind: ProxyKind, raw: &str) -> Result<Proxy, String> {
    let raw = raw.trim();
    let raw = raw.split_once("://").map_or(raw, |(_, rest)| rest).trim_end_matches('/');
    if raw.is_empty() {
        return Err("enter the proxy address".into());
    }
    let (auth, hostport) = match raw.rsplit_once('@') {
        Some((userinfo, hp)) => {
            let (u, p) = userinfo.split_once(':').unwrap_or((userinfo, ""));
            (Some((u.to_string(), p.to_string())), hp)
        }
        None => (None, raw),
    };
    let default_port = if kind == ProxyKind::Socks5 { 1080 } else { 8080 };
    let (host, port) = match hostport.rsplit_once(':') {
        Some((h, p)) if !h.ends_with(':') && !p.contains(']') => {
            (h.to_string(), p.parse::<u16>().map_err(|_| format!("\"{p}\" is not a port"))?)
        }
        _ => (hostport.to_string(), default_port),
    };
    let host = host.trim_start_matches('[').trim_end_matches(']').to_string();
    if host.is_empty() {
        return Err("the proxy address has no host".into());
    }
    let scheme = if kind == ProxyKind::Socks5 { "socks5h" } else { "http" };
    let url = format!("{scheme}://{raw}");
    Ok(Proxy { kind, host, port, auth, url })
}

/// Comma, space or newline separated domains; "*.corp.local", ".corp.local" and "corp.local" are the same entry.
fn parse_list(s: &str) -> Vec<String> {
    s.split([',', ' ', '\n', ';'])
        .map(|e| e.trim().trim_start_matches("*.").trim_start_matches('.').to_ascii_lowercase())
        .filter(|e| !e.is_empty())
        .collect()
}

/// An entry covers itself and its subdomains; "*" covers everything.
fn matches_any(list: &[String], host: &str) -> bool {
    let h = host.trim_start_matches('[').trim_end_matches(']').trim_end_matches('.').to_ascii_lowercase();
    list.iter().any(|d| d == "*" || h == *d || (h.len() > d.len() && h.ends_with(d.as_str()) && h.as_bytes()[h.len() - d.len() - 1] == b'.'))
}

// ---------- commands ----------

/// Applies Settings > Network. Pooled HTTP connections are dropped so the next send uses it.
/// Ok holds the parts that could not be turned on, as messages for Settings (empty: all good).
#[tauri::command]
pub async fn net_configure(http: State<'_, HttpState>, config: NetConfig) -> Result<Vec<String>, String> {
    let (net, problems) = Net::build(&config).await;
    *NET.write().map_err(|e| e.to_string())? = Arc::new(net);
    http.reset_clients();
    Ok(problems)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetStep {
    pub name: &'static str,
    pub ok: bool,
    pub detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetCheck {
    pub ok: bool,
    pub ms: u64,
    pub steps: Vec<NetStep>,
    /// what to try next, when a step failed
    pub hint: Option<String>,
}

/// Settings > Network > Check a host: look up, connect and (for https) finish a TLS handshake with
/// the settings in force, reporting each step, so a block can be told apart from a typo.
#[tauri::command]
pub async fn net_test(host: String) -> Result<NetCheck, String> {
    let (host, port, tls) = parse_target(&host)?;
    let net = current();
    let started = Instant::now();
    let mut steps = Vec::new();
    let done = |steps: Vec<NetStep>, hint: Option<&str>| NetCheck {
        ok: hint.is_none(),
        ms: started.elapsed().as_millis() as u64,
        steps,
        hint: hint.map(str::to_string),
    };
    let ms = |t: Instant| t.elapsed().as_millis();

    let stream = if let Some(p) = net.proxy_for(&host) {
        steps.push(NetStep { name: "DNS", ok: true, detail: "looked up by the proxy".into() });
        let t = Instant::now();
        match timeout(STEP_TIMEOUT, p.tunnel(&host, port)).await {
            Ok(Ok(s)) => {
                steps.push(NetStep { name: "Connect", ok: true, detail: format!("{host}:{port} · via {} {}:{} · {} ms", p.kind_label(), p.host, p.port, ms(t)) });
                s
            }
            res => {
                let detail = match res {
                    Ok(Err(e)) => e.to_string(),
                    _ => format!("no answer within {} s", STEP_TIMEOUT.as_secs()),
                };
                steps.push(NetStep { name: "Connect", ok: false, detail });
                return Ok(done(steps, Some("Check that the proxy is running. For Cloudflare WARP: warp-cli mode proxy, then warp-cli connect.")));
            }
        }
    } else {
        let t = Instant::now();
        let ips = match timeout(STEP_TIMEOUT, net.lookup(&host)).await {
            Ok(Ok((ips, source))) => {
                let more = if ips.len() > 1 { format!(" (+{})", ips.len() - 1) } else { String::new() };
                steps.push(NetStep { name: "DNS", ok: true, detail: format!("{}{more} · {source} · {} ms", ips[0], ms(t)) });
                ips
            }
            res => {
                let detail = match res {
                    Ok(Err(e)) => e.to_string(),
                    _ => format!("no answer within {} s", STEP_TIMEOUT.as_secs()),
                };
                steps.push(NetStep { name: "DNS", ok: false, detail });
                return Ok(done(steps, Some("Check the hostname. If it is right, try another secure DNS provider.")));
            }
        };
        let t = Instant::now();
        match timeout(STEP_TIMEOUT, connect_any(&ips, port)).await {
            Ok(Ok(s)) => {
                let peer = s.peer_addr().map(|a| a.to_string()).unwrap_or_else(|_| format!("{}:{port}", ips[0]));
                steps.push(NetStep { name: "Connect", ok: true, detail: format!("{peer} · direct · {} ms", ms(t)) });
                s
            }
            res => {
                let detail = match res {
                    Ok(Err(e)) => e.to_string(),
                    _ => format!("no answer within {} s", STEP_TIMEOUT.as_secs()),
                };
                steps.push(NetStep { name: "Connect", ok: false, detail });
                let hint = if net.secure_dns() {
                    "The address can't be reached from this network. Try the proxy."
                } else {
                    "Your ISP's DNS may point this site somewhere else. Turn on secure DNS."
                };
                return Ok(done(steps, Some(hint)));
            }
        }
    };

    if !tls {
        return Ok(done(steps, None));
    }
    let t = Instant::now();
    let name = rustls::pki_types::ServerName::try_from(host.clone()).map_err(|e| format!("Invalid hostname: {e}"))?;
    let connector = tokio_rustls::TlsConnector::from(Arc::new(crate::certs::tls_config(false, &host, port)?));
    let proxied = net.proxy_for(&host).is_some();
    match timeout(STEP_TIMEOUT, connector.connect(name, stream)).await {
        Ok(Ok(conn)) => {
            let version = match conn.get_ref().1.protocol_version() {
                Some(rustls::ProtocolVersion::TLSv1_3) => "TLS 1.3",
                Some(rustls::ProtocolVersion::TLSv1_2) => "TLS 1.2",
                _ => "TLS",
            };
            steps.push(NetStep { name: "TLS", ok: true, detail: format!("{version} · certificate valid for {host} · {} ms", ms(t)) });
            Ok(done(steps, None))
        }
        Ok(Err(e)) => {
            let cert = e.get_ref().and_then(|inner| inner.downcast_ref::<rustls::Error>()).is_some_and(|r| matches!(r, rustls::Error::InvalidCertificate(_)));
            let (detail, hint) = if cert {
                (
                    format!("certificate rejected: {e}"),
                    if net.secure_dns() || proxied {
                        "The server's certificate is not valid for this name."
                    } else {
                        "Something on the network answered in the site's place. Turn on secure DNS."
                    },
                )
            } else if matches!(e.kind(), io::ErrorKind::ConnectionReset | io::ErrorKind::UnexpectedEof | io::ErrorKind::BrokenPipe) {
                (
                    "connection reset after ClientHello".to_string(),
                    if proxied {
                        "The proxy closed the connection during TLS."
                    } else {
                        "Your network blocks this site by name, which secure DNS can't get around. Turn on the proxy and run WARP in proxy mode."
                    },
                )
            } else {
                (e.to_string(), "The TLS handshake failed.")
            };
            steps.push(NetStep { name: "TLS", ok: false, detail });
            Ok(done(steps, Some(hint)))
        }
        Err(_) => {
            steps.push(NetStep { name: "TLS", ok: false, detail: format!("no answer to ClientHello within {} s", STEP_TIMEOUT.as_secs()) });
            let hint = if proxied { "The proxy did not finish the TLS handshake." } else { "Your network may block this site by name. Turn on the proxy and run WARP in proxy mode." };
            Ok(done(steps, Some(hint)))
        }
    }
}

/// "api.example.com", "api.example.com:8443" or a full URL; TLS unless the scheme is http or ws.
fn parse_target(raw: &str) -> Result<(String, u16, bool), String> {
    let raw = raw.trim();
    if raw.is_empty() {
        return Err("Enter a host to check".into());
    }
    let with_scheme = if raw.contains("://") { raw.to_string() } else { format!("https://{raw}") };
    let url = reqwest::Url::parse(&with_scheme).map_err(|e| format!("Invalid host: {e}"))?;
    let tls = !matches!(url.scheme(), "http" | "ws");
    let host = url.host_str().ok_or("Invalid host")?.trim_start_matches('[').trim_end_matches(']').to_string();
    let port = url.port().unwrap_or(if tls { 443 } else { 80 });
    Ok((host, port, tls))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_cover_subdomains() {
        let list = parse_list("*.corp.local, .internal\nexample.com");
        assert!(matches_any(&list, "corp.local"));
        assert!(matches_any(&list, "api.corp.local"));
        assert!(matches_any(&list, "a.b.internal"));
        assert!(matches_any(&list, "EXAMPLE.com."));
        assert!(!matches_any(&list, "notexample.com"));
        assert!(!matches_any(&list, "corp.local.evil.io"));
        assert!(matches_any(&parse_list("*"), "anything.io"));
    }

    #[test]
    fn proxy_addresses() {
        let p = parse_proxy(ProxyKind::Socks5, "127.0.0.1:40000").unwrap();
        assert_eq!((p.host.as_str(), p.port, p.url.as_str()), ("127.0.0.1", 40000, "socks5h://127.0.0.1:40000"));
        let p = parse_proxy(ProxyKind::Http, "http://bob:s3cret@proxy.lan:3128/").unwrap();
        assert_eq!((p.host.as_str(), p.port), ("proxy.lan", 3128));
        assert_eq!(p.auth, Some(("bob".into(), "s3cret".into())));
        assert_eq!(parse_proxy(ProxyKind::Socks5, "warp.lan").unwrap().port, 1080);
        assert!(parse_proxy(ProxyKind::Socks5, "host:notaport").is_err());
        assert!(parse_proxy(ProxyKind::Socks5, "  ").is_err());
    }

    #[test]
    fn targets() {
        assert_eq!(parse_target("api.binance.com").unwrap(), ("api.binance.com".into(), 443, true));
        assert_eq!(parse_target("http://intranet:8080/x").unwrap(), ("intranet".into(), 8080, false));
        assert_eq!(parse_target("wss://stream.bybit.com/v5").unwrap(), ("stream.bybit.com".into(), 443, true));
    }

    #[tokio::test]
    async fn http_connect_tunnel() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut s, _) = listener.accept().await.unwrap();
            let mut buf = vec![0u8; 1024];
            let n = s.read(&mut buf).await.unwrap();
            let req = String::from_utf8_lossy(&buf[..n]).to_string();
            assert!(req.starts_with("CONNECT example.com:443 HTTP/1.1\r\n"));
            assert!(req.contains("Proxy-Authorization: Basic Ym9iOnB3\r\n"));
            s.write_all(b"HTTP/1.1 200 Connection established\r\n\r\nhello").await.unwrap();
        });
        let p = parse_proxy(ProxyKind::Http, &format!("bob:pw@{addr}")).unwrap();
        let mut s = p.tunnel("example.com", 443).await.unwrap();
        let mut rest = [0u8; 5];
        s.read_exact(&mut rest).await.unwrap();
        assert_eq!(&rest, b"hello");
    }
}

#[cfg(test)]
mod live {
    use super::*;

    /// Needs the internet: cargo test net::live -- --ignored
    #[tokio::test]
    #[ignore]
    async fn secure_dns_and_check() {
        let cfg = NetConfig { secure_dns: true, ..NetConfig::default() };
        let (net, problems) = Net::build(&cfg).await;
        assert!(problems.is_empty(), "{problems:?}");
        let (ips, source) = net.lookup("example.com").await.unwrap();
        assert!(!ips.is_empty());
        assert_eq!(source, "Cloudflare over HTTPS");
        *NET.write().unwrap() = Arc::new(net);
        let check = net_test("api.binance.com".into()).await.unwrap();
        println!("{check:#?}");
        let custom = NetConfig { secure_dns: true, provider: "custom".into(), doh_url: "https://dns.google/dns-query".into(), ..NetConfig::default() };
        let (net, problems) = Net::build(&custom).await;
        assert!(problems.is_empty(), "{problems:?}");
        assert_eq!(net.lookup("example.com").await.unwrap().1, "dns.google over HTTPS");
    }
}
