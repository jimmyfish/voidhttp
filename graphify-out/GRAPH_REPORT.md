# Graph Report - voidHTTP  (2026-11-16)

## Corpus Check
- 109 files · ~199,412 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 25 file(s) not represented in the graph (top: .css 16, (none) 5, .lock 1)

## Summary
- 1856 nodes · 4741 edges · 93 communities (74 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `07f37ffb`
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
- stripJsonComments
- Crate Package
- common.ts
- with
- cache.yml
- themes.ts
- GrpcPane.tsx
- net.ts
- curl.ts
- grpc.rs
- CertificatesPane.tsx
- native.ts
- sio.rs
- certs.rs
- Contributor Covenant Code of Conduct
- ResponseBody.tsx
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
- lib.rs
- package.json
- model.ts
- gqlSchema.ts
- index.ts
- script.ts
- run
- contact_links
- pull_request_template.md
- har.ts
- Enforcement Guidelines
- Architecture
- devDependencies
- CONTRIBUTING.md
- Security policy
- files.rs
- updater.ts
- UpdateChip
- main.tsx
- ResponsePane.tsx
- scripts

## God Nodes (most connected - your core abstractions)
1. `useStore` - 70 edges
2. `State` - 58 edges
3. `RequestPane()` - 41 edges
4. `react` - 40 edges
5. `uid()` - 38 edges
6. `kv()` - 28 edges
7. `GrpcRequestPane()` - 26 edges
8. `ico` - 26 edges
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

## Communities (93 total, 19 thin omitted)

### Community 0 - "Contributing to voidHTTP"
Cohesion: 0.18
Nodes (11): AI agents, Before you start, Checks, Code style, Commits and pull requests, Contributing to voidHTTP, License, Principles (+3 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.07
Nodes (20): build_multipart(), cancel_request(), ClientKey, execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState (+12 more)

### Community 2 - "Changelog"
Cohesion: 0.13
Nodes (15): [0.1.3] - 2026-11-13, [0.1.4] - 2026-11-13, [0.1.5] - 2026-11-13, [0.1.6] - 2026-11-16, Added, Added, Added, Added (+7 more)

### Community 3 - "net.rs"
Cohesion: 0.06
Nodes (33): CERTS, ALWAYS_DIRECT, bootstrap(), connect_any(), custom_group(), doh_resolver(), http_connect(), http_connect_tunnel() (+25 more)

### Community 4 - "ws.rs"
Cohesion: 0.10
Nodes (16): bad_header_is_an_error(), build_request(), echo_and_close(), Handshake, handshake_headers_are_kept_and_extras_added(), header_list(), is_handshake_header(), MAX_REFUSED_BODY (+8 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.05
Nodes (4): State, ExampleRef, ProjectData, ProjectMeta

### Community 7 - "WsResponse.tsx"
Cohesion: 0.11
Nodes (29): AckWait(), closeLabel(), CloseRow(), duration(), EventFilter(), Handshake(), MessageList(), MessageRow() (+21 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.12
Nodes (27): Any, parseDoc(), Source, Build, buildAuth(), buildBody(), buildExamples(), buildOpenApi() (+19 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.14
Nodes (18): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+10 more)

### Community 12 - "ExportModal.tsx"
Cohesion: 0.16
Nodes (20): @tauri-apps/api, DropImport(), Envs, ExportModal(), Format, FORMATS, plural(), baseName() (+12 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "stripJsonComments"
Cohesion: 0.19
Nodes (19): react, CodeArea(), Props, MessageEditor(), MessageList(), UpdatesPane(), BodyEditor(), ScriptsEditor() (+11 more)

### Community 20 - "common.ts"
Cohesion: 0.17
Nodes (32): addressLike(), basicKept(), blankHarEnv(), blankKv(), blankSecretJson(), blankSecretKv(), blankSecretXml(), blankValues() (+24 more)

### Community 21 - "with"
Cohesion: 0.05
Nodes (40): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+32 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "themes.ts"
Cohesion: 0.17
Nodes (21): useTheme(), alpha(), BUILTIN, BuiltinId, contrast(), DEFAULT_SCHEME, FAMILIES, findScheme() (+13 more)

### Community 25 - "GrpcPane.tsx"
Cohesion: 0.07
Nodes (30): MethodPicker(), SchemaEditor(), Section, time(), clientStreams(), emit(), findMethod(), grpcCancel() (+22 more)

### Community 26 - "net.ts"
Cohesion: 0.19
Nodes (14): NetworkPane(), apply(), checkHost(), DEFAULT_NET, DNS_PROVIDERS, listeners, NetCheck, netSettings() (+6 more)

### Community 27 - "curl.ts"
Cohesion: 0.11
Nodes (20): @tauri-apps/plugin-dialog, Props, Row, ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson() (+12 more)

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (13): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+5 more)

### Community 29 - "CertificatesPane.tsx"
Cohesion: 0.12
Nodes (27): CaRow(), CERT_FILES, CertificatesPane(), ClientForm(), ClientRow(), FilePick(), KEY_FILES, PFX_FILES (+19 more)

### Community 30 - "native.ts"
Cohesion: 0.15
Nodes (22): Found, importNative(), NATIVE_VERSION, NativeFile, num(), pairs(), rows(), sane() (+14 more)

### Community 31 - "sio.rs"
Cohesion: 0.08
Nodes (27): ACK, BINARY_ACK, BINARY_EVENT, Cmd, Close, Emit, CONNECT, CONNECT_ERROR (+19 more)

### Community 32 - "certs.rs"
Cohesion: 0.05
Nodes (53): a_dev_ca_and_a_client_certificate_reach_a_mutual_tls_server(), a_pfx_opens_with_its_passphrase_only(), a_private_key_is_not_taken_for_a_ca(), added_cert_fits(), AddedCertVerifier, an_openssl_self_signed_server_certificate_is_trusted_once_added(), ca_file_info_names_the_certificate(), CertConfig (+45 more)

### Community 33 - "Contributor Covenant Code of Conduct"
Cohesion: 0.29
Nodes (7): Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Responsibilities, Our Pledge, Our Standards, Scope

### Community 34 - "ResponseBody.tsx"
Cohesion: 0.10
Nodes (24): duration(), EndRow(), MessageRow(), pretty(), seconds(), StatusLine(), Sub, BodyViewer() (+16 more)

### Community 35 - "postman.ts"
Cohesion: 0.20
Nodes (25): str(), convertAuth(), convertBody(), convertExamples(), convertItems(), count(), exportPostman(), hasScript() (+17 more)

### Community 36 - "store.rs"
Cohesion: 0.22
Nodes (18): copy_atomic(), doc_path(), load_response(), load_state(), local_dir(), LOCAL_DOCS, migrate_to_vault(), MIGRATED_MARKER (+10 more)

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
Cohesion: 0.17
Nodes (25): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+17 more)

### Community 41 - "Kv"
Cohesion: 0.13
Nodes (7): apply_metadata(), DynamicCodec, DynamicDecoder, DynamicEncoder, metadata_list(), Kv, SioRequest

### Community 42 - "DescriptorPool"
Cohesion: 0.28
Nodes (14): cached_pool(), compile_protos(), describe(), grpc_describe(), InvokeRequest, load_pool(), pool_key(), protos_compile_and_describe() (+6 more)

### Community 43 - "App.tsx"
Cohesion: 0.10
Nodes (15): App(), SIDEBAR_DEFAULT, stack(), useTypeTokens(), Mark(), ShortcutsPane(), SideView, TabsBar() (+7 more)

### Community 46 - "UpdateChip.tsx"
Cohesion: 0.17
Nodes (12): AboutModal(), Line(), Notes(), UpdateCard(), Wait(), Notes(), mb(), noteLines() (+4 more)

### Community 47 - "SioPane.tsx"
Cohesion: 0.11
Nodes (37): GrpcRequestPane(), Props, ico, icoLg, TitleName(), KVEditor(), MethodMenu(), AuthEditor() (+29 more)

### Community 50 - "attributes"
Cohesion: 0.13
Nodes (14): description, label, options, placeholder, value, body, attributes, id (+6 more)

### Community 52 - "connect"
Cohesion: 0.29
Nodes (6): address_gets_scheme_and_port(), connect(), parse_address(), describe_error(), root_cause(), current()

### Community 53 - "GrpcEvent"
Cohesion: 0.18
Nodes (14): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+6 more)

### Community 54 - "Modals.tsx"
Cohesion: 0.11
Nodes (26): EnvMenu(), CODE_SIZES, EnvColor(), FontRow(), Modals(), MONO_FONTS, ProjectModal(), PromptModal() (+18 more)

### Community 55 - "script.rs"
Cohesion: 0.12
Nodes (24): async_tests_settle(), chai_edges(), console_is_capped(), endless_loop_is_stopped(), endless_promise_jobs_are_stopped(), errors_carry_the_line(), fail(), go() (+16 more)

### Community 56 - "GqlPane.tsx"
Cohesion: 0.11
Nodes (37): Args(), DocsBrowser(), fieldCount(), FieldRow(), GqlQueryEditor(), KIND_LABEL, kindLabel(), OperationPicker() (+29 more)

### Community 57 - "QuickOpen.tsx"
Cohesion: 0.08
Nodes (18): greeting(), Home(), pathOf(), ExIcon(), Fields, fuzzy(), Item, Marked() (+10 more)

### Community 58 - "store.ts"
Cohesion: 0.04
Nodes (72): RFC-6455, capEnvironments(), isGrpc(), ParsedGrpcurl, prepareGrpc(), schemaOf(), base64Utf8(), CONTENT_TYPES (+64 more)

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
Cohesion: 0.14
Nodes (29): allRequests(), ExampleModal(), key(), statusName(), applyMasks(), COOKIE_ATTRS, COOKIE_FLAGS, findSensitive() (+21 more)

### Community 71 - "varsFormat.ts"
Cohesion: 0.33
Nodes (10): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+2 more)

### Community 72 - "lib.rs"
Cohesion: 0.14
Nodes (6): ABOUT, build(), CHECK_UPDATES, CLOSE_TAB, CLOSE_WINDOW, on_event()

### Community 73 - "package.json"
Cohesion: 0.12
Nodes (20): dependencies, lucide-react@^0.460.0, react@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2, @tauri-apps/plugin-updater@^2 (+12 more)

### Community 74 - "model.ts"
Cohesion: 0.14
Nodes (14): renameTab(), useTabExample(), DropWhere, findNode(), insertNode(), mapTree(), MAX_PARAMS, METHODS (+6 more)

### Community 75 - "gqlSchema.ts"
Cohesion: 0.24
Nodes (14): useTabSchema(), readTextFile(), emit(), fetchGqlSchema(), gqlSchemaKey(), GqlSchemaState, listeners, loadGqlSchemaFile() (+6 more)

### Community 76 - "index.ts"
Cohesion: 0.25
Nodes (12): shellWords(), commandsSummary(), importCommands(), nameOf(), splitCommands(), detect(), dropFilePaths(), ImportPlan (+4 more)

### Community 77 - "script.ts"
Cohesion: 0.15
Nodes (14): applyVarOps(), hasScript(), OPEN_SCRIPT, OpenScript, runScript(), ScriptOutput, SNIPPETS, TEXT_BODY (+6 more)

### Community 78 - "run"
Cohesion: 0.12
Nodes (22): collect(), join_emit_ack_disconnect(), live_server(), run(), sio_connect(), SioEvent, AckTimeout, Close (+14 more)

### Community 79 - "contact_links"
Cohesion: 0.33
Nodes (5): blank_issues_enabled, contact_links, about, name, url

### Community 80 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Checklist, How I tested it, Screenshots, What and why

### Community 81 - "har.ts"
Cohesion: 0.19
Nodes (14): Note, harBody(), HarFile, harHeaders(), HarOptions, harPlan(), harResponse(), HarRow (+6 more)

### Community 82 - "Enforcement Guidelines"
Cohesion: 0.40
Nodes (5): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Enforcement Guidelines

### Community 83 - "Architecture"
Cohesion: 0.25
Nodes (8): Architecture, Import and export, Live connections, Network and TLS, Sending an HTTP request, State and persistence, Two halves, Updates

### Community 84 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @tauri-apps/cli@^2.0.0, @types/react@^18.3.11, @types/react-dom@^18.3.1, typescript@^5.6.3, vite@^5.4.10, @vitejs/plugin-react@^4.3.2, @tauri-apps/cli (+5 more)

### Community 86 - "Security policy"
Cohesion: 0.40
Nodes (5): How voidHTTP protects your data, Reporting a vulnerability, Scope, Security policy, Supported versions

### Community 87 - "files.rs"
Cohesion: 0.27
Nodes (8): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_ref_file(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file()

### Community 88 - "updater.ts"
Cohesion: 0.33
Nodes (7): checkForUpdate(), hasPendingUpdate(), installUpdate(), message(), NOTE_PREFIX, REPO_URL, restartToUpdate()

### Community 89 - "UpdateChip"
Cohesion: 0.36
Nodes (4): AppStrip(), UpdateChip(), UpdateState, Updates

### Community 90 - "main.tsx"
Cohesion: 0.33
Nodes (4): index.html SPA Entry, #root Mount Element, react-dom@^18.3.1, react-dom

### Community 91 - "ResponsePane.tsx"
Cohesion: 0.11
Nodes (27): OPEN_GQL_LINE, OpenGqlLine, GrpcResponsePane(), SaveExampleButton(), UnaryBody(), ExampleBanner(), PairsTable(), when() (+19 more)

### Community 92 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, tauri, typecheck

## Knowledge Gaps
- **28 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 555 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prepare()` connect `store.ts` to `ImportModal.tsx`, `gqlSchema.ts`, `ExportModal.tsx`, `SioPane.tsx`, `har.ts`, `stripJsonComments`, `Architecture`, `GqlPane.tsx`, `GrpcPane.tsx`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07171717171717172 - nodes in this community are weakly interconnected._
- **Why does `Sending an HTTP request` connect `Architecture` to `store.ts`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `Changelog` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Why does `Architecture` connect `Architecture` to `CONTRIBUTING.md`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `net.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.05970149253731343 - nodes in this community are weakly interconnected._