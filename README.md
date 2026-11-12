# voidHTTP

A lightweight, local-first API client. Rust + React + Tauri v2.

- **Small.** Uses the OS webview (WebKit on macOS), not a bundled Chromium + Node runtime.
- **Local only.** No account, no cloud sync, no telemetry. Your data is plain JSON on disk.
- **Fast.** Requests run in Rust (`reqwest` + `rustls`), so CORS does not apply, connections are pooled, and the UI thread never blocks.

## Features (v0.1)

- Tabs, with request/response split view (drag the divider to resize)
- Methods, URL ↔ query params sync, headers, auth (Bearer, Basic, API key)
- Bodies: JSON, text, XML, `x-www-form-urlencoded`, `multipart/form-data` (text and file fields)
- Response: status, time, size, HTTP version, headers, pretty JSON, raw view, image preview
- Large-response guard: highlighting is off above 512 KB, and rendering is truncated above 4 MB
- Collections with nested folders, plus collection variables
- Environments with `{{variables}}`. Nested variables and `{{$guid}}`, `{{$timestamp}}`, `{{$isoTimestamp}}`, `{{$randomInt}}` work
- History (last 200 requests)
- **Import Postman** collection v2.0/v2.1 and environment exports (auth inheritance is flattened)
- Copy as cURL
- Cookie jar shared across requests (in memory)
- Settings: timeout, follow redirects, skip TLS verification
- Request cancellation

### Shortcuts

| Key | Action |
| --- | --- |
| `⌘/Ctrl + Enter` | Send |
| `⌘/Ctrl + S` | Save to collection |
| `⌘/Ctrl + T` | New tab |
| Middle-click a tab | Close it |

## Development

Prerequisites: [Rust](https://rustup.rs), [Bun](https://bun.sh), and the [Tauri v2 system dependencies](https://v2.tauri.app/start/prerequisites/). On macOS, the Xcode Command Line Tools are enough.

```sh
bun install
bun run tauri dev      # run the app with hot reload
bun run tauri build    # build the release bundle (.app / .dmg / .msi / .AppImage)
```

To regenerate icons: `bunx tauri icon app-icon.svg`.

## Layout

```
src-tauri/src/http.rs    HTTP engine: reqwest, pooled clients, cancellation, multipart
src-tauri/src/store.rs   atomic JSON persistence in the app data dir
src/store.ts             app state (zustand) and debounced persistence
src/lib/                 vars, request preparation, Postman import, cURL, JSON highlighter
src/components/          UI
```

Data location: `~/Library/Application Support/dev.voidhttp.app/` on macOS. It holds `workspace.json`, `history.json`, and `session.json`.

## Not yet

These are not implemented yet: pre-request and test scripts, GraphQL, WebSocket/gRPC, OAuth 2 flows, collection runner, and code generation beyond cURL.
