# Graph Report - voidHTTP  (2026-11-16)

## Corpus Check
- 116 files · ~225,439 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 27 file(s) not represented in the graph (top: .css 18, (none) 5, .lock 1)

## Summary
- 2062 nodes · 5316 edges · 104 communities (85 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 63 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bebf537b`
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
- ResponseBody.tsx
- Crate Package
- kafka.rs
- with
- cache.yml
- CertificatesPane.tsx
- GrpcPane.tsx
- KafkaResponse.tsx
- themes.ts
- grpc.rs
- Step
- native.ts
- sio.rs
- certs.rs
- Contributor Covenant Code of Conduct
- highlightLines
- postman.ts
- store.rs
- ReflectError
- prelude.js
- DescriptorPool
- ImportModal.tsx
- MessageDescriptor
- DescriptorPool
- useStore
- AboutModal.tsx
- SioPane.tsx
- attributes
- common.ts
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
- GrpcState
- mask.ts
- varsFormat.ts
- useStore
- package.json
- store.rs
- devDependencies
- har.ts
- sio.ts
- model.ts
- contact_links
- pull_request_template.md
- Runs.tsx
- Enforcement Guidelines
- Architecture
- KafkaEvent
- CONTRIBUTING.md
- Security policy
- Session
- Net
- .refresh
- shortcuts.ts
- ResponsePane.tsx
- curl.ts
- State
- net.ts
- SioEvent
- .lookup
- updater.ts
- types.ts
- net_test
- commands.ts
- UpdateChip
- scripts
- Kv

## God Nodes (most connected - your core abstractions)
1. `useStore` - 80 edges
2. `State` - 62 edges
3. `RequestPane()` - 44 edges
4. `react` - 43 edges
5. `uid()` - 38 edges
6. `ico` - 29 edges
7. `kv()` - 28 edges
8. `GrpcRequestPane()` - 27 edges
9. `stripJsonComments()` - 27 edges
10. `Parser` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Sending an HTTP request` --references--> `prepare()`  [INFERRED]
  docs/ARCHITECTURE.md → src/lib/http.ts
- `<img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones)` --references--> `get()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `<img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones)` --references--> `remove()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `<img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones)` --references--> `upsert()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `<img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones)` --references--> `replaceIn()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js

## Import Cycles
- 1-file cycle: `src-tauri/src/files.rs -> src-tauri/src/files.rs`
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (104 total, 19 thin omitted)

### Community 0 - "Contributing to voidHTTP"
Cohesion: 0.18
Nodes (11): AI agents, Before you start, Checks, Code style, Commits and pull requests, Contributing to voidHTTP, License, Principles (+3 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.08
Nodes (20): build_multipart(), cancel_request(), ClientKey, execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState (+12 more)

### Community 2 - "Changelog"
Cohesion: 0.13
Nodes (15): [0.1.3] - 2026-11-13, [0.1.4] - 2026-11-13, [0.1.5] - 2026-11-13, [0.1.6] - 2026-11-16, Added, Added, Added, Added (+7 more)

### Community 3 - "net.rs"
Cohesion: 0.08
Nodes (19): CERTS, ALWAYS_DIRECT, http_connect_tunnel(), lists_cover_subdomains(), matches_any(), NET, NetCheck, NetStep (+11 more)

### Community 4 - "ws.rs"
Cohesion: 0.09
Nodes (17): bad_header_is_an_error(), build_request(), CLOSE_GRACE, echo_and_close(), Handshake, handshake_headers_are_kept_and_extras_added(), header_list(), is_handshake_header() (+9 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.05
Nodes (4): State, ExampleRef, ProjectData, ProjectMeta

### Community 7 - "WsResponse.tsx"
Cohesion: 0.12
Nodes (27): AckWait(), closeLabel(), CloseRow(), duration(), EventFilter(), Handshake(), MessageList(), MessageRow() (+19 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.10
Nodes (30): Any, parseDoc(), Source, HarRow, Build, buildAuth(), buildBody(), buildExamples() (+22 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.14
Nodes (18): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+10 more)

### Community 12 - "ExportModal.tsx"
Cohesion: 0.19
Nodes (18): Envs, ExportModal(), Format, FORMATS, plural(), baseName(), IMPORT_EXTENSIONS, pickImportFile() (+10 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "ResponseBody.tsx"
Cohesion: 0.13
Nodes (20): duration(), EndRow(), GrpcResponsePane(), MessageList(), MessageRow(), pretty(), SaveExampleButton(), seconds() (+12 more)

### Community 20 - "kafka.rs"
Cohesion: 0.05
Nodes (15): broker_lists(), DEFAULT_TIMEOUT, FETCH_BYTES, FETCH_WAIT_MS, Io, MAX_FAILS, MAX_FRAME, murmur2() (+7 more)

### Community 21 - "with"
Cohesion: 0.05
Nodes (40): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+32 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "CertificatesPane.tsx"
Cohesion: 0.14
Nodes (26): CaRow(), CERT_FILES, CertificatesPane(), ClientForm(), ClientRow(), FilePick(), KEY_FILES, PFX_FILES (+18 more)

### Community 25 - "GrpcPane.tsx"
Cohesion: 0.07
Nodes (32): MethodPicker(), SchemaEditor(), Section, time(), clientStreams(), emit(), findMethod(), grpcCancel() (+24 more)

### Community 26 - "KafkaResponse.tsx"
Cohesion: 0.14
Nodes (26): AckRow(), ACKS, duration(), FAILED, KafkaResponsePane(), keyText(), num(), parseMaybe() (+18 more)

### Community 27 - "themes.ts"
Cohesion: 0.18
Nodes (18): alpha(), BUILTIN, BuiltinId, contrast(), DEFAULT_SCHEME, FAMILIES, fit(), Ghostty (+10 more)

### Community 28 - "grpc.rs"
Cohesion: 0.09
Nodes (12): describe(), ERROR_DETAILS_PROTO, example(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+4 more)

### Community 29 - "Step"
Cohesion: 0.33
Nodes (5): fetch_all(), FetchJob, Step, Command, Fetched

### Community 30 - "native.ts"
Cohesion: 0.14
Nodes (23): Found, ImportPlan, NATIVE_VERSION, NativeFile, num(), pairs(), rows(), sane() (+15 more)

### Community 31 - "sio.rs"
Cohesion: 0.07
Nodes (30): ACK, BINARY_ACK, BINARY_EVENT, Cmd, Close, Emit, collect(), CONNECT (+22 more)

### Community 32 - "certs.rs"
Cohesion: 0.05
Nodes (53): a_dev_ca_and_a_client_certificate_reach_a_mutual_tls_server(), a_pfx_opens_with_its_passphrase_only(), a_private_key_is_not_taken_for_a_ca(), added_cert_fits(), AddedCertVerifier, an_openssl_self_signed_server_certificate_is_trusted_once_added(), ca_file_info_names_the_certificate(), CertConfig (+45 more)

### Community 33 - "Contributor Covenant Code of Conduct"
Cohesion: 0.29
Nodes (7): Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Responsibilities, Our Pledge, Our Standards, Scope

### Community 34 - "highlightLines"
Cohesion: 0.40
Nodes (9): esc(), GQL_KEYWORDS, highlightGraphql(), highlightJson(), highlightLines(), jsLines(), jsRuns(), KEYWORDS (+1 more)

### Community 35 - "postman.ts"
Cohesion: 0.19
Nodes (26): str(), convertAuth(), convertBody(), convertExamples(), convertItems(), count(), exportPostman(), hasScript() (+18 more)

### Community 36 - "store.rs"
Cohesion: 0.09
Nodes (14): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_ref_file(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file() (+6 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "prelude.js"
Cohesion: 0.05
Nodes (31): <img src="docs/assets/icons/ban.svg" width="24" height="24" align="top" alt="" /> Never on the wishlist, <img src="docs/assets/icons/circle-help.svg" width="24" height="24" align="top" alt="" /> Why another API client?, <img src="docs/assets/icons/code-xml.svg" width="24" height="24" align="top" alt="" /> Hack on it, <img src="docs/assets/icons/database.svg" width="24" height="24" align="top" alt="" /> Where's my data?, <img src="docs/assets/icons/download.svg" width="24" height="24" align="top" alt="" /> Get it, <img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones), <img src="docs/assets/icons/folder-tree.svg" width="20" height="20" align="top" alt="" /> Projects, tabs, the whole workspace, <img src="docs/assets/icons/globe.svg" width="20" height="20" align="top" alt="" /> HTTP, done properly (+23 more)

### Community 39 - "DescriptorPool"
Cohesion: 0.19
Nodes (9): compile_protos(), decode_details(), EmbeddedFile, error_details_decode(), error_details_pool(), home(), protos_compile_and_describe(), sample_pool() (+1 more)

### Community 40 - "ImportModal.tsx"
Cohesion: 0.16
Nodes (24): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+16 more)

### Community 41 - "MessageDescriptor"
Cohesion: 0.18
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 42 - "DescriptorPool"
Cohesion: 0.21
Nodes (15): address_gets_scheme_and_port(), cached_pool(), connect(), grpc_describe(), load_pool(), parse_address(), pool_key(), reflect() (+7 more)

### Community 43 - "useStore"
Cohesion: 0.24
Nodes (15): CodeArea(), Props, MessageEditor(), RecordEditor(), BodyEditor(), EmitEditor(), MessageEditor(), dropTrailingCommas() (+7 more)

### Community 46 - "AboutModal.tsx"
Cohesion: 0.17
Nodes (13): AboutModal(), BuildCard(), Line(), Notes(), UpdateCard(), Wait(), Notes(), mb() (+5 more)

### Community 47 - "SioPane.tsx"
Cohesion: 0.08
Nodes (54): react, @tauri-apps/plugin-dialog, GrpcRequestPane(), Props, ico, icoLg, renameTab(), TitleName() (+46 more)

### Community 50 - "attributes"
Cohesion: 0.13
Nodes (14): description, label, options, placeholder, value, body, attributes, id (+6 more)

### Community 52 - "common.ts"
Cohesion: 0.17
Nodes (31): addressLike(), basicKept(), blankHarEnv(), blankKv(), blankSecretJson(), blankSecretKv(), blankSecretXml(), blankValues() (+23 more)

### Community 53 - "GrpcEvent"
Cohesion: 0.17
Nodes (15): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+7 more)

### Community 54 - "Modals.tsx"
Cohesion: 0.10
Nodes (31): BuildBadge(), EnvMenu(), CODE_SIZES, DevUpdatesPane(), EnvColor(), FontRow(), Modals(), MONO_FONTS (+23 more)

### Community 55 - "script.rs"
Cohesion: 0.12
Nodes (24): async_tests_settle(), chai_edges(), console_is_capped(), endless_loop_is_stopped(), endless_promise_jobs_are_stopped(), errors_carry_the_line(), fail(), go() (+16 more)

### Community 56 - "GqlPane.tsx"
Cohesion: 0.09
Nodes (50): Args(), DocsBrowser(), fieldCount(), FieldRow(), GqlQueryEditor(), KIND_LABEL, kindLabel(), OperationPicker() (+42 more)

### Community 57 - "QuickOpen.tsx"
Cohesion: 0.07
Nodes (21): greeting(), Home(), pathOf(), ExIcon(), Fields, fuzzy(), Item, Marked() (+13 more)

### Community 58 - "store.ts"
Cohesion: 0.07
Nodes (37): isGrpc(), b64(), connectKafka(), defaultKafka(), isKafka(), kafkaClose(), KafkaEvent, KafkaFailure (+29 more)

### Community 59 - "Sidebar.tsx"
Cohesion: 0.10
Nodes (28): RenameField(), EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView(), containerIds() (+20 more)

### Community 60 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 63 - "body"
Cohesion: 0.13
Nodes (14): description, label, options, value, body, attributes, id, type (+6 more)

### Community 64 - "Conns"
Cohesion: 0.12
Nodes (17): run(), Cmd, Close, Send, ConnGuard, Conns, Conns<C>, run() (+9 more)

### Community 69 - "GrpcState"
Cohesion: 0.38
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

### Community 70 - "mask.ts"
Cohesion: 0.13
Nodes (32): allRequests(), ExampleModal(), key(), statusName(), scrubNodes(), applyMasks(), COOKIE_ATTRS, COOKIE_FLAGS (+24 more)

### Community 71 - "varsFormat.ts"
Cohesion: 0.29
Nodes (11): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+3 more)

### Community 72 - "useStore"
Cohesion: 0.15
Nodes (20): index.html SPA Entry, #root Mount Element, @tauri-apps/api, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTheme() (+12 more)

### Community 73 - "package.json"
Cohesion: 0.11
Nodes (22): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2 (+14 more)

### Community 74 - "store.rs"
Cohesion: 0.22
Nodes (18): copy_atomic(), doc_path(), load_response(), load_state(), local_dir(), LOCAL_DOCS, migrate_to_vault(), MIGRATED_MARKER (+10 more)

### Community 75 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @tauri-apps/cli@^2.0.0, @types/react@^18.3.11, @types/react-dom@^18.3.1, typescript@^5.6.3, vite@^5.4.10, @vitejs/plugin-react@^4.3.2, @tauri-apps/cli (+7 more)

### Community 76 - "har.ts"
Cohesion: 0.21
Nodes (15): detect(), dropFilePaths(), harBody(), HarFile, harHeaders(), HarOptions, harResponse(), harToCollection() (+7 more)

### Community 77 - "sio.ts"
Cohesion: 0.08
Nodes (37): RFC-6455, prepareGrpc(), base64Utf8(), CONTENT_TYPES, prepare(), Prepared, WireBody, WireKV (+29 more)

### Community 78 - "model.ts"
Cohesion: 0.14
Nodes (15): cloneNode(), cloneRequest(), DropWhere, insertNode(), mapTree(), MAX_PARAMS, METHODS, nodeIds() (+7 more)

### Community 79 - "contact_links"
Cohesion: 0.33
Nodes (5): blank_issues_enabled, contact_links, about, name, url

### Community 80 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Checklist, How I tested it, Screenshots, What and why

### Community 81 - "Runs.tsx"
Cohesion: 0.29
Nodes (7): ExampleBanner(), when(), GRPC_CODES, RunBanner(), RunCells(), RunsButton(), useRuns()

### Community 82 - "Enforcement Guidelines"
Cohesion: 0.40
Nodes (5): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Enforcement Guidelines

### Community 83 - "Architecture"
Cohesion: 0.25
Nodes (8): Architecture, Import and export, Live connections, Network and TLS, Sending an HTTP request, State and persistence, Two halves, Updates

### Community 84 - "KafkaEvent"
Cohesion: 0.10
Nodes (20): ack_event(), Header, kafka_connect(), KafkaEvent, Close, Connected, Failed, Message (+12 more)

### Community 86 - "Security policy"
Cohesion: 0.40
Nodes (5): How voidHTTP protects your data, Reporting a vulnerability, Scope, Security policy, Supported versions

### Community 87 - "Session"
Cohesion: 0.28
Nodes (5): chrono_now_ms(), Leader, produce_error(), record_event(), Session

### Community 88 - "Net"
Cohesion: 0.21
Nodes (6): doh_resolver(), Net, net_configure(), NetConfig, Resolve, secure_dns_and_check()

### Community 89 - ".refresh"
Cohesion: 0.20
Nodes (8): Broker, Cluster, Conn, Failure, hint_for(), open(), Opts, PartitionInfo

### Community 90 - "shortcuts.ts"
Cohesion: 0.18
Nodes (7): ShortcutsPane(), act, isEditable(), KEYS, onGlobalKey(), SHORTCUT_GROUPS, ShortcutRow

### Community 91 - "ResponsePane.tsx"
Cohesion: 0.19
Nodes (13): OPEN_GQL_LINE, OpenGqlLine, Failed(), ConsoleList(), ConsoleView(), GqlErrorList(), HttpResponsePane(), openScript() (+5 more)

### Community 92 - "curl.ts"
Cohesion: 0.17
Nodes (15): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+7 more)

### Community 93 - "State"
Cohesion: 0.27
Nodes (14): Cmd, Close, Pause, Produce, Refresh, Seek, kafka_close(), kafka_pause() (+6 more)

### Community 94 - "net.ts"
Cohesion: 0.22
Nodes (12): NetworkPane(), apply(), checkHost(), DEFAULT_NET, DNS_PROVIDERS, listeners, NetCheck, netSettings() (+4 more)

### Community 95 - "SioEvent"
Cohesion: 0.22
Nodes (11): sio_connect(), SioEvent, AckTimeout, Close, ConnectError, Engine, Joined, Message (+3 more)

### Community 96 - ".lookup"
Cohesion: 0.24
Nodes (4): bootstrap(), custom_group(), system_lookup(), v4()

### Community 97 - "updater.ts"
Cohesion: 0.33
Nodes (7): checkForUpdate(), hasPendingUpdate(), installUpdate(), message(), NOTE_PREFIX, REPO_URL, restartToUpdate()

### Community 98 - "types.ts"
Cohesion: 0.07
Nodes (30): ParsedGrpcurl, applyVarOps(), OPEN_SCRIPT, OpenScript, runScript(), ScriptOutput, SNIPPETS, TEXT_BODY (+22 more)

### Community 99 - "net_test"
Cohesion: 0.42
Nodes (4): connect_any(), http_connect(), net_test(), Proxy

### Community 100 - "commands.ts"
Cohesion: 0.43
Nodes (7): shellWords(), commandsSummary(), importCommands(), nameOf(), splitCommands(), Note, parseGrpcurl()

### Community 101 - "UpdateChip"
Cohesion: 0.43
Nodes (3): UpdateChip(), UpdateState, Updates

### Community 102 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, tauri, typecheck

### Community 103 - "Kv"
Cohesion: 0.67
Nodes (3): apply_metadata(), metadata_list(), Kv

## Knowledge Gaps
- **47 isolated node(s):** `Latest`, `Earliest`, `Last`, `Time`, `Offset` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 628 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prepare()` connect `sio.ts` to `ImportModal.tsx`, `useStore`, `har.ts`, `ExportModal.tsx`, `SioPane.tsx`, `Architecture`, `GqlPane.tsx`, `GrpcPane.tsx`, `store.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `Latest`, `Earliest`, `Last` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07641196013289037 - nodes in this community are weakly interconnected._
- **Why does `Sending an HTTP request` connect `Architecture` to `sio.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `Changelog` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Why does `Architecture` connect `Architecture` to `CONTRIBUTING.md`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `net.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.08143939393939394 - nodes in this community are weakly interconnected._