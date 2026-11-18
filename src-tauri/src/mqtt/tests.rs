//! Session tests: the client against an in-memory broker that speaks through the same packet code.
//! The `live_*` tests at the end need a real broker (see `live_broker`); they are ignored by default.

use super::*;
use packet::{ConnAck, SubAck};
use serde_json::{json, Value};
use tokio::{
    io::{duplex, DuplexStream},
    sync::mpsc::{unbounded_channel, UnboundedReceiver},
    task::JoinHandle,
};

const WAIT: Duration = Duration::from_secs(30);

struct Broker {
    io: DuplexStream,
    v: Version,
    buf: Vec<u8>,
}

impl Broker {
    async fn recv(&mut self) -> Packet {
        tokio::time::timeout(WAIT, async {
            loop {
                if let Some((p, n)) = packet::decode(&self.buf, self.v, MAX_IN).unwrap() {
                    self.buf.drain(..n);
                    return p;
                }
                let mut c = [0u8; 4096];
                let n = self.io.read(&mut c).await.unwrap();
                assert!(n > 0, "the client closed the link while the broker waited for a packet");
                self.buf.extend_from_slice(&c[..n]);
            }
        })
        .await
        .expect("the client sent nothing")
    }

    async fn send(&mut self, p: Packet) {
        self.io.write_all(&p.encode(self.v)).await.unwrap();
    }

    /// The client hung up: reads end.
    async fn gone(&mut self) -> bool {
        let mut c = [0u8; 256];
        matches!(tokio::time::timeout(WAIT, self.io.read(&mut c)).await, Ok(Ok(0)) | Ok(Err(_)))
    }
}

struct Client {
    events: UnboundedReceiver<MqttEvent>,
    cmd: mpsc::Sender<Cmd>,
    task: JoinHandle<()>,
}

impl Client {
    async fn next(&mut self) -> Value {
        let e = tokio::time::timeout(WAIT, self.events.recv()).await.expect("no event").expect("the session ended without an event");
        serde_json::to_value(e).unwrap()
    }

    /// The next event of this type; others before it are skipped.
    async fn next_of(&mut self, kind: &str) -> Value {
        loop {
            let e = self.next().await;
            if e["type"] == kind {
                return e;
            }
        }
    }

    async fn publish(&self, p: PublishRequest) {
        self.cmd.send(Cmd::Publish(p)).await.unwrap();
    }

    async fn subs(&self, list: Vec<SubRequest>) {
        self.cmd.send(Cmd::Subs(list)).await.unwrap();
    }

    async fn close(&self) {
        self.cmd.send(Cmd::Close).await.unwrap();
    }

    /// Nothing more arrives, and the session task ended.
    async fn ended(mut self) {
        tokio::time::timeout(WAIT, &mut self.task).await.expect("the session did not end").unwrap();
        assert!(self.events.recv().await.is_none(), "an event after the end");
    }
}

fn request(version: &str) -> MqttRequest {
    MqttRequest {
        id: "t".into(),
        url: "mqtt://broker.test:1883".into(),
        version: version.into(),
        client_id: String::new(),
        clean_start: true,
        keep_alive: 60,
        session_expiry: 0,
        username: String::new(),
        password: String::new(),
        will: None,
        subs: Vec::new(),
        insecure: false,
        timeout_ms: 5_000,
    }
}

fn sub(filter: &str, qos: u8) -> SubRequest {
    SubRequest { filter: filter.into(), qos, no_local: false, retain_as_published: false, retain_handling: 0 }
}

fn publish(seq: u64, topic: &str, payload: &str, qos: u8) -> PublishRequest {
    PublishRequest {
        seq,
        topic: topic.into(),
        payload: payload.into(),
        qos,
        retain: false,
        content_type: String::new(),
        utf8: None,
        message_expiry: None,
        response_topic: String::new(),
        correlation: String::new(),
        user: Vec::new(),
    }
}

/// The client connecting over an in-memory link; the broker side is handed back.
fn start(r: MqttRequest) -> (Broker, Client) {
    let (client_io, broker_io) = duplex(1 << 20);
    let t = Target::parse(&r.url).unwrap();
    let o = Opts::from(&r).unwrap();
    let v = o.version;
    let (cmd, mut rx) = mpsc::channel(64);
    let (etx, events) = unbounded_channel();
    let subs = r.subs.clone();
    let task = tokio::spawn(async move {
        let emit = move |e: MqttEvent| {
            let _ = etx.send(e);
        };
        run_over(async move { Ok((Link::Stream(Box::new(client_io)), None)) }, &t, &o, &subs, &mut rx, &emit).await;
    });
    (Broker { io: broker_io, v, buf: Vec::new() }, Client { events, cmd, task })
}

/// CONNECT in, CONNACK out; returns what the client sent.
async fn accept(b: &mut Broker, props: Props) -> Connect {
    let Packet::Connect(c) = b.recv().await else { panic!("first packet is not CONNECT") };
    b.send(Packet::ConnAck(ConnAck { session_present: false, code: 0, props })).await;
    c
}

#[test]
fn urls() {
    let t = |s: &str| Target::parse(s).unwrap();
    assert_eq!(t("broker.test"), Target { tls: false, ws: false, host: "broker.test".into(), port: 1883, path: String::new() });
    assert_eq!(t("broker.test:1884").port, 1884);
    assert_eq!(t("mqtts://broker.test").port, 8883);
    assert!(t("ssl://broker.test").tls);
    assert!(t("tcp://broker.test:1883").port == 1883);
    let w = t("wss://broker.test:8084");
    assert_eq!((w.tls, w.ws, w.port, w.path.as_str()), (true, true, 8084, "/mqtt"));
    assert_eq!(t("ws://broker.test").port, 80);
    assert_eq!(t("ws://broker.test:9001/").path, "/");
    assert_eq!(t("wss://broker.test/ws?token=abc").path, "/ws?token=abc");
    assert_eq!(t("mqtt://[::1]:1883").host, "::1");
    assert_eq!(t("mqtt://[::1]:1883").addr(), "[::1]:1883");
    assert_eq!(t("MQTTS://Broker.Test").port, 8883);
    assert!(Target::parse("").is_err());
    assert!(Target::parse("http://broker.test").unwrap_err().contains("Unknown scheme"));
    assert!(Target::parse("mqtt://").is_err());
}

#[test]
fn options() {
    let o = Opts::from(&request("5")).unwrap();
    assert_eq!(o.version, Version::V5);
    assert!(o.random_id && o.client_id.starts_with("voidhttp") && o.client_id.len() == 18, "{}", o.client_id);
    assert!(o.client_id.chars().all(|c| c.is_ascii_alphanumeric()), "3.1.1 only promises [0-9a-zA-Z]");
    assert_ne!(Opts::from(&request("5")).unwrap().client_id, o.client_id, "a new random id each time");
    assert_eq!(Opts::from(&request("3.1.1")).unwrap().version, Version::V311);

    let mut r = request("3.1.1");
    r.password = "pw".into();
    assert!(Opts::from(&r).unwrap_err().contains("username"));
    let mut r = request("5");
    r.password = "pw".into();
    assert!(Opts::from(&r).is_ok(), "MQTT 5 sends a password alone");

    let mut r = request("5");
    r.will = Some(WillRequest { topic: "a/+".into(), payload: String::new(), qos: 1, retain: false, delay: 0 });
    assert!(Opts::from(&r).unwrap_err().starts_with("Last Will"));
}

#[tokio::test]
async fn connects_and_reports_the_broker() {
    let mut r = request("5");
    r.client_id = "ops-console".into();
    r.username = "ops".into();
    r.password = "s3cret".into();
    r.keep_alive = 60;
    r.session_expiry = 300;
    r.will = Some(WillRequest { topic: "atm/voidhttp/status".into(), payload: "{\"state\":\"OFFLINE\"}".into(), qos: 1, retain: true, delay: 5 });
    let (mut b, mut c) = start(r);
    let props = Props {
        server_keep_alive: Some(30),
        max_qos: Some(1),
        retain_available: Some(1),
        shared_available: Some(1),
        receive_max: Some(32),
        topic_alias_max: Some(10),
        user: vec![("server".into(), "emqx 5.8.1".into())],
        ..Default::default()
    };
    let sent = accept(&mut b, props).await;
    assert_eq!(sent.client_id, "ops-console");
    assert_eq!(sent.username.as_deref(), Some("ops"));
    assert_eq!(sent.password.as_deref(), Some(&b"s3cret"[..]));
    assert_eq!(sent.keep_alive, 60);
    assert_eq!(sent.props.session_expiry, Some(300));
    assert_eq!(sent.props.max_packet_size, Some(MAX_IN as u32));
    let w = sent.will.unwrap();
    assert_eq!((w.topic.as_str(), w.qos, w.retain, w.props.will_delay), ("atm/voidhttp/status", 1, true, Some(5)));

    let e = c.next().await;
    assert_eq!(e["type"], "connected");
    let i = &e["info"];
    assert_eq!(i["broker"], "broker.test:1883");
    assert_eq!(i["transport"], "TCP");
    assert_eq!(i["version"], "5.0");
    assert_eq!(i["clientId"], "ops-console");
    assert_eq!(i["randomId"], false);
    assert_eq!(i["keepAlive"], 30);
    assert_eq!(i["serverKeepAlive"], 30);
    assert_eq!(i["maxQos"], 1);
    assert_eq!(i["receiveMax"], 32);
    assert_eq!(i["will"], "atm/voidhttp/status · QoS 1 · retained · delay 5 s");
    assert_eq!(i["user"], json!([{ "key": "server", "value": "emqx 5.8.1" }]));
    c.close().await;
    assert!(matches!(b.recv().await, Packet::Disconnect(Disconnect { code: 0, .. })));
    assert_eq!(c.next().await["by"], "client");
    c.ended().await;
}

#[tokio::test]
async fn assigned_client_id_wins() {
    let (mut b, mut c) = start(request("5"));
    accept(&mut b, Props { assigned_client_id: Some("auto-77".into()), ..Default::default() }).await;
    let e = c.next().await;
    assert_eq!(e["info"]["clientId"], "auto-77");
    assert_eq!(e["info"]["assignedId"], true);
}

#[tokio::test]
async fn subscribes_on_connect_and_reports_each_filter() {
    let mut r = request("5");
    r.subs = vec![sub("atm/+/status", 1), sub("atm/0142/telemetry/#", 0), sub("$share/ops/atm/+/alerts", 2), sub("$SYS/#", 0), sub("bad/#/x", 0), sub("  ", 1), sub("atm/+/status", 2)];
    let (mut b, mut c) = start(r);
    accept(&mut b, Props::default()).await;
    assert_eq!(c.next().await["type"], "connected");

    // the broken filter is answered locally, never sent
    let local = c.next().await;
    assert_eq!(local["type"], "subscribed");
    assert_eq!(local["results"][0]["filter"], "bad/#/x");
    assert!(local["results"][0]["error"].as_str().unwrap().contains("last one"));

    let Packet::Subscribe(s) = b.recv().await else { panic!("expected SUBSCRIBE") };
    let filters: Vec<(&str, u8)> = s.filters.iter().map(|(f, o)| (f.as_str(), o.qos)).collect();
    // sorted, deduped (the first entry of a filter wins), the blank one dropped
    assert_eq!(filters, vec![("$SYS/#", 0), ("$share/ops/atm/+/alerts", 2), ("atm/+/status", 1), ("atm/0142/telemetry/#", 0)]);
    b.send(Packet::SubAck(SubAck { pid: s.pid, props: Props::default(), codes: vec![0x87, 1, 1, 0] })).await;

    let e = c.next().await;
    assert_eq!(e["type"], "subscribed");
    assert_eq!(e["results"][0], json!({ "filter": "$SYS/#", "qos": 0, "error": "0x87 Not authorized" }));
    assert_eq!(e["results"][1], json!({ "filter": "$share/ops/atm/+/alerts", "qos": 2, "granted": 1 }));
    assert_eq!(e["results"][2]["granted"], 1);
    assert_eq!(e["results"][3]["granted"], 0);
}

#[tokio::test]
async fn live_topic_list_changes() {
    let mut r = request("5");
    r.subs = vec![sub("a/#", 0), sub("b", 1), sub("denied", 0)];
    let (mut b, mut c) = start(r);
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    let Packet::Subscribe(s) = b.recv().await else { panic!() };
    b.send(Packet::SubAck(SubAck { pid: s.pid, props: Props::default(), codes: vec![0, 1, 0x87] })).await;
    c.next_of("subscribed").await;

    // a/# goes, b changes QoS, c is new, "denied" stays as it was: not sent again
    c.subs(vec![sub("b", 2), sub("c/+", 1), sub("denied", 0)]).await;
    let Packet::Unsubscribe(u) = b.recv().await else { panic!("expected UNSUBSCRIBE first") };
    assert_eq!(u.filters, vec!["a/#".to_string()]);
    let Packet::Subscribe(s) = b.recv().await else { panic!("expected SUBSCRIBE") };
    let filters: Vec<(&str, u8)> = s.filters.iter().map(|(f, o)| (f.as_str(), o.qos)).collect();
    assert_eq!(filters, vec![("b", 2), ("c/+", 1)]);
    b.send(Packet::UnsubAck(SubAck { pid: u.pid, props: Props::default(), codes: vec![0] })).await;
    let e = c.next().await;
    assert_eq!((e["type"].as_str(), &e["filters"]), (Some("unsubscribed"), &json!(["a/#"])));
    b.send(Packet::SubAck(SubAck { pid: s.pid, props: Props::default(), codes: vec![2, 1] })).await;
    let e = c.next_of("subscribed").await;
    assert_eq!(e["results"][0]["granted"], 2);

    // the same list again sends nothing; "denied" with a new QoS is tried again
    c.subs(vec![sub("b", 2), sub("c/+", 1), sub("denied", 1)]).await;
    let Packet::Subscribe(s) = b.recv().await else { panic!("expected SUBSCRIBE") };
    assert_eq!(s.filters.len(), 1);
    assert_eq!(s.filters[0].0, "denied");
    b.send(Packet::SubAck(SubAck { pid: s.pid, props: Props::default(), codes: vec![0x87] })).await;
    c.next_of("subscribed").await;

    // dropping the refused one sends nothing, and says it's gone
    c.subs(vec![sub("b", 2), sub("c/+", 1)]).await;
    let e = c.next().await;
    assert_eq!((e["type"].as_str(), &e["filters"]), (Some("unsubscribed"), &json!(["denied"])));
    c.close().await;
    assert!(matches!(b.recv().await, Packet::Disconnect(_)), "no UNSUBSCRIBE for a filter the broker refused");
}

#[tokio::test]
async fn unsubscribe_event() {
    let mut r = request("3.1.1");
    r.subs = vec![sub("x", 0)];
    let (mut b, mut c) = start(r);
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    let Packet::Subscribe(s) = b.recv().await else { panic!() };
    b.send(Packet::SubAck(SubAck { pid: s.pid, props: Props::default(), codes: vec![0] })).await;
    c.next_of("subscribed").await;
    c.subs(vec![]).await;
    let Packet::Unsubscribe(u) = b.recv().await else { panic!() };
    b.send(Packet::UnsubAck(SubAck { pid: u.pid, props: Props::default(), codes: vec![] })).await;
    let e = c.next().await;
    assert_eq!(e["type"], "unsubscribed");
    assert_eq!(e["filters"], json!(["x"]));
}

#[tokio::test]
async fn mqtt311_suback_failure() {
    let mut r = request("3.1.1");
    r.subs = vec![sub("secret/#", 1)];
    let (mut b, mut c) = start(r);
    let sent = accept(&mut b, Props::default()).await;
    assert_eq!(sent.version, Version::V311);
    c.next_of("connected").await;
    let Packet::Subscribe(s) = b.recv().await else { panic!() };
    b.send(Packet::SubAck(SubAck { pid: s.pid, props: Props::default(), codes: vec![0x80] })).await;
    let e = c.next_of("subscribed").await;
    assert_eq!(e["results"][0]["error"], "0x80 Failure");
}

#[tokio::test]
async fn receives_qos_0_1_2() {
    let (mut b, mut c) = start(request("5"));
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;

    let msg = |qos: u8, pid: Option<u16>, payload: &[u8]| Publish {
        dup: false,
        qos,
        retain: qos == 1,
        topic: "atm/0142/status".into(),
        pid,
        props: Props { content_type: Some("application/json".into()), user: vec![("site".into(), "JKT-SUD-07".into())], correlation: Some(vec![0xFF, 0x00]), ..Default::default() },
        payload: payload.to_vec(),
    };
    b.send(Packet::Publish(msg(0, None, b"{\"state\":\"ONLINE\"}"))).await;
    let e = c.next().await;
    assert_eq!(e["dir"], "in");
    assert_eq!(e["kind"], "publish");
    assert_eq!(e["topic"], "atm/0142/status");
    assert_eq!(e["data"], "{\"state\":\"ONLINE\"}");
    assert_eq!(e["props"]["contentType"], "application/json");
    assert_eq!(e["props"]["user"], json!([{ "key": "site", "value": "JKT-SUD-07" }]));
    assert_eq!(e["props"]["correlation"], "/wA=");
    assert_eq!(e["props"]["correlationBin"], true);

    b.send(Packet::Publish(msg(1, Some(5), &[0, 159, 146, 150]))).await;
    let e = c.next().await;
    assert_eq!((e["qos"].as_u64(), e["retain"].as_bool(), e["valueBin"].as_bool()), (Some(1), Some(true), Some(true)));
    assert_eq!(e["data"], "AJ+Slg==");
    assert_eq!(b.recv().await, Packet::PubAck(Ack::ok(5)));

    // QoS 2: one event, even when the broker sends it again before PUBREL
    b.send(Packet::Publish(msg(2, Some(6), b"once"))).await;
    assert_eq!(b.recv().await, Packet::PubRec(Ack::ok(6)));
    let mut again = msg(2, Some(6), b"once");
    again.dup = true;
    b.send(Packet::Publish(again)).await;
    assert_eq!(b.recv().await, Packet::PubRec(Ack::ok(6)));
    b.send(Packet::PubRel(Ack::ok(6))).await;
    assert_eq!(b.recv().await, Packet::PubComp(Ack::ok(6)));
    let e = c.next().await;
    assert_eq!(e["data"], "once");
    b.send(Packet::PingResp).await; // anything, to prove no second "once" is queued
    c.close().await;
    let rest: Vec<Value> = std::iter::from_fn(|| c.events.try_recv().ok().map(|e| serde_json::to_value(e).unwrap())).collect();
    assert!(rest.iter().all(|e| e["data"] != "once"), "QoS 2 resend showed twice: {rest:?}");
}

#[tokio::test]
async fn topic_alias_from_the_broker() {
    let (mut b, mut c) = start(request("5"));
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    let p = |topic: &str, payload: &str| Packet::Publish(Publish { dup: false, qos: 0, retain: false, topic: topic.into(), pid: None, props: Props { topic_alias: Some(3), ..Default::default() }, payload: payload.into() });
    b.send(p("long/topic/name", "1")).await;
    b.send(p("", "2")).await;
    assert_eq!(c.next().await["topic"], "long/topic/name");
    assert_eq!(c.next().await["topic"], "long/topic/name");
    // an alias never named ends the connection, with a reason to the broker
    b.send(Packet::Publish(Publish { dup: false, qos: 0, retain: false, topic: String::new(), pid: None, props: Props { topic_alias: Some(9), ..Default::default() }, payload: Vec::new() })).await;
    assert!(matches!(b.recv().await, Packet::Disconnect(Disconnect { code: 0x94, .. })));
    let e = c.next().await;
    assert_eq!(e["by"], "lost");
    assert!(e["reason"].as_str().unwrap().contains("alias 9"));
}

#[tokio::test]
async fn publishes_with_acks() {
    let (mut b, mut c) = start(request("5"));
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;

    // QoS 1 with MQTT 5 properties
    let mut p = publish(1, " atm/0142/cmd/reboot ", "{\"reason\":\"cash_jam\"}", 1);
    p.content_type = "application/json".into();
    p.utf8 = Some(true);
    p.message_expiry = Some(120);
    p.response_topic = "atm/0142/cmd/reboot/reply".into();
    p.correlation = "req-7".into();
    p.user = vec![UserProp { key: "requested-by".into(), value: "ops-team".into() }, UserProp { key: String::new(), value: "dropped".into() }];
    c.publish(p).await;
    let out = c.next().await;
    assert_eq!((out["dir"].as_str(), out["kind"].as_str(), out["ackId"].as_u64()), (Some("out"), Some("publish"), Some(1)));
    assert_eq!(out["topic"], "atm/0142/cmd/reboot");
    assert_eq!(out["props"]["responseTopic"], "atm/0142/cmd/reboot/reply");
    let Packet::Publish(sent) = b.recv().await else { panic!() };
    assert_eq!(sent.topic, "atm/0142/cmd/reboot");
    assert_eq!(sent.qos, 1);
    assert_eq!(sent.props.content_type.as_deref(), Some("application/json"));
    assert_eq!(sent.props.payload_format, Some(1));
    assert_eq!(sent.props.message_expiry, Some(120));
    assert_eq!(sent.props.correlation.as_deref(), Some(&b"req-7"[..]));
    assert_eq!(sent.props.user, vec![("requested-by".to_string(), "ops-team".to_string())]);
    b.send(Packet::PubAck(Ack { pid: sent.pid.unwrap(), code: 0x10, props: Props::default() })).await;
    let ack = c.next().await;
    assert_eq!((ack["kind"].as_str(), ack["ackId"].as_u64(), ack["ack"].as_str()), (Some("ack"), Some(1), Some("PUBACK")));
    assert_eq!(ack["reason"], "0x10 No matching subscribers");
    assert!(ack.get("error").is_none());

    // QoS 2: PUBREC, our PUBREL, PUBCOMP
    c.publish(publish(2, "atm/0388/cmd/ping", "{}", 2)).await;
    c.next().await;
    let Packet::Publish(sent) = b.recv().await else { panic!() };
    let pid = sent.pid.unwrap();
    b.send(Packet::PubRec(Ack::ok(pid))).await;
    assert_eq!(b.recv().await, Packet::PubRel(Ack::ok(pid)));
    b.send(Packet::PubComp(Ack::ok(pid))).await;
    let ack = c.next().await;
    assert_eq!(ack["ack"], "PUBREC → PUBCOMP");
    assert_eq!(ack["ackId"], 2);

    // QoS 0: no packet id, no ack
    c.publish(publish(3, "atm/0142/cmd/beep", "x", 0)).await;
    let out = c.next().await;
    assert!(out.get("packetId").is_none());
    let Packet::Publish(sent) = b.recv().await else { panic!() };
    assert_eq!(sent.pid, None);

    // a refusal
    c.publish(publish(4, "forbidden", "x", 1)).await;
    c.next().await;
    let Packet::Publish(sent) = b.recv().await else { panic!() };
    b.send(Packet::PubAck(Ack { pid: sent.pid.unwrap(), code: 0x87, props: Props { reason_string: Some("ACL".into()), ..Default::default() } })).await;
    let ack = c.next().await;
    assert_eq!(ack["error"], "PUBACK 0x87 Not authorized: ACL");

    // a QoS 2 refused at PUBREC ends there, no PUBREL
    c.publish(publish(5, "full", "x", 2)).await;
    c.next().await;
    let Packet::Publish(sent) = b.recv().await else { panic!() };
    b.send(Packet::PubRec(Ack { pid: sent.pid.unwrap(), code: 0x97, props: Props::default() })).await;
    assert_eq!(c.next().await["error"], "PUBREC 0x97 Quota exceeded");
}

#[tokio::test]
async fn publishes_that_never_leave() {
    let (mut b, mut c) = start(request("5"));
    accept(&mut b, Props { max_qos: Some(1), retain_available: Some(0), max_packet_size: Some(64), ..Default::default() }).await;
    c.next_of("connected").await;
    let fail = |e: &Value| e["error"].as_str().unwrap_or_default().to_string();

    c.publish(publish(1, "a/+", "x", 0)).await;
    let e = c.next().await;
    assert_eq!((e["kind"].as_str(), e["ackId"].as_u64()), (Some("ack"), Some(1)));
    assert!(fail(&e).contains("wildcards"));

    c.publish(publish(2, "a", "x", 2)).await;
    assert!(fail(&c.next().await).contains("QoS 1 at most"));

    let mut p = publish(3, "a", "x", 0);
    p.retain = true;
    c.publish(p).await;
    assert!(fail(&c.next().await).contains("retained"));

    c.publish(publish(4, "a", &"x".repeat(100), 0)).await;
    assert!(fail(&c.next().await).contains("at most"));

    // none of that reached the broker: the next thing it sees is our DISCONNECT
    c.close().await;
    assert!(matches!(b.recv().await, Packet::Disconnect(_)));
}

#[tokio::test]
async fn mqtt311_publish_has_no_properties() {
    let (mut b, mut c) = start(request("3.1.1"));
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    let mut p = publish(1, "t", "x", 1);
    p.content_type = "text/plain".into();
    c.publish(p).await;
    let out = c.next().await;
    assert!(out.get("props").is_none());
    let Packet::Publish(sent) = b.recv().await else { panic!() };
    assert!(sent.props.is_empty());
    b.send(Packet::PubAck(Ack::ok(sent.pid.unwrap()))).await;
    let ack = c.next().await;
    assert_eq!(ack["ack"], "PUBACK");
    assert!(ack.get("reason").is_none());
}

#[tokio::test]
async fn broker_takes_the_session_over() {
    let (mut b, mut c) = start(request("5"));
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    b.send(Packet::Disconnect(Disconnect { code: 0x8E, props: Props { reason_string: Some("client ops-console connected elsewhere".into()), ..Default::default() } })).await;
    let e = c.next().await;
    assert_eq!(e["type"], "close");
    assert_eq!(e["by"], "server");
    assert_eq!(e["code"], 0x8E);
    assert_eq!(e["reason"], "Session taken over: client ops-console connected elsewhere");
    c.ended().await;
}

#[tokio::test]
async fn broker_hangs_up() {
    let (mut b, mut c) = start(request("3.1.1"));
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    drop(b);
    let e = c.next().await;
    assert_eq!(e["by"], "lost");
    assert_eq!(e["reason"], "The broker closed the connection");
    c.ended().await;
}

#[tokio::test]
async fn garbage_from_the_broker() {
    let (mut b, mut c) = start(request("5"));
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    b.io.write_all(&[0x00, 0x00]).await.unwrap();
    assert!(matches!(b.recv().await, Packet::Disconnect(Disconnect { code: 0x81, .. })));
    let e = c.next().await;
    assert_eq!(e["by"], "lost");
    assert!(e["reason"].as_str().unwrap().contains("can't read"));
}

#[tokio::test(start_paused = true)]
async fn keep_alive_pings_and_gives_up() {
    let mut r = request("5");
    r.keep_alive = 10;
    let (mut b, mut c) = start(r);
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    // idle for the keep alive: a ping
    let t0 = tokio::time::Instant::now();
    assert_eq!(b.recv().await, Packet::PingReq);
    assert!(t0.elapsed() >= Duration::from_secs(9), "pinged after {:?}", t0.elapsed());
    b.send(Packet::PingResp).await;
    assert_eq!(b.recv().await, Packet::PingReq);
    // no answer this time: lost after the wait
    let e = c.next().await;
    assert_eq!(e["by"], "lost");
    assert_eq!(e["reason"], "No answer to the keep-alive ping in 10 s");
}

#[tokio::test(start_paused = true)]
async fn the_server_keep_alive_wins() {
    let mut r = request("5");
    r.keep_alive = 600;
    let (mut b, mut c) = start(r);
    accept(&mut b, Props { server_keep_alive: Some(20), ..Default::default() }).await;
    c.next_of("connected").await;
    let t0 = tokio::time::Instant::now();
    assert_eq!(b.recv().await, Packet::PingReq);
    let waited = t0.elapsed();
    assert!(waited >= Duration::from_secs(19) && waited <= Duration::from_secs(21), "pinged after {waited:?}");
}

#[tokio::test(start_paused = true)]
async fn keep_alive_zero_never_pings() {
    let mut r = request("3.1.1");
    r.keep_alive = 0;
    let (mut b, mut c) = start(r);
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    tokio::time::sleep(Duration::from_secs(4000)).await;
    c.close().await;
    assert!(matches!(b.recv().await, Packet::Disconnect(_)), "the first thing after an hour is our DISCONNECT, not a ping");
}

#[tokio::test]
async fn refused_logins() {
    for (v, code, words, hint) in [("5", 0x86u8, "CONNACK 0x86 Bad User Name or Password", "username or password"), ("3.1.1", 4, "CONNACK 0x04 Bad user name or password", "username or password"), ("5", 0x84, "Unsupported Protocol Version", "3.1.1"), ("3.1.1", 2, "Identifier rejected", "Client ID")] {
        let (mut b, mut c) = start(request(v));
        let Packet::Connect(_) = b.recv().await else { panic!() };
        b.send(Packet::ConnAck(ConnAck { session_present: false, code, props: Props::default() })).await;
        let e = c.next().await;
        assert_eq!(e["type"], "failed");
        assert_eq!(e["stage"], "refused");
        assert_eq!(e["code"], code);
        assert!(e["message"].as_str().unwrap().contains(words), "{e}");
        assert!(e["hint"].as_str().unwrap().contains(hint), "{e}");
        c.ended().await;
    }
}

#[tokio::test]
async fn mqtt5_to_a_311_only_broker() {
    // mosquitto in 3.1.1 mode answers an MQTT 5 CONNECT with a 3.1.1 CONNACK, return code 1
    let (mut b, mut c) = start(request("5"));
    let Packet::Connect(_) = b.recv().await else { panic!() };
    b.io.write_all(&[0x20, 0x02, 0x00, 0x01]).await.unwrap();
    let e = c.next().await;
    assert_eq!(e["stage"], "refused");
    assert!(e["hint"].as_str().unwrap().contains("3.1.1"), "{e}");
}

#[tokio::test]
async fn hung_up_before_connack() {
    let (mut b, mut c) = start(request("5"));
    let Packet::Connect(_) = b.recv().await else { panic!() };
    drop(b);
    let e = c.next().await;
    assert_eq!(e["stage"], "mqtt");
    assert!(e["hint"].as_str().unwrap().contains("3.1.1"));
}

#[tokio::test]
async fn http_server_instead_of_a_broker() {
    let (mut b, mut c) = start(request("3.1.1"));
    let Packet::Connect(_) = b.recv().await else { panic!() };
    b.io.write_all(b"HTTP/1.1 400 Bad Request\r\n\r\n").await.unwrap();
    let e = c.next().await;
    assert_eq!(e["stage"], "mqtt");
    assert!(e["hint"].as_str().unwrap().contains("ws://"), "{e}");
}

#[tokio::test(start_paused = true)]
async fn silent_port_times_out() {
    let (mut b, mut c) = start(request("5"));
    let Packet::Connect(_) = b.recv().await else { panic!() };
    let e = c.next().await;
    assert_eq!(e["stage"], "mqtt");
    assert!(e["message"].as_str().unwrap().contains("Timed out after 5000 ms waiting for CONNACK"));
    drop(b);
}

#[tokio::test]
async fn disconnect_while_connecting() {
    let (mut b, mut c) = start(request("5"));
    let Packet::Connect(_) = b.recv().await else { panic!() };
    c.close().await;
    let e = c.next().await;
    assert_eq!((e["type"].as_str(), e["by"].as_str(), e["reason"].as_str()), (Some("close"), Some("client"), Some("Cancelled")));
    c.ended().await;
    assert!(b.gone().await);
}

#[tokio::test]
async fn local_filter_checks() {
    let mut r = request("5");
    let mut shared = sub("$share/g/a", 0);
    shared.no_local = true;
    r.subs = vec![shared, sub("ok", 0)];
    let (mut b, mut c) = start(r);
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    let e = c.next().await;
    assert!(e["results"][0]["error"].as_str().unwrap().contains("No local"));
    let Packet::Subscribe(s) = b.recv().await else { panic!() };
    assert_eq!(s.filters.len(), 1);
    assert_eq!(s.filters[0].0, "ok");
}

#[tokio::test]
async fn mqtt5_subscription_options_on_the_wire() {
    let mut r = request("5");
    r.subs = vec![SubRequest { filter: "x".into(), qos: 1, no_local: true, retain_as_published: true, retain_handling: 2 }];
    let (mut b, mut c) = start(r);
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    let Packet::Subscribe(s) = b.recv().await else { panic!() };
    assert_eq!(s.filters[0].1, SubOpts { qos: 1, no_local: true, retain_as_published: true, retain_handling: 2 });
    // on 3.1.1 only the QoS goes out
    let mut r = request("3.1.1");
    r.subs = vec![SubRequest { filter: "x".into(), qos: 1, no_local: true, retain_as_published: true, retain_handling: 2 }];
    let (mut b, mut c) = start(r);
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    let Packet::Subscribe(s) = b.recv().await else { panic!() };
    assert_eq!(s.filters[0].1, SubOpts::qos(1));
}

// ---------- against a real broker ----------
//
// MQTT_LIVE=host runs these against Eclipse Mosquitto with:
//   1883 anonymous TCP · 1884 password (voidhttp / s3cret) · 9001 WebSocket · 8883 TLS (self-signed)
// They pass against EMQX 5.8 too (9001 mapped to its 8083 WebSocket port; skip live_password there).
// e.g. `MQTT_LIVE=127.0.0.1 cargo test mqtt::tests::live -- --ignored --test-threads=1`

fn live_broker() -> String {
    std::env::var("MQTT_LIVE").expect("set MQTT_LIVE to the broker host")
}

/// Connects for real; events and the command queue.
fn live(url: String, mut r: MqttRequest) -> Client {
    r.url = url;
    r.insecure = true;
    let t = Target::parse(&r.url).unwrap();
    let o = Opts::from(&r).unwrap();
    let (cmd, mut rx) = mpsc::channel(64);
    let (etx, events) = unbounded_channel();
    let subs = r.subs.clone();
    let task = tokio::spawn(async move {
        let emit = move |e: MqttEvent| {
            let _ = etx.send(e);
        };
        connect_and_run(&t, &o, &subs, &mut rx, &emit).await;
    });
    Client { events, cmd, task }
}

/// Publishes QoS 0, 1, 2 to a topic it subscribes to, and reads all three back.
async fn round_trip(url: String, version: &str) {
    let topic = format!("voidhttp/it/{}", random_client_id());
    let mut r = request(version);
    r.subs = vec![sub(&format!("{topic}/#"), 2)];
    let mut c = live(url, r);
    let e = c.next().await;
    assert_eq!(e["type"], "connected", "{e}");
    let s = c.next_of("subscribed").await;
    assert_eq!(s["results"][0]["granted"], 2, "{s}");
    for qos in 0..=2u8 {
        let mut p = publish(qos as u64 + 1, &format!("{topic}/q{qos}"), &format!("{{\"qos\":{qos}}}"), qos);
        if version == "5" {
            p.content_type = "application/json".into();
            p.user = vec![UserProp { key: "k".into(), value: "v".into() }];
        }
        c.publish(p).await;
    }
    let mut got = Vec::new();
    let mut acks = Vec::new();
    while got.len() < 3 || acks.len() < 2 {
        let e = c.next().await;
        if e["type"] != "message" {
            continue;
        }
        if e["kind"] == "ack" {
            assert!(e.get("error").is_none(), "{e}");
            acks.push(e["ack"].as_str().unwrap().to_string());
        } else if e["dir"] == "in" {
            if version == "5" {
                assert_eq!(e["props"]["contentType"], "application/json", "{e}");
                assert_eq!(e["props"]["user"][0]["key"], "k");
            }
            got.push((e["topic"].as_str().unwrap().to_string(), e["qos"].as_u64().unwrap()));
        }
    }
    got.sort();
    assert_eq!(got, vec![(format!("{topic}/q0"), 0), (format!("{topic}/q1"), 1), (format!("{topic}/q2"), 2)]);
    acks.sort();
    assert_eq!(acks, vec!["PUBACK".to_string(), "PUBREC → PUBCOMP".to_string()]);
    c.close().await;
    assert_eq!(c.next_of("close").await["by"], "client");
}

#[tokio::test]
#[ignore]
async fn live_tcp_v5() {
    round_trip(format!("mqtt://{}:1883", live_broker()), "5").await;
}

#[tokio::test]
#[ignore]
async fn live_tcp_v311() {
    round_trip(format!("mqtt://{}:1883", live_broker()), "3.1.1").await;
}

#[tokio::test]
#[ignore]
async fn live_ws_v5() {
    round_trip(format!("ws://{}:9001", live_broker()), "5").await;
}

#[tokio::test]
#[ignore]
async fn live_ws_v311() {
    round_trip(format!("ws://{}:9001/mqtt", live_broker()), "3.1.1").await;
}

#[tokio::test]
#[ignore]
async fn live_tls_v5() {
    round_trip(format!("mqtts://{}:8883", live_broker()), "5").await;
}

/// MQTT_LIVE_WSS=wss://host:port/mqtt, e.g. EMQX's 8084 listener
#[tokio::test]
#[ignore]
async fn live_wss_v5() {
    let Ok(url) = std::env::var("MQTT_LIVE_WSS") else { return };
    round_trip(url, "5").await;
}

#[tokio::test]
#[ignore]
async fn live_password() {
    let url = format!("mqtt://{}:1884", live_broker());
    let mut r = request("5");
    r.username = "voidhttp".into();
    r.password = "wrong".into();
    let mut c = live(url.clone(), r);
    let e = c.next().await;
    assert_eq!(e["stage"], "refused", "{e}");
    // 0x86 Bad User Name or Password, or (Mosquitto) 0x87 Not authorized
    assert!(e["code"] == 0x86 || e["code"] == 0x87, "{e}");
    assert!(e["hint"].as_str().unwrap().contains("password"), "{e}");
    let mut r = request("3.1.1");
    r.username = "voidhttp".into();
    r.password = "wrong".into();
    let mut c = live(url.clone(), r);
    let e = c.next().await;
    assert!(e["code"] == 4 || e["code"] == 5, "{e}");
    let mut r = request("5");
    r.username = "voidhttp".into();
    r.password = "s3cret".into();
    let mut c = live(url, r);
    assert_eq!(c.next().await["type"], "connected");
    c.close().await;
}

#[tokio::test]
#[ignore]
async fn live_retained_and_session_takeover() {
    let host = live_broker();
    let topic = format!("voidhttp/it/{}/status", random_client_id());
    // leave a retained message
    let mut a = live(format!("mqtt://{host}:1883"), request("5"));
    a.next_of("connected").await;
    let mut p = publish(1, &topic, "ONLINE", 1);
    p.retain = true;
    a.publish(p).await;
    a.next_of("message").await;
    assert_eq!(a.next_of("message").await["ack"], "PUBACK");

    // a new subscriber gets it, flagged retained
    let id = format!("voidhttp-it-{}", random_client_id());
    let mut r = request("5");
    r.client_id = id.clone();
    r.subs = vec![sub(&topic, 1)];
    let mut b = live(format!("mqtt://{host}:1883"), r);
    b.next_of("connected").await;
    let m = b.next_of("message").await;
    assert_eq!((m["data"].as_str(), m["retain"].as_bool()), (Some("ONLINE"), Some(true)), "{m}");

    // the same client id again: the first one is told the session was taken over
    let mut r2 = request("5");
    r2.client_id = id;
    let mut b2 = live(format!("mqtt://{host}:1883"), r2);
    b2.next_of("connected").await;
    let e = b.next_of("close").await;
    assert_eq!((e["by"].as_str(), e["code"].as_u64()), (Some("server"), Some(0x8E)), "{e}");
    assert!(e["reason"].as_str().unwrap().starts_with("Session taken over"));

    // clean up the retained message
    let mut p = publish(2, &topic, "", 0);
    p.retain = true;
    a.publish(p).await;
    a.close().await;
    b2.close().await;
}

#[tokio::test]
#[ignore]
async fn live_last_will() {
    let host = live_broker();
    let topic = format!("voidhttp/it/{}/will", random_client_id());
    let mut r = request("5");
    r.subs = vec![sub(&topic, 1)];
    let mut watcher = live(format!("mqtt://{host}:1883"), r);
    watcher.next_of("connected").await;
    watcher.next_of("subscribed").await;

    let mut r = request("3.1.1");
    r.will = Some(WillRequest { topic: topic.clone(), payload: "{\"state\":\"OFFLINE\"}".into(), qos: 1, retain: false, delay: 0 });
    r.keep_alive = 2;
    let mut dying = live(format!("mqtt://{host}:1883"), r);
    dying.next_of("connected").await;
    // drop without DISCONNECT: the broker publishes the will
    dying.task.abort();
    let m = watcher.next_of("message").await;
    assert_eq!(m["data"], "{\"state\":\"OFFLINE\"}", "{m}");
    watcher.close().await;
}

#[tokio::test]
#[ignore]
async fn live_denied_and_bad_port() {
    let host = live_broker();
    // nothing listens there
    let mut c = live(format!("mqtt://{host}:1"), request("5"));
    let e = c.next().await;
    assert_eq!(e["stage"], "connect", "{e}");
    assert!(e["hint"].as_str().unwrap_or_default().contains("Nothing is listening"), "{e}");
    // TLS against a plain port
    let mut c = live(format!("mqtts://{host}:1883"), request("5"));
    let e = c.next().await;
    assert_eq!(e["stage"], "tls", "{e}");
    // a plain MQTT port spoken to as WebSocket
    let mut c = live(format!("ws://{host}:1883"), request("5"));
    let e = c.next().await;
    assert_eq!(e["stage"], "ws", "{e}");
    // a WebSocket port spoken to as plain MQTT
    let mut c = live(format!("mqtt://{host}:9001"), request("3.1.1"));
    let e = c.next().await;
    assert_eq!(e["stage"], "mqtt", "{e}");
}

// ---------- regressions from the protocol review ----------

#[tokio::test]
async fn messages_that_arrive_with_connack_are_kept() {
    let mut r = request("5");
    r.clean_start = false;
    let (mut b, mut c) = start(r);
    let Packet::Connect(_) = b.recv().await else { panic!() };
    // CONNACK and a queued QoS 1 message in one write, the next one split across two
    let mut bytes = Packet::ConnAck(ConnAck { session_present: true, code: 0, props: Props::default() }).encode(Version::V5);
    let queued = |pid: u16, payload: &str| Packet::Publish(Publish { dup: false, qos: 1, retain: false, topic: "q".into(), pid: Some(pid), props: Props::default(), payload: payload.into() }).encode(Version::V5);
    bytes.extend(queued(1, "first"));
    let second = queued(2, "second");
    let half = second.len() / 2;
    bytes.extend(&second[..half]);
    b.io.write_all(&bytes).await.unwrap();
    assert_eq!(c.next().await["info"]["sessionPresent"], true);
    assert_eq!(c.next().await["data"], "first");
    assert_eq!(b.recv().await, Packet::PubAck(Ack::ok(1)));
    b.io.write_all(&second[half..]).await.unwrap();
    assert_eq!(c.next().await["data"], "second");
    assert_eq!(b.recv().await, Packet::PubAck(Ack::ok(2)));
}

#[tokio::test(start_paused = true)]
async fn a_broker_that_stops_reading_ends_the_session() {
    let mut r = request("5");
    r.keep_alive = 5;
    let (client_io, broker_io) = duplex(64 * 1024);
    let t = Target::parse(&r.url).unwrap();
    let o = Opts::from(&r).unwrap();
    let (cmd, mut rx) = mpsc::channel(64);
    let (etx, events) = unbounded_channel();
    let task = tokio::spawn(async move {
        let emit = move |e: MqttEvent| {
            let _ = etx.send(e);
        };
        run_over(async move { Ok((Link::Stream(Box::new(client_io)), None)) }, &t, &o, &[], &mut rx, &emit).await;
    });
    let mut b = Broker { io: broker_io, v: Version::V5, buf: Vec::new() };
    let mut c = Client { events, cmd, task };
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    // 1 MB into a 64 KB pipe nobody reads
    c.publish(publish(1, "big", &"x".repeat(1 << 20), 0)).await;
    let e = c.next_of("close").await;
    assert_eq!(e["by"], "lost");
    assert!(e["reason"].as_str().unwrap().contains("stalled"), "{e}");
    drop(b);
}

#[tokio::test]
async fn a_late_refusal_doesnt_forget_a_newer_subscribe() {
    let (mut b, mut c) = start(request("5"));
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    c.subs(vec![sub("x/#", 2)]).await;
    let Packet::Subscribe(a) = b.recv().await else { panic!() };
    c.subs(vec![sub("x/#", 1)]).await;
    let Packet::Subscribe(bb) = b.recv().await else { panic!() };
    b.send(Packet::SubAck(SubAck { pid: a.pid, props: Props::default(), codes: vec![0x9B] })).await;
    b.send(Packet::SubAck(SubAck { pid: bb.pid, props: Props::default(), codes: vec![1] })).await;
    c.next_of("subscribed").await;
    c.next_of("subscribed").await;
    // removing it now must unsubscribe at the broker
    c.subs(vec![]).await;
    let Packet::Unsubscribe(u) = b.recv().await else { panic!("expected UNSUBSCRIBE") };
    assert_eq!(u.filters, vec!["x/#".to_string()]);
}

#[tokio::test]
async fn a_refused_unsubscribe_is_reported_and_tried_again() {
    let mut r = request("5");
    r.subs = vec![sub("a", 0), sub("b", 0)];
    let (mut b, mut c) = start(r);
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    let Packet::Subscribe(s) = b.recv().await else { panic!() };
    b.send(Packet::SubAck(SubAck { pid: s.pid, props: Props::default(), codes: vec![0, 0] })).await;
    c.next_of("subscribed").await;
    c.subs(vec![]).await;
    let Packet::Unsubscribe(u) = b.recv().await else { panic!() };
    b.send(Packet::UnsubAck(SubAck { pid: u.pid, props: Props::default(), codes: vec![0x11, 0x87] })).await;
    let gone = c.next().await;
    assert_eq!((gone["type"].as_str(), &gone["filters"]), (Some("unsubscribed"), &json!(["a"])));
    let refused = c.next().await;
    assert_eq!(refused["results"][0]["filter"], "b");
    assert_eq!(refused["results"][0]["error"], "Unsubscribe refused: 0x87 Not authorized");
    // the next change tries "b" again
    c.subs(vec![]).await;
    let Packet::Unsubscribe(u) = b.recv().await else { panic!("expected a second UNSUBSCRIBE") };
    assert_eq!(u.filters, vec!["b".to_string()]);
}

#[tokio::test]
async fn filters_the_broker_says_it_lacks_never_leave() {
    let mut r = request("5");
    r.subs = vec![sub("a/+", 0), sub("$share/g/a", 0), sub("plain", 0)];
    let (mut b, mut c) = start(r);
    accept(&mut b, Props { wildcard_available: Some(0), shared_available: Some(0), ..Default::default() }).await;
    c.next_of("connected").await;
    let e = c.next().await;
    let errors: Vec<&str> = e["results"].as_array().unwrap().iter().map(|r| r["error"].as_str().unwrap()).collect();
    assert!(errors.iter().any(|x| x.contains("wildcard")) && errors.iter().any(|x| x.contains("shared")), "{e}");
    let Packet::Subscribe(s) = b.recv().await else { panic!() };
    assert_eq!(s.filters.len(), 1);
    assert_eq!(s.filters[0].0, "plain");
}

#[tokio::test]
async fn auth_from_the_broker_is_a_protocol_error() {
    let (mut b, mut c) = start(request("5"));
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    b.send(Packet::Auth(Disconnect { code: 0x19, props: Props::default() })).await;
    assert!(matches!(b.recv().await, Packet::Disconnect(Disconnect { code: 0x82, .. })));
    assert_eq!(c.next().await["by"], "lost");
}

#[tokio::test]
async fn overlong_fields_are_refused_before_sending() {
    let (mut b, mut c) = start(request("5"));
    accept(&mut b, Props::default()).await;
    c.next_of("connected").await;
    let mut p = publish(1, "t", "x", 0);
    p.content_type = "x".repeat(70_000);
    c.publish(p).await;
    assert!(c.next().await["error"].as_str().unwrap().contains("65 535"));
    c.subs(vec![sub(&"a".repeat(70_000), 0)]).await;
    assert!(c.next().await["results"][0]["error"].as_str().unwrap().contains("65 535"));
    let mut r = request("5");
    r.client_id = "c".repeat(70_000);
    assert!(Opts::from(&r).unwrap_err().contains("65 535"));
}
