# Graph Report - voidHTTP  (2026-11-16)

## Corpus Check
- 111 files · ~211,366 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 27 file(s) not represented in the graph (top: .css 18, (none) 5, .lock 1)

## Summary
- 1868 nodes · 4777 edges · 92 communities (73 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8b686a87`
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
- react
- Crate Package
- common.ts
- with
- cache.yml
- themes.ts
- GrpcPane.tsx
- net.ts
- RequestPane.tsx
- grpc.rs
- CertificatesPane.tsx
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
- Kv
- DescriptorPool
- useStore
- UpdateChip.tsx
- SioPane.tsx
- attributes
- connect
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
- Home.tsx
- package.json
- model.ts
- gqlSchema.ts
- commands.ts
- types.ts
- run
- contact_links
- pull_request_template.md
- Runs.tsx
- Enforcement Guidelines
- Architecture
- devDependencies
- CONTRIBUTING.md
- Security policy
- Kv
- updater.ts
- UpdateChip
- ResponsePane.tsx
- scripts

## God Nodes (most connected - your core abstractions)
1. `useStore` - 71 edges
2. `State` - 58 edges
3. `RequestPane()` - 41 edges
4. `react` - 40 edges
5. `uid()` - 38 edges
6. `kv()` - 28 edges
7. `ico` - 27 edges
8. `GrpcRequestPane()` - 26 edges
9. `Parser` - 25 edges
10. `stripJsonComments()` - 23 edges

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
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`
- 1-file cycle: `src-tauri/src/files.rs -> src-tauri/src/files.rs`

## Communities (92 total, 19 thin omitted)

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
Cohesion: 0.06
Nodes (33): CERTS, ALWAYS_DIRECT, bootstrap(), connect_any(), custom_group(), doh_resolver(), http_connect(), http_connect_tunnel() (+25 more)

### Community 4 - "ws.rs"
Cohesion: 0.10
Nodes (15): bad_header_is_an_error(), build_request(), echo_and_close(), handshake_headers_are_kept_and_extras_added(), header_list(), is_handshake_header(), MAX_REFUSED_BODY, normalize_url() (+7 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.05
Nodes (4): State, ExampleRef, ProjectData, ProjectMeta

### Community 7 - "WsResponse.tsx"
Cohesion: 0.10
Nodes (29): AckWait(), closeLabel(), CloseRow(), duration(), EventFilter(), Handshake(), MessageList(), MessageRow() (+21 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.09
Nodes (35): Any, detect(), parseDoc(), Source, HarFile, HarRow, readHar(), siteOf() (+27 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.13
Nodes (19): child(), children(), CMP, compile(), equal(), evaluate(), Expr, has() (+11 more)

### Community 12 - "ExportModal.tsx"
Cohesion: 0.16
Nodes (21): @tauri-apps/api, Envs, ExportModal(), Format, FORMATS, plural(), baseName(), IMPORT_EXTENSIONS (+13 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "react"
Cohesion: 0.11
Nodes (8): react, EnvMenu(), ico, icoLg, EXAMPLES, Filtered, filters, markMatches()

### Community 20 - "common.ts"
Cohesion: 0.16
Nodes (32): addressLike(), basicKept(), blankHarEnv(), blankKv(), blankSecretJson(), blankSecretKv(), blankSecretXml(), blankValues() (+24 more)

### Community 21 - "with"
Cohesion: 0.05
Nodes (40): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+32 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "themes.ts"
Cohesion: 0.16
Nodes (20): SchemeRow(), alpha(), BUILTIN, BuiltinId, contrast(), DEFAULT_SCHEME, FAMILIES, fit() (+12 more)

### Community 25 - "GrpcPane.tsx"
Cohesion: 0.08
Nodes (34): GrpcRequestPane(), MethodPicker(), SchemaEditor(), Section, time(), clientStreams(), defaultGrpc(), emit() (+26 more)

### Community 26 - "net.ts"
Cohesion: 0.20
Nodes (13): NetworkPane(), apply(), checkHost(), DEFAULT_NET, DNS_PROVIDERS, listeners, NetCheck, netSettings() (+5 more)

### Community 27 - "RequestPane.tsx"
Cohesion: 0.11
Nodes (39): KVEditor(), MethodMenu(), AuthEditor(), BODY_MODES, BodyEditor(), RequestPane(), SCRIPT_TEXT, ScriptsEditor() (+31 more)

### Community 28 - "grpc.rs"
Cohesion: 0.09
Nodes (12): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+4 more)

### Community 29 - "CertificatesPane.tsx"
Cohesion: 0.14
Nodes (27): CaRow(), CERT_FILES, CertificatesPane(), ClientForm(), ClientRow(), FilePick(), KEY_FILES, PFX_FILES (+19 more)

### Community 30 - "native.ts"
Cohesion: 0.24
Nodes (17): importNative(), NATIVE_VERSION, num(), pairs(), rows(), sane(), saneAuth(), saneGql() (+9 more)

### Community 31 - "sio.rs"
Cohesion: 0.08
Nodes (31): ACK, BINARY_ACK, BINARY_EVENT, Cmd, Close, Emit, collect(), CONNECT (+23 more)

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
Nodes (26): dropFilePaths(), str(), analyze(), convertAuth(), convertBody(), convertExamples(), convertItems(), count() (+18 more)

### Community 36 - "store.rs"
Cohesion: 0.07
Nodes (32): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_ref_file(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file() (+24 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "prelude.js"
Cohesion: 0.05
Nodes (30): <img src="docs/assets/icons/ban.svg" width="24" height="24" align="top" alt="" /> Never on the wishlist, <img src="docs/assets/icons/circle-help.svg" width="24" height="24" align="top" alt="" /> Why another API client?, <img src="docs/assets/icons/code-xml.svg" width="24" height="24" align="top" alt="" /> Hack on it, <img src="docs/assets/icons/database.svg" width="24" height="24" align="top" alt="" /> Where's my data?, <img src="docs/assets/icons/download.svg" width="24" height="24" align="top" alt="" /> Get it, <img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones), <img src="docs/assets/icons/folder-tree.svg" width="20" height="20" align="top" alt="" /> Projects, tabs, the whole workspace, <img src="docs/assets/icons/globe.svg" width="20" height="20" align="top" alt="" /> HTTP, done properly (+22 more)

### Community 39 - "DescriptorPool"
Cohesion: 0.33
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "ImportModal.tsx"
Cohesion: 0.15
Nodes (25): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+17 more)

### Community 41 - "Kv"
Cohesion: 0.18
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 42 - "DescriptorPool"
Cohesion: 0.28
Nodes (14): cached_pool(), compile_protos(), describe(), grpc_describe(), load_pool(), pool_key(), protos_compile_and_describe(), reflect() (+6 more)

### Community 43 - "useStore"
Cohesion: 0.20
Nodes (17): index.html SPA Entry, #root Mount Element, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTheme(), useTypeTokens() (+9 more)

### Community 46 - "UpdateChip.tsx"
Cohesion: 0.17
Nodes (11): AboutModal(), BuildCard(), Line(), Notes(), UpdateCard(), Wait(), BuildBadge(), mb() (+3 more)

### Community 47 - "SioPane.tsx"
Cohesion: 0.10
Nodes (30): CodeArea(), Props, MessageEditor(), Props, renameTab(), TitleName(), EmitEditor(), Props (+22 more)

### Community 50 - "attributes"
Cohesion: 0.13
Nodes (14): description, label, options, placeholder, value, body, attributes, id (+6 more)

### Community 52 - "connect"
Cohesion: 0.29
Nodes (6): address_gets_scheme_and_port(), connect(), parse_address(), describe_error(), root_cause(), current()

### Community 53 - "GrpcEvent"
Cohesion: 0.17
Nodes (15): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+7 more)

### Community 54 - "Modals.tsx"
Cohesion: 0.11
Nodes (28): CODE_SIZES, DevUpdatesPane(), EnvColor(), FontRow(), Modals(), MONO_FONTS, ProjectModal(), PromptModal() (+20 more)

### Community 55 - "script.rs"
Cohesion: 0.10
Nodes (24): async_tests_settle(), chai_edges(), console_is_capped(), endless_loop_is_stopped(), endless_promise_jobs_are_stopped(), errors_carry_the_line(), fail(), go() (+16 more)

### Community 56 - "GqlPane.tsx"
Cohesion: 0.10
Nodes (38): Args(), DocsBrowser(), fieldCount(), FieldRow(), GqlQueryEditor(), KIND_LABEL, kindLabel(), OPEN_GQL_LINE (+30 more)

### Community 57 - "QuickOpen.tsx"
Cohesion: 0.07
Nodes (19): ExIcon(), Fields, fuzzy(), Item, Marked(), Method(), METHOD_WORDS, pathOf() (+11 more)

### Community 58 - "store.ts"
Cohesion: 0.06
Nodes (51): RFC-6455, prepareGrpc(), base64Utf8(), CONTENT_TYPES, prepare(), Prepared, WireBody, WireKV (+43 more)

### Community 59 - "Sidebar.tsx"
Cohesion: 0.12
Nodes (27): RenameField(), EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView(), containerIds() (+19 more)

### Community 60 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 63 - "body"
Cohesion: 0.13
Nodes (14): description, label, options, value, body, attributes, id, type (+6 more)

### Community 64 - "Conns"
Cohesion: 0.18
Nodes (9): Cmd, Close, Send, ConnGuard, Conns, Conns<C>, ws_close(), ws_send() (+1 more)

### Community 69 - "GrpcState"
Cohesion: 0.38
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

### Community 70 - "mask.ts"
Cohesion: 0.12
Nodes (33): allRequests(), ExampleModal(), key(), statusName(), Select(), scrubNodes(), applyMasks(), COOKIE_ATTRS (+25 more)

### Community 71 - "varsFormat.ts"
Cohesion: 0.33
Nodes (10): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+2 more)

### Community 72 - "Home.tsx"
Cohesion: 0.33
Nodes (7): greeting(), Home(), pathOf(), entryStatus(), methodLabel(), ago(), startOfDay()

### Community 73 - "package.json"
Cohesion: 0.11
Nodes (23): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2 (+15 more)

### Community 74 - "model.ts"
Cohesion: 0.16
Nodes (12): DropWhere, insertNode(), mapTree(), MAX_PARAMS, METHODS, nodeIds(), pathTo(), placeNode() (+4 more)

### Community 75 - "gqlSchema.ts"
Cohesion: 0.25
Nodes (13): useTabSchema(), emit(), fetchGqlSchema(), gqlSchemaKey(), listeners, loadGqlSchemaFile(), put(), schemas (+5 more)

### Community 76 - "commands.ts"
Cohesion: 0.21
Nodes (10): Found, commandsSummary(), importCommands(), nameOf(), splitCommands(), ImportPlan, Note, NativeFile (+2 more)

### Community 77 - "types.ts"
Cohesion: 0.07
Nodes (39): Props, Row, harBody(), harResponse(), harToCollection(), hostVar(), ParsedGrpcurl, applyVarOps() (+31 more)

### Community 78 - "run"
Cohesion: 0.13
Nodes (20): run(), sio_connect(), SioEvent, AckTimeout, Close, ConnectError, Engine, Joined (+12 more)

### Community 79 - "contact_links"
Cohesion: 0.33
Nodes (5): blank_issues_enabled, contact_links, about, name, url

### Community 80 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Checklist, How I tested it, Screenshots, What and why

### Community 81 - "Runs.tsx"
Cohesion: 0.29
Nodes (4): GRPC_CODES, useRuns(), runKey(), runsOf()

### Community 82 - "Enforcement Guidelines"
Cohesion: 0.40
Nodes (5): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Enforcement Guidelines

### Community 83 - "Architecture"
Cohesion: 0.25
Nodes (8): Architecture, Import and export, Live connections, Network and TLS, Sending an HTTP request, State and persistence, Two halves, Updates

### Community 84 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @tauri-apps/cli@^2.0.0, @types/react@^18.3.11, @types/react-dom@^18.3.1, typescript@^5.6.3, vite@^5.4.10, @vitejs/plugin-react@^4.3.2, @tauri-apps/cli (+7 more)

### Community 86 - "Security policy"
Cohesion: 0.40
Nodes (5): How voidHTTP protects your data, Reporting a vulnerability, Scope, Security policy, Supported versions

### Community 87 - "Kv"
Cohesion: 0.67
Nodes (3): apply_metadata(), metadata_list(), Kv

### Community 88 - "updater.ts"
Cohesion: 0.21
Nodes (11): DEV_BUILD, DevBuild, checkForUpdate(), hasPendingUpdate(), installUpdate(), message(), NOTE_PREFIX, noteLines() (+3 more)

### Community 89 - "UpdateChip"
Cohesion: 0.36
Nodes (4): Notes(), UpdateChip(), UpdateState, Updates

### Community 91 - "ResponsePane.tsx"
Cohesion: 0.13
Nodes (31): duration(), EndRow(), GrpcResponsePane(), MessageList(), MessageRow(), pretty(), SaveExampleButton(), seconds() (+23 more)

### Community 92 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, tauri, typecheck

## Knowledge Gaps
- **28 isolated node(s):** `voidHTTP App Icon`, `#root Mount Element`, `FormUrlEncoded`, `Multipart`, `Text` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 557 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prepare()` connect `store.ts` to `ImportModal.tsx`, `gqlSchema.ts`, `ExportModal.tsx`, `types.ts`, `Architecture`, `GrpcPane.tsx`, `RequestPane.tsx`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `voidHTTP App Icon`, `#root Mount Element`, `FormUrlEncoded` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07641196013289037 - nodes in this community are weakly interconnected._
- **Why does `Sending an HTTP request` connect `Architecture` to `store.ts`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Should `Changelog` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Why does `Architecture` connect `Architecture` to `CONTRIBUTING.md`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Should `net.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.061072261072261075 - nodes in this community are weakly interconnected._