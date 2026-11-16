# Changelog

All notable changes to voidHTTP are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Quick open (⌘P).** Fuzzy-search the requests, examples and open tabs of the current project by name, folder or URL, then press Enter to open one. A method typed as a word (`post login`) filters by method. With nothing typed it lists the open tabs and the requests you sent lately.
- **Actions (⇧⌘P, or `>` in quick open).** Send, cancel, save as, reopen a closed tab, show or hide the sidebar, zoom, switch theme or layout, import, settings and more, each shown with its shortcut.
- **Settings > Shortcuts** lists every keyboard shortcut, with a search box. ⌘/ opens it (inside a code editor ⌘/ still comments lines). Shortcuts can't be changed.
- **More shortcuts:** ⌘. cancel the request, ⇧⌘S save as, ⌘L jump to the URL, ⇧⌘T reopen the last closed tab, ⇧⌘] / ⇧⌘[ and ⌃Tab / ⌃⇧Tab next and previous tab, ⌘1–⌘8 go to a tab and ⌘9 to the last, ⇧⌘F search the sidebar, ⌥E switch environment, ⌘O import, ⌘+ / ⌘− / ⌘0 zoom (remembered between launches).
- **Sidebar keyboard:** ↑ / ↓ move between items (↓ from the search box enters the list), Enter opens, → / ← expand or collapse (⌥ for all), F2 renames, ⌘D duplicates and ⌘⌫ deletes the focused item.

## [0.1.6] - 2026-11-16

### Added

- **WebSocket.** Pick WebSocket in the method menu and connect to a `ws://` or `wss://` URL. `{{variables}}`, params, headers and auth apply to the upgrade request. Send text or JSON messages and watch received ones arrive in a live list; binary frames show as hex. Subprotocols and a keep-alive ping interval are under Settings. The Handshake tab shows the upgrade request and the server's answer. Sessions are saved to history with their messages.
- **Socket.IO.** Pick Socket.IO in the method menu, enter the server URL and a namespace. Supports Socket.IO 3/4 (Engine.IO 4) and Socket.IO 2 (Engine.IO 3), a custom mount path, and handshake auth JSON. Emit events with one text or JSON argument, wait for acks (shown under the emit), and filter received events by name. The Handshake tab shows the Engine.IO open packet, the namespace join and the upgrade. Only the WebSocket transport is used, not long-polling.
- **GraphQL.** Pick GraphQL in the method menu. The Query tab has the document (highlighting, Beautify, `#` comments) and its variables as JSON; an Operation picker chooses which operation Send runs when the document holds several. It is sent as an HTTP POST of `{ query, operationName, variables }`, so headers, auth, scripts, history, examples and Copy as cURL work as for HTTP. A Docs panel fetches the schema by introspection, or from an introspection JSON file, and browses types, fields, arguments and enum values with search. GraphQL errors returned with `200 OK` are counted beside the status and listed above the body, each linking to its line in the query. Postman imports turn GraphQL bodies into GraphQL requests, and Postman exports write them back as GraphQL bodies.
- **Settings > Network**, for every kind of request (all off by default):
  - Secure DNS (DNS over HTTPS) via Cloudflare, Google, Quad9, AdGuard or a custom DoH URL, with an optional fallback to the system resolver and a list of domains that always use it.
  - A SOCKS5 or HTTP proxy, with a skip list. `localhost`, `127.0.0.1` and `::1` always connect directly.
  - A connection check that looks up, connects to and handshakes with a host step by step.
- **Settings > Certificates**, for HTTP, WebSocket, Socket.IO and gRPC:
  - CA certificates (`.pem`) trusted on top of the public CAs, for dev servers with a self-signed or company certificate.
  - Client certificates for mutual TLS (CRT + KEY or PFX), matched by host and port. Passphrases are kept in the macOS Keychain, and certificate files are referenced by path, never copied.
- **Scripts.** HTTP requests get a Scripts tab with a pre-request script (runs before Send) and a post-response script (runs once the response arrives), using Postman's `pm` API: environment, collection and request variables, changing the request before it goes out, `pm.test` with chai-style `pm.expect`, and `console.log`. The response gets a Tests tab (passed and failed tests, with the failing assertion and its line) and a Console tab. A failing pre-request script stops the send and points at its line. Snippets cover the common cases. Scripts run in an isolated QuickJS sandbox with a time and memory limit. Postman imports now keep request scripts instead of dropping them, and Postman exports write them.
- **gRPC examples.** Save a finished gRPC call (metadata, messages sent and received, trailers, error details) as an example under a saved request. Masking covers all of these parts.

### Changed

- **About voidHTTP** (app menu) opens a new dialog instead of the plain macOS panel: the version (click to copy), update status with Install and Restart, the release notes, the license in short, and links to GitHub, the full license and the issue tracker.
- The update popover and the About dialog now show what changed in a new version, one short line per item, taken from this changelog.
- voidHTTP now has a license: Apache License 2.0 with the Commons Clause. You may use, modify and redistribute it, and forks must keep the LICENSE and NOTICE files. You may not sell it or offer it as a paid product or service. Releases before 0.1.6 were published without a license.

### Security

- Scripts never run in the app's webview. They run in a separate QuickJS sandbox with no network, file system or app access, stopped after 10 seconds or 64 MB. Imported collections can bring scripts that run on every send; the import review says how many, and Settings › Requests › Run scripts turns them all off.
- An imported multipart field can no longer choose which local file gets uploaded: file paths that come in with an import are dropped, and the review step names them.
- OpenAPI `$ref` files are read only from the spec's folder or below it, with symlinks resolved. Only `.json`, `.yaml` and `.yml` files are read, and never from hidden folders or voidHTTP's own data.
- Exports are written through a fresh, unguessable temporary name, so a symlink planted at a predictable path cannot redirect the write.
- Blanking secrets on export now also empties passwords in URLs (`https://user:pass@host`), user names that act as tokens, secret-looking query params, and secret fields inside JSON variable values.
- Masking in saved examples covers more token and personal-data patterns.

### Fixed

- The editor no longer hangs on imports or requests with a huge number of rows, query params, requests or folders. These are now capped. The URL keeps its whole query, so what is sent does not change.
- Variables that grow on expansion, and long URLs with many `{{tokens}}`, no longer slow down the address bar. Previews now render within a fixed budget.
- A regular expression in variable parsing that could take cubic time on input such as `{{` followed by many spaces.
- A stack overflow when base64-encoding a very large credential for Basic auth.

## [0.1.5] - 2026-11-13

### Added

- In-app updates: an update chip next to the Settings gear shows when a new version is available, downloading, or ready to install. Settings > Updates shows the current version and has "Check for updates" and a "Check automatically" switch. The app menu has "Check for Updates…". Updates are signed and verified before installing.

### Changed

- Release builds cache Rust dependencies, so they finish faster.

## [0.1.4] - 2026-11-13

### Changed

- macOS bundles for Apple Silicon and Intel are built separately, so each Mac downloads only its own.

## [0.1.3] - 2026-11-13

First tagged release.

### Added

- Projects with their own collections, environments and history; request tabs with stacked or split layout.
- HTTP requests run in Rust: methods, params, headers, Bearer / Basic / API key auth, and JSON (with comments), text, XML, form and multipart bodies.
- Collections with nested folders, collection variables, and environments with `{{variables}}` and dynamic values.
- Response viewer with pretty JSON, raw view, image preview, a text or JSONPath filter, and a guard for large responses.
- gRPC: server reflection or `.proto` files compiled in-app, all four call types, metadata, TLS, decoded error details, and Copy as grpcurl.
- History with stored responses, earlier runs per request, and saved examples with masking of tokens and personal data.
- Import from voidHTTP, Postman v2.x, OpenAPI 3 / Swagger 2, HAR, and cURL / grpcurl commands. Export to voidHTTP, Postman v2.1 and HAR.
- Light and dark themes with colour schemes, system fonts, and compact mode.

[0.1.6]: https://github.com/jimmyfish/voidhttp/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/jimmyfish/voidhttp/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/jimmyfish/voidhttp/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/jimmyfish/voidhttp/releases/tag/v0.1.3
