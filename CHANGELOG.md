# Changelog

All notable changes to voidHTTP are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [0.1.9] - Unreleased

### Added

- **Collapse all.** A button at the right of the Collections header closes every collection and folder at once. Once everything is closed it becomes Expand all, which opens them all again. It does the same as ⌥← / ⌥→ on a focused row, without needing a row focused first.
- **Drag tabs to reorder them.** Grab a request tab and slide it along the strip; the tabs it passes move aside, and dropping it keeps the new order. Pinned tabs stay in front of the others. When tabs scroll past either end of the strip, that edge fades out.

### Changed

- **Redesigned Home.** Home opens with a greeting and a line about this week: how many requests were sent and how many came back OK. Each project card shows its icon, when it was last opened, its collections, a 7-day spark in the project's colour with "n sent this week" and the share that came back OK, and its collection, request and environment counts; Edit project and Delete are in the card's "…" menu. Last 7 days, across all projects, shows requests sent, success rate, median response time and the most called request, then requests per day as OK / Failed bars and the mix of status classes. Recent requests lists the last 7 sends; clicking one opens it from history in its project. Every figure comes from local history. On first run, Home says "Welcome to voidHTTP" and offers two ways in: New project and Import (Postman, OpenAPI, Swagger, HAR, cURL, or a file dropped anywhere on the window).
- **Environment picker.** The picker in the tabs bar is a pill tinted with the active environment's colour (grey when it has no colour, muted for No environment). Each row in its menu shows the variable count under the name, and No environment reads "Collection variables only". Manage environments (⌘E) is now the last row of the menu, so the separate button beside the picker is gone.
- **Save shows its state in one button.** A saved request with no changes reads "Saved" with a green check and can't be clicked. A changed or never-saved request reads "Save" with the tab's blue unsaved dot. Undo your edits back to what is saved and the request counts as unchanged again.
- **Send and Cancel.** Send shows its shortcut (⌘↵) inside the button. While a request is out, Cancel shows a spinner and its shortcut (⌘.), and keeps Send's width, so Save never shifts.

### Fixed

- History search now matches what each row shows. It used to look only at the URL, so a gRPC call such as `AuthService/Login` could not be found by its service or method name. It now also checks the method label (`gRPC`, `POST`) and the gRPC `service/method`. A search that matches nothing says "No matches" instead of "No requests yet".

## [0.1.8] - 2026-11-25

### Added

- **OpenAPI export.** Export… on a collection now offers OpenAPI 3.0 (3.0.3), written as YAML or JSON by the app itself, with nothing else to install. Each folder path becomes a tag (`Billing / Invoices`); requests at the top of the collection get none. `:id` and `{{customerId}}` in a path become path parameters. Params, headers and cookies become parameters, with enabled rows marked required; `Accept`, `Content-Type` and `Authorization` are left to the body, the responses and the security scheme. Bodies get a schema read from their JSON, and auth becomes a security scheme without its values. Saved examples become responses by status code. The address in front of each path (such as `{{baseUrl}}`) becomes a server, one for each chosen environment it resolves in. With Variable values set to Blank, credentials are emptied but addresses are kept, since a server needs its URL. Requests that share a method and path are written as one operation with named examples, and GraphQL requests become POST operations. gRPC, WebSocket, Socket.IO, Kafka, MQTT and Pub/Sub requests, requests with a method OpenAPI has no place for (such as `PROPFIND`), and scripts are left out.
- **Path variables.** A `:name` segment in an HTTP or GraphQL URL path (`/realms/:realm/token`) gets a row under Path variables in the Params tab, where you fill in its value; `{{variables}}` work there. The value goes into the URL when the request is sent, in Copy as cURL, in HAR export and in the GraphQL schema fetch. In the address bar, a path variable with no value is underlined in red like an unknown `{{variable}}`, and its tooltip has a Set in Params link; one with a value shows the value. Pasting a cURL command with `:name` segments fills in the rows. Postman collections bring their path variable values in and take them out again, and `.voidhttp.json` files keep them (Blank empties the secret-looking ones). OpenAPI path parameters that fill a whole segment import as path variables.
- **Faker variables.** Postman's `{{$random…}}` set works in requests and in scripts (`pm.variables.replaceIn`): `{{$randomFirstName}}`, `{{$randomLastName}}`, `{{$randomEmail}}`, `{{$randomPhoneNumber}}`, `{{$randomCity}}`, `{{$randomCompanyName}}`, `{{$randomDatePast}}`, `{{$randomLoremSentence}}` and 105 more, each a new value on every send. Values are English only. faker loads the first time one of these names is used, so the app starts no slower and scripts that don't use them run as before. A few values differ from Postman's: the category images (`$randomCatsImage` and the like) are loremflickr links, and `$randomImageUrl`, `$randomAvatarImage` and `$randomPhoneNumber` follow current faker's formats.
- **Tab menu and pinned tabs.** Right-click a request tab for Pin tab (Unpin tab on a pinned one), Close tab, Close other tabs, Close tabs to the right and Close tabs to the left. Pinned tabs sit at the left of the tab strip and stay there while the other tabs scroll; ⌘W, middle-click and the bulk closes leave them open, and clicking a pinned tab's pin unpins it. Closing two or more tabs at once shows a toast with Undo. A pinned tab reopened with ⇧⌘T comes back pinned. Pins are kept with the session.
- **XML and HTML highlighting.** XML request bodies are coloured as you type, and XML or HTML responses are coloured in Pretty (Raw shows them as sent).

### Changed

- **Redesigned dialogs.** New collection, New folder, Save request, New and Edit project, Variables, Settings, Clear history and every delete confirmation share one new frame: a header with a tinted icon (the project's own tile in the project dialogs), the title, one line saying what the dialog is about, and a close button; the main button names the action. New collection and New folder say where the item goes, show it in a small tree as you type, and refuse a name already used there, ignoring case (a collection in the project, a folder beside it). Confirmations (deletes and Clear history) use a solid red button. Settings has no Done button; close it with the close button, Escape or a click outside.
- **Dialogs open and close smoothly.** Every dialog (the ones above, Import, Export, Save as example and About) fades in over a lightly blurred backdrop and rises into place; on close it fades and sinks instead of vanishing, however it was closed. Quick open and Actions (⌘P, ⇧⌘P) open and close the same way; switching between them keeps the box in place. With the system's Reduce motion setting on, both are instant.
- The layout switch moved from the tab bar into the response bar, at its far right. It is a two-button switch (response below, response on the right) with the current layout highlighted, so it no longer reads as splitting the window. It shows for every protocol and state, including while sending and after an error. ⌘K and the Actions list (⇧⌘P) toggle it too.
- Request tabs are at most 200px wide. When the strip is crowded, every unpinned tab shrinks down to 120px and long names end in "…", with the full name and URL in the tooltip; pinned tabs keep their width, up to 160px. The strip no longer shows a scrollbar, and a mouse wheel scrolls it sideways.
- OpenAPI import: a path parameter that fills a whole segment (`/users/{id}`) now becomes a path variable with its value in the Params tab, instead of a `{{id}}` collection variable.

## [0.1.7] - 2026-11-19

### Added

- **Google Cloud Pub/Sub.** Pick Pub/Sub in the method menu, enter the project ID and a topic, and Connect; one connection publishes and reads. Sign in with a service account key file, Application Default Credentials, a pasted access token or the local emulator; key and ADC can act as another service account (impersonation). The project, topic and subscription fields can be typed or picked from a list (your key or ADC file's project, your gcloud config project, Cloud Resource Manager, the project's topics and subscriptions). The Read tab chooses how messages are read, because Pub/Sub subscribers compete for them: Temporary (voidHTTP's own subscription, deleted on Disconnect, the default), Peek (pull on demand and hand every message straight back), Consume (read and ack, with a warning) or Publish only. Publish Text or JSON data with an ordering key and attributes; the message ID shows under each publish. Received messages show their message ID, ordering key, attributes, publish time and delivery attempt. The Topic tab shows retention, schema, encryption, labels and every subscription on the topic. Settings has a regional endpoint, the ack deadline and how many messages the list keeps. A refused key, a missing topic and an account that may not make the temporary subscription each get their own explanation. Settings > Network and Settings > Certificates apply.
- **MQTT.** Pick MQTT in the method menu, enter the broker URL and Connect: `mqtt://` over TCP, `mqtts://` over TLS, `ws://` and `wss://` over WebSocket (the path defaults to `/mqtt`), MQTT 5.0 or 3.1.1. One connection subscribes and publishes. The Topics tab lists topic filters, each with a QoS and an on/off switch; while connected, a change subscribes or unsubscribes at once, and each row shows what the broker granted or why it said no. MQTT 5 rows also take No local, Retain as published and how retained messages are sent. Publish a Text or JSON payload at QoS 0, 1 or 2, retained or not, with MQTT 5 properties (content type, payload format, response topic, correlation data, message expiry, user properties); the broker's PUBACK, or PUBREC → PUBCOMP, shows under each publish. Received messages show their topic, QoS, a retained tag and their properties; filter the list by topic or text, pause it, and copy messages as JSON. The Connection tab shows what was sent in CONNECT and the broker's CONNACK limits. Last Will (with an MQTT 5 delay), client ID (random when empty), clean start, session expiry and keep alive are under their own tabs. A refused login, the wrong MQTT version, a TLS or WebSocket mismatch, and a session taken over by another client with the same ID each get their own explanation. Settings > Network and Settings > Certificates apply, so mutual TLS (AWS IoT Core) works.
- **Kafka.** Pick Kafka in the method menu, enter the bootstrap brokers and a topic, and Connect. voidHTTP reads every partition straight from its leader without a consumer group and never commits offsets, so services reading the same topic keep every record. Start from the latest or earliest record, the last 100 per partition, a time, or one partition at an offset, and change it from the list's From menu. Produce records with a key (String, JSON, Base64 or Hex), headers and a Text or JSON value, to a partition picked from the key (murmur2, as the Java client does) or one you choose; the partition and offset the broker stored each record at show under it. Settings has acks, compression (gzip, lz4, snappy, zstd), the client ID and how many records the list keeps. Filter the list by partition or text, pause it, and copy records as JSON. The Topic tab shows the brokers, the controller and each partition's leader, replicas, in-sync replicas and offsets. Auth supports SASL PLAIN, SCRAM-SHA-256 and SCRAM-SHA-512 and TLS; Settings > Network and Settings > Certificates apply to every broker. A refused login, a missing topic and a broker advertising an unreachable address each get their own explanation.
- **Table view for JSON responses.** REST, GraphQL and gRPC unary responses get a third view beside Pretty and Raw. The rows come from the biggest array in the body; the path next to the switch shows where they come from, and its menu lists every other array or object, including `$.data[*].items` (that list from every row in one table, with a column saying which row each one came from). Columns are every key, in order; numbers line up right, `null` is spelled out and a missing key stays blank. Click a column to sort it. A nested object or array shows as a chip (`{3}`, `[2]`) that opens it as a table under its row, as deep as it goes, or on its own with Open as table. Search keeps only the matching rows, a `$.path` filter shows its result as a table, and Copy gives tab-separated text that pastes into a spreadsheet. The choice is remembered. Live message lists (gRPC streams, WebSocket, Socket.IO, Kafka, MQTT, Pub/Sub) stay lists.
- **Quick open (⌘P).** Fuzzy-search the requests, examples and open tabs of the current project by name, folder or URL, then press Enter to open one. A method typed as a word (`post login`) filters by method. With nothing typed it lists the open tabs and the requests you sent lately.
- **Actions (⇧⌘P, or `>` in quick open).** Send, cancel, save as, reopen a closed tab, show or hide the sidebar, zoom, switch theme or layout, import, settings and more, each shown with its shortcut.
- **Settings > Shortcuts** lists every keyboard shortcut, with a search box. ⌘/ opens it (inside a code editor ⌘/ still comments lines). Shortcuts can't be changed.
- **More shortcuts:** ⌘. cancel the request, ⇧⌘S save as, ⌘L jump to the URL, ⇧⌘T reopen the last closed tab, ⇧⌘] / ⇧⌘[ and ⌃Tab / ⌃⇧Tab next and previous tab, ⌘1–⌘8 go to a tab and ⌘9 to the last, ⇧⌘F search the sidebar, ⌥E switch environment, ⌘O import, ⌘+ / ⌘− / ⌘0 zoom (remembered between launches).
- **Sidebar keyboard:** ↑ / ↓ move between items (↓ from the search box enters the list), Enter opens, → / ← expand or collapse (⌥ for all), F2 renames, ⌘D duplicates and ⌘⌫ deletes the focused item.
- **Dev build tag.** `bun tauri dev` and `bun tauri build --debug` show an amber `DEV <commit>` pill left of the Settings gear (a `+` after the commit means uncommitted changes). About and Settings > Updates show the branch and `git describe` version, and update checks are off, so a dev build is never mistaken for, or replaced by, the release from GitHub. Release builds look as before.

### Changed

- Home lists project cards in the order the projects were made, so a card no longer moves each time its project is opened.
- Icons come from Lucide 1.x. A few look slightly different.

### Fixed

- `{{variables}}` in a saved example now take their values from the example's collection. Before, the address bar marked them as missing and they were not filled in.
- Opened messages in WebSocket, Socket.IO, Kafka, MQTT and gRPC stream lists now keep a gap between the text and the line on their left.

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

[0.1.9]: https://github.com/jimmyfish/voidhttp/compare/v0.1.8...HEAD
[0.1.8]: https://github.com/jimmyfish/voidhttp/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/jimmyfish/voidhttp/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/jimmyfish/voidhttp/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/jimmyfish/voidhttp/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/jimmyfish/voidhttp/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/jimmyfish/voidhttp/releases/tag/v0.1.3
