<div align="center">

<img src="app-icon.svg" alt="voidHTTP icon" width="128" height="128" />

# voidHTTP

**The API client that minds its own business.**

No account. No cloud. No telemetry. No 400 MB of bundled Chromium.
Just you, your requests, and a very fast Rust core.

<sub><i>Introvert friendly: never phones home, never asks you to sign in, never wants to "sync up".</i></sub>

[![Latest release](https://img.shields.io/github/v/release/jimmyfish/voidhttp?style=for-the-badge&logo=github&label=release&color=2e67e5)](https://github.com/jimmyfish/voidhttp/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/jimmyfish/voidhttp/release.yml?style=for-the-badge&logo=githubactions&logoColor=white&label=build)](https://github.com/jimmyfish/voidhttp/actions/workflows/release.yml)
[![Downloads](https://img.shields.io/github/downloads/jimmyfish/voidhttp/total?style=for-the-badge&logo=apple&logoColor=white&color=0b1f55)](https://github.com/jimmyfish/voidhttp/releases)

[![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon%20%2B%20Intel-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/jimmyfish/voidhttp/releases/latest)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-24c8db?style=flat-square&logo=tauri&logoColor=white)](https://v2.tauri.app)
[![Rust](https://img.shields.io/badge/Rust-core-b7410e?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![License](https://img.shields.io/badge/license-Apache%202.0%20%2B%20Commons%20Clause-5b8ff8?style=flat-square)](LICENSE)
[![Telemetry](https://img.shields.io/badge/telemetry-none,%20zero,%20nada-01804a?style=flat-square)](#why-another-api-client)
[![Introvert friendly](https://img.shields.io/badge/introvert-friendly-9b59b6?style=flat-square)](#why-another-api-client)
[![Social battery](https://img.shields.io/badge/social%20battery-not%20required-34495e?style=flat-square)](#why-another-api-client)

[**Download**](https://github.com/jimmyfish/voidhttp/releases/latest) · [What it does](#what-it-does) · [Shortcuts](#shortcuts) · [Hack on it](#hack-on-it) · [Changelog](CHANGELOG.md)

<br />

<img src="docs/assets/voidhttp-window.svg" alt="voidHTTP in split view: collections in the sidebar, a POST request with a JSON body and variables on the left, a 201 Created JSON response on the right" width="100%" />

</div>

---

## <img src="docs/assets/icons/circle-help.svg" width="24" height="24" align="top" alt="" /> Why another API client?

Because you opened your API client to send *one* GET request and it asked you to log in, sync to the cloud, and update a 400 MB Electron bundle first. We've all been there. It's not cute.

voidHTTP goes the other way:

- <img src="docs/assets/icons/feather.svg" width="18" height="18" align="top" alt="" /> **Tiny.** It uses the webview your OS already ships (WebKit on macOS) instead of dragging along its own Chromium and Node.
- <img src="docs/assets/icons/hard-drive.svg" width="18" height="18" align="top" alt="" /> **Local. Like, actually local.** No account, no cloud sync, no telemetry. Your stuff is plain JSON on your disk. Back it up, grep it, commit it, it's yours.
- <img src="docs/assets/icons/zap.svg" width="18" height="18" align="top" alt="" /> **Fast.** Requests run in Rust (`reqwest` + `rustls`). That means no CORS drama, pooled connections, and a UI that never freezes while it waits on your slow staging server.
- <img src="docs/assets/icons/arrow-right-left.svg" width="18" height="18" align="top" alt="" /> **Speaks Postman.** Imports your collections, environments *and* `pm.*` scripts, so switching over takes about one coffee.
- <img src="docs/assets/icons/users.svg" width="18" height="18" align="top" alt="" /> **Introvert friendly.** No team invites, no workspace members, no "Kevin from QA is viewing this request". It's a party of one, and the party is great.

## <img src="docs/assets/icons/download.svg" width="24" height="24" align="top" alt="" /> Get it

1. Grab the `.dmg` for your Mac (Apple Silicon or Intel) from the [latest release](https://github.com/jimmyfish/voidhttp/releases/latest).
2. Drag voidHTTP into Applications.
3. The app is ad-hoc signed (no Apple Developer ID yet, those cost money), so macOS will side-eye it on first launch. Calm it down once with:

   ```sh
   xattr -cr /Applications/voidHTTP.app
   ```

After that, the app updates itself. You'll see a little chip when a new version lands.

## <img src="docs/assets/icons/sparkles.svg" width="24" height="24" align="top" alt="" /> What it does

### <img src="docs/assets/icons/folder-tree.svg" width="20" height="20" align="top" alt="" /> Projects, tabs, the whole workspace

- **Projects** each get their own collections, environments and history. Open ones sit as tabs in the title strip; Home shows them as cards with recent activity (computed from local history, obviously).
- **Request tabs** with the response stacked below or split beside. Drag the divider until it feels right.
- **Collections** with nested folders, drag-to-reorder, collection variables and inline rename.
- **Environments** with `{{variables}}`, a colour tag each so you never fire at prod by accident, and a picker right in the tabs bar. Nested variables work, and so do `{{$guid}}`, `{{$timestamp}}`, `{{$isoTimestamp}}` and `{{$randomInt}}`.
- **Edit variables your way**: as a table, as JSON, or as `.env` lines.

### <img src="docs/assets/icons/globe.svg" width="20" height="20" align="top" alt="" /> HTTP, done properly

- All the methods, URL ↔ query params kept in sync, headers, and auth (Bearer, Basic, API key).
- **Bodies:** JSON (with `//` comments, stripped before sending, you're welcome), text, XML, `x-www-form-urlencoded`, and `multipart/form-data` with text and file fields.
- **Responses:** status, time, size, HTTP version, headers, pretty JSON, raw view, and image preview.
- **Filter the response** with plain text (jump between matches) or a JSONPath query starting with `$` (Goessner / jsonpath-plus dialect, filters included). Copy grabs only what you filtered.
- **Huge responses won't melt your laptop:** highlighting turns off above 512 KB and rendering is truncated above 4 MB.
- **Paste a cURL** into the address bar and it becomes a request. Copy as cURL goes the other way.
- Shared in-memory cookie jar, and a Cancel button for when the server just… doesn't.

### <img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones)

Each HTTP request can have a **pre-request** script (runs before Send) and a **post-response** script (runs when the response lands), written with Postman's `pm` API.

- `pm.environment`, `pm.collectionVariables` and `pm.variables` (`get`, `set`, `unset`, `replaceIn`). Changes save to the active environment or the request's collection.
- Tweak the outgoing request: `pm.request.url`, `.method`, `.headers` (`add`, `upsert`, `remove`) and a text body.
- `pm.test` with `pm.expect` (chai-ish: `equal`, `eql`, `include`, `match`, `property`, `keys`, `length`, `above`/`below`, `a`/`an` and friends) plus `pm.response.to.have.status` / `.header`. Old-school `tests["…"]`, `responseBody` and `postman.setEnvironmentVariable` still work too.
- Results show in the **Tests** tab (pass/fail, with the failing assertion and its line) and the **Console** tab (`console.log`, variable changes, errors).
- A broken pre-request script stops the send and points at the line. In a hurry? Hit **Send without scripts**. Don't trust scripts at all? Settings › Requests turns them off.
- **Sandboxed hard:** scripts run in an isolated QuickJS box with no network, no file and no app access, capped at 10 seconds and 64 MB. Post-response scripts see the first 8 MB of the body, and the Console keeps the first 1,000 lines.
- **Not yet:** `pm.sendRequest`, `require()` libraries (lodash, CryptoJS…), cookies, globals (`pm.globals.set` warns and keeps nothing), and folder/collection scripts.

### <img src="docs/assets/icons/waypoints.svg" width="20" height="20" align="top" alt="" /> GraphQL

Pick **GraphQL** in the method menu and drop in the endpoint. Query on the left (highlighting, Beautify, `#` comments with `⌘/`), variables as JSON on the right (`{{variables}}` and `//` comments welcome). Several operations in one document? An Operation picker chooses which one Send fires.

Under the hood it's just an HTTP POST of `{ query, operationName, variables }`, so params, headers, auth, scripts, history, examples and Copy as cURL all work like normal.

- **Docs panel:** fetches the schema by introspection (using your headers and auth) and lets you browse types, fields, arguments, enums and deprecations, with search. Server has introspection off? Load an introspection JSON file instead. Schemas are cached per endpoint for the session.
- **Errors that hide behind `200 OK`** get counted next to the status and listed above the body, with path, `extensions.code`, and a link to the line in your query.
- Not yet: subscriptions and schema-aware autocomplete.

### <img src="docs/assets/icons/network.svg" width="20" height="20" align="top" alt="" /> gRPC

Pick **gRPC**. Methods come from server reflection (v1, falling back to v1alpha) or from `.proto` files compiled right in the app. No `protoc` install, no tears.

- Unary, server, client and bidirectional streaming. Messages are JSON, and **Fill example** builds one from the schema.
- Metadata (keys ending in `-bin` take base64), TLS or plaintext per request, and decoded error details (`google.rpc.ErrorInfo`, `BadRequest`…).
- History, and Copy as grpcurl. Paste a grpcurl command into the address bar to import it. Paste a cURL into a gRPC tab and it flips back to HTTP.

### <img src="docs/assets/icons/plug-zap.svg" width="20" height="20" align="top" alt="" /> WebSocket

Pick **WebSocket**, enter a `ws://` or `wss://` URL (`{{variables}}`, params, headers and auth apply to the upgrade), and hit Connect.

- Send text or JSON one message at a time while incoming ones stream into a live list. Click a row to expand it; binary frames show as hex.
- Subprotocols and a keep-alive ping interval live under Settings.
- The **Handshake** tab shows the upgrade request and the server's reply. A refused upgrade shows its HTTP status and body.
- Sessions land in history with all their messages.

### <img src="docs/assets/icons/messages-square.svg" width="20" height="20" align="top" alt="" /> Socket.IO

Pick **Socket.IO**, enter the server URL and a namespace (leave it empty and the URL's path is the namespace, same as socket.io-client).

- Speaks Socket.IO 3 & 4 (Engine.IO 4) *and* Socket.IO 2 (Engine.IO 3). Pick the version, the mount path and handshake auth JSON in Settings (`{{variables}}` work there).
- **Emit** an event with one text or JSON argument. Turn on **Wait for ack** to see the server's ack threaded under the emit, or a note if it ghosts you.
- Incoming events show their name and every argument (binary attachments as base64). Filter the list by event name.
- The Handshake tab shows the Engine.IO open packet, the namespace join and the upgrade. A refused join shows the server's `connect_error` and its data.
- WebSocket transport only. If a server or proxy only allows long-polling, the upgrade fails and the app tells you so.

### <img src="docs/assets/icons/history.svg" width="20" height="20" align="top" alt="" /> History and examples

- **History** keeps the last 200 requests per project, each response stored on disk exactly as it arrived. Bodies over the size limit (1 MB by default) keep just status and headers.
- **Runs:** flip between earlier responses of the same request right in the response pane.
- **Examples:** save a response (or a finished gRPC call, with metadata, messages and trailers) under a saved request. Tokens, cookies and personal data (email, phone, NIK, account numbers…) get spotted by name and masked in the saved copy, so you can share without leaking.

### <img src="docs/assets/icons/package.svg" width="20" height="20" align="top" alt="" /> Import and export

Bring stuff in from a file (picker or just drag it onto the window), a URL, or pasted text. Every import shows a review step first: what's being added, and what got changed on the way in. No surprises.

| Format | Import | Export |
| --- | --- | --- |
| voidHTTP export (`.voidhttp.json`): collections and environments, nothing lost | <img src="docs/assets/icons/check.svg" width="16" height="16" align="top" alt="" /> | <img src="docs/assets/icons/check.svg" width="16" height="16" align="top" alt="" /> |
| Postman Collection v2.0 / v2.1 and Postman environments | <img src="docs/assets/icons/check.svg" width="16" height="16" align="top" alt="" /> auth inheritance flattened; request scripts kept, folder and collection scripts dropped; GraphQL bodies become GraphQL requests | <img src="docs/assets/icons/check.svg" width="16" height="16" align="top" alt="" /> v2.1, environments written beside it |
| OpenAPI 3.x and Swagger 2 (JSON or YAML) | <img src="docs/assets/icons/check.svg" width="16" height="16" align="top" alt="" /> folders from tags or paths, `{{baseUrl}}` from the first server, response examples, `$ref` into nearby files or URLs | |
| HAR | <img src="docs/assets/icons/check.svg" width="16" height="16" align="top" alt="" /> you pick which captured calls become requests | <img src="docs/assets/icons/check.svg" width="16" height="16" align="top" alt="" /> each request with its latest saved example as the response |
| cURL and grpcurl commands, one or many | <img src="docs/assets/icons/check.svg" width="16" height="16" align="top" alt="" /> | |

On export, choose which environments tag along (none, the active one, or all). Secrets get blanked unless you say keep them, and examples can be left out.

<details>
<summary><img src="docs/assets/icons/shield-check.svg" width="18" height="18" align="top" alt="" /> <b>Imports are treated as sketchy by default</b></summary>

<br />

Someone sent you a collection? Cool. voidHTTP still doesn't trust it:

- A file path inside an imported multipart field is dropped, and the review step tells you which. Pick the file again yourself before sending. An imported collection can't choose which of your local files gets uploaded.
- OpenAPI `$ref` files are read only from the spec's folder or below (symlinks resolved), and only `.json`, `.yaml` and `.yml`, never from hidden folders or voidHTTP's own data.
- Blanking secrets also catches passwords in URLs (`https://user:pass@host`), secret-looking query params, and secret fields inside JSON variable values.
- Huge imports are capped (rows per table, requests and folders per import) so the editor and sidebar stay snappy.
- Imported scripts would run on every send, so the review step counts them, and Settings › Requests › Run scripts can switch them all off.

</details>

### <img src="docs/assets/icons/palette.svg" width="20" height="20" align="top" alt="" /> Make it yours

- **Light, dark, or follow the OS**, with a separate colour scheme for each: Ayu, Atom One, Everforest and Gruvbox families, straight from Ghostty theme files.
- **Fonts:** pick the UI and code fonts from what's installed, each with its own size.
- **Compact mode:** fewer icons, methods as little coloured dots.
- **Soft wrap** for request and response bodies.
- **Requests:** timeout, follow redirects, skip TLS verification, whether to keep responses in history, and the biggest body worth keeping.

<details>
<summary><img src="docs/assets/icons/wrench.svg" width="18" height="18" align="top" alt="" /> <b>Network and certificate settings for corporate-VPN survivors</b></summary>

<br />

All of these work for HTTP, WebSocket, Socket.IO and gRPC alike, and all are off by default.

- **Secure DNS (DNS over HTTPS)** via Cloudflare, Google, Quad9, AdGuard, or your own DoH URL. Optionally fall back to the system resolver when DoH draws a blank (hello, intranet names on a VPN), and list domains that should always use the system resolver.
- **Proxy:** SOCKS5 or HTTP, with optional `user:pass@`, plus a skip list. `localhost`, `127.0.0.1` and `::1` always go direct.
- **Connection check:** looks up, connects to and (for HTTPS) handshakes with a host using the settings on screen, step by step, so you can see exactly where it breaks.
- **CA certificates** (`.pem`) trusted on top of the public CAs, for dev servers with self-signed or company certs.
- **Client certificates** for mutual TLS (CRT + KEY or PFX), matched by host and port. Passphrases live in the macOS Keychain. Files stay where they are; only their paths are saved.

</details>

## <img src="docs/assets/icons/keyboard.svg" width="24" height="24" align="top" alt="" /> Shortcuts

Hands off the mouse.

| Key | What happens |
| --- | --- |
| `⌘/Ctrl + Enter` | Send (or Invoke a gRPC call). On an open client or bidi stream, send the next message. Connect a WebSocket or Socket.IO server, or send/emit once it's open |
| `⌘/Ctrl + S` | Save to collection |
| `⌘/Ctrl + T` | New tab |
| `⌘/Ctrl + W` | Close the open dialog, otherwise the active tab |
| `⌘/Ctrl + Shift + W` | Close window |
| `⌘/Ctrl + E` | Open or close the Variables dialog |
| `⌘/Ctrl + F` | Jump to the response filter |
| `⌘/Ctrl + \` | Show or hide the sidebar |
| `⌘/Ctrl + ,` | Settings |
| `⌘/Ctrl + /` | Comment or uncomment lines in a JSON body |
| Middle-click a tab | Close it |

## <img src="docs/assets/icons/database.svg" width="24" height="24" align="top" alt="" /> Where's my data?

Right here, in plain JSON:

- **`~/.config/voidhttp/`** (or `$XDG_CONFIG_HOME/voidhttp/`) holds `workspace.json` (settings, plus every project's collections and environments), `history.json`, and `responses/`. New laptop? Copy this folder to the same path there. Done.
- **Per-device state** (open projects and tabs, layout) lives in `session.json` in the app data dir: `~/Library/Application Support/dev.voidhttp.app/` on macOS.

Upgrading from an older version? On first launch, any older data found in the app data dir gets copied into `~/.config/voidhttp/` once, and the originals stay put as a backup. A workspace saved before projects existed becomes one project on first load.

## <img src="docs/assets/icons/code-xml.svg" width="24" height="24" align="top" alt="" /> Hack on it

You'll need [Rust](https://rustup.rs), [Bun](https://bun.sh), and the [Tauri v2 system dependencies](https://v2.tauri.app/start/prerequisites/). On macOS, the Xcode Command Line Tools are enough.

```sh
bun install
bun run tauri dev      # run the app with hot reload
bun run tauri build    # build the release bundle (.app / .dmg / .msi / .AppImage)
bun run typecheck      # TypeScript check only
```

- New icon? `bunx tauri icon app-icon.svg` regenerates the lot.
- The gRPC live test hits the public test server grpcb.in, so it's skipped by default. Run it with `cargo test -- --ignored live_` inside `src-tauri`.

<details>
<summary><img src="docs/assets/icons/map.svg" width="18" height="18" align="top" alt="" /> <b>Where things live</b></summary>

<br />

```
src-tauri/src/http.rs     HTTP engine: reqwest, pooled clients, cancellation, multipart
src-tauri/src/grpc.rs     gRPC engine: tonic, dynamic messages (prost-reflect), reflection, protox, streams
src-tauri/src/ws.rs       WebSocket engine: tokio-tungstenite over rustls, one live socket per tab
src-tauri/src/sio.rs      Socket.IO client on the WebSocket engine: Engine.IO 3/4, namespace join, emits, acks
src-tauri/src/certs.rs    the one rustls setup: public + custom CAs, client certificates, Keychain passphrases
src-tauri/src/net.rs      secure DNS (hickory, DoH), SOCKS5 / HTTP proxy, connection check
src-tauri/src/store.rs    atomic JSON persistence in ~/.config/voidhttp and the app data dir
src-tauri/src/files.rs    read and write import/export files (64 MB read limit, atomic writes)
src-tauri/src/fonts.rs    installed system fonts for Settings
src/store.ts              app state (zustand) and debounced persistence
src/lib/                  vars, request preparation, GraphQL (wire body, introspection), gRPC calls and schemas, WebSocket, Socket.IO, network settings, cURL, JSONPath, masking, themes
src/lib/formats/          import and export: Postman, OpenAPI / Swagger, HAR, voidHTTP, pasted commands
src/components/           UI
```

The longer story is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

</details>

<details>
<summary><img src="docs/assets/icons/rocket.svg" width="18" height="18" align="top" alt="" /> <b>Shipping a release</b></summary>

<br />

Push a version tag (`v0.2.0`, `v0.2.1`, …) and `.github/workflows/release.yml` takes it from there. It builds separate macOS bundles for Apple Silicon and Intel (so each Mac downloads only what it needs) and uploads them to a **draft** GitHub release, along with `latest.json`, the manifest the in-app updater reads. Release notes come from that version's section of [CHANGELOG.md](CHANGELOG.md).

Publish the draft by hand. Until you do, `/releases/latest/` keeps pointing at the previous release, so nobody gets a half-baked update.

Update bundles are signed with a Tauri updater key. The workflow needs two repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`: contents of `~/.tauri/voidhttp.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the password you picked when generating it

The matching public key goes in `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.

</details>

## <img src="docs/assets/icons/lightbulb.svg" width="24" height="24" align="top" alt="" /> On the wishlist

Not built yet, but on the radar: folder and collection scripts, `pm.sendRequest`, GraphQL subscriptions and autocomplete, Socket.IO long-polling, gRPC-Web, OAuth 2 flows, a collection runner, and code generation beyond cURL and grpcurl.

Want one of these sooner? Open an issue and make some noise.

## <img src="docs/assets/icons/users.svg" width="24" height="24" align="top" alt="" /> Come build with us

Bug reports, wild ideas and pull requests are all welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Every version's changes are in [CHANGELOG.md](CHANGELOG.md).

Found a security hole? Please don't post it publicly. Report it privately as described in [SECURITY.md](SECURITY.md).

## <img src="docs/assets/icons/scale.svg" width="24" height="24" align="top" alt="" /> License

voidHTTP is source-available under the [Apache License 2.0 with the Commons Clause](LICENSE). In human words: build cool stuff with it, have fun, just don't resell it.

- <img src="docs/assets/icons/check.svg" width="18" height="18" align="top" alt="" /> **Go ahead:** use it for free, for anything. Hobby projects, weekend hacks, your day job, your company's API, your own paid SaaS: test them all with voidHTTP, no strings attached. Read the source, tweak it, fork it, share your fork.
- <img src="docs/assets/icons/paperclip.svg" width="18" height="18" align="top" alt="" /> **Please do:** keep the [LICENSE](LICENSE) and [NOTICE](NOTICE) files in every copy and fork. NOTICE credits this repo.
- <img src="docs/assets/icons/ban.svg" width="18" height="18" align="top" alt="" /> **Don't:** sell voidHTTP itself. No rebranded copies, no paid forks, no "voidHTTP in the cloud" subscription, no paid support plans for it. If people would mainly be paying for voidHTTP, it's off the table.

Because of the Commons Clause, voidHTTP isn't "open source" by the OSI definition. Need a different arrangement? Open an issue and ask.

<div align="center">
<br />
<sub>Made with coffee, Rust, and a mild grudge against bloated API clients.</sub>
</div>
