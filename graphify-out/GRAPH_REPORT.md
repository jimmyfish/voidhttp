# Graph Report - voidHTTP  (2026-11-16)

## Corpus Check
- 104 files · ~178,863 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .css 15, (none) 5, .lock 1)

## Summary
- 1803 nodes · 4605 edges · 94 communities (75 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 56 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d7506162`
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
- CertificatesPane.tsx
- Tauri Config
- openapi.ts
- TypeScript Config
- Parser
- ExportModal.tsx
- Tauri Capabilities
- Agent Instructions
- Visual Reference
- package.json
- Crate Package
- common.ts
- with
- cache.yml
- themes.ts
- store.ts
- lib.rs
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
- types.ts
- GrpcEvent
- Modals.tsx
- script.rs
- GqlPane.tsx
- ResponsePane.tsx
- ws.ts
- net.ts
- Home.tsx
- ConnGuard<'_, C>
- body
- Conns
- GrpcState
- ResponseBody.tsx
- varsFormat.ts
- Runs.tsx
- dependencies
- useStore
- GrpcPane.tsx
- gqlSchema.ts
- Kv
- fonts.rs
- contact_links
- pull_request_template.md
- model.ts
- Enforcement Guidelines
- Architecture
- run
- Security policy
- commands.ts
- files.rs
- SioEvent
- updater.ts
- connect
- UpdateChip
- scripts

## God Nodes (most connected - your core abstractions)
1. `useStore` - 67 edges
2. `State` - 56 edges
3. `RequestPane()` - 41 edges
4. `uid()` - 38 edges
5. `react` - 37 edges
6. `kv()` - 28 edges
7. `GrpcRequestPane()` - 26 edges
8. `Parser` - 25 edges
9. `ico` - 24 edges
10. `stripJsonComments()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Sending an HTTP request` --references--> `prepare()`  [INFERRED]
  docs/ARCHITECTURE.md → src/lib/http.ts
- `Scripts` --references--> `remove()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `Scripts` --references--> `replaceIn()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `Scripts` --references--> `upsert()`  [INFERRED]
  README.md → src-tauri/src/script/prelude.js
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png

## Import Cycles
- 1-file cycle: `src-tauri/src/files.rs -> src-tauri/src/files.rs`
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (94 total, 19 thin omitted)

### Community 0 - "Contributing to voidHTTP"
Cohesion: 0.18
Nodes (11): AI agents, Before you start, Checks, Code style, Commits and pull requests, Contributing to voidHTTP, License, Principles (+3 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.08
Nodes (16): build_multipart(), cancel_request(), ClientKey, execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState (+8 more)

### Community 2 - "Changelog"
Cohesion: 0.15
Nodes (13): [0.1.3] - 2026-11-13, [0.1.4] - 2026-11-13, [0.1.5] - 2026-11-13, [0.1.6] - Unreleased, Added, Added, Added, Changed (+5 more)

### Community 3 - "net.rs"
Cohesion: 0.06
Nodes (33): CERTS, ALWAYS_DIRECT, bootstrap(), connect_any(), custom_group(), doh_resolver(), http_connect(), http_connect_tunnel() (+25 more)

### Community 4 - "ws.rs"
Cohesion: 0.10
Nodes (16): bad_header_is_an_error(), build_request(), echo_and_close(), Handshake, handshake_headers_are_kept_and_extras_added(), header_list(), is_handshake_header(), MAX_REFUSED_BODY (+8 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.05
Nodes (5): DropWhere, State, ExampleRef, ProjectData, ProjectMeta

### Community 7 - "CertificatesPane.tsx"
Cohesion: 0.12
Nodes (26): CaRow(), CERT_FILES, CertificatesPane(), ClientForm(), FilePick(), KEY_FILES, PFX_FILES, pickOne() (+18 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.12
Nodes (27): Any, Source, HarRow, Build, buildAuth(), buildBody(), buildExamples(), buildOpenApi() (+19 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.14
Nodes (17): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+9 more)

### Community 12 - "ExportModal.tsx"
Cohesion: 0.15
Nodes (22): @tauri-apps/api, DropImport(), Envs, ExportModal(), Format, FORMATS, plural(), baseName() (+14 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "package.json"
Cohesion: 0.15
Nodes (17): devDependencies, @tauri-apps/cli@^2.0.0, @types/react@^18.3.11, @types/react-dom@^18.3.1, typescript@^5.6.3, vite@^5.4.10, @vitejs/plugin-react@^4.3.2, name (+9 more)

### Community 20 - "common.ts"
Cohesion: 0.08
Nodes (62): allRequests(), ExampleModal(), key(), statusName(), addressLike(), basicKept(), blankHarEnv(), blankKv() (+54 more)

### Community 21 - "with"
Cohesion: 0.05
Nodes (38): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+30 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "themes.ts"
Cohesion: 0.16
Nodes (22): useTheme(), SchemeRow(), alpha(), BUILTIN, BuiltinId, contrast(), DEFAULT_SCHEME, FAMILIES (+14 more)

### Community 25 - "store.ts"
Cohesion: 0.05
Nodes (48): capEnvironments(), clientStreams(), emit(), findMethod(), grpcCancel(), grpcEndSending(), GrpcEvent, grpcSend() (+40 more)

### Community 26 - "lib.rs"
Cohesion: 0.14
Nodes (6): ABOUT, build(), CHECK_UPDATES, CLOSE_TAB, CLOSE_WINDOW, on_event()

### Community 27 - "curl.ts"
Cohesion: 0.20
Nodes (14): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+6 more)

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (12): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+4 more)

### Community 29 - "Sidebar.tsx"
Cohesion: 0.12
Nodes (24): ClientRow(), RenameField(), EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView() (+16 more)

### Community 30 - "native.ts"
Cohesion: 0.19
Nodes (21): detect(), dropFilePaths(), parseDoc(), HarFile, Analysis, analyze(), importNative(), NATIVE_VERSION (+13 more)

### Community 31 - "sio.rs"
Cohesion: 0.08
Nodes (27): ACK, BINARY_ACK, BINARY_EVENT, Cmd, Close, Emit, CONNECT, CONNECT_ERROR (+19 more)

### Community 32 - "certs.rs"
Cohesion: 0.05
Nodes (53): a_dev_ca_and_a_client_certificate_reach_a_mutual_tls_server(), a_pfx_opens_with_its_passphrase_only(), a_private_key_is_not_taken_for_a_ca(), added_cert_fits(), AddedCertVerifier, an_openssl_self_signed_server_certificate_is_trusted_once_added(), ca_file_info_names_the_certificate(), CertConfig (+45 more)

### Community 33 - "Contributor Covenant Code of Conduct"
Cohesion: 0.29
Nodes (7): Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Responsibilities, Our Pledge, Our Standards, Scope

### Community 34 - "WsResponse.tsx"
Cohesion: 0.12
Nodes (27): AckWait(), closeLabel(), CloseRow(), duration(), EventFilter(), Handshake(), MessageList(), MessageRow() (+19 more)

### Community 35 - "postman.ts"
Cohesion: 0.20
Nodes (24): str(), convertAuth(), convertBody(), convertExamples(), convertItems(), count(), hasScript(), importPostman() (+16 more)

### Community 36 - "store.rs"
Cohesion: 0.19
Nodes (18): copy_atomic(), doc_path(), load_response(), load_state(), local_dir(), LOCAL_DOCS, migrate_to_vault(), MIGRATED_MARKER (+10 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "prelude.js"
Cohesion: 0.06
Nodes (27): Appearance and settings, Contributing, Development, Features, GraphQL, gRPC, History and examples, HTTP (+19 more)

### Community 39 - "DescriptorPool"
Cohesion: 0.33
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "ImportModal.tsx"
Cohesion: 0.16
Nodes (25): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+17 more)

### Community 41 - "Kv"
Cohesion: 0.18
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 42 - "DescriptorPool"
Cohesion: 0.28
Nodes (14): cached_pool(), compile_protos(), describe(), grpc_describe(), load_pool(), pool_key(), protos_compile_and_describe(), reflect() (+6 more)

### Community 43 - "App.tsx"
Cohesion: 0.10
Nodes (11): index.html SPA Entry, #root Mount Element, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTypeTokens(), EnvMenu() (+3 more)

### Community 46 - "UpdateChip.tsx"
Cohesion: 0.16
Nodes (13): AboutModal(), Line(), Notes(), UpdateCard(), Wait(), Notes(), mb(), noteLines() (+5 more)

### Community 47 - "RequestPane.tsx"
Cohesion: 0.11
Nodes (41): GrpcRequestPane(), Props, renameTab(), TitleName(), KVEditor(), MethodMenu(), AuthEditor(), BODY_MODES (+33 more)

### Community 50 - "attributes"
Cohesion: 0.13
Nodes (14): description, label, options, placeholder, value, body, attributes, id (+6 more)

### Community 52 - "types.ts"
Cohesion: 0.07
Nodes (29): ParsedGrpcurl, applyVarOps(), OPEN_SCRIPT, OpenScript, runScript(), ScriptOutput, SNIPPETS, TEXT_BODY (+21 more)

### Community 53 - "GrpcEvent"
Cohesion: 0.17
Nodes (15): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+7 more)

### Community 54 - "Modals.tsx"
Cohesion: 0.13
Nodes (24): CODE_SIZES, EnvColor(), FontRow(), Modals(), MONO_FONTS, ProjectModal(), PromptModal(), SaveModal() (+16 more)

### Community 55 - "script.rs"
Cohesion: 0.12
Nodes (24): async_tests_settle(), chai_edges(), console_is_capped(), endless_loop_is_stopped(), endless_promise_jobs_are_stopped(), errors_carry_the_line(), fail(), go() (+16 more)

### Community 56 - "GqlPane.tsx"
Cohesion: 0.12
Nodes (34): Args(), DocsBrowser(), fieldCount(), FieldRow(), GqlQueryEditor(), KIND_LABEL, kindLabel(), OperationPicker() (+26 more)

### Community 57 - "ResponsePane.tsx"
Cohesion: 0.11
Nodes (27): OPEN_GQL_LINE, OpenGqlLine, duration(), EndRow(), GrpcResponsePane(), MessageRow(), pretty(), SaveExampleButton() (+19 more)

### Community 58 - "ws.ts"
Cohesion: 0.08
Nodes (38): RFC-6455, prepareGrpc(), base64Utf8(), CONTENT_TYPES, prepare(), Prepared, WireBody, WireKV (+30 more)

### Community 59 - "net.ts"
Cohesion: 0.19
Nodes (14): NetworkPane(), apply(), checkHost(), DEFAULT_NET, DNS_PROVIDERS, listeners, NetCheck, netSettings() (+6 more)

### Community 60 - "Home.tsx"
Cohesion: 0.29
Nodes (5): greeting(), Home(), pathOf(), ago(), startOfDay()

### Community 63 - "body"
Cohesion: 0.13
Nodes (14): description, label, options, value, body, attributes, id, type (+6 more)

### Community 64 - "Conns"
Cohesion: 0.18
Nodes (9): Cmd, Close, Send, ConnGuard, Conns, Conns<C>, ws_close(), ws_send() (+1 more)

### Community 69 - "GrpcState"
Cohesion: 0.38
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

### Community 70 - "ResponseBody.tsx"
Cohesion: 0.14
Nodes (16): BodyViewer(), EXAMPLES, Filtered, filters, markMatches(), esc(), GQL_KEYWORDS, highlightGraphql() (+8 more)

### Community 71 - "varsFormat.ts"
Cohesion: 0.29
Nodes (11): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+3 more)

### Community 72 - "Runs.tsx"
Cohesion: 0.22
Nodes (9): when(), GRPC_CODES, RunBanner(), RunCells(), RunsButton(), useRuns(), runKey(), runsOf() (+1 more)

### Community 73 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2 (+10 more)

### Community 74 - "useStore"
Cohesion: 0.21
Nodes (17): CodeArea(), Props, MessageEditor(), MessageList(), UpdatesPane(), BodyEditor(), EmitEditor(), MessageEditor() (+9 more)

### Community 75 - "GrpcPane.tsx"
Cohesion: 0.10
Nodes (13): react, @tauri-apps/plugin-dialog, MethodPicker(), SchemaEditor(), Section, time(), ico, icoLg (+5 more)

### Community 76 - "gqlSchema.ts"
Cohesion: 0.20
Nodes (16): SchemaState(), useTabSchema(), emit(), fetchGqlSchema(), gqlSchemaKey(), GqlSchemaState, listeners, loadGqlSchemaFile() (+8 more)

### Community 77 - "Kv"
Cohesion: 0.29
Nodes (7): apply_metadata(), metadata_list(), Kv, RequestBody, FormUrlEncoded, Multipart, Text

### Community 78 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 79 - "contact_links"
Cohesion: 0.33
Nodes (5): blank_issues_enabled, contact_links, about, name, url

### Community 80 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Checklist, How I tested it, Screenshots, What and why

### Community 81 - "model.ts"
Cohesion: 0.13
Nodes (20): harBody(), harHeaders(), HarOptions, harPlan(), harResponse(), harToCollection(), hostVar(), readHar() (+12 more)

### Community 82 - "Enforcement Guidelines"
Cohesion: 0.40
Nodes (5): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Enforcement Guidelines

### Community 83 - "Architecture"
Cohesion: 0.25
Nodes (8): Architecture, Import and export, Live connections, Network and TLS, Sending an HTTP request, State and persistence, Two halves, Updates

### Community 84 - "run"
Cohesion: 0.21
Nodes (12): collect(), join_emit_ack_disconnect(), live_server(), run(), v2_connect_error(), run(), ws_connect(), WsEvent (+4 more)

### Community 86 - "Security policy"
Cohesion: 0.40
Nodes (5): How voidHTTP protects your data, Reporting a vulnerability, Scope, Security policy, Supported versions

### Community 87 - "commands.ts"
Cohesion: 0.23
Nodes (9): commandsSummary(), importCommands(), nameOf(), splitCommands(), ImportPlan, Note, NativeFile, Collection (+1 more)

### Community 88 - "files.rs"
Cohesion: 0.27
Nodes (8): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_ref_file(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file()

### Community 89 - "SioEvent"
Cohesion: 0.22
Nodes (11): sio_connect(), SioEvent, AckTimeout, Close, ConnectError, Engine, Joined, Message (+3 more)

### Community 90 - "updater.ts"
Cohesion: 0.39
Nodes (6): checkForUpdate(), hasPendingUpdate(), installUpdate(), message(), NOTE_PREFIX, restartToUpdate()

### Community 91 - "connect"
Cohesion: 0.29
Nodes (6): address_gets_scheme_and_port(), connect(), parse_address(), describe_error(), root_cause(), current()

### Community 92 - "UpdateChip"
Cohesion: 0.43
Nodes (3): UpdateChip(), UpdateState, Updates

### Community 93 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, tauri, typecheck

## Knowledge Gaps
- **28 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 542 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prepare()` connect `ws.ts` to `ImportModal.tsx`, `useStore`, `ExportModal.tsx`, `gqlSchema.ts`, `RequestPane.tsx`, `model.ts`, `Architecture`, `GqlPane.tsx`, `store.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07926829268292683 - nodes in this community are weakly interconnected._
- **Why does `Sending an HTTP request` connect `Architecture` to `ws.ts`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Should `net.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.05970149253731343 - nodes in this community are weakly interconnected._
- **Why does `Architecture` connect `Architecture` to `CONTRIBUTING.md`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Should `ws.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09659090909090909 - nodes in this community are weakly interconnected._