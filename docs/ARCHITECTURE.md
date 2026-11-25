# Architecture

This page describes how voidHTTP is put together: which side does what, how a request travels, and where data is stored. For the list of files, see "Where things live" under [Hack on it](../README.md#hack-on-it) in the README.

## Two halves

voidHTTP is a [Tauri v2](https://v2.tauri.app) app, made of two parts:

- **The webview (`src/`)**: React, with app state in zustand (`src/store.ts`). It owns the data model, the UI, variable resolution, import and export, and masking. It never opens a network connection itself.
- **Rust (`src-tauri/src/`)**: every network connection, TLS, DNS and proxy, plus reading and writing files on disk. It does not interpret the workspace; it reads and writes the JSON documents the webview hands it.

The two halves talk only through Tauri commands (`invoke`), registered in `src-tauri/src/lib.rs`. Live connections (gRPC streams, WebSocket, Socket.IO, Kafka, MQTT, Pub/Sub) also use a Tauri IPC `Channel` to push events back to the webview.

```
 webview (React)                                   Rust (tokio)
 ───────────────                                   ────────────
 RequestPane / GrpcPane / WsPane / SioPane / KafkaPane / MqttPane / PubsubPane
        │  prepare(): fill {{variables}},
        │  build headers, auth, body
        ▼
 src/lib/http.ts   invoke("send_request") ───────▶ http.rs   reqwest, pooled clients
 src/lib/grpc.ts   invoke("grpc_invoke", Channel)▶ grpc.rs   tonic + prost-reflect
 src/lib/ws.ts     invoke("ws_connect", Channel) ▶ ws.rs     tokio-tungstenite
 src/lib/sio.ts    invoke("sio_connect", Channel)▶ sio.rs    Engine.IO / Socket.IO on ws.rs
 src/lib/kafka.ts  invoke("kafka_connect", Channel)▶ kafka.rs rskafka protocol, own connections
 src/lib/mqtt.ts   invoke("mqtt_connect", Channel) ▶ mqtt.rs  own MQTT 3.1.1 / 5.0 packets
 src/lib/pubsub.ts invoke("pubsub_connect", Channel)▶ pubsub.rs Pub/Sub REST over reqwest
        ▲                                                 │
        │  response / Channel events                      ├─ net.rs    DNS (system or DoH), proxy
        └─────────────────────────────────────────────────┤
                                                          └─ certs.rs  one rustls config:
                                                                       public + custom CAs,
                                                                       client certs (mTLS)
```

## Sending an HTTP request

1. **Prepare (webview).** `prepare()` in `src/lib/http.ts` takes the request and the variable scope. Variables come from the collection, overridden by the active environment (Postman precedence), plus dynamic values such as `{{$guid}}`. The faker-backed `{{$random…}}` names (`src/lib/fake.ts`, English only) load as a separate chunk the first time one turns up, and every send path awaits `fakeReady()` first so the synchronous resolve can fill them in. Scripts get the same code as `src-tauri/src/script/fake.js`, a bundle built by `bun run fake` and committed; QuickJS evaluates it only when a script first resolves a `{{$random…}}` name. It fills in the URL, params, headers, auth and body, and strips comments from JSON bodies. The address-bar preview uses the same code with a size budget, so a variable that grows on expansion cannot freeze the UI.
2. **Send (Rust).** `invoke("send_request")` reaches `http.rs`. Clients are pooled per combination of "follow redirects", "skip TLS verification" and the matching client certificate. Each client gets its TLS config from `certs::tls_config()` and its DNS resolver and proxy from `net::current()`. Requests can be cancelled by ID (`cancel_request`).
3. **Show and keep (webview).** The response comes back as one value. The webview shows it, adds an entry to history, and stores the body with `save_response` unless it is over the size limit.

## Live connections

gRPC streams, WebSocket, Socket.IO, Kafka, MQTT and Pub/Sub keep a connection open per tab:

- `*_connect` / `grpc_invoke` starts a task that runs until the connection ends. Messages, acks, errors and the close arrive in the webview through the IPC `Channel`.
- `ws_send`, `sio_emit`, `kafka_produce`, `kafka_seek`, `kafka_pause`, `kafka_refresh`, `mqtt_publish`, `mqtt_subscriptions`, `pubsub_publish`, `pubsub_pull`, `pubsub_pause`, `pubsub_refresh`, `grpc_send`, `grpc_end`, `*_close` and `grpc_cancel` reach the running task through a command queue, keyed by the tab's ID.
- `sio.rs` reuses the WebSocket connection code and adds the Engine.IO (v3 and v4) and Socket.IO packet layer on top: namespace join, events, binary attachments and acks.
- `kafka.rs` uses rskafka only for the wire protocol (messages, record batches, compression, SASL) and opens every broker connection itself through `net.rs` and `certs.rs`. It reads each partition from its leader without a consumer group and never commits offsets. Produce picks the partition from the key with murmur2, as the Java client does.
- `mqtt.rs` speaks MQTT 3.1.1 and 5.0 with its own packet code (`mqtt/packet.rs`, both directions, so the tests can play broker). The link is TCP, TLS or WebSocket (`mqtt` subprotocol), all opened through `net.rs` and `certs.rs`. `mqtt_subscriptions` takes the whole Topics list and the session subscribes or unsubscribes the difference; filters the broker refused aren't sent again until their options change. QoS 1 and 2 flows (PUBACK, PUBREC / PUBREL / PUBCOMP) run in both directions, keep-alive pings follow the broker's Server Keep Alive, and a DISCONNECT from the broker (e.g. 0x8E Session taken over) ends the session with its reason.
- `pubsub.rs` talks to Google Cloud Pub/Sub's REST API through a reqwest client built like `http.rs`'s, so `net.rs` and `certs.rs` apply. `pubsub/auth.rs` turns a service account key (a JWT signed with ring), an Application Default Credentials file, an impersonation target or a pasted token into an access token, cached until shortly before it expires. Reading depends on the tab's mode: Temporary makes a `voidhttp-…` subscription with a 24-hour expiry and deletes it on close; Consume pulls and acks an existing subscription; Peek pulls only on `pubsub_pull` and sets every ack deadline back to 0, so the messages go straight back. Pulls run in their own task so a long poll never holds up a publish. `pubsub_inspect` (local files only) and `pubsub_list` fill the project, topic and subscription pickers.
- `grpc.rs` loads method schemas through server reflection (v1, then v1alpha) or compiles `.proto` files in-process with protox, then encodes and decodes JSON messages with prost-reflect.

## Network and TLS

Every engine opens connections through the same two modules, so Settings apply to every kind of request:

- **`net.rs`**: looks up hostnames with the system resolver or with DNS over HTTPS (hickory-resolver), optionally falling back to the system resolver. Connects directly or through a SOCKS5 or HTTP proxy. `localhost`, `127.0.0.1` and `::1` are always direct. `net_configure` swaps in the new setup and clears the pooled HTTP clients; `net_test` runs the step-by-step connection check.
- **`certs.rs`**: builds the one rustls `ClientConfig` used by HTTP, WebSocket, Kafka, MQTT, Pub/Sub, gRPC and the connection check. It trusts the public roots plus the CA `.pem` files from Settings, and picks a client certificate by host and port. Client-certificate passphrases are read from the macOS Keychain.

## State and persistence

All app state lives in one zustand store (`src/store.ts`). Writes to disk are debounced (about 400 ms) and happen only when the slice a file depends on has changed. Rust writes each file atomically: it writes a temporary file beside it, then renames it into place, so a crash never leaves a half-written file.

| Where | File | Holds |
| --- | --- | --- |
| `~/.config/voidhttp/` (or `$XDG_CONFIG_HOME/voidhttp/`) | `workspace.json` | settings, and every project's collections and environments |
| | `history.json` | the last 200 requests per project |
| | `responses/` | response bodies kept for history, runs and examples |
| App data dir (`~/Library/Application Support/dev.voidhttp.app/`) | `session.json` | open projects and tabs, layout (per device) |

The first folder is portable: copy it to another Mac to move everything. Stored responses that no history entry points to any more are removed with `prune_responses`.

Debug builds (`bun tauri dev`) use separate folders so development never touches real data: `~/.config/voidHTTP_dev/` for the vault and `dev/` inside the app data dir for `session.json`.

## Import and export

Each format lives in `src/lib/formats/` (`postman.ts`, `openapi.ts`, `har.ts`, `native.ts`, and pasted commands). OpenAPI export is its own module, `openapiExport.ts`: it writes OpenAPI 3.0.3 as YAML (the `yaml` package) or JSON in the webview, with each chosen environment's address as a server; on Blank, environments are cleaned like HAR's (credentials emptied, addresses kept), since a server needs its URL. Every importer produces voidHTTP collections and environments plus a list of notes. The shared checks in `common.ts` run on every import before the review step:

- file paths in multipart fields are dropped
- tables, requests and folders are capped
- on export, secrets are blanked: secret variables, passwords in URLs, secret query params, and secret JSON fields

Files are read and written through Rust (`files.rs`). `read_text_file` has a 64 MB limit. `write_text_file` writes exports atomically through a temporary file with an unguessable name, so a symlink planted at a predictable path cannot redirect the write. `read_ref_file` reads OpenAPI `$ref` files only from the spec's folder or below it, with symlinks resolved.

## Updates

`tauri-plugin-updater` reads `latest.json` from the latest GitHub release, checks the minisign signature, installs the update, and `tauri-plugin-process` restarts the app. The release workflow (`.github/workflows/release.yml`) builds Apple Silicon and Intel bundles separately and writes `latest.json` into a draft release. Nothing reaches users until the draft is published.
