# Graph Report - voidHTTP  (2026-11-18)

## Corpus Check
- 185 files · ~254,970 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2687 nodes · 6866 edges · 125 communities (100 shown, 25 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 224 edges (avg confidence: 0.85)
- Token cost: 1,583,186 input · 0 output

## Community Hubs (Navigation)
- TLS Certificates & Keychain
- Store Types & Kafka Client
- MQTT Packet Codec
- gRPC Request Pane
- Network Transport Layer
- Socket.IO Engine
- Env Menu & Modals
- GraphQL Pane & Schema
- Script Runtime (Rust)
- Quick Open & Shortcuts
- Transfer/Shortcuts/Certs Previews
- Updater & About Modal
- Kafka Protocol Calls
- HTTP Client Engine
- Connection Pane Controls
- MQTT Tests
- Package Dependencies
- Code Editor & MQTT Pane
- Release Workflow
- HTTP Lib & Variables
- App Store Actions
- MQTT Subscriptions
- App Shell & Themes
- Response Pane & Runs
- File Storage (Rust)
- Format Common & Masking
- Import Detection & OpenAPI
- MQTT Command Loop
- README Icons & Prelude
- WebSocket Engine
- Certificates Pane
- WebSocket Response View
- MQTT Connection Run
- About & Build Previews
- gRPC Metadata & Reflection
- App Icon & Window SVGs
- Example Modal
- Sidebar Tree Actions
- Kafka Response View
- HAR Format
- Postman Format
- WebSocket Commands
- gRPC Response View
- MQTT Events & Acks
- Kafka Events & Errors
- Cache Workflow
- Import Modal
- Tauri Config
- Drop Import & Export
- MQTT Response View
- JSONPath Parser
- Kafka Metadata & SASL
- Agent & Contribution Docs
- Changelog Releases
- Quick Open Features Docs
- gRPC Dynamic Calls
- Code of Conduct & Security
- Kafka/WS/SIO Previews
- gRPC Proto Compile
- Lucide README Icons
- JSONPath Evaluator
- cURL Import
- Native Format
- TypeScript Config
- Feature Docs (README)
- Request Scripts (TS)
- Bug Report Template
- Feature Request Template
- Home & Lucide Icons
- gRPC Codec
- Command Import
- Kafka Commands
- PR Checklist
- gRPC Previews
- Enforcement Ladder
- Variable Formats
- GraphQL Previews
- Base Preview Shell
- Scripts Preview
- Syntax Highlighting
- Kafka Connect & Seek
- System Fonts
- Repo Doc Files
- gRPC Errors
- Kafka Fetch Jobs
- gRPC Proto Files
- gRPC Call State
- Kafka Preview
- Issue Template Config
- Tauri Capabilities
- App Icon 128 & 150
- PR Template
- Request Metadata
- Design Language
- Example Management
- Example Save
- Icon 310
- Agent Instructions
- Public App Icon
- Icon 128@2x
- Icon Master PNG
- Icon 107
- Icon 142
- Icon 284
- Icon 30
- Icon 44
- Icon 71
- Error Descriptions
- Apidog Reference
- History & Masking Docs
- Tree Drag & Drop
- Project Data
- Project Meta
- Icon 32
- Icon 64
- Icon 89
- Store Logo
- WS Conn Guard
- App Icon SVG
- Cargo Crate
- Themes & Fonts Docs
- Wishlist

## God Nodes (most connected - your core abstractions)
1. `useStore` - 89 edges
2. `State` - 64 edges
3. `RequestPane()` - 47 edges
4. `react` - 45 edges
5. `uid()` - 41 edges
6. `request()` - 40 edges
7. `start()` - 37 edges
8. `stripJsonComments()` - 33 edges
9. `accept()` - 31 edges
10. `ico` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Sending an HTTP request` --references--> `prepare()`  [INFERRED]
  docs/ARCHITECTURE.md → src/lib/http.ts
- `<img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones)` --references--> `get()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `<img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones)` --references--> `remove()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `<img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones)` --references--> `upsert()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `Requests Run in Rust (reqwest + rustls)` --semantically_similar_to--> `Two halves`  [INFERRED] [semantically similar]
  README.md → docs/ARCHITECTURE.md

## Import Cycles
- 1-file cycle: `src-tauri/src/files.rs -> src-tauri/src/files.rs`
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Hyperedges (group relationships)
- **Live-connection protocol engines sharing per-tab task + IPC Channel model** — docs_architecture_live_connections, docs_architecture_kafka_engine, docs_architecture_mqtt_engine, docs_architecture_grpc_engine, docs_architecture_sio_engine, readme_websocket [EXTRACTED 1.00]
- **Shared network/TLS layer applied to every request kind** — docs_architecture_net_module, docs_architecture_certs_module, readme_network_settings, readme_certificate_settings, docs_architecture_http_request_flow [INFERRED 0.85]
- **Untrusted-import and secret-protection defenses** — readme_untrusted_imports, readme_secret_blanking, readme_quickjs_sandbox, docs_architecture_import_export_pipeline, security_in_scope, readme_masking [INFERRED 0.85]
- **Protocol request kinds sharing the method menu** — _hallmark_preview_index_method_menu, _hallmark_preview_grpc_grpc_request_line, _hallmark_preview_websocket_connect_disconnect_lifecycle, _hallmark_preview_graphql_graphql_request, _hallmark_preview_socketio_namespace_field, _hallmark_preview_kafka_kafka_request_line [INFERRED 0.85]
- **Connect, live stream, ack and close pattern** — _hallmark_preview_websocket_connect_disconnect_lifecycle, _hallmark_preview_websocket_message_stream, _hallmark_preview_socketio_emit_with_ack, _hallmark_preview_kafka_produce_record [INFERRED 0.85]
- **Preview tokenizers that port into src/lib/highlight.ts** — _hallmark_preview_grpc_json_line_tokenizer, _hallmark_preview_scripts_js_line_tokenizer, _hallmark_preview_graphql_gql_line_tokenizer [INFERRED 0.85]
- **In-app update flow surfaces (chip, popover, Settings pane, About cards)** — _hallmark_preview_updates_update_chip, _hallmark_preview_updates_update_popover, _hallmark_preview_updates_settings_updates_pane, _hallmark_preview_about_update_state_cards [INFERRED 0.85]
- **MQTT session lifecycle (connect, subscribe, publish/ack, will, takeover)** — _hallmark_preview_mqtt_connect_connack_view, _hallmark_preview_mqtt_topic_subscriptions, _hallmark_preview_mqtt_message_stream, _hallmark_preview_mqtt_last_will, _hallmark_preview_mqtt_session_taken_over [EXTRACTED 1.00]
- **Build channel awareness (DEV tag, About build card, updates off in dev)** — _hallmark_preview_build_build_tag, _hallmark_preview_build_about_build_card, _hallmark_preview_build_dev_updates_disabled [EXTRACTED 1.00]
- **voidHTTP import/export interchange formats** — _hallmark_preview_transfer_postman_collection_format, _hallmark_preview_transfer_openapi_swagger_format, _hallmark_preview_transfer_har_format, _hallmark_preview_transfer_voidhttp_native_format [EXTRACTED 1.00]
- **Settings dialog panes previewed (Network, Certificates, Shortcuts)** — _hallmark_preview_shortcuts_settings_dialog, _hallmark_preview_shortcuts_shortcuts_pane, _hallmark_preview_network, _hallmark_preview_certificates [INFERRED 0.85]
- **Request reachability path: DNS -> proxy -> TLS trust** — _hallmark_preview_network_secure_dns, _hallmark_preview_network_proxy, _hallmark_preview_network_connection_check, _hallmark_preview_certificates_ca_trust, _hallmark_preview_certificates_client_certs_mtls [INFERRED 0.75]
- **Docs feature icons (Lucide, ISC, #3d74ec stroke)** — docs_assets_icons_arrow_right_left_icon, docs_assets_icons_ban_icon, docs_assets_icons_check_icon, docs_assets_icons_circle_help_icon, docs_assets_icons_code_xml_icon, docs_assets_icons_database_icon, docs_assets_icons_download_icon, docs_assets_icons_feather_icon, docs_assets_icons_flask_conical_icon, docs_assets_icons_folder_tree_icon, docs_assets_icons_globe_icon, docs_assets_icons_hard_drive_icon, docs_assets_icons_history_icon, docs_assets_icons_keyboard_icon, docs_assets_icons_lightbulb_icon [INFERRED 0.95]
- **Request/response workflow shown in window illustration** — docs_assets_voidhttp_window_collections_sidebar, docs_assets_voidhttp_window_request_tabs, docs_assets_voidhttp_window_environment_selector, docs_assets_voidhttp_window_url_bar_variables, docs_assets_voidhttp_window_request_editor, docs_assets_voidhttp_window_response_viewer [INFERRED 0.85]
- **README protocol section icons (GraphQL, gRPC, WebSocket, Socket.IO, Kafka, MQTT)** — docs_assets_icons_waypoints_icon, docs_assets_icons_network_icon, docs_assets_icons_plug_zap_icon, docs_assets_icons_messages_square_icon, docs_assets_icons_radio_tower_icon, docs_assets_icons_router_icon [INFERRED 0.85]

## Communities (125 total, 25 thin omitted)

### Community 0 - "TLS Certificates & Keychain"
Cohesion: 0.05
Nodes (54): a_dev_ca_and_a_client_certificate_reach_a_mutual_tls_server(), a_pfx_opens_with_its_passphrase_only(), a_private_key_is_not_taken_for_a_ca(), added_cert_fits(), AddedCertVerifier, an_openssl_self_signed_server_certificate_is_trusted_once_added(), ca_file_info_names_the_certificate(), CertConfig (+46 more)

### Community 1 - "Store Types & Kafka Client"
Cohesion: 0.04
Nodes (76): RFC-6455, capEnvironments(), ParsedGrpcurl, b64(), connectKafka(), defaultKafka(), kafkaClose(), KafkaEvent (+68 more)

### Community 2 - "MQTT Packet Codec"
Cohesion: 0.06
Nodes (57): Ack, bad(), broken_packets_are_errors(), connack_reason(), Connect, connect_bytes_match_the_spec(), decode(), Disconnect (+49 more)

### Community 3 - "gRPC Request Pane"
Cohesion: 0.05
Nodes (52): @tauri-apps/plugin-dialog, GrpcRequestPane(), MethodPicker(), SchemaEditor(), Section, time(), Props, Row (+44 more)

### Community 4 - "Network Transport Layer"
Cohesion: 0.06
Nodes (32): ALWAYS_DIRECT, bootstrap(), connect_any(), custom_group(), doh_resolver(), http_connect(), http_connect_tunnel(), lists_cover_subdomains() (+24 more)

### Community 5 - "Socket.IO Engine"
Cohesion: 0.07
Nodes (42): ACK, BINARY_ACK, BINARY_EVENT, Cmd, Close, Emit, collect(), CONNECT (+34 more)

### Community 6 - "Env Menu & Modals"
Cohesion: 0.08
Nodes (46): ClientRow(), EnvMenu(), CODE_SIZES, EnvColor(), EnvItem(), FontRow(), Modals(), MONO_FONTS (+38 more)

### Community 7 - "GraphQL Pane & Schema"
Cohesion: 0.08
Nodes (48): Args(), DocsBrowser(), fieldCount(), FieldRow(), KIND_LABEL, kindLabel(), OPEN_GQL_LINE, OpenGqlLine (+40 more)

### Community 8 - "Script Runtime (Rust)"
Cohesion: 0.07
Nodes (30): ABOUT, build(), CHECK_UPDATES, CLOSE_TAB, CLOSE_WINDOW, on_event(), async_tests_settle(), chai_edges() (+22 more)

### Community 9 - "Quick Open & Shortcuts"
Cohesion: 0.06
Nodes (21): ExIcon(), Fields, fuzzy(), Item, Marked(), Method(), METHOD_WORDS, pathOf() (+13 more)

### Community 10 - "Transfer/Shortcuts/Certs Previews"
Cohesion: 0.06
Nodes (44): Certificates design preview (certificates.html), Add client certificate form (CRT + KEY or PFX/P12), Trust custom CA certificates (.pem, on top of public CAs), CA file validation (private key rejected, expiry warning), Client certificates for mutual TLS (matched by host:port, wildcard hosts), Certificates screen router (data-screen + URL hash), Skip TLS verification notice (from Requests settings), Network settings design preview (network.html) (+36 more)

### Community 11 - "Updater & About Modal"
Cohesion: 0.09
Nodes (30): @tauri-apps/plugin-opener, DEV_BUILD, DevBuild, AboutModal(), BuildCard(), Line(), Notes(), UpdateCard() (+22 more)

### Community 12 - "Kafka Protocol Calls"
Cohesion: 0.05
Nodes (15): broker_lists(), DEFAULT_TIMEOUT, FETCH_BYTES, FETCH_WAIT_MS, Io, MAX_FAILS, MAX_FRAME, murmur2() (+7 more)

### Community 13 - "HTTP Client Engine"
Cohesion: 0.07
Nodes (21): build_multipart(), cancel_request(), ClientKey, execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState (+13 more)

### Community 14 - "Connection Pane Controls"
Cohesion: 0.12
Nodes (33): react, Props, RenameField(), renameTab(), TitleName(), AuthEditor(), KafkaRequestPane(), KeyTypePicker() (+25 more)

### Community 15 - "MQTT Tests"
Cohesion: 0.18
Nodes (35): a_late_refusal_doesnt_forget_a_newer_subscribe(), a_refused_unsubscribe_is_reported_and_tried_again(), accept(), assigned_client_id_wins(), auth_from_the_broker_is_a_protocol_error(), Broker, broker_hangs_up(), broker_takes_the_session_over() (+27 more)

### Community 16 - "Package Dependencies"
Cohesion: 0.06
Nodes (39): dependencies, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2, @tauri-apps/plugin-updater@^2 (+31 more)

### Community 17 - "Code Editor & MQTT Pane"
Cohesion: 0.13
Nodes (37): CodeArea(), Props, GqlQueryEditor(), resolveForCheck(), MessageEditor(), RecordEditor(), KVEditor(), AuthEditor() (+29 more)

### Community 18 - "Release Workflow"
Cohesion: 0.05
Nodes (40): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+32 more)

### Community 19 - "HTTP Lib & Variables"
Cohesion: 0.08
Nodes (37): fetchText(), gqlAsHttp(), base64Utf8(), cancel(), CONTENT_TYPES, prepare(), Prepared, WireBody (+29 more)

### Community 21 - "MQTT Subscriptions"
Cohesion: 0.09
Nodes (25): Subs, ConnInfo, DEFAULT_TIMEOUT, Io, MAX_IN, mqtt_close(), mqtt_connect(), mqtt_publish() (+17 more)

### Community 22 - "App Shell & Themes"
Cohesion: 0.11
Nodes (32): App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTheme(), useTypeTokens(), BuildTag(), Mark() (+24 more)

### Community 23 - "Response Pane & Runs"
Cohesion: 0.12
Nodes (29): Failed(), KafkaResponsePane(), Failed(), MqttResponsePane(), when(), ConsoleList(), ConsoleView(), GqlErrorList() (+21 more)

### Community 24 - "File Storage (Rust)"
Cohesion: 0.11
Nodes (26): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_ref_file(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file() (+18 more)

### Community 25 - "Format Common & Masking"
Cohesion: 0.15
Nodes (35): addressLike(), basicKept(), blankHarEnv(), blankKv(), blankSecretJson(), blankSecretKv(), blankSecretXml(), blankValues() (+27 more)

### Community 26 - "Import Detection & OpenAPI"
Cohesion: 0.10
Nodes (31): Any, detect(), parseDoc(), Source, HarFile, Analysis, Build, buildAuth() (+23 more)

### Community 27 - "MQTT Command Loop"
Cohesion: 0.13
Nodes (20): random_client_id(), a_broker_that_stops_reading_ends_the_session(), Client, live(), live_broker(), live_denied_and_bad_port(), live_last_will(), live_password() (+12 more)

### Community 28 - "README Icons & Prelude"
Cohesion: 0.07
Nodes (22): <img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones), <img src="docs/assets/icons/folder-tree.svg" width="20" height="20" align="top" alt="" /> Projects, tabs, the whole workspace, <img src="docs/assets/icons/globe.svg" width="20" height="20" align="top" alt="" /> HTTP, done properly, <img src="docs/assets/icons/history.svg" width="20" height="20" align="top" alt="" /> History and examples, <img src="docs/assets/icons/messages-square.svg" width="20" height="20" align="top" alt="" /> Socket.IO, <img src="docs/assets/icons/network.svg" width="20" height="20" align="top" alt="" /> gRPC, <img src="docs/assets/icons/package.svg" width="20" height="20" align="top" alt="" /> Import and export, <img src="docs/assets/icons/palette.svg" width="20" height="20" align="top" alt="" /> Make it yours (+14 more)

### Community 29 - "WebSocket Engine"
Cohesion: 0.10
Nodes (17): bad_header_is_an_error(), build_request(), CLOSE_GRACE, echo_and_close(), Handshake, handshake_headers_are_kept_and_extras_added(), header_list(), is_handshake_header() (+9 more)

### Community 30 - "Certificates Pane"
Cohesion: 0.12
Nodes (25): CaRow(), CERT_FILES, CertificatesPane(), ClientForm(), FilePick(), KEY_FILES, PFX_FILES, pickOne() (+17 more)

### Community 31 - "WebSocket Response View"
Cohesion: 0.10
Nodes (26): AckWait(), closeLabel(), CloseRow(), duration(), EventFilter(), Handshake(), MessageList(), MessageRow() (+18 more)

### Community 32 - "MQTT Connection Run"
Cohesion: 0.13
Nodes (19): Cmd, Close, Publish, conn_info(), connect_and_run(), Failure, Handshake, handshake() (+11 more)

### Community 33 - "About & Build Previews"
Cohesion: 0.10
Nodes (27): voidHTTP About dialog design preview, About voidHTTP dialog (replaces native macOS About panel), License card: Apache-2.0 + Commons Clause, About update state cards (current, checking, available, long changelog, downloading, installing, ready, failed), voidHTTP build tag design preview, About dialog GET /build card (dev channel), Address bar {{var}} / :param token painter with hover tip, DEV build channel tag (title strip pill) (+19 more)

### Community 34 - "gRPC Metadata & Reflection"
Cohesion: 0.09
Nodes (13): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+5 more)

### Community 35 - "App Icon & Window SVGs"
Cohesion: 0.09
Nodes (28): Void / Black-Hole Brand Motif, voidHTTP App Icon (blue tile, void rings, white slash), Lucide arrow-right-left icon, Lucide ban icon, Lucide check icon, Lucide circle-help icon, Lucide code-xml icon, Lucide database icon (+20 more)

### Community 36 - "Example Modal"
Cohesion: 0.14
Nodes (27): allRequests(), ExampleModal(), key(), statusName(), applyMasks(), COOKIE_ATTRS, COOKIE_FLAGS, findSensitive() (+19 more)

### Community 37 - "Sidebar Tree Actions"
Cohesion: 0.11
Nodes (20): CollectionView(), containerIds(), DragCtx, DragItem, Drop, dropTarget(), ExampleRow(), focusRow() (+12 more)

### Community 38 - "Kafka Response View"
Cohesion: 0.15
Nodes (27): AckRow(), ACKS, duration(), FAILED, keyText(), num(), parseMaybe(), PartitionFilter() (+19 more)

### Community 39 - "HAR Format"
Cohesion: 0.10
Nodes (26): Found, harBody(), harHeaders(), HarOptions, harPlan(), harResponse(), HarRow, harToCollection() (+18 more)

### Community 40 - "Postman Format"
Cohesion: 0.19
Nodes (27): dropFilePaths(), str(), analyze(), convertAuth(), convertBody(), convertExamples(), convertItems(), count() (+19 more)

### Community 41 - "WebSocket Commands"
Cohesion: 0.11
Nodes (16): Cmd, Close, Send, ConnGuard, Conns, Conns<C>, run(), ws_close() (+8 more)

### Community 42 - "gRPC Response View"
Cohesion: 0.14
Nodes (20): duration(), EndRow(), GrpcResponsePane(), MessageList(), MessageRow(), pretty(), SaveExampleButton(), seconds() (+12 more)

### Community 43 - "MQTT Events & Acks"
Cohesion: 0.20
Nodes (10): ack_event(), Emit, End, Client, Lost, Server, Outgoing, Publish (+2 more)

### Community 44 - "Kafka Events & Errors"
Cohesion: 0.13
Nodes (15): ack_event(), chrono_now_ms(), Header, KafkaEvent, Close, Connected, Failed, Message (+7 more)

### Community 45 - "Cache Workflow"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 46 - "Import Modal"
Cohesion: 0.18
Nodes (23): Check3(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal(), isUrl() (+15 more)

### Community 47 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 48 - "Drop Import & Export"
Cohesion: 0.16
Nodes (20): @tauri-apps/api, DropImport(), Envs, ExportModal(), Format, FORMATS, plural(), baseName() (+12 more)

### Community 49 - "MQTT Response View"
Cohesion: 0.15
Nodes (21): AckRow(), CloseRow(), ConnectionView(), duration(), FAILED, hex(), MessageList(), num() (+13 more)

### Community 51 - "Kafka Metadata & SASL"
Cohesion: 0.21
Nodes (10): Broker, Cluster, Conn, Failure, hint_for(), Leader, open(), Opts (+2 more)

### Community 52 - "Agent & Contribution Docs"
Cohesion: 0.10
Nodes (17): Graph Update Hooks (PostToolUse + post-commit), AI Agents Guidance (read AGENTS.md, run graphify update), Conventional Commits Policy, Contributing Guide, Principles, Architecture, Import and export, Network and TLS (+9 more)

### Community 53 - "Changelog Releases"
Cohesion: 0.10
Nodes (22): [0.1.3] - 2026-11-13, [0.1.4] - 2026-11-13, [0.1.5] - 2026-11-13, [0.1.6] - 2026-11-16, Added, Added, Added, Changed (+14 more)

### Community 54 - "Quick Open Features Docs"
Cohesion: 0.11
Nodes (22): Actions Palette (Shift+Cmd+P), Added, Fixed, Quick Open (Cmd+P fuzzy search), [Unreleased], certs.rs (single rustls ClientConfig, custom CAs, mTLS), grpc.rs Engine (reflection v1/v1alpha, protox, prost-reflect), HTTP Request Flow (prepare, send_request, show and keep) (+14 more)

### Community 55 - "gRPC Dynamic Calls"
Cohesion: 0.17
Nodes (15): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+7 more)

### Community 56 - "Code of Conduct & Security"
Cohesion: 0.11
Nodes (18): Contributor Covenant Code of Conduct v2.1, Community Impact Enforcement Ladder (Correction, Warning, Temporary Ban, Permanent Ban), Ad-hoc Signing and Gatekeeper Workaround, <img src="docs/assets/icons/ban.svg" width="24" height="24" align="top" alt="" /> Never on the wishlist, <img src="docs/assets/icons/circle-help.svg" width="24" height="24" align="top" alt="" /> Why another API client?, <img src="docs/assets/icons/code-xml.svg" width="24" height="24" align="top" alt="" /> Hack on it, <img src="docs/assets/icons/database.svg" width="24" height="24" align="top" alt="" /> Where's my data?, <img src="docs/assets/icons/download.svg" width="24" height="24" align="top" alt="" /> Get it (+10 more)

### Community 57 - "Kafka/WS/SIO Previews"
Cohesion: 0.13
Nodes (19): Kafka Advertised Listener Error, Kafka Produce Record (key, partition, value), Preview Screen Switcher (data-screen), Kafka Topic Partition View, Socket.IO Emit with Ack, Engine.IO Handshake View, Socket.IO Event Name Filter, Socket.IO Namespace connect_error (+11 more)

### Community 58 - "gRPC Proto Compile"
Cohesion: 0.22
Nodes (16): address_gets_scheme_and_port(), cached_pool(), compile_protos(), connect(), describe(), grpc_describe(), load_pool(), parse_address() (+8 more)

### Community 59 - "Lucide README Icons"
Cohesion: 0.12
Nodes (18): Lucide Icon Set (ISC license, stroke #3d74ec, 24x24), Map Icon (folded map, README 'Where things live' project layout), Messages-Square Icon (two speech bubbles, README Socket.IO section), Network Icon (hierarchy of three nodes, README gRPC section), Package Icon (3D box, README Import and export section), Palette Icon (paint palette, README Make it yours theming section), Paperclip Icon (attachment clip, README License keep LICENSE/NOTICE), Plug-Zap Icon (plug with lightning bolt, README WebSocket section) (+10 more)

### Community 60 - "JSONPath Evaluator"
Cohesion: 0.20
Nodes (17): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+9 more)

### Community 61 - "cURL Import"
Cohesion: 0.18
Nodes (16): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+8 more)

### Community 62 - "Native Format"
Cohesion: 0.27
Nodes (16): importNative(), NATIVE_VERSION, num(), pairs(), rows(), sane(), saneAuth(), saneGql() (+8 more)

### Community 63 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 64 - "Feature Docs (README)"
Cohesion: 0.17
Nodes (14): 0.1.6 (WebSocket, Socket.IO, GraphQL, Network, Certificates, Scripts, License), Import/Export Pipeline (src/lib/formats, common.ts checks, files.rs), GraphQL Support, HTTP Requests (methods, auth, bodies, responses), Import and Export Formats (voidHTTP, Postman, OpenAPI, HAR, cURL/grpcurl), Large Response Guard (512 KB highlight, 4 MB truncate), Apache 2.0 + Commons Clause License, Moonbase Demo API (docs/examples/moonbase-api.yaml) (+6 more)

### Community 65 - "Request Scripts (TS)"
Cohesion: 0.15
Nodes (14): applyVarOps(), hasScript(), OPEN_SCRIPT, OpenScript, runScript(), ScriptOutput, SNIPPETS, TEXT_BODY (+6 more)

### Community 66 - "Bug Report Template"
Cohesion: 0.13
Nodes (14): description, label, options, placeholder, value, body, attributes, id (+6 more)

### Community 67 - "Feature Request Template"
Cohesion: 0.13
Nodes (14): description, label, options, value, body, attributes, id, type (+6 more)

### Community 68 - "Home & Lucide Icons"
Cohesion: 0.23
Nodes (10): lucide-react@^1.75.0, lucide-react, greeting(), Home(), pathOf(), ico, icoLg, entryStatus() (+2 more)

### Community 69 - "gRPC Codec"
Cohesion: 0.18
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 70 - "Command Import"
Cohesion: 0.21
Nodes (10): commandsSummary(), importCommands(), nameOf(), splitCommands(), ImportPlan, Note, NativeFile, TagColor (+2 more)

### Community 71 - "Kafka Commands"
Cohesion: 0.29
Nodes (13): Cmd, Close, Pause, Produce, Refresh, Seek, kafka_close(), kafka_pause() (+5 more)

### Community 72 - "PR Checklist"
Cohesion: 0.17
Nodes (12): PR Checklist (typecheck, cargo test, docs, no secrets), Pull Request Template, AI agents, Before you start, Checks, Code style, Commits and pull requests, Contributing to voidHTTP (+4 more)

### Community 73 - "gRPC Previews"
Cohesion: 0.17
Nodes (12): GraphQL Line Tokenizer, Copy as grpcurl, gRPC Request Message Editor (Fill example), gRPC Request Line, gRPC Response Status, Metadata and Trailers, JSON Line Tokenizer (preview script), voidHTTP gRPC Preview, RPC Method Picker (Service/Method + Unary/Stream tag) (+4 more)

### Community 74 - "Enforcement Ladder"
Cohesion: 0.17
Nodes (12): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Guidelines (+4 more)

### Community 75 - "Variable Formats"
Cohesion: 0.29
Nodes (11): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+3 more)

### Community 76 - "GraphQL Previews"
Cohesion: 0.22
Nodes (10): GraphQL Errors Panel, GraphQL Request (HTTP POST), GraphQL Operation Picker, voidHTTP GraphQL Preview, GraphQL Schema Docs Explorer, GraphQL Schema Introspection, Preview Screen Switcher (data-screen), GraphQL Variables Panel (+2 more)

### Community 77 - "Base Preview Shell"
Cohesion: 0.22
Nodes (9): Address Bar Token Highlighter, App Shell (title strip, rail, sidebar, work area), Request Body Mode Editor, Collections Sidebar Tree, Compact Density Mode, Environment Menu, Stacked / Side-by-side Layout Toggle, voidHTTP Base Restyle Preview (+1 more)

### Community 78 - "Scripts Preview"
Cohesion: 0.31
Nodes (10): Lucide Icon Sprite (v0.460.0), voidHTTP Scripts Preview, pm Scripting API (Postman-compatible), Post-response Script, Pre-request Script, Pre-request Script Failure State, Preview Screen Switcher (data-screen), Script Console (+2 more)

### Community 79 - "Syntax Highlighting"
Cohesion: 0.40
Nodes (9): esc(), GQL_KEYWORDS, highlightGraphql(), highlightJson(), highlightLines(), jsLines(), jsRuns(), KEYWORDS (+1 more)

### Community 80 - "Kafka Connect & Seek"
Cohesion: 0.22
Nodes (8): kafka_connect(), KafkaRequest, Seek, Earliest, Last, Latest, Offset, Time

### Community 81 - "System Fonts"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 83 - "gRPC Errors"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 84 - "Kafka Fetch Jobs"
Cohesion: 0.29
Nodes (5): fetch_all(), FetchJob, Step, Command, Fetched

### Community 85 - "gRPC Proto Files"
Cohesion: 0.33
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 86 - "gRPC Call State"
Cohesion: 0.38
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

### Community 87 - "Kafka Preview"
Cohesion: 0.47
Nodes (5): Kafka Client Settings (client id, read from, acks, compression, keep), voidHTTP Kafka Preview, Read-from Seek Menu, Kafka SASL Login Failure State, Kafka SASL/TLS Auth

### Community 88 - "Issue Template Config"
Cohesion: 0.33
Nodes (5): blank_issues_enabled, contact_links, about, name, url

### Community 89 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 90 - "App Icon 128 & 150"
Cohesion: 0.33
Nodes (6): voidHTTP App Icon (128x128), Blue Gradient Rounded-Square Icon Style, Tauri Bundle Icon Set, Void / Empty-Set Slash Motif, Square150x150Logo App Icon (Windows Store tile), voidHTTP Brand Mark: Void Vortex with Null Slash

### Community 91 - "PR Template"
Cohesion: 0.40
Nodes (4): Checklist, How I tested it, Screenshots, What and why

### Community 92 - "Request Metadata"
Cohesion: 0.50
Nodes (4): apply_metadata(), metadata_list(), Kv, Produce

### Community 96 - "Icon 310"
Cohesion: 0.67
Nodes (4): Square310x310Logo (voidHTTP App Icon, 310x310), Void Slash Emblem (concentric dark-blue void rings crossed by white slash), voidHTTP Brand Identity (blue gradient rounded-square app tile), Windows Store Square310x310 Tile Asset (Tauri bundle icon)

### Community 99 - "Icon 128@2x"
Cohesion: 0.67
Nodes (3): voidHTTP App Icon (128x128@2x), Blue Gradient Rounded-Square Icon Container (macOS-style squircle, soft edges), Void / Empty-Set Slash Motif (concentric dark vortex crossed by white diagonal bar)

### Community 100 - "Icon Master PNG"
Cohesion: 0.67
Nodes (3): voidHTTP App Icon (icon.png), Soft-Edge Blue Gradient Brand Style, Void / Null Glyph Motif

### Community 101 - "Icon 107"
Cohesion: 0.67
Nodes (3): Square107x107Logo (voidHTTP app icon, 107x107), voidHTTP Void Symbol Logo Mark, Windows Store Square Tile Asset

### Community 102 - "Icon 142"
Cohesion: 1.00
Nodes (3): voidHTTP App Icon (Square142x142Logo, Windows Store tile), Brand Style: blue gradient rounded-square tile (soft edges), Void Slash Logo Motif (white diagonal slash over concentric blue circles, empty-set/null symbol)

### Community 103 - "Icon 284"
Cohesion: 0.67
Nodes (3): voidHTTP App Icon (Square284x284Logo), Void Slash Brand Mark (concentric void rings crossed by slash), Windows Store Square284x284 Logo Asset

### Community 104 - "Icon 30"
Cohesion: 0.67
Nodes (3): Square30x30Logo (voidHTTP Windows tile icon, 30x30), Tauri-generated Windows Store (appx) square logo icon set, voidHTTP brand mark: white slashed-circle (empty-set/void) glyph on blue rounded square

### Community 105 - "Icon 44"
Cohesion: 0.67
Nodes (3): Square44x44Logo.png (Windows Store tile icon), Tauri Windows/UWP App Icon Set, voidHTTP Brand Mark (blue rounded square with white void/slash glyph)

### Community 106 - "Icon 71"
Cohesion: 0.67
Nodes (3): Square71x71Logo (voidHTTP app icon, 71x71), voidHTTP logo mark: white slashed circle (empty-set / void symbol) on blue rounded square, Windows Store / UWP square tile asset (Tauri bundle icon set)

### Community 107 - "Error Descriptions"
Cohesion: 0.67
Nodes (3): describe_error(), root_cause(), lost()

## Ambiguous Edges - Review These
- `MQTT message stream with broker acks` → `About update state cards (current, checking, available, long changelog, downloading, installing, ready, failed)`  [AMBIGUOUS]
  .hallmark/preview/mqtt.html · relation: conceptually_related_to

## Knowledge Gaps
- **176 isolated node(s):** `voidHTTP App Icon`, `#root Mount Element`, `voidhttp`, `Reflection`, `Protos` (+171 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 774 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prepare()` connect `HTTP Lib & Variables` to `Store Types & Kafka Client`, `gRPC Request Pane`, `HAR Format`, `GraphQL Pane & Schema`, `Import Modal`, `Drop Import & Export`, `Code Editor & MQTT Pane`, `Agent & Contribution Docs`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `voidHTTP App Icon`, `#root Mount Element`, `voidhttp` to the rest of the system?**
  _176 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TLS Certificates & Keychain` be split into smaller, more focused modules?**
  _Cohesion score 0.05218365061590145 - nodes in this community are weakly interconnected._
- **Why does `Architecture` connect `Agent & Contribution Docs` to `Feature Docs (README)`, `Repo Doc Files`, `Changelog Releases`, `Quick Open Features Docs`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `Store Types & Kafka Client` be split into smaller, more focused modules?**
  _Cohesion score 0.03663003663003663 - nodes in this community are weakly interconnected._
- **Why does `Sending an HTTP request` connect `Agent & Contribution Docs` to `HTTP Lib & Variables`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `MQTT message stream with broker acks` and `About update state cards (current, checking, available, long changelog, downloading, installing, ready, failed)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._