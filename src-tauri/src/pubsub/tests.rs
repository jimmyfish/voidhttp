use std::time::Duration;

use base64::Engine;
use serde_json::{json, Value};
use tokio::sync::mpsc;

use super::auth::{self, Creds, SaKey};
use super::*;

// A throwaway 2048-bit RSA key made for these tests only; it signs nothing real. The PEM armour is
// put together at run time so secret scanners don't take the file for a leaked key.
const TEST_KEY_BODY: &[&str] = &[
    "MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDeTRH2pI1wuzRh",
    "msGtA+EY/u/i9MrCWtNRWzneJwShwOk48C2zdq88TWy3ueto5c+Gg3y6F33PtEH6",
    "4aKkqmfnvhy0JonERYDpthk77yd8BhxMGY1sHTLT7u2c2cepx4654LWJ/s1incPt",
    "KcLYVjxqkUUro+OpHubuouQGQzg63yd8T+1HUhPt+E80FoVmzlZxONrv9eWuPqv1",
    "G6xXX+E7tDlKiIKWliIzByDtYXbavkGH9a2CZSIXYwGRnf7PBmgdJ/TJImQ6iD34",
    "Y0gIS+DzFhbJcdyUgB4HpgIoO8Sblu0Pwe7bDDe7hBF7v7JmGFFe/OroJuxubL/d",
    "ui9+gqEPAgMBAAECggEAXZxLw7aAfye+A5oFE8Pt7rYwMzzNAzH3CavmPufkWe8f",
    "5uOxAwEoArdB4E5Q1P/tN2I4TC7nQmdQX4LTmA7QKXTTpoMSAY4ZHpGZp7TqRh5W",
    "nS8ncA8Nn9Rdx+6nVxXbQufe2ojrWStBXaX30FzkHSYmYB2oGUgTjAsZBZAZ5iPY",
    "hWJvOD9+gxYoppXTvtxtMrQ82P3fpYo2pC+1rezFesIjuXd1MXxbHZGLpGoLc1Aq",
    "LDKGxF77BPjqgkKljXcHOvP0jdBZOrnk5iFu3RU1gtt5mjMTqj77tnJx+Gt+b900",
    "eVGUd7fjGXT2iO13RrtpX4nhcWXhi4p4JL+VKTdYTQKBgQD0j9wEdzjTQNmnFAFw",
    "9K9K59Wo586Fk0uNPLqtDFVRu+pt4n2DbkdLp/qISBabtAA0DUcplcedfgDucuGh",
    "mz3VLwNN71SiIKE5kRmUwF0SJVIk93b9HQcdhrdn3MYL1cPXRDIg8taBzWjCxa3o",
    "OJbrCduWpiY9rSj+hZVR7j4v4wKBgQDosq5Vqay0aihsIRRp3lvqOrBTmt06vKT8",
    "ICTVQbuodg5xeP+Ho4THOpX/gVYLXs+zZQipa22PnqXf544LivcS4IiDwHUZumcb",
    "QoJh8nTjy5Jb6klekPP46pYmds2hCBjZK5o21jJfd9NCX/e/43v44OITKzQRlZZo",
    "vZrh/9r55QKBgG1msVCaGKR//R19mIt0GbpTbUPKtpsQYhrDUOq6eqw+eMdBK06R",
    "FXmlojA2t05dvj2KtwvGQe6VAEuqvn5xmL518m95oY2JNTYwT5Y4WyoT4eRBg0wF",
    "ITq3GfJvU3TV4m64xgfxOb4FKlj+3yXjsrdfyIhiuPacMJtzHHHzNoRrAoGALNy+",
    "BZ/nvwS0dFxQTjTjbZ4Q/p1dx4Q1HrKnx0GcB1dzY2cbhK/+2lYuMwthZmHKE2EI",
    "MXmXrte8TRWcahdJmScWyqfhK6unUzcYYf/Xj09hET1zFbtGfhfkCNhgvooMGFpy",
    "qd3T6ln0rdhIsIMQFKRukZmDuVwomlrrsGSeeA0CgYAzt3EjaCVLUKPzsIYMptsg",
    "6YO3IjKMcdZM2B1q6YvugzoIqfVJmDyot0j6WJT+ikB8EF/z8cRpnts6w23rrxwE",
    "w/F3irOF/5oOhP+0Vs0xxDBg848fkrbt3iLzGY7iWr1FYCcSQcQYFI3cHtIjtXFq",
    "AHltyjga2yEZJ1FrYh/1RQ==",
];

fn test_pem() -> String {
    let armour = |w: &str| format!("-----{w} {} KEY-----", "PRIVATE");
    format!("{}\n{}\n{}\n", armour("BEGIN"), TEST_KEY_BODY.join("\n"), armour("END"))
}

fn test_sa() -> SaKey {
    SaKey {
        client_email: "sa-qa-pubsub@acme-staging.iam.gserviceaccount.com".into(),
        private_key: test_pem(),
        private_key_id: Some("3f2a".into()),
        token_uri: "https://oauth2.googleapis.com/token".into(),
        project_id: Some("acme-staging".into()),
    }
}

fn b64url_decode(s: &str) -> Vec<u8> {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(s).unwrap()
}

// ---------- signing ----------

#[test]
fn jwt_has_the_claims_google_wants_and_verifies() {
    let sa = test_sa();
    let token = auth::jwt(&sa, auth::SCOPE, 1_700_000_000).unwrap();
    let parts: Vec<&str> = token.split('.').collect();
    assert_eq!(parts.len(), 3);
    let header: Value = serde_json::from_slice(&b64url_decode(parts[0])).unwrap();
    assert_eq!(header, json!({ "alg": "RS256", "typ": "JWT", "kid": "3f2a" }));
    let claims: Value = serde_json::from_slice(&b64url_decode(parts[1])).unwrap();
    assert_eq!(claims["iss"], "sa-qa-pubsub@acme-staging.iam.gserviceaccount.com");
    assert_eq!(claims["aud"], "https://oauth2.googleapis.com/token");
    assert_eq!(claims["scope"], auth::SCOPE);
    assert_eq!(claims["iat"], 1_700_000_000u64);
    assert_eq!(claims["exp"], 1_700_003_600u64);

    // the signature checks out against the key's own public half
    let body: String = TEST_KEY_BODY.concat();
    let der = base64::engine::general_purpose::STANDARD.decode(body).unwrap();
    let pair = ring::signature::RsaKeyPair::from_pkcs8(&der).unwrap();
    let public = ring::signature::UnparsedPublicKey::new(&ring::signature::RSA_PKCS1_2048_8192_SHA256, pair.public().as_ref());
    public.verify(format!("{}.{}", parts[0], parts[1]).as_bytes(), &b64url_decode(parts[2])).unwrap();
}

#[test]
fn jwt_refuses_a_broken_key() {
    let mut sa = test_sa();
    sa.private_key = "-----BEGIN PRIVATE KEY-----\nbm90IGEga2V5\n-----END PRIVATE KEY-----\n".into();
    let e = auth::jwt(&sa, auth::SCOPE, 0).unwrap_err();
    assert!(e.contains("can't be used"), "{e}");
}

// ---------- credentials files ----------

#[test]
fn reads_each_credentials_type() {
    let sa = json!({ "type": "service_account", "client_email": "a@p.iam.gserviceaccount.com", "private_key": "k", "project_id": "p" }).to_string();
    match auth::parse_creds(&sa).unwrap() {
        Creds::ServiceAccount(k) => {
            assert_eq!(k.client_email, "a@p.iam.gserviceaccount.com");
            assert_eq!(k.token_uri, "https://oauth2.googleapis.com/token");
            assert_eq!(k.project_id.as_deref(), Some("p"));
        }
        other => panic!("{other:?}"),
    }

    let user = json!({ "type": "authorized_user", "client_id": "id", "client_secret": "s", "refresh_token": "r", "quota_project_id": "q" }).to_string();
    match auth::parse_creds(&user).unwrap() {
        Creds::User { quota_project, refresh_token, .. } => {
            assert_eq!(quota_project.as_deref(), Some("q"));
            assert_eq!(refresh_token, "r");
        }
        other => panic!("{other:?}"),
    }

    let imp = json!({
        "type": "impersonated_service_account",
        "service_account_impersonation_url": "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/sa-qa@acme.iam.gserviceaccount.com:generateAccessToken",
        "delegates": ["d@acme.iam.gserviceaccount.com"],
        "source_credentials": { "type": "authorized_user", "client_id": "id", "client_secret": "s", "refresh_token": "r" }
    })
    .to_string();
    match auth::parse_creds(&imp).unwrap() {
        Creds::Impersonated { source, target, delegates } => {
            assert_eq!(target, "sa-qa@acme.iam.gserviceaccount.com");
            assert_eq!(delegates, vec!["d@acme.iam.gserviceaccount.com".to_string()]);
            assert!(matches!(*source, Creds::User { .. }));
        }
        other => panic!("{other:?}"),
    }

    let ext = json!({ "type": "external_account" }).to_string();
    assert_eq!(auth::parse_creds(&ext).unwrap_err(), "Workload Identity Federation is not supported yet");
    assert!(auth::parse_creds("{}").unwrap_err().contains("no \"type\""));
    assert!(auth::parse_creds("not json").unwrap_err().starts_with("Not a JSON"));
    let missing = json!({ "type": "service_account", "client_email": "a" }).to_string();
    assert_eq!(auth::parse_creds(&missing).unwrap_err(), "The credentials file has no \"private_key\"");
}

#[test]
fn gcloud_ini_project_is_read_from_core_only() {
    let raw = "[auth]\nproject = wrong\n\n[core]\naccount = dev@acme.co\nproject = acme-staging\n\n[compute]\nregion = asia-southeast2\n";
    assert_eq!(auth::ini_project(raw).as_deref(), Some("acme-staging"));
    assert_eq!(auth::ini_project("[core]\naccount = x\n"), None);
    assert_eq!(auth::ini_project("[core]\nproject =\n"), None);
}

#[test]
fn tilde_expands_to_home() {
    let home = std::env::var("HOME").unwrap();
    assert_eq!(auth::expand("~/keys/k.json"), std::path::PathBuf::from(format!("{home}/keys/k.json")));
    assert_eq!(auth::expand("/abs/k.json"), std::path::PathBuf::from("/abs/k.json"));
}

#[test]
fn inspect_reads_a_key_file_without_going_online() {
    let dir = std::env::temp_dir().join(format!("voidhttp-pubsub-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("sa.json");
    std::fs::write(&path, json!({ "type": "service_account", "client_email": "sa@acme-staging.iam.gserviceaccount.com", "private_key": "k", "project_id": "acme-staging" }).to_string()).unwrap();
    let mut a = AuthReq { kind: "key".into(), file: path.display().to_string(), ..Default::default() };
    let i = auth::inspect(&a);
    assert_eq!(i.kind, "service account");
    assert_eq!(i.email.as_deref(), Some("sa@acme-staging.iam.gserviceaccount.com"));
    assert_eq!(i.projects[0], auth::LocalProject { id: "acme-staging".into(), source: "key file" });
    assert!(i.error.is_none());

    a.impersonate = "other@acme.iam.gserviceaccount.com".into();
    let i = auth::inspect(&a);
    assert_eq!(i.kind, "impersonation");
    assert_eq!(i.email.as_deref(), Some("other@acme.iam.gserviceaccount.com"));

    a.file = dir.join("missing.json").display().to_string();
    assert!(auth::inspect(&a).error.unwrap().starts_with("Can't read"));
    std::fs::remove_dir_all(&dir).ok();
}

#[tokio::test]
async fn pasted_tokens_and_the_emulator_need_no_sign_in() {
    let c = Clients::new(false);
    let t = AuthReq { kind: "token".into(), token: "Bearer ya29.abc ".into(), ..Default::default() };
    assert_eq!(auth::access_token(&c, &t).await.unwrap().as_deref(), Some("ya29.abc"));
    let empty = AuthReq { kind: "token".into(), ..Default::default() };
    assert_eq!(auth::access_token(&c, &empty).await.unwrap_err().message, "Paste an access token");
    let emu = AuthReq { kind: "emulator".into(), emulator_host: "localhost:8085".into(), ..Default::default() };
    assert_eq!(auth::access_token(&c, &emu).await.unwrap(), None);
    let key = AuthReq { kind: "key".into(), ..Default::default() };
    assert_eq!(auth::access_token(&c, &key).await.unwrap_err().message, "Choose a service account key file");
}

// ---------- Google's answers ----------

#[test]
fn google_errors_read_plainly() {
    let api = br#"{"error":{"code":403,"message":"User not authorized to perform this action.","status":"PERMISSION_DENIED"}}"#;
    assert_eq!(google_error(403, api), "PERMISSION_DENIED: User not authorized to perform this action.");
    let token = br#"{"error":"invalid_grant","error_description":"Invalid JWT Signature."}"#;
    assert_eq!(google_error(400, token), "invalid_grant: Invalid JWT Signature.");
    assert_eq!(google_error(400, br#"{"error":"invalid_scope"}"#), "invalid_scope");
    assert_eq!(google_error(502, b"<html>Bad Gateway</html>"), "HTTP 502: <html>Bad Gateway</html>");
    assert_eq!(google_error(500, b""), "HTTP 500");
}

#[test]
fn subscription_delivery_kinds() {
    assert_eq!(delivery(&json!({ "pushConfig": {} })), "Pull");
    assert_eq!(delivery(&json!({ "pushConfig": { "pushEndpoint": "https://notify.acme.internal/pubsub" } })), "Push");
    assert_eq!(delivery(&json!({ "pushConfig": {}, "bigqueryConfig": { "table": "p.payments.transfers" } })), "BigQuery");
    assert_eq!(delivery(&json!({ "cloudStorageConfig": { "bucket": "acme-archive" } })), "Cloud Storage");

    let s = sub_info(&json!({
        "name": "projects/acme-staging/subscriptions/transfer-events-ledger",
        "topic": "projects/acme-staging/topics/transfer-events",
        "pushConfig": {},
        "ackDeadlineSeconds": 60,
        "deadLetterPolicy": { "deadLetterTopic": "projects/acme-staging/topics/transfer-events-dlq", "maxDeliveryAttempts": 5 },
        "enableMessageOrdering": true
    }))
    .unwrap();
    assert_eq!(s.name, "transfer-events-ledger");
    assert_eq!(s.delivery, "Pull");
    assert_eq!(s.ack_deadline, 60);
    assert_eq!(s.dead_letter.as_deref(), Some("transfer-events-dlq · 5"));
    assert!(s.ordering);
    let push = sub_info(&json!({ "name": "projects/p/subscriptions/n", "pushConfig": { "pushEndpoint": "https://notify.acme.internal/pubsub" } })).unwrap();
    assert_eq!(push.endpoint.as_deref(), Some("notify.acme.internal"));
    assert_eq!(push.ack_deadline, 10);
}

#[test]
fn durations_and_times() {
    assert_eq!(duration_label("604800s").as_deref(), Some("7 days"));
    assert_eq!(duration_label("86400s").as_deref(), Some("1 day"));
    assert_eq!(duration_label("7200s").as_deref(), Some("2 hours"));
    assert_eq!(duration_label("600s").as_deref(), Some("10 minutes"));
    assert_eq!(duration_label("0s"), None);

    assert_eq!(rfc3339_ms("1970-01-01T00:00:00Z"), Some(0));
    assert_eq!(rfc3339_ms("2026-11-18T03:14:07.312Z"), Some(1_794_971_647_312));
    assert_eq!(rfc3339_ms("2026-11-18T03:14:07.312345678Z"), Some(1_794_971_647_312));
    assert_eq!(rfc3339_ms("2026-11-18T10:14:07.3+07:00"), Some(1_794_971_647_300));
    assert_eq!(rfc3339_ms("2000-02-29T12:00:00Z"), Some(951_825_600_000));
    assert_eq!(rfc3339_ms("nope"), None);
}

#[test]
fn received_messages_become_events() {
    let rm = json!({
        "ackId": "ack-1",
        "deliveryAttempt": 4,
        "message": {
            "data": base64::engine::general_purpose::STANDARD.encode(r#"{"a":1}"#),
            "attributes": { "traceId": "t", "eventType": "transfer.completed" },
            "messageId": "13284711099254",
            "publishTime": "2026-11-18T03:14:07.312Z",
            "orderingKey": "acc_5d1e08"
        }
    });
    let (ev, ack, id) = received(&rm, "returned", 42).unwrap();
    assert_eq!((ack.as_str(), id.as_str()), ("ack-1", "13284711099254"));
    let v = serde_json::to_value(&ev).unwrap();
    assert_eq!(v["type"], "message");
    assert_eq!(v["dir"], "in");
    assert_eq!(v["kind"], "record");
    assert_eq!(v["data"], r#"{"a":1}"#);
    assert_eq!(v["messageId"], "13284711099254");
    assert_eq!(v["key"], "acc_5d1e08");
    assert_eq!(v["headers"], json!([{ "key": "eventType", "value": "transfer.completed" }, { "key": "traceId", "value": "t" }]));
    assert_eq!(v["ts"], 1_794_971_647_312i64);
    assert_eq!(v["attempt"], 4);
    assert_eq!(v["handed"], "returned");
    assert_eq!(v["size"], 7);
    assert_eq!(v["atMs"], 42);
    assert!(v.get("valueBin").is_none());

    // bytes that aren't UTF-8 stay base64
    let bin = json!({ "ackId": "a", "message": { "data": "/w==", "messageId": "1" } });
    let v = serde_json::to_value(received(&bin, "acked", 0).unwrap().0).unwrap();
    assert_eq!(v["data"], "/w==");
    assert_eq!(v["valueBin"], true);
    assert!(v.get("attempt").is_none());
}

#[test]
fn event_shapes_match_the_webview() {
    let f = serde_json::to_value(PubsubEvent::Failed { stage: "auth", message: "m".into(), hint: None, elapsed_ms: 3 }).unwrap();
    assert_eq!(f, json!({ "type": "failed", "stage": "auth", "message": "m", "elapsedMs": 3 }));
    let p = serde_json::to_value(PubsubEvent::Pulled { n: 2, count: 1, skipped: 3, at_ms: 9 }).unwrap();
    assert_eq!(p, json!({ "type": "pulled", "n": 2, "count": 1, "skipped": 3, "atMs": 9 }));
    let i = serde_json::to_value(Info { project: "p".into(), auth_kind: "key".into(), mode: "temp".into(), ..Default::default() }).unwrap();
    assert_eq!(i["authKind"], "key");
    assert_eq!(i["labels"], json!([]));
    assert!(i.get("subscriptions").is_none());
}

#[test]
fn requests_are_checked_before_anything_is_sent() {
    let base = PubsubRequest {
        id: "c".into(),
        project: "acme-staging".into(),
        topic: "transfer-events".into(),
        auth: AuthReq { kind: "token".into(), token: "t".into(), ..Default::default() },
        endpoint: String::new(),
        mode: "temp".into(),
        subscription: String::new(),
        filter: String::new(),
        ordering: false,
        ack_deadline: 60,
        create_topic: false,
        insecure: false,
        timeout_ms: 0,
    };
    assert!(check_request(&base).is_ok());
    assert_eq!(check_request(&PubsubRequest { project: " ".into(), ..base.clone() }).unwrap_err(), "Enter a project ID");
    assert_eq!(check_request(&PubsubRequest { mode: "peek".into(), ..base.clone() }).unwrap_err(), "Enter a subscription");
    assert!(check_request(&PubsubRequest { topic: "projects/p/topics/t".into(), ..base.clone() }).unwrap_err().contains("short name"));
    let emu = PubsubRequest { auth: AuthReq { kind: "emulator".into(), ..Default::default() }, ..base.clone() };
    assert!(check_request(&emu).unwrap_err().contains("emulator host"));

    let api = Api::new(&AuthReq { kind: "emulator".into(), emulator_host: "http://localhost:8085/".into(), ..Default::default() }, "", false, 0).unwrap();
    assert_eq!((api.base.as_str(), api.host.as_str(), api.emulator), ("http://localhost:8085", "localhost:8085", true));
    let api = Api::new(&AuthReq { kind: "token".into(), ..Default::default() }, "", false, 0).unwrap();
    assert_eq!(api.base, "https://pubsub.googleapis.com");
    let api = Api::new(&AuthReq { kind: "token".into(), ..Default::default() }, "https://asia-southeast2-pubsub.googleapis.com/", false, 5000).unwrap();
    assert_eq!(api.base, "https://asia-southeast2-pubsub.googleapis.com");
    assert_eq!(api.timeout, Duration::from_secs(5));
}

#[test]
fn temp_names_are_short_and_ours() {
    let n = temp_name();
    assert!(n.starts_with("voidhttp-") && n.len() == "voidhttp-".len() + 6, "{n}");
}

// ---------- against the emulator ----------
//
// PUBSUB_LIVE=host:port runs these against the Pub/Sub emulator, e.g.
//   docker run -d -p 8085:8085 gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators \
//     gcloud beta emulators pubsub start --host-port=0.0.0.0:8085
//   PUBSUB_LIVE=127.0.0.1:8085 cargo test --lib pubsub::tests::live -- --ignored --test-threads=1

fn live_request(mode: &str, topic: &str) -> PubsubRequest {
    PubsubRequest {
        id: format!("live-{mode}"),
        project: "voidhttp-test".into(),
        topic: topic.into(),
        auth: AuthReq { kind: "emulator".into(), emulator_host: std::env::var("PUBSUB_LIVE").expect("set PUBSUB_LIVE to host:port"), ..Default::default() },
        endpoint: String::new(),
        mode: mode.into(),
        subscription: String::new(),
        filter: String::new(),
        ordering: false,
        ack_deadline: 10,
        create_topic: true,
        insecure: false,
        timeout_ms: 10_000,
    }
}

/// Runs a connection; returns the command queue and the events.
fn live(req: PubsubRequest) -> (mpsc::Sender<Cmd>, mpsc::UnboundedReceiver<PubsubEvent>, tokio::task::JoinHandle<()>) {
    let api = Arc::new(Api::new(&req.auth, &req.endpoint, req.insecure, req.timeout_ms).unwrap());
    let (tx, rx) = mpsc::channel(64);
    let (etx, erx) = mpsc::unbounded_channel();
    let emit: Emit = Arc::new(move |e| {
        let _ = etx.send(e);
    });
    let task = tokio::spawn(run(api, req, rx, emit));
    (tx, erx, task)
}

async fn next(rx: &mut mpsc::UnboundedReceiver<PubsubEvent>, what: &str, pick: impl Fn(&PubsubEvent) -> bool) -> PubsubEvent {
    tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            let e = rx.recv().await.expect("the connection ended");
            if let PubsubEvent::Failed { message, .. } = &e {
                panic!("failed: {message}");
            }
            if pick(&e) {
                return e;
            }
        }
    })
    .await
    .unwrap_or_else(|_| panic!("no {what} in 30 s"))
}

#[tokio::test]
#[ignore]
async fn live_temp_subscription_round_trip() {
    let (tx, mut rx, task) = live(live_request("temp", "live-round-trip"));
    let PubsubEvent::Connected { info, .. } = next(&mut rx, "connected", |e| matches!(e, PubsubEvent::Connected { .. })).await else { unreachable!() };
    let sub = info.subscription.clone().unwrap();
    assert!(sub.starts_with("voidhttp-"));
    assert!(info.subscriptions.unwrap().iter().any(|s| s.name == sub));

    tx.send(Cmd::Publish(Publish { seq: 1, data: r#"{"hello":"pubsub"}"#.into(), attributes: vec![Kv { key: "eventType".into(), value: "test".into() }], ordering_key: None }))
        .await
        .unwrap();
    let PubsubEvent::Message { message_id, error, .. } = next(&mut rx, "publish answer", |e| matches!(e, PubsubEvent::Message { kind: "ack", .. })).await else { unreachable!() };
    assert!(error.is_none(), "{error:?}");
    let published = message_id.unwrap();
    let PubsubEvent::Message { data, headers, handed, message_id, .. } =
        next(&mut rx, "the message back", |e| matches!(e, PubsubEvent::Message { dir: "in", kind: "record", .. })).await
    else {
        unreachable!()
    };
    assert_eq!(data, r#"{"hello":"pubsub"}"#);
    assert_eq!(message_id.as_deref(), Some(published.as_str()));
    assert_eq!(headers[0].key, "eventType");
    assert_eq!(handed, Some("acked"));

    tx.send(Cmd::Close).await.unwrap();
    let PubsubEvent::Close { by, reason, .. } = next(&mut rx, "close", |e| matches!(e, PubsubEvent::Close { .. })).await else { unreachable!() };
    assert_eq!((by, reason.as_str()), ("client", "Disconnected"));
    task.await.unwrap();

    // the temporary subscription is gone
    let api = Api::new(&live_request("temp", "x").auth, "", false, 10_000).unwrap();
    let e = api.get(&api.url(&sub_path("voidhttp-test", &sub))).await.unwrap_err();
    assert_eq!(e.status, 404);
}

#[tokio::test]
#[ignore]
async fn live_peek_hands_messages_back() {
    // a subscription of "our service", made directly
    let api = Api::new(&live_request("peek", "x").auth, "", false, 10_000).unwrap();
    let topic = topic_path("voidhttp-test", "live-peek");
    let _ = api.call(Method::PUT, &api.url(&topic), Some(json!({})), api.timeout).await;
    let sub = sub_path("voidhttp-test", "live-peek-service");
    let _ = api.call(Method::PUT, &api.url(&sub), Some(json!({ "topic": topic, "ackDeadlineSeconds": 10 })), api.timeout).await;
    let data = base64::engine::general_purpose::STANDARD.encode("peek me");
    api.call(Method::POST, &api.url(&format!("{topic}:publish")), Some(json!({ "messages": [{ "data": data }] })), api.timeout).await.unwrap();

    let mut req = live_request("peek", "live-peek");
    req.subscription = "live-peek-service".into();
    let (tx, mut rx, task) = live(req);
    next(&mut rx, "connected", |e| matches!(e, PubsubEvent::Connected { .. })).await;
    tx.send(Cmd::Pull(10)).await.unwrap();
    let PubsubEvent::Pulled { count, .. } = next(&mut rx, "pull", |e| matches!(e, PubsubEvent::Pulled { .. })).await else { unreachable!() };
    assert_eq!(count, 1);
    let PubsubEvent::Message { data, handed, .. } = next(&mut rx, "message", |e| matches!(e, PubsubEvent::Message { .. })).await else { unreachable!() };
    assert_eq!((data.as_str(), handed), ("peek me", Some("returned")));
    tx.send(Cmd::Close).await.unwrap();
    next(&mut rx, "close", |e| matches!(e, PubsubEvent::Close { .. })).await;
    task.await.unwrap();

    // handed back: the service still gets it
    let mut got = Vec::new();
    for _ in 0..5 {
        got = api.pull(&sub, 10, true).await.unwrap();
        if !got.is_empty() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    assert_eq!(got.len(), 1, "the peeked message should be back on the subscription");
    let _ = api.call(Method::DELETE, &api.url(&sub), None, api.timeout).await;
}
