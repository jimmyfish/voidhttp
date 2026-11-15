# voidHTTP

A lightweight, local-first API client. Rust + React + Tauri v2.

- **Small.** Uses the OS webview (WebKit on macOS), not a bundled Chromium + Node runtime.
- **Local only.** No account, no cloud sync, no telemetry. Your data is plain JSON on disk.
- **Fast.** Requests run in Rust (`reqwest` + `rustls`), so CORS does not apply, connections are pooled, and the UI thread never blocks.

## Features

### Projects and workspace

- Projects: each one has its own collections, environments and history. Open projects show as tabs in the title strip; Home shows them as cards, with recent activity computed from local history
- Request tabs, with the response below the request (stacked) or beside it (split). Drag the divider to resize
- Collections with nested folders (drag to reorder or move), collection variables, and inline rename
- Environments with `{{variables}}`, a colour tag per environment, and an environment picker in the tabs bar. Nested variables and `{{$guid}}`, `{{$timestamp}}`, `{{$isoTimestamp}}`, `{{$randomInt}}` work
- Variables can be edited as a table, as JSON, or as `.env` lines

### HTTP

- Methods, URL ↔ query params sync, headers, auth (Bearer, Basic, API key)
- Bodies: JSON (with `//` comments, stripped before sending), text, XML, `x-www-form-urlencoded`, `multipart/form-data` (text and file fields)
- Response: status, time, size, HTTP version, headers, pretty JSON, raw view, image preview
- Response filter: plain-text search with match navigation, or a JSONPath query (start with `$`, Goessner / jsonpath-plus dialect, filters included). Copy copies the filtered result
- Large-response guard: highlighting is off above 512 KB, and rendering is truncated above 4 MB
- Paste a cURL command into the address bar to import it. Copy as cURL
- Cookie jar shared across requests (in memory)
- Request cancellation

### gRPC

Pick gRPC in the method menu. Methods come from server reflection (v1, falling back to v1alpha) or from `.proto` files compiled in-app (no `protoc` needed). Unary, server, client and bidirectional streams; messages are JSON, with "Fill example" from the schema. Metadata (keys ending in `-bin` take base64), TLS or plaintext per request, error details (`google.rpc.ErrorInfo`, `BadRequest`…) decoded, history, and Copy as grpcurl. Paste a grpcurl command into the address bar to import it (a cURL command pasted into a gRPC tab turns it back into HTTP).

### WebSocket

Pick WebSocket in the method menu and enter a `ws://` or `wss://` URL (`{{variables}}`, params, headers and auth apply to the upgrade request). Connect opens the socket; send text or JSON messages one by one while received ones stream into a live list (click a row to expand it; binary frames show as hex). Subprotocols and a keep-alive ping interval are under Settings. The Handshake tab shows the upgrade request and the server's answer; a refused upgrade shows its HTTP status and body. Sessions go to history with their messages. Socket.IO is not supported.

### History and examples

- History (last 200 requests per project), with each response kept on disk as received. Bodies over a size limit (1 MB by default) keep only status and headers
- Runs: switch between earlier responses of the same request from the response pane
- Examples: save a response under a saved request. Tokens, cookies and personal data (email, phone, NIK, account numbers…) are found by name and masked in the saved copy

### Import and export

Import from a file (picker or drag-and-drop onto the window), a URL, or pasted text. Every import shows a review step that lists what will be added and what changed on the way in.

| Format | Import | Export |
| --- | --- | --- |
| voidHTTP export (`.voidhttp.json`): collections and environments, nothing lost | ✓ | ✓ |
| Postman Collection v2.0 / v2.1 and Postman environments | ✓ (auth inheritance flattened, scripts dropped) | ✓ v2.1, environments written beside it |
| OpenAPI 3.x and Swagger 2 (JSON or YAML) | ✓ folders from tags or paths, `{{baseUrl}}` from the first server, response examples, `$ref` into files beside the spec or URLs | |
| HAR | ✓ pick which captured calls become requests | ✓ each request with its latest saved example as the response |
| cURL and grpcurl commands, one or many | ✓ | |

On export, pick which environments go along (none, the active one, all). Secret values are blanked unless you choose to keep them, and examples can be left out.

### Appearance and settings

- Light, dark, or follow the OS, with a separate colour scheme for each (Ayu, Atom One, Everforest, Gruvbox families, from Ghostty theme files)
- UI and code fonts picked from installed system fonts, with separate sizes
- Compact mode: fewer icons, methods shown as coloured dots
- Soft wrap for the request body and the response body
- Requests: timeout, follow redirects, skip TLS verification, keep responses in history and the largest body kept
- Certificates, for HTTP, WebSocket and gRPC alike: CA certificates (`.pem`) trusted on top of the public CAs, for dev servers with a self-signed or company certificate; client certificates for mutual TLS (CRT + KEY or PFX) matched by host and port, with passphrases kept in the macOS Keychain. Files stay where they are; only their paths are saved

### Shortcuts

| Key | Action |
| --- | --- |
| `⌘/Ctrl + Enter` | Send, or Invoke a gRPC call; on an open client or bidi stream, send the next message; Connect a WebSocket, or send the message once it is open |
| `⌘/Ctrl + S` | Save to collection |
| `⌘/Ctrl + T` | New tab |
| `⌘/Ctrl + W` | Close the open dialog, otherwise the active tab |
| `⌘/Ctrl + Shift + W` | Close window |
| `⌘/Ctrl + E` | Open or close the Variables dialog |
| `⌘/Ctrl + F` | Focus the response filter |
| `⌘/Ctrl + \` | Show or hide the sidebar |
| `⌘/Ctrl + ,` | Settings |
| `⌘/Ctrl + /` | Comment or uncomment lines in a JSON body |
| Middle-click a tab | Close it |

## Development

Prerequisites: [Rust](https://rustup.rs), [Bun](https://bun.sh), and the [Tauri v2 system dependencies](https://v2.tauri.app/start/prerequisites/). On macOS, the Xcode Command Line Tools are enough.

```sh
bun install
bun run tauri dev      # run the app with hot reload
bun run tauri build    # build the release bundle (.app / .dmg / .msi / .AppImage)
bun run typecheck      # TypeScript check only
```

To regenerate icons: `bunx tauri icon app-icon.svg`.

The gRPC live test talks to the public test server grpcb.in and is skipped by default: `cargo test -- --ignored live_` in `src-tauri`.

## Releases

Pushing a version tag (`v0.2.0`, `v0.2.1`, …) runs `.github/workflows/release.yml`. It builds a universal macOS binary (Apple Silicon and Intel) and uploads it to a **draft** GitHub release, together with `latest.json`, the manifest the Tauri updater reads. Publish the draft by hand; until then, `/releases/latest/` keeps pointing at the previous release.

Update bundles are signed with a Tauri updater key. The workflow needs two repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`: contents of `~/.tauri/voidhttp.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the password chosen when generating it

The matching public key goes in `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.

The app is ad-hoc signed (no Apple Developer ID), so a first install needs `xattr -cr /Applications/voidHTTP.app`.

## Layout

```
src-tauri/src/http.rs     HTTP engine: reqwest, pooled clients, cancellation, multipart
src-tauri/src/grpc.rs     gRPC engine: tonic, dynamic messages (prost-reflect), reflection, protox, streams
src-tauri/src/ws.rs       WebSocket engine: tokio-tungstenite over rustls, one live socket per tab
src-tauri/src/certs.rs    the one rustls setup: public + custom CAs, client certificates, Keychain passphrases
src-tauri/src/store.rs    atomic JSON persistence in ~/.config/voidhttp and the app data dir
src-tauri/src/files.rs    read and write import/export files (64 MB read limit, atomic writes)
src-tauri/src/fonts.rs    installed system fonts for Settings
src/store.ts              app state (zustand) and debounced persistence
src/lib/                  vars, request preparation, gRPC calls and schemas, WebSocket, cURL, JSONPath, masking, themes
src/lib/formats/          import and export: Postman, OpenAPI / Swagger, HAR, voidHTTP, pasted commands
src/components/           UI
```

Data location: `~/.config/voidhttp/` (or `$XDG_CONFIG_HOME/voidhttp/`). It holds `workspace.json` (settings, plus every project's collections and environments), `history.json`, and `responses/`. To move to another device, copy this folder to the same path there.

Per-device state stays in the app data dir (`~/Library/Application Support/dev.voidhttp.app/` on macOS): `session.json` (open projects and tabs, layout). On first launch after the switch, older data found there is copied into `~/.config/voidhttp/` once; the originals are left in place as a backup. A workspace saved before projects existed is migrated into one project on first load.

## Not yet

These are not implemented yet: pre-request and test scripts, GraphQL, Socket.IO, gRPC-Web, OAuth 2 flows, collection runner, and code generation beyond cURL and grpcurl.
