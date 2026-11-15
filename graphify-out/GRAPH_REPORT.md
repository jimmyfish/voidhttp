# Graph Report - voidHTTP  (2026-11-16)

## Corpus Check
- 101 files · ~169,223 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 23 file(s) not represented in the graph (top: .css 14, (none) 5, .lock 1)

## Summary
- 1738 nodes · 4370 edges · 92 communities (65 shown, 27 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 55 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8eba0d94`
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
- store.rs
- Tauri Config
- openapi.ts
- TypeScript Config
- Parser
- ExportModal.tsx
- Tauri Capabilities
- Agent Instructions
- Visual Reference
- dependencies
- Crate Package
- common.ts
- with
- cache.yml
- GrpcResponse.tsx
- GrpcPane.tsx
- updater.ts
- curl.ts
- grpc.rs
- Sidebar.tsx
- native.ts
- sio.rs
- certs.rs
- Contributor Covenant Code of Conduct
- WsResponse.tsx
- postman.ts
- store.rs
- ReflectError
- prelude.js
- DescriptorPool
- ImportModal.tsx
- Kv
- DescriptorPool
- App.tsx
- UpdateChip.tsx
- RequestPane.tsx
- attributes
- store.ts
- GrpcEvent
- Modals.tsx
- script.rs
- ResponseBody.tsx
- UpdateChip
- ws.ts
- useStore
- Collection
- ConnGuard<'_, C>
- body
- Conns
- GrpcState
- package.json
- Icon.tsx
- SioEvent
- scripts
- har.ts
- ExampleRef
- run
- files.rs
- fonts.rs
- contact_links
- pull_request_template.md
- index.ts
- Enforcement Guidelines
- Architecture
- EmbeddedFile
- Security policy
- types.ts
- DropWhere
- SavedRef
- ProjectData
- ProjectMeta

## God Nodes (most connected - your core abstractions)
1. `useStore` - 64 edges
2. `State` - 56 edges
3. `uid()` - 38 edges
4. `RequestPane()` - 36 edges
5. `react` - 35 edges
6. `kv()` - 26 edges
7. `Parser` - 25 edges
8. `GrpcRequestPane()` - 25 edges
9. `ico` - 23 edges
10. `stripJsonComments()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Sending an HTTP request` --references--> `prepare()`  [INFERRED]
  docs/ARCHITECTURE.md → src/lib/http.ts
- `Scripts` --references--> `replaceIn()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `Scripts` --references--> `upsert()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `Scripts` --references--> `remove()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png

## Import Cycles
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`
- 1-file cycle: `src-tauri/src/files.rs -> src-tauri/src/files.rs`

## Communities (92 total, 27 thin omitted)

### Community 0 - "Contributing to voidHTTP"
Cohesion: 0.18
Nodes (11): AI agents, Before you start, Checks, Code style, Commits and pull requests, Contributing to voidHTTP, License, Principles (+3 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.07
Nodes (21): build_multipart(), cancel_request(), ClientKey, describe_error(), execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse (+13 more)

### Community 2 - "Changelog"
Cohesion: 0.15
Nodes (13): [0.1.3] - 2026-11-13, [0.1.4] - 2026-11-13, [0.1.5] - 2026-11-13, [0.1.6] - Unreleased, Added, Added, Added, Changed (+5 more)

### Community 3 - "net.rs"
Cohesion: 0.06
Nodes (32): ALWAYS_DIRECT, bootstrap(), connect_any(), current(), custom_group(), doh_resolver(), http_connect(), http_connect_tunnel() (+24 more)

### Community 4 - "ws.rs"
Cohesion: 0.10
Nodes (16): bad_header_is_an_error(), build_request(), echo_and_close(), Handshake, handshake_headers_are_kept_and_extras_added(), header_list(), is_handshake_header(), MAX_REFUSED_BODY (+8 more)

### Community 7 - "store.rs"
Cohesion: 0.13
Nodes (7): read_ref_file(), ABOUT, build(), CHECK_UPDATES, CLOSE_TAB, CLOSE_WINDOW, on_event()

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.12
Nodes (26): Any, parseDoc(), HarRow, Build, buildAuth(), buildBody(), buildExamples(), buildOpenApi() (+18 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.14
Nodes (17): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+9 more)

### Community 12 - "ExportModal.tsx"
Cohesion: 0.14
Nodes (21): DropImport(), Envs, ExportModal(), Format, FORMATS, plural(), baseName(), IMPORT_EXTENSIONS (+13 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2 (+10 more)

### Community 20 - "common.ts"
Cohesion: 0.08
Nodes (64): allRequests(), ExampleModal(), key(), statusName(), FontRow(), Select(), addressLike(), basicKept() (+56 more)

### Community 21 - "with"
Cohesion: 0.05
Nodes (38): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+30 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "GrpcResponse.tsx"
Cohesion: 0.21
Nodes (11): duration(), EndRow(), MessageList(), MessageRow(), pretty(), SaveExampleButton(), seconds(), StatusLine() (+3 more)

### Community 25 - "GrpcPane.tsx"
Cohesion: 0.07
Nodes (36): GrpcRequestPane(), MethodPicker(), SchemaEditor(), Section, time(), clientStreams(), defaultGrpc(), emit() (+28 more)

### Community 26 - "updater.ts"
Cohesion: 0.46
Nodes (5): checkForUpdate(), hasPendingUpdate(), installUpdate(), message(), restartToUpdate()

### Community 27 - "curl.ts"
Cohesion: 0.20
Nodes (14): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+6 more)

### Community 28 - "grpc.rs"
Cohesion: 0.09
Nodes (12): DynamicCodec, DynamicDecoder, ERROR_DETAILS_PROTO, example(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus (+4 more)

### Community 29 - "Sidebar.tsx"
Cohesion: 0.06
Nodes (58): CaRow(), CERT_FILES, CertificatesPane(), ClientForm(), ClientRow(), FilePick(), KEY_FILES, PFX_FILES (+50 more)

### Community 30 - "native.ts"
Cohesion: 0.25
Nodes (18): dropFilePaths(), importNative(), NATIVE_VERSION, num(), pairs(), rows(), sane(), saneAuth() (+10 more)

### Community 31 - "sio.rs"
Cohesion: 0.08
Nodes (27): ACK, BINARY_ACK, BINARY_EVENT, Cmd, Close, Emit, CONNECT, CONNECT_ERROR (+19 more)

### Community 32 - "certs.rs"
Cohesion: 0.05
Nodes (55): a_dev_ca_and_a_client_certificate_reach_a_mutual_tls_server(), a_pfx_opens_with_its_passphrase_only(), a_private_key_is_not_taken_for_a_ca(), added_cert_fits(), AddedCertVerifier, an_openssl_self_signed_server_certificate_is_trusted_once_added(), ca_file_info_names_the_certificate(), CertConfig (+47 more)

### Community 33 - "Contributor Covenant Code of Conduct"
Cohesion: 0.29
Nodes (7): Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Responsibilities, Our Pledge, Our Standards, Scope

### Community 34 - "WsResponse.tsx"
Cohesion: 0.10
Nodes (29): AckWait(), closeLabel(), CloseRow(), duration(), EventFilter(), Handshake(), MessageList(), MessageRow() (+21 more)

### Community 35 - "postman.ts"
Cohesion: 0.20
Nodes (22): str(), convertAuth(), convertBody(), convertExamples(), convertItems(), count(), hasScript(), importPostman() (+14 more)

### Community 36 - "store.rs"
Cohesion: 0.19
Nodes (18): copy_atomic(), doc_path(), load_response(), load_state(), local_dir(), LOCAL_DOCS, migrate_to_vault(), MIGRATED_MARKER (+10 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "prelude.js"
Cohesion: 0.06
Nodes (26): Appearance and settings, Contributing, Development, Features, gRPC, History and examples, HTTP, Import and export (+18 more)

### Community 39 - "DescriptorPool"
Cohesion: 0.21
Nodes (11): compile_protos(), decode_details(), error_details_decode(), error_details_pool(), find_method(), home(), local_proto_compiles_and_takes_the_message(), messages_round_trip_through_json() (+3 more)

### Community 40 - "ImportModal.tsx"
Cohesion: 0.12
Nodes (27): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+19 more)

### Community 41 - "Kv"
Cohesion: 0.18
Nodes (4): apply_metadata(), DynamicEncoder, metadata_list(), Kv

### Community 42 - "DescriptorPool"
Cohesion: 0.18
Nodes (17): address_gets_scheme_and_port(), connect(), describe(), grpc_describe(), InvokeRequest, live_reflection_and_calls(), load_pool(), parse_address() (+9 more)

### Community 43 - "App.tsx"
Cohesion: 0.12
Nodes (21): index.html SPA Entry, #root Mount Element, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTypeTokens(), MessageEditor() (+13 more)

### Community 46 - "UpdateChip.tsx"
Cohesion: 0.17
Nodes (12): AboutModal(), Line(), Notes(), UpdateCard(), Wait(), Notes(), mb(), noteLines() (+4 more)

### Community 47 - "RequestPane.tsx"
Cohesion: 0.12
Nodes (36): react, CodeArea(), Props, Props, renameTab(), TitleName(), KVEditor(), MethodMenu() (+28 more)

### Community 50 - "attributes"
Cohesion: 0.13
Nodes (14): description, label, options, placeholder, value, body, attributes, id (+6 more)

### Community 52 - "store.ts"
Cohesion: 0.06
Nodes (35): @tauri-apps/api, capEnvironments(), isGrpc(), insertNode(), mapTree(), applyVarOps(), OPEN_SCRIPT, OpenScript (+27 more)

### Community 53 - "GrpcEvent"
Cohesion: 0.24
Nodes (7): Call, emit_message(), GrpcEvent, End, Headers, Message, to_json()

### Community 54 - "Modals.tsx"
Cohesion: 0.05
Nodes (66): useTheme(), CODE_SIZES, EnvColor(), Modals(), MONO_FONTS, ProjectModal(), PromptModal(), SaveModal() (+58 more)

### Community 55 - "script.rs"
Cohesion: 0.12
Nodes (24): async_tests_settle(), chai_edges(), console_is_capped(), endless_loop_is_stopped(), endless_promise_jobs_are_stopped(), errors_carry_the_line(), fail(), go() (+16 more)

### Community 56 - "ResponseBody.tsx"
Cohesion: 0.15
Nodes (14): BodyViewer(), EXAMPLES, Filtered, filters, markMatches(), esc(), highlightJson(), highlightLines() (+6 more)

### Community 57 - "UpdateChip"
Cohesion: 0.43
Nodes (3): UpdateChip(), UpdateState, Updates

### Community 58 - "ws.ts"
Cohesion: 0.08
Nodes (42): RFC-6455, prepareGrpc(), base64Utf8(), CONTENT_TYPES, prepare(), Prepared, WireBody, WireKV (+34 more)

### Community 59 - "useStore"
Cohesion: 0.17
Nodes (21): GrpcResponsePane(), ScriptsEditor(), ExampleBanner(), PairsTable(), useTabExample(), when(), ConsoleList(), ConsoleView() (+13 more)

### Community 60 - "Collection"
Cohesion: 0.38
Nodes (4): ImportPlan, NativeFile, Collection, Environment

### Community 63 - "body"
Cohesion: 0.13
Nodes (14): description, label, options, value, body, attributes, id, type (+6 more)

### Community 64 - "Conns"
Cohesion: 0.18
Nodes (9): Cmd, Close, Send, ConnGuard, Conns, Conns<C>, ws_close(), ws_send() (+1 more)

### Community 69 - "GrpcState"
Cohesion: 0.29
Nodes (8): cached_pool(), CallGuard, grpc_cancel(), grpc_end(), grpc_invoke(), grpc_send(), GrpcState, parse_message()

### Community 70 - "package.json"
Cohesion: 0.15
Nodes (17): devDependencies, @tauri-apps/cli@^2.0.0, @types/react@^18.3.11, @types/react-dom@^18.3.1, typescript@^5.6.3, vite@^5.4.10, @vitejs/plugin-react@^4.3.2, name (+9 more)

### Community 72 - "SioEvent"
Cohesion: 0.22
Nodes (11): sio_connect(), SioEvent, AckTimeout, Close, ConnectError, Engine, Joined, Message (+3 more)

### Community 73 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, tauri, typecheck

### Community 74 - "har.ts"
Cohesion: 0.25
Nodes (10): commandsSummary(), importCommands(), nameOf(), splitCommands(), Note, harBody(), harResponse(), harToCollection() (+2 more)

### Community 76 - "run"
Cohesion: 0.21
Nodes (12): collect(), join_emit_ack_disconnect(), live_server(), run(), v2_connect_error(), run(), ws_connect(), WsEvent (+4 more)

### Community 77 - "files.rs"
Cohesion: 0.29
Nodes (7): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file()

### Community 78 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 79 - "contact_links"
Cohesion: 0.33
Nodes (5): blank_issues_enabled, contact_links, about, name, url

### Community 80 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Checklist, How I tested it, Screenshots, What and why

### Community 81 - "index.ts"
Cohesion: 0.27
Nodes (9): detect(), Source, HarFile, readHar(), siteOf(), Analysis, analyze(), LoadedSpec (+1 more)

### Community 82 - "Enforcement Guidelines"
Cohesion: 0.40
Nodes (5): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Enforcement Guidelines

### Community 83 - "Architecture"
Cohesion: 0.25
Nodes (8): Architecture, Import and export, Live connections, Network and TLS, Sending an HTTP request, State and persistence, Two halves, Updates

### Community 86 - "Security policy"
Cohesion: 0.40
Nodes (5): How voidHTTP protects your data, Reporting a vulnerability, Scope, Security policy, Supported versions

### Community 87 - "types.ts"
Cohesion: 0.08
Nodes (31): @tauri-apps/plugin-dialog, Props, Row, ParsedGrpcurl, cloneRequest(), MAX_PARAMS, nodeIds(), pathTo() (+23 more)

## Knowledge Gaps
- **28 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 532 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prepare()` connect `ws.ts` to `ImportModal.tsx`, `ExportModal.tsx`, `RequestPane.tsx`, `Architecture`, `store.ts`, `types.ts`, `GrpcPane.tsx`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.06956521739130435 - nodes in this community are weakly interconnected._
- **Why does `Sending an HTTP request` connect `Architecture` to `ws.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `net.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.06299603174603174 - nodes in this community are weakly interconnected._
- **Why does `Architecture` connect `Architecture` to `CONTRIBUTING.md`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `ws.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09659090909090909 - nodes in this community are weakly interconnected._