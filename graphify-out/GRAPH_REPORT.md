# Graph Report - voidHTTP  (2026-11-18)

## Corpus Check
- 122 files · ~254,970 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .css 19, (none) 5, .lock 1)

## Summary
- 2396 nodes · 6471 edges · 92 communities (82 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 107 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `888d92cf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Contributing to voidHTTP
- Rust HTTP Engine
- Changelog
- net.rs
- ws.rs
- Zustand Store Actions
- App Identity & Docs
- WsResponse.tsx
- Tauri Config
- openapi.ts
- TypeScript Config
- Parser
- ExportModal.tsx
- Tauri Capabilities
- Agent Instructions
- Visual Reference
- tests.rs
- Crate Package
- kafka.rs
- with
- cache.yml
- mqtt.rs
- grpc.ts
- RequestPane.tsx
- themes.ts
- grpc.rs
- Step
- native.ts
- sio.rs
- certs.rs
- Contributor Covenant Code of Conduct
- lib.rs
- postman.ts
- KafkaResponse.tsx
- ReflectError
- prelude.js
- DescriptorPool
- ImportModal.tsx
- MessageDescriptor
- DescriptorPool
- Session
- net.ts
- run_call
- AboutModal.tsx
- Error
- Example
- attributes
- CertificatesPane.tsx
- GrpcEvent
- Modals.tsx
- script.rs
- GqlPane.tsx
- QuickOpen.tsx
- store.ts
- Sidebar.tsx
- fonts.rs
- ConnGuard<'_, C>
- body
- Conns
- connect_and_run
- mask.ts
- varsFormat.ts
- mask.ts
- MqttResponse.tsx
- ResponseBody.tsx
- package.json
- index.ts
- App.tsx
- contact_links
- pull_request_template.md
- model.ts
- Enforcement Guidelines
- Architecture
- KafkaEvent
- CONTRIBUTING.md
- Security policy
- Packet
- .refresh
- packet.rs
- useStore
- State
- types.ts
- curl.ts
- GrpcResponse.tsx
- react
- MqttPane.tsx
- Seek
- Home.tsx
- [0.1.6] - 2026-11-16

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
- `<img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones)` --references--> `upsert()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `<img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones)` --references--> `remove()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `<img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones)` --references--> `get()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `<img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones)` --references--> `replaceIn()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js

## Import Cycles
- 1-file cycle: `src-tauri/src/files.rs -> src-tauri/src/files.rs`
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (92 total, 10 thin omitted)

### Community 0 - "Contributing to voidHTTP"
Cohesion: 0.18
Nodes (11): AI agents, Before you start, Checks, Code style, Commits and pull requests, Contributing to voidHTTP, License, Principles (+3 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.07
Nodes (22): build_multipart(), cancel_request(), ClientKey, describe_error(), execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse (+14 more)

### Community 2 - "Changelog"
Cohesion: 0.18
Nodes (11): [0.1.3] - 2026-11-13, [0.1.4] - 2026-11-13, [0.1.5] - 2026-11-13, Added, Added, Added, Changed, Changed (+3 more)

### Community 3 - "net.rs"
Cohesion: 0.06
Nodes (32): ALWAYS_DIRECT, bootstrap(), connect_any(), custom_group(), doh_resolver(), http_connect(), http_connect_tunnel(), lists_cover_subdomains() (+24 more)

### Community 4 - "ws.rs"
Cohesion: 0.10
Nodes (17): bad_header_is_an_error(), build_request(), CLOSE_GRACE, echo_and_close(), handshake_headers_are_kept_and_extras_added(), header_list(), is_handshake_header(), lost() (+9 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.04
Nodes (5): DropWhere, State, ExampleRef, ProjectData, ProjectMeta

### Community 7 - "WsResponse.tsx"
Cohesion: 0.10
Nodes (27): icoLg, AckWait(), closeLabel(), CloseRow(), duration(), EventFilter(), Handshake(), MessageList() (+19 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.11
Nodes (28): Any, parseDoc(), Source, HarRow, Build, buildAuth(), buildBody(), buildExamples() (+20 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.14
Nodes (17): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+9 more)

### Community 12 - "ExportModal.tsx"
Cohesion: 0.18
Nodes (19): Envs, ExportModal(), Format, FORMATS, plural(), baseName(), IMPORT_EXTENSIONS, pickImportFile() (+11 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "tests.rs"
Cohesion: 0.10
Nodes (56): MqttRequest, random_client_id(), a_broker_that_stops_reading_ends_the_session(), a_late_refusal_doesnt_forget_a_newer_subscribe(), a_refused_unsubscribe_is_reported_and_tried_again(), accept(), assigned_client_id_wins(), auth_from_the_broker_is_a_protocol_error() (+48 more)

### Community 20 - "kafka.rs"
Cohesion: 0.05
Nodes (15): broker_lists(), DEFAULT_TIMEOUT, FETCH_BYTES, FETCH_WAIT_MS, Io, MAX_FAILS, MAX_FRAME, murmur2() (+7 more)

### Community 21 - "with"
Cohesion: 0.05
Nodes (40): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+32 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "mqtt.rs"
Cohesion: 0.09
Nodes (24): Subs, ConnInfo, DEFAULT_TIMEOUT, Io, MAX_IN, mqtt_close(), mqtt_connect(), mqtt_publish() (+16 more)

### Community 25 - "grpc.ts"
Cohesion: 0.07
Nodes (33): GrpcRequestPane(), MethodPicker(), SchemaEditor(), Section, time(), clientStreams(), emit(), findMethod() (+25 more)

### Community 26 - "RequestPane.tsx"
Cohesion: 0.16
Nodes (21): AuthEditor(), BODY_MODES, RequestPane(), SCRIPT_TEXT, ScriptsEditor(), Section, capRequest(), defaultGql() (+13 more)

### Community 27 - "themes.ts"
Cohesion: 0.17
Nodes (21): useTheme(), alpha(), BUILTIN, BuiltinId, contrast(), DEFAULT_SCHEME, FAMILIES, findScheme() (+13 more)

### Community 28 - "grpc.rs"
Cohesion: 0.09
Nodes (12): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+4 more)

### Community 29 - "Step"
Cohesion: 0.29
Nodes (5): fetch_all(), FetchJob, Step, Command, Fetched

### Community 30 - "native.ts"
Cohesion: 0.17
Nodes (20): ImportPlan, NATIVE_VERSION, NativeFile, num(), pairs(), rows(), sane(), saneAuth() (+12 more)

### Community 31 - "sio.rs"
Cohesion: 0.06
Nodes (42): ACK, BINARY_ACK, BINARY_EVENT, Cmd, Close, Emit, collect(), CONNECT (+34 more)

### Community 32 - "certs.rs"
Cohesion: 0.05
Nodes (54): a_dev_ca_and_a_client_certificate_reach_a_mutual_tls_server(), a_pfx_opens_with_its_passphrase_only(), a_private_key_is_not_taken_for_a_ca(), added_cert_fits(), AddedCertVerifier, an_openssl_self_signed_server_certificate_is_trusted_once_added(), ca_file_info_names_the_certificate(), CertConfig (+46 more)

### Community 33 - "Contributor Covenant Code of Conduct"
Cohesion: 0.29
Nodes (7): Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Responsibilities, Our Pledge, Our Standards, Scope

### Community 34 - "lib.rs"
Cohesion: 0.07
Nodes (32): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_ref_file(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file() (+24 more)

### Community 35 - "postman.ts"
Cohesion: 0.20
Nodes (25): str(), convertAuth(), convertBody(), convertExamples(), convertItems(), count(), exportPostman(), hasScript() (+17 more)

### Community 36 - "KafkaResponse.tsx"
Cohesion: 0.18
Nodes (22): AckRow(), ACKS, duration(), Failed(), KafkaResponsePane(), keyText(), num(), parseMaybe() (+14 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "prelude.js"
Cohesion: 0.05
Nodes (32): <img src="docs/assets/icons/ban.svg" width="24" height="24" align="top" alt="" /> Never on the wishlist, <img src="docs/assets/icons/circle-help.svg" width="24" height="24" align="top" alt="" /> Why another API client?, <img src="docs/assets/icons/code-xml.svg" width="24" height="24" align="top" alt="" /> Hack on it, <img src="docs/assets/icons/database.svg" width="24" height="24" align="top" alt="" /> Where's my data?, <img src="docs/assets/icons/download.svg" width="24" height="24" align="top" alt="" /> Get it, <img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones), <img src="docs/assets/icons/folder-tree.svg" width="20" height="20" align="top" alt="" /> Projects, tabs, the whole workspace, <img src="docs/assets/icons/globe.svg" width="20" height="20" align="top" alt="" /> HTTP, done properly (+24 more)

### Community 39 - "DescriptorPool"
Cohesion: 0.33
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "ImportModal.tsx"
Cohesion: 0.17
Nodes (24): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+16 more)

### Community 41 - "MessageDescriptor"
Cohesion: 0.18
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 42 - "DescriptorPool"
Cohesion: 0.21
Nodes (19): cached_pool(), compile_protos(), describe(), find_method(), grpc_describe(), InvokeRequest, live_reflection_and_calls(), load_pool() (+11 more)

### Community 43 - "Session"
Cohesion: 0.16
Nodes (15): ack_event(), Cmd, Close, Publish, connect_and_run(), Emit, End, Client (+7 more)

### Community 44 - "net.ts"
Cohesion: 0.20
Nodes (13): NetworkPane(), apply(), checkHost(), DEFAULT_NET, DNS_PROVIDERS, listeners, NetCheck, netSettings() (+5 more)

### Community 45 - "run_call"
Cohesion: 0.21
Nodes (8): address_gets_scheme_and_port(), apply_metadata(), connect(), metadata_list(), parse_address(), run_call(), Kv, root_cause()

### Community 46 - "AboutModal.tsx"
Cohesion: 0.10
Nodes (29): @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-opener, DEV_BUILD, DevBuild, AboutModal(), BuildCard(), Line(), Notes() (+21 more)

### Community 47 - "Error"
Cohesion: 0.28
Nodes (5): bad(), Error, Malformed, Reader, Reader<'a>

### Community 50 - "attributes"
Cohesion: 0.13
Nodes (14): description, label, options, placeholder, value, body, attributes, id (+6 more)

### Community 52 - "CertificatesPane.tsx"
Cohesion: 0.12
Nodes (26): CaRow(), CERT_FILES, CertificatesPane(), ClientForm(), ClientRow(), FilePick(), KEY_FILES, PFX_FILES (+18 more)

### Community 53 - "GrpcEvent"
Cohesion: 0.16
Nodes (14): Call, CallGuard, emit_message(), grpc_cancel(), grpc_end(), grpc_invoke(), grpc_send(), GrpcEvent (+6 more)

### Community 54 - "Modals.tsx"
Cohesion: 0.11
Nodes (30): CODE_SIZES, DevUpdatesPane(), EnvColor(), FontRow(), Modals(), MONO_FONTS, ProjectModal(), PromptModal() (+22 more)

### Community 55 - "script.rs"
Cohesion: 0.12
Nodes (24): async_tests_settle(), chai_edges(), console_is_capped(), endless_loop_is_stopped(), endless_promise_jobs_are_stopped(), errors_carry_the_line(), fail(), go() (+16 more)

### Community 56 - "GqlPane.tsx"
Cohesion: 0.08
Nodes (50): Args(), DocsBrowser(), fieldCount(), FieldRow(), GqlQueryEditor(), KIND_LABEL, kindLabel(), OPEN_GQL_LINE (+42 more)

### Community 57 - "QuickOpen.tsx"
Cohesion: 0.06
Nodes (17): EnvMenu(), ExIcon(), Fields, fuzzy(), Item, Marked(), Method(), METHOD_WORDS (+9 more)

### Community 58 - "store.ts"
Cohesion: 0.04
Nodes (72): RFC-6455, capEnvironments(), gqlAsHttp(), prepareGrpc(), base64Utf8(), CONTENT_TYPES, prepare(), WireBody (+64 more)

### Community 59 - "Sidebar.tsx"
Cohesion: 0.12
Nodes (27): EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView(), containerIds(), DragCtx (+19 more)

### Community 60 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 63 - "body"
Cohesion: 0.13
Nodes (14): description, label, options, value, body, attributes, id, type (+6 more)

### Community 64 - "Conns"
Cohesion: 0.11
Nodes (17): Cmd, Close, Send, ConnGuard, Conns, Conns<C>, Handshake, run() (+9 more)

### Community 69 - "connect_and_run"
Cohesion: 0.15
Nodes (13): conn_info(), Failure, Handshake, handshake(), hint_for(), Link, Stream, Ws (+5 more)

### Community 70 - "mask.ts"
Cohesion: 0.17
Nodes (32): addressLike(), basicKept(), blankHarEnv(), blankKv(), blankSecretJson(), blankSecretKv(), blankSecretXml(), blankValues() (+24 more)

### Community 71 - "varsFormat.ts"
Cohesion: 0.29
Nodes (11): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+3 more)

### Community 72 - "mask.ts"
Cohesion: 0.11
Nodes (34): allRequests(), ExampleModal(), key(), statusName(), applyMasks(), COOKIE_ATTRS, COOKIE_FLAGS, findSensitive() (+26 more)

### Community 73 - "MqttResponse.tsx"
Cohesion: 0.16
Nodes (26): AckRow(), CloseRow(), ConnectionView(), duration(), Failed(), hex(), MessageList(), MessageRow() (+18 more)

### Community 74 - "ResponseBody.tsx"
Cohesion: 0.12
Nodes (10): BodyViewer(), EXAMPLES, Filtered, filters, markMatches(), when(), GRPC_CODES, RunCells() (+2 more)

### Community 75 - "package.json"
Cohesion: 0.06
Nodes (40): dependencies, lucide-react@^1.75.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-process@^2, @tauri-apps/plugin-updater@^2 (+32 more)

### Community 76 - "index.ts"
Cohesion: 0.23
Nodes (14): commandsSummary(), importCommands(), nameOf(), splitCommands(), detect(), dropFilePaths(), Note, HarFile (+6 more)

### Community 78 - "App.tsx"
Cohesion: 0.14
Nodes (17): index.html SPA Entry, #root Mount Element, @tauri-apps/api, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTypeTokens() (+9 more)

### Community 79 - "contact_links"
Cohesion: 0.33
Nodes (5): blank_issues_enabled, contact_links, about, name, url

### Community 80 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Checklist, How I tested it, Screenshots, What and why

### Community 81 - "model.ts"
Cohesion: 0.11
Nodes (25): Found, harBody(), harHeaders(), HarOptions, harPlan(), harResponse(), harToCollection(), hostVar() (+17 more)

### Community 82 - "Enforcement Guidelines"
Cohesion: 0.40
Nodes (5): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Enforcement Guidelines

### Community 83 - "Architecture"
Cohesion: 0.25
Nodes (8): Architecture, Import and export, Live connections, Network and TLS, Sending an HTTP request, State and persistence, Two halves, Updates

### Community 84 - "KafkaEvent"
Cohesion: 0.12
Nodes (16): ack_event(), chrono_now_ms(), Header, KafkaEvent, Close, Connected, Failed, Message (+8 more)

### Community 86 - "Security policy"
Cohesion: 0.40
Nodes (5): How voidHTTP protects your data, Reporting a vulnerability, Scope, Security policy, Supported versions

### Community 87 - "Packet"
Cohesion: 0.23
Nodes (18): every_packet_round_trips(), Packet, Auth, ConnAck, Connect, Disconnect, PingReq, PingResp (+10 more)

### Community 89 - ".refresh"
Cohesion: 0.22
Nodes (10): Broker, Cluster, Conn, Failure, hint_for(), Leader, open(), Opts (+2 more)

### Community 90 - "packet.rs"
Cohesion: 0.09
Nodes (35): Ack, broken_packets_are_errors(), connack_reason(), Connect, connect_bytes_match_the_spec(), decode(), Disconnect, TooLarge (+27 more)

### Community 91 - "useStore"
Cohesion: 0.19
Nodes (24): GrpcResponsePane(), MessageList(), SaveExampleButton(), UnaryBody(), FAILED, FAILED, ExampleBanner(), PairsTable() (+16 more)

### Community 93 - "State"
Cohesion: 0.29
Nodes (13): Cmd, Close, Pause, Produce, Refresh, Seek, kafka_close(), kafka_pause() (+5 more)

### Community 94 - "types.ts"
Cohesion: 0.07
Nodes (32): ParsedGrpcurl, applyVarOps(), OPEN_SCRIPT, OpenScript, runScript(), ScriptOutput, SNIPPETS, TEXT_BODY (+24 more)

### Community 95 - "curl.ts"
Cohesion: 0.17
Nodes (16): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+8 more)

### Community 96 - "GrpcResponse.tsx"
Cohesion: 0.16
Nodes (16): duration(), EndRow(), MessageRow(), pretty(), seconds(), StatusLine(), Sub, esc() (+8 more)

### Community 97 - "react"
Cohesion: 0.09
Nodes (40): react, @tauri-apps/plugin-dialog, Props, ico, RenameField(), renameTab(), TitleName(), AuthEditor() (+32 more)

### Community 99 - "MqttPane.tsx"
Cohesion: 0.08
Nodes (50): CodeArea(), Props, MessageEditor(), RecordEditor(), AuthEditor(), FilterInput(), MessageEditor(), MqttRequestPane() (+42 more)

### Community 101 - "Seek"
Cohesion: 0.22
Nodes (8): kafka_connect(), KafkaRequest, Seek, Earliest, Last, Latest, Offset, Time

### Community 110 - "Home.tsx"
Cohesion: 0.39
Nodes (6): greeting(), Home(), pathOf(), ago(), startOfDay(), HistoryEntry

### Community 114 - "[0.1.6] - 2026-11-16"
Cohesion: 0.40
Nodes (5): [0.1.6] - 2026-11-16, Added, Changed, Fixed, Security

## Knowledge Gaps
- **61 isolated node(s):** `voidhttp`, `Reflection`, `Protos`, `Headers`, `Message` (+56 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 671 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prepare()` connect `store.ts` to `MqttPane.tsx`, `ImportModal.tsx`, `ExportModal.tsx`, `model.ts`, `Architecture`, `GqlPane.tsx`, `grpc.ts`, `RequestPane.tsx`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `voidhttp`, `Reflection`, `Protos` to the rest of the system?**
  _61 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.06753006475485661 - nodes in this community are weakly interconnected._
- **Why does `Sending an HTTP request` connect `Architecture` to `store.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `net.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Why does `Architecture` connect `Architecture` to `CONTRIBUTING.md`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `ws.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09879032258064516 - nodes in this community are weakly interconnected._