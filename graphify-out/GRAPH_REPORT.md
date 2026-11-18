# Graph Report - voidHTTP  (2026-11-18)

## Corpus Check
- 128 files · ~277,745 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 29 file(s) not represented in the graph (top: .css 20, (none) 5, .lock 1)

## Summary
- 2949 nodes · 7664 edges · 131 communities (108 shown, 23 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 244 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `059991ba`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- TLS Certificates & Keychain
- Store Types & Kafka Client
- MQTT Packet Codec
- gRPC Request Pane
- Network Transport Layer
- sio.rs
- Env Menu & Modals
- GraphQL Pane & Schema
- Script Runtime (Rust)
- QuickOpen.tsx
- Transfer/Shortcuts/Certs Previews
- Updater & About Modal
- Kafka Protocol Calls
- HTTP Client Engine
- RequestPane.tsx
- MQTT Tests
- Package Dependencies
- Code Editor & MQTT Pane
- Release Workflow
- auth.rs
- App Store Actions
- mqtt.rs
- SioEvent
- ResponseBody.tsx
- File Storage (Rust)
- Format Common & Masking
- Import Detection & OpenAPI
- PubsubPane.tsx
- README Icons & Prelude
- ws.rs
- Certificates Pane
- WebSocket Response View
- ResponsePane.tsx
- About & Build Previews
- gRPC Metadata & Reflection
- App Icon & Window SVGs
- Example Modal
- Sidebar Tree Actions
- Kafka Response View
- model.ts
- Postman Format
- useStore
- pubsub.rs
- MQTT Events & Acks
- KafkaEvent
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
- Session
- PubsubResponse.tsx
- Native Format
- TypeScript Config
- Feature Docs (README)
- ws_connect
- Bug Report Template
- Feature Request Template
- Error
- gRPC Codec
- themes.ts
- Kafka Commands
- PR Checklist
- gRPC Previews
- Enforcement Ladder
- Variable Formats
- GraphQL Previews
- Base Preview Shell
- Scripts Preview
- highlightLines
- AuthReq
- System Fonts
- Repo Doc Files
- gRPC Errors
- Cmd
- gRPC Proto Files
- Runs.tsx
- Kafka Preview
- Issue Template Config
- Tauri Capabilities
- App Icon 128 & 150
- PR Template
- Link
- Design Language
- pubsub/tests.rs
- GrpcState
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
- net.ts
- Apidog Reference
- History & Masking Docs
- ws_connect
- Example
- Icon 32
- Icon 64
- Icon 89
- Store Logo
- WS Conn Guard
- App Icon SVG
- Cargo Crate
- Themes & Fonts Docs
- Wishlist
- Packet
- Cmd
- .produce

## God Nodes (most connected - your core abstractions)
1. `useStore` - 97 edges
2. `State` - 68 edges
3. `RequestPane()` - 50 edges
4. `react` - 47 edges
5. `uid()` - 41 edges
6. `request()` - 40 edges
7. `resolve()` - 37 edges
8. `stripJsonComments()` - 37 edges
9. `start()` - 37 edges
10. `ico` - 33 edges

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
- 2-file cycle: `src-tauri/src/pubsub.rs -> src-tauri/src/pubsub/auth.rs -> src-tauri/src/pubsub.rs`

## Hyperedges (group relationships)
- **Build channel awareness (DEV tag, About build card, updates off in dev)** — _hallmark_preview_build_build_tag, _hallmark_preview_build_about_build_card, _hallmark_preview_build_dev_updates_disabled [EXTRACTED 1.00]
- **Live-connection protocol engines sharing per-tab task + IPC Channel model** — docs_architecture_live_connections, docs_architecture_kafka_engine, docs_architecture_mqtt_engine, docs_architecture_grpc_engine, docs_architecture_sio_engine, readme_websocket [EXTRACTED 1.00]
- **MQTT session lifecycle (connect, subscribe, publish/ack, will, takeover)** — _hallmark_preview_mqtt_connect_connack_view, _hallmark_preview_mqtt_topic_subscriptions, _hallmark_preview_mqtt_message_stream, _hallmark_preview_mqtt_last_will, _hallmark_preview_mqtt_session_taken_over [EXTRACTED 1.00]
- **voidHTTP import/export interchange formats** — _hallmark_preview_transfer_postman_collection_format, _hallmark_preview_transfer_openapi_swagger_format, _hallmark_preview_transfer_har_format, _hallmark_preview_transfer_voidhttp_native_format [EXTRACTED 1.00]
- **Request reachability path: DNS -> proxy -> TLS trust** — _hallmark_preview_network_secure_dns, _hallmark_preview_network_proxy, _hallmark_preview_network_connection_check, _hallmark_preview_certificates_ca_trust, _hallmark_preview_certificates_client_certs_mtls [INFERRED 0.75]
- **README protocol section icons (GraphQL, gRPC, WebSocket, Socket.IO, Kafka, MQTT)** — docs_assets_icons_waypoints_icon, docs_assets_icons_network_icon, docs_assets_icons_plug_zap_icon, docs_assets_icons_messages_square_icon, docs_assets_icons_radio_tower_icon, docs_assets_icons_router_icon [INFERRED 0.85]
- **In-app update flow surfaces (chip, popover, Settings pane, About cards)** — _hallmark_preview_updates_update_chip, _hallmark_preview_updates_update_popover, _hallmark_preview_updates_settings_updates_pane, _hallmark_preview_about_update_state_cards [INFERRED 0.85]
- **Shared network/TLS layer applied to every request kind** — docs_architecture_net_module, docs_architecture_certs_module, readme_network_settings, readme_certificate_settings, docs_architecture_http_request_flow [INFERRED 0.85]
- **Untrusted-import and secret-protection defenses** — readme_untrusted_imports, readme_secret_blanking, readme_quickjs_sandbox, docs_architecture_import_export_pipeline, security_in_scope, readme_masking [INFERRED 0.85]
- **Connect, live stream, ack and close pattern** — _hallmark_preview_websocket_connect_disconnect_lifecycle, _hallmark_preview_websocket_message_stream, _hallmark_preview_socketio_emit_with_ack, _hallmark_preview_kafka_produce_record [INFERRED 0.85]
- **Preview tokenizers that port into src/lib/highlight.ts** — _hallmark_preview_grpc_json_line_tokenizer, _hallmark_preview_scripts_js_line_tokenizer, _hallmark_preview_graphql_gql_line_tokenizer [INFERRED 0.85]
- **Protocol request kinds sharing the method menu** — _hallmark_preview_index_method_menu, _hallmark_preview_grpc_grpc_request_line, _hallmark_preview_websocket_connect_disconnect_lifecycle, _hallmark_preview_graphql_graphql_request, _hallmark_preview_socketio_namespace_field, _hallmark_preview_kafka_kafka_request_line [INFERRED 0.85]
- **Settings dialog panes previewed (Network, Certificates, Shortcuts)** — _hallmark_preview_shortcuts_settings_dialog, _hallmark_preview_shortcuts_shortcuts_pane, _hallmark_preview_network, _hallmark_preview_certificates [INFERRED 0.85]
- **Request/response workflow shown in window illustration** — docs_assets_voidhttp_window_collections_sidebar, docs_assets_voidhttp_window_request_tabs, docs_assets_voidhttp_window_environment_selector, docs_assets_voidhttp_window_url_bar_variables, docs_assets_voidhttp_window_request_editor, docs_assets_voidhttp_window_response_viewer [INFERRED 0.85]
- **Docs feature icons (Lucide, ISC, #3d74ec stroke)** — docs_assets_icons_arrow_right_left_icon, docs_assets_icons_ban_icon, docs_assets_icons_check_icon, docs_assets_icons_circle_help_icon, docs_assets_icons_code_xml_icon, docs_assets_icons_database_icon, docs_assets_icons_download_icon, docs_assets_icons_feather_icon, docs_assets_icons_flask_conical_icon, docs_assets_icons_folder_tree_icon, docs_assets_icons_globe_icon, docs_assets_icons_hard_drive_icon, docs_assets_icons_history_icon, docs_assets_icons_keyboard_icon, docs_assets_icons_lightbulb_icon [INFERRED 0.95]

## Communities (131 total, 23 thin omitted)

### Community 0 - "TLS Certificates & Keychain"
Cohesion: 0.05
Nodes (54): a_dev_ca_and_a_client_certificate_reach_a_mutual_tls_server(), a_pfx_opens_with_its_passphrase_only(), a_private_key_is_not_taken_for_a_ca(), added_cert_fits(), AddedCertVerifier, an_openssl_self_signed_server_certificate_is_trusted_once_added(), ca_file_info_names_the_certificate(), CertConfig (+46 more)

### Community 1 - "Store Types & Kafka Client"
Cohesion: 0.04
Nodes (100): RFC-6455, @tauri-apps/api, gqlAsHttp(), ParsedGrpcurl, base64Utf8(), CONTENT_TYPES, prepare(), Prepared (+92 more)

### Community 2 - "MQTT Packet Codec"
Cohesion: 0.09
Nodes (36): Ack, broken_packets_are_errors(), ConnAck, connack_reason(), Connect, connect_bytes_match_the_spec(), decode(), Disconnect (+28 more)

### Community 3 - "gRPC Request Pane"
Cohesion: 0.07
Nodes (32): MethodPicker(), SchemaEditor(), Section, time(), clientStreams(), emit(), findMethod(), grpcCancel() (+24 more)

### Community 4 - "Network Transport Layer"
Cohesion: 0.07
Nodes (33): ALWAYS_DIRECT, bootstrap(), connect_any(), current(), custom_group(), doh_resolver(), http_connect(), http_connect_tunnel() (+25 more)

### Community 5 - "sio.rs"
Cohesion: 0.08
Nodes (25): ACK, BINARY_ACK, BINARY_EVENT, Cmd, Close, Emit, CONNECT, CONNECT_ERROR (+17 more)

### Community 6 - "Env Menu & Modals"
Cohesion: 0.12
Nodes (25): BuildBadge(), CODE_SIZES, DevUpdatesPane(), EnvColor(), Modals(), MONO_FONTS, ProjectModal(), PromptModal() (+17 more)

### Community 7 - "GraphQL Pane & Schema"
Cohesion: 0.09
Nodes (49): Args(), DocsBrowser(), fieldCount(), FieldRow(), GqlQueryEditor(), KIND_LABEL, kindLabel(), OperationPicker() (+41 more)

### Community 8 - "Script Runtime (Rust)"
Cohesion: 0.11
Nodes (24): async_tests_settle(), chai_edges(), console_is_capped(), endless_loop_is_stopped(), endless_promise_jobs_are_stopped(), errors_carry_the_line(), fail(), go() (+16 more)

### Community 9 - "QuickOpen.tsx"
Cohesion: 0.04
Nodes (45): App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTypeTokens(), BuildTag(), DropImport(), EnvMenu() (+37 more)

### Community 10 - "Transfer/Shortcuts/Certs Previews"
Cohesion: 0.06
Nodes (44): Certificates design preview (certificates.html), Add client certificate form (CRT + KEY or PFX/P12), Trust custom CA certificates (.pem, on top of public CAs), CA file validation (private key rejected, expiry warning), Client certificates for mutual TLS (matched by host:port, wildcard hosts), Certificates screen router (data-screen + URL hash), Skip TLS verification notice (from Requests settings), Network settings design preview (network.html) (+36 more)

### Community 11 - "Updater & About Modal"
Cohesion: 0.10
Nodes (26): DEV_BUILD, DevBuild, AboutModal(), BuildCard(), Line(), Notes(), UpdateCard(), Wait() (+18 more)

### Community 12 - "Kafka Protocol Calls"
Cohesion: 0.05
Nodes (11): broker_lists(), DEFAULT_TIMEOUT, FETCH_BYTES, FETCH_WAIT_MS, Io, MAX_FAILS, MAX_FRAME, parse_brokers() (+3 more)

### Community 13 - "HTTP Client Engine"
Cohesion: 0.08
Nodes (20): build_multipart(), cancel_request(), ClientKey, execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState (+12 more)

### Community 14 - "RequestPane.tsx"
Cohesion: 0.08
Nodes (63): react, GrpcRequestPane(), Props, renameTab(), TitleName(), AuthEditor(), KafkaRequestPane(), Props (+55 more)

### Community 15 - "MQTT Tests"
Cohesion: 0.09
Nodes (62): PublishRequest, random_client_id(), a_broker_that_stops_reading_ends_the_session(), a_late_refusal_doesnt_forget_a_newer_subscribe(), a_refused_unsubscribe_is_reported_and_tried_again(), accept(), assigned_client_id_wins(), auth_from_the_broker_is_a_protocol_error() (+54 more)

### Community 16 - "Package Dependencies"
Cohesion: 0.06
Nodes (41): dependencies, lucide-react@^1.75.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2, @tauri-apps/plugin-updater@^2 (+33 more)

### Community 17 - "Code Editor & MQTT Pane"
Cohesion: 0.15
Nodes (18): clampQos(), connectMqtt(), defaultMqtt(), mqttClose(), MqttEvent, MqttFailure, mqttPublish(), mqttSubscriptions() (+10 more)

### Community 18 - "Release Workflow"
Cohesion: 0.05
Nodes (40): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+32 more)

### Community 19 - "auth.rs"
Cohesion: 0.09
Nodes (34): access_token(), AuthError, b64url(), cache(), cache_key(), Cached, Creds, Impersonated (+26 more)

### Community 20 - "App Store Actions"
Cohesion: 0.04
Nodes (4): State, ExampleRef, ProjectData, ProjectMeta

### Community 21 - "mqtt.rs"
Cohesion: 0.08
Nodes (24): Subs, ConnInfo, DEFAULT_TIMEOUT, Io, MAX_IN, mqtt_close(), mqtt_connect(), mqtt_publish() (+16 more)

### Community 22 - "SioEvent"
Cohesion: 0.12
Nodes (18): collect(), endpoint(), endpoints(), join_emit_ack_disconnect(), live_server(), run(), sio_connect(), SioEvent (+10 more)

### Community 23 - "ResponseBody.tsx"
Cohesion: 0.11
Nodes (18): duration(), EndRow(), GrpcResponsePane(), MessageRow(), pretty(), seconds(), StatusLine(), Sub (+10 more)

### Community 24 - "File Storage (Rust)"
Cohesion: 0.07
Nodes (32): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_ref_file(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file() (+24 more)

### Community 25 - "Format Common & Masking"
Cohesion: 0.16
Nodes (34): addressLike(), basicKept(), blankHarEnv(), blankKv(), blankSecretJson(), blankSecretKv(), blankSecretXml(), blankValues() (+26 more)

### Community 26 - "Import Detection & OpenAPI"
Cohesion: 0.10
Nodes (33): Any, detect(), parseDoc(), Source, HarFile, HarRow, Analysis, Build (+25 more)

### Community 27 - "PubsubPane.tsx"
Cohesion: 0.09
Nodes (40): AuthEditor(), clock(), Group, listArgs(), listError(), ListPicker(), Loaded, ProjectPicker() (+32 more)

### Community 28 - "README Icons & Prelude"
Cohesion: 0.07
Nodes (22): <img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones), <img src="docs/assets/icons/folder-tree.svg" width="20" height="20" align="top" alt="" /> Projects, tabs, the whole workspace, <img src="docs/assets/icons/globe.svg" width="20" height="20" align="top" alt="" /> HTTP, done properly, <img src="docs/assets/icons/history.svg" width="20" height="20" align="top" alt="" /> History and examples, <img src="docs/assets/icons/messages-square.svg" width="20" height="20" align="top" alt="" /> Socket.IO, <img src="docs/assets/icons/network.svg" width="20" height="20" align="top" alt="" /> gRPC, <img src="docs/assets/icons/package.svg" width="20" height="20" align="top" alt="" /> Import and export, <img src="docs/assets/icons/palette.svg" width="20" height="20" align="top" alt="" /> Make it yours (+14 more)

### Community 29 - "ws.rs"
Cohesion: 0.12
Nodes (16): bad_header_is_an_error(), build_request(), echo_and_close(), Handshake, handshake_headers_are_kept_and_extras_added(), header_list(), is_handshake_header(), MAX_REFUSED_BODY (+8 more)

### Community 30 - "Certificates Pane"
Cohesion: 0.11
Nodes (26): CaRow(), CERT_FILES, CertificatesPane(), ClientForm(), FilePick(), KEY_FILES, PFX_FILES, pickOne() (+18 more)

### Community 31 - "WebSocket Response View"
Cohesion: 0.13
Nodes (27): AckWait(), closeLabel(), CloseRow(), duration(), EventFilter(), Handshake(), MessageList(), MessageRow() (+19 more)

### Community 32 - "ResponsePane.tsx"
Cohesion: 0.19
Nodes (14): OPEN_GQL_LINE, OpenGqlLine, ResponsePane(), isGrpc(), isKafka(), isMqtt(), isPubsub(), hasScript() (+6 more)

### Community 33 - "About & Build Previews"
Cohesion: 0.10
Nodes (27): voidHTTP About dialog design preview, About voidHTTP dialog (replaces native macOS About panel), License card: Apache-2.0 + Commons Clause, About update state cards (current, checking, available, long changelog, downloading, installing, ready, failed), voidHTTP build tag design preview, About dialog GET /build card (dev channel), Address bar {{var}} / :param token painter with hover tip, DEV build channel tag (title strip pill) (+19 more)

### Community 34 - "gRPC Metadata & Reflection"
Cohesion: 0.09
Nodes (15): describe(), ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, protos_compile_and_describe() (+7 more)

### Community 35 - "App Icon & Window SVGs"
Cohesion: 0.09
Nodes (28): Void / Black-Hole Brand Motif, voidHTTP App Icon (blue tile, void rings, white slash), Lucide arrow-right-left icon, Lucide ban icon, Lucide check icon, Lucide circle-help icon, Lucide code-xml icon, Lucide database icon (+20 more)

### Community 36 - "Example Modal"
Cohesion: 0.13
Nodes (30): allRequests(), ExampleModal(), key(), statusName(), applyMasks(), COOKIE_ATTRS, COOKIE_FLAGS, findSensitive() (+22 more)

### Community 37 - "Sidebar Tree Actions"
Cohesion: 0.10
Nodes (29): ClientRow(), RenameField(), EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView() (+21 more)

### Community 38 - "Kafka Response View"
Cohesion: 0.14
Nodes (23): AckRow(), ACKS, duration(), FAILED, keyText(), num(), parseMaybe(), PartitionFilter() (+15 more)

### Community 39 - "model.ts"
Cohesion: 0.11
Nodes (23): harBody(), harHeaders(), HarOptions, harPlan(), harResponse(), harToCollection(), hostVar(), readHar() (+15 more)

### Community 40 - "Postman Format"
Cohesion: 0.18
Nodes (25): dropFilePaths(), str(), analyze(), convertAuth(), convertBody(), convertExamples(), convertItems(), count() (+17 more)

### Community 41 - "useStore"
Cohesion: 0.10
Nodes (46): CodeArea(), Props, MessageEditor(), MessageList(), SaveExampleButton(), UnaryBody(), KeyTypePicker(), PartitionPicker() (+38 more)

### Community 42 - "pubsub.rs"
Cohesion: 0.09
Nodes (37): Kv, attributes_of(), check_id(), data_of(), dead_letter_of(), DeadLetter, DEFAULT_ENDPOINT, DEFAULT_TIMEOUT (+29 more)

### Community 43 - "MQTT Events & Acks"
Cohesion: 0.21
Nodes (9): ack_event(), Emit, End, Client, Lost, Server, Outgoing, Session (+1 more)

### Community 44 - "KafkaEvent"
Cohesion: 0.11
Nodes (19): Header, kafka_connect(), KafkaEvent, Close, Connected, Failed, Message, Notice (+11 more)

### Community 45 - "Cache Workflow"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 46 - "Import Modal"
Cohesion: 0.16
Nodes (26): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+18 more)

### Community 47 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 48 - "Drop Import & Export"
Cohesion: 0.15
Nodes (21): @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-dialog, Envs, ExportModal(), Format, FORMATS, plural(), baseName() (+13 more)

### Community 49 - "MQTT Response View"
Cohesion: 0.12
Nodes (26): valueText(), AckRow(), CloseRow(), ConnectionView(), duration(), FAILED, hex(), MessageList() (+18 more)

### Community 50 - "JSONPath Parser"
Cohesion: 0.14
Nodes (17): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+9 more)

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
Cohesion: 0.19
Nodes (17): address_gets_scheme_and_port(), cached_pool(), compile_protos(), connect(), grpc_describe(), load_pool(), parse_address(), pool_key() (+9 more)

### Community 59 - "Lucide README Icons"
Cohesion: 0.12
Nodes (18): Lucide Icon Set (ISC license, stroke #3d74ec, 24x24), Map Icon (folded map, README 'Where things live' project layout), Messages-Square Icon (two speech bubbles, README Socket.IO section), Network Icon (hierarchy of three nodes, README gRPC section), Package Icon (3D box, README Import and export section), Palette Icon (paint palette, README Make it yours theming section), Paperclip Icon (attachment clip, README License keep LICENSE/NOTICE), Plug-Zap Icon (plug with lightning bolt, README WebSocket section) (+10 more)

### Community 60 - "Session"
Cohesion: 0.18
Nodes (7): Api, ApiErr, Emit, Fail, run(), Session, topic_path()

### Community 61 - "PubsubResponse.tsx"
Cohesion: 0.14
Nodes (22): AckRow(), attrText(), dataText(), duration(), FAILED, Failed(), MessageList(), MessageRow() (+14 more)

### Community 62 - "Native Format"
Cohesion: 0.13
Nodes (31): commandsSummary(), importCommands(), nameOf(), splitCommands(), ImportPlan, Note, importNative(), NATIVE_VERSION (+23 more)

### Community 63 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 64 - "Feature Docs (README)"
Cohesion: 0.17
Nodes (14): 0.1.6 (WebSocket, Socket.IO, GraphQL, Network, Certificates, Scripts, License), Import/Export Pipeline (src/lib/formats, common.ts checks, files.rs), GraphQL Support, HTTP Requests (methods, auth, bodies, responses), Import and Export Formats (voidHTTP, Postman, OpenAPI, HAR, cURL/grpcurl), Large Response Guard (512 KB highlight, 4 MB truncate), Apache 2.0 + Commons Clause License, Moonbase Demo API (docs/examples/moonbase-api.yaml) (+6 more)

### Community 65 - "ws_connect"
Cohesion: 0.18
Nodes (9): Cmd, Close, Send, ConnGuard, Conns, Conns<C>, ws_close(), ws_send() (+1 more)

### Community 66 - "Bug Report Template"
Cohesion: 0.13
Nodes (14): description, label, options, placeholder, value, body, attributes, id (+6 more)

### Community 67 - "Feature Request Template"
Cohesion: 0.13
Nodes (14): description, label, options, value, body, attributes, id, type (+6 more)

### Community 68 - "Error"
Cohesion: 0.28
Nodes (5): bad(), Error, Malformed, Reader, Reader<'a>

### Community 69 - "gRPC Codec"
Cohesion: 0.14
Nodes (5): apply_metadata(), DynamicCodec, DynamicDecoder, DynamicEncoder, metadata_list()

### Community 70 - "themes.ts"
Cohesion: 0.16
Nodes (22): useTheme(), SchemeRow(), alpha(), BUILTIN, BuiltinId, contrast(), DEFAULT_SCHEME, FAMILIES (+14 more)

### Community 71 - "Kafka Commands"
Cohesion: 0.35
Nodes (10): Pause, Produce, Seek, kafka_close(), kafka_pause(), kafka_produce(), kafka_refresh(), kafka_seek() (+2 more)

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
Cohesion: 0.33
Nodes (10): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+2 more)

### Community 76 - "GraphQL Previews"
Cohesion: 0.22
Nodes (10): GraphQL Errors Panel, GraphQL Request (HTTP POST), GraphQL Operation Picker, voidHTTP GraphQL Preview, GraphQL Schema Docs Explorer, GraphQL Schema Introspection, Preview Screen Switcher (data-screen), GraphQL Variables Panel (+2 more)

### Community 77 - "Base Preview Shell"
Cohesion: 0.22
Nodes (9): Address Bar Token Highlighter, App Shell (title strip, rail, sidebar, work area), Request Body Mode Editor, Collections Sidebar Tree, Compact Density Mode, Environment Menu, Stacked / Side-by-side Layout Toggle, voidHTTP Base Restyle Preview (+1 more)

### Community 78 - "Scripts Preview"
Cohesion: 0.31
Nodes (10): Lucide Icon Sprite (v0.460.0), voidHTTP Scripts Preview, pm Scripting API (Postman-compatible), Post-response Script, Pre-request Script, Pre-request Script Failure State, Preview Screen Switcher (data-screen), Script Console (+2 more)

### Community 79 - "highlightLines"
Cohesion: 0.40
Nodes (9): esc(), GQL_KEYWORDS, highlightGraphql(), highlightJson(), highlightLines(), jsLines(), jsRuns(), KEYWORDS (+1 more)

### Community 80 - "AuthReq"
Cohesion: 0.12
Nodes (20): adc_path(), AuthReq, expand(), file_of(), gcloud_dir(), gcloud_project(), home(), identity() (+12 more)

### Community 81 - "System Fonts"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 83 - "gRPC Errors"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 84 - "Cmd"
Cohesion: 0.20
Nodes (8): Cmd, Close, Refresh, fetch_all(), FetchJob, Step, Command, Fetched

### Community 85 - "gRPC Proto Files"
Cohesion: 0.33
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 86 - "Runs.tsx"
Cohesion: 0.16
Nodes (17): Failed(), KafkaResponsePane(), Failed(), MqttResponsePane(), when(), ConsoleList(), ConsoleView(), GqlErrorList() (+9 more)

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

### Community 92 - "Link"
Cohesion: 0.14
Nodes (18): Cmd, Close, Publish, conn_info(), connect_and_run(), Failure, Handshake, handshake() (+10 more)

### Community 94 - "pubsub/tests.rs"
Cohesion: 0.16
Nodes (11): jwt(), SaKey, temp_name(), b64url_decode(), jwt_has_the_claims_google_wants_and_verifies(), jwt_refuses_a_broken_key(), received_messages_become_events(), temp_names_are_short_and_ours() (+3 more)

### Community 95 - "GrpcState"
Cohesion: 0.38
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

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

### Community 107 - "net.ts"
Cohesion: 0.19
Nodes (13): apply(), checkHost(), DEFAULT_NET, DNS_PROVIDERS, listeners, NetCheck, netSettings(), NetStep (+5 more)

### Community 111 - "ws_connect"
Cohesion: 0.25
Nodes (7): run(), ws_connect(), WsEvent, Close, Message, Open, Refused

### Community 125 - "Packet"
Cohesion: 0.23
Nodes (18): every_packet_round_trips(), Packet, Auth, ConnAck, Connect, Disconnect, PingReq, PingResp (+10 more)

### Community 126 - "Cmd"
Cohesion: 0.30
Nodes (13): Cmd, Close, Pause, Publish, Pull, Refresh, pubsub_close(), pubsub_pause() (+5 more)

### Community 128 - ".produce"
Cohesion: 0.17
Nodes (9): ack_event(), chrono_now_ms(), murmur2(), murmur2_matches_the_java_client(), Produce, produce_error(), record_event(), show() (+1 more)

## Ambiguous Edges - Review These
- `About update state cards (current, checking, available, long changelog, downloading, installing, ready, failed)` → `MQTT message stream with broker acks`  [AMBIGUOUS]
  .hallmark/preview/mqtt.html · relation: conceptually_related_to

## Knowledge Gaps
- **188 isolated node(s):** `Connected`, `Topic`, `Message`, `Pulled`, `Paused` (+183 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 833 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prepare()` connect `Store Types & Kafka Client` to `gRPC Request Pane`, `model.ts`, `GraphQL Pane & Schema`, `useStore`, `Import Modal`, `RequestPane.tsx`, `Drop Import & Export`, `Agent & Contribution Docs`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `Connected`, `Topic`, `Message` to the rest of the system?**
  _188 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TLS Certificates & Keychain` be split into smaller, more focused modules?**
  _Cohesion score 0.05218365061590145 - nodes in this community are weakly interconnected._
- **Why does `Architecture` connect `Agent & Contribution Docs` to `Feature Docs (README)`, `Repo Doc Files`, `Changelog Releases`, `Quick Open Features Docs`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `Store Types & Kafka Client` be split into smaller, more focused modules?**
  _Cohesion score 0.035240274599542334 - nodes in this community are weakly interconnected._
- **Why does `Sending an HTTP request` connect `Agent & Contribution Docs` to `Store Types & Kafka Client`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `About update state cards (current, checking, available, long changelog, downloading, installing, ready, failed)` and `MQTT message stream with broker acks`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._