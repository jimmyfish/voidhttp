# Graph Report - voidHTTP  (2026-11-16)

## Corpus Check
- 105 files · ~185,452 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .css 15, (none) 5, .lock 1)

## Summary
- 1806 nodes · 4609 edges · 99 communities (74 shown, 25 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `62a2e035`
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
- RequestPane.tsx
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
- GrpcPane.tsx
- useStore
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
- tags.ts
- UpdateChip.tsx
- SioPane.tsx
- attributes
- model.ts
- GrpcEvent
- Modals.tsx
- script.rs
- GqlPane.tsx
- ResponsePane.tsx
- ws.ts
- .build
- Net
- ConnGuard<'_, C>
- body
- Conns
- GrpcState
- net.ts
- varsFormat.ts
- Runs.tsx
- dependencies
- stripJsonComments
- GrpcResponse.tsx
- react
- Kv
- fonts.rs
- contact_links
- pull_request_template.md
- har.ts
- Enforcement Guidelines
- Architecture
- jsonc.ts
- Security policy
- connect
- highlightLines
- SioEvent
- updater.ts
- ExampleRef
- UpdateChip
- scripts
- Example
- DropWhere
- ProjectData
- ProjectMeta
- RequestBody

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

## Communities (99 total, 25 thin omitted)

### Community 0 - "Contributing to voidHTTP"
Cohesion: 0.18
Nodes (11): AI agents, Before you start, Checks, Code style, Commits and pull requests, Contributing to voidHTTP, License, Principles (+3 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.09
Nodes (14): cancel_request(), ClientKey, execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState, InflightGuard (+6 more)

### Community 2 - "Changelog"
Cohesion: 0.15
Nodes (13): [0.1.3] - 2026-11-13, [0.1.4] - 2026-11-13, [0.1.5] - 2026-11-13, [0.1.6] - 2026-11-16, Added, Added, Added, Changed (+5 more)

### Community 3 - "net.rs"
Cohesion: 0.08
Nodes (19): CERTS, ALWAYS_DIRECT, http_connect_tunnel(), lists_cover_subdomains(), matches_any(), NET, NetCheck, NetStep (+11 more)

### Community 4 - "ws.rs"
Cohesion: 0.09
Nodes (17): bad_header_is_an_error(), build_request(), CLOSE_GRACE, echo_and_close(), Handshake, handshake_headers_are_kept_and_extras_added(), header_list(), is_handshake_header() (+9 more)

### Community 7 - "RequestPane.tsx"
Cohesion: 0.15
Nodes (21): GrpcRequestPane(), icoLg, renameTab(), TitleName(), AuthEditor(), BODY_MODES, RequestPane(), SCRIPT_TEXT (+13 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.10
Nodes (33): Any, detect(), parseDoc(), Source, HarFile, HarRow, Analysis, analyze() (+25 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.13
Nodes (19): child(), children(), CMP, compile(), equal(), evaluate(), Expr, has() (+11 more)

### Community 12 - "ExportModal.tsx"
Cohesion: 0.19
Nodes (17): @tauri-apps/api, Envs, ExportModal(), Format, FORMATS, plural(), baseName(), IMPORT_EXTENSIONS (+9 more)

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
Nodes (40): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+32 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "themes.ts"
Cohesion: 0.16
Nodes (22): useTheme(), SchemeRow(), alpha(), BUILTIN, BuiltinId, contrast(), DEFAULT_SCHEME, FAMILIES (+14 more)

### Community 25 - "GrpcPane.tsx"
Cohesion: 0.06
Nodes (37): @tauri-apps/plugin-dialog, MethodPicker(), SchemaEditor(), Section, time(), clientStreams(), emit(), findMethod() (+29 more)

### Community 26 - "useStore"
Cohesion: 0.14
Nodes (14): index.html SPA Entry, #root Mount Element, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTypeTokens(), DropImport() (+6 more)

### Community 27 - "curl.ts"
Cohesion: 0.18
Nodes (16): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+8 more)

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (13): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+5 more)

### Community 29 - "Sidebar.tsx"
Cohesion: 0.05
Nodes (57): CaRow(), CERT_FILES, CertificatesPane(), ClientForm(), ClientRow(), FilePick(), KEY_FILES, PFX_FILES (+49 more)

### Community 30 - "native.ts"
Cohesion: 0.21
Nodes (21): dropFilePaths(), ImportPlan, importNative(), NATIVE_VERSION, NativeFile, num(), pairs(), rows() (+13 more)

### Community 31 - "sio.rs"
Cohesion: 0.09
Nodes (24): ACK, BINARY_ACK, BINARY_EVENT, Cmd, Close, Emit, CONNECT, CONNECT_ERROR (+16 more)

### Community 32 - "certs.rs"
Cohesion: 0.05
Nodes (53): a_dev_ca_and_a_client_certificate_reach_a_mutual_tls_server(), a_pfx_opens_with_its_passphrase_only(), a_private_key_is_not_taken_for_a_ca(), added_cert_fits(), AddedCertVerifier, an_openssl_self_signed_server_certificate_is_trusted_once_added(), ca_file_info_names_the_certificate(), CertConfig (+45 more)

### Community 33 - "Contributor Covenant Code of Conduct"
Cohesion: 0.29
Nodes (7): Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Responsibilities, Our Pledge, Our Standards, Scope

### Community 34 - "WsResponse.tsx"
Cohesion: 0.10
Nodes (29): AckWait(), closeLabel(), CloseRow(), duration(), EventFilter(), Handshake(), MessageList(), MessageRow() (+21 more)

### Community 35 - "postman.ts"
Cohesion: 0.16
Nodes (25): str(), convertAuth(), convertBody(), convertExamples(), convertItems(), count(), exportPostman(), hasScript() (+17 more)

### Community 36 - "store.rs"
Cohesion: 0.22
Nodes (18): copy_atomic(), doc_path(), load_response(), load_state(), local_dir(), LOCAL_DOCS, migrate_to_vault(), MIGRATED_MARKER (+10 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "prelude.js"
Cohesion: 0.06
Nodes (29): <img src="docs/assets/icons/circle-help.svg" width="24" height="24" align="top" alt="" /> Why another API client?, <img src="docs/assets/icons/code-xml.svg" width="24" height="24" align="top" alt="" /> Hack on it, <img src="docs/assets/icons/database.svg" width="24" height="24" align="top" alt="" /> Where's my data?, <img src="docs/assets/icons/download.svg" width="24" height="24" align="top" alt="" /> Get it, <img src="docs/assets/icons/flask-conical.svg" width="20" height="20" align="top" alt="" /> Scripts (yes, your Postman ones), <img src="docs/assets/icons/folder-tree.svg" width="20" height="20" align="top" alt="" /> Projects, tabs, the whole workspace, <img src="docs/assets/icons/globe.svg" width="20" height="20" align="top" alt="" /> HTTP, done properly, <img src="docs/assets/icons/history.svg" width="20" height="20" align="top" alt="" /> History and examples (+21 more)

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
Nodes (14): cached_pool(), compile_protos(), describe(), grpc_describe(), InvokeRequest, load_pool(), pool_key(), protos_compile_and_describe() (+6 more)

### Community 43 - "tags.ts"
Cohesion: 0.38
Nodes (6): EnvMenu(), EnvColor(), envStyle(), TAG_COLORS, TagColor, tagName()

### Community 46 - "UpdateChip.tsx"
Cohesion: 0.16
Nodes (13): AboutModal(), Line(), Notes(), UpdateCard(), Wait(), Notes(), mb(), noteLines() (+5 more)

### Community 47 - "SioPane.tsx"
Cohesion: 0.14
Nodes (21): Props, MethodMenu(), Props, Section, SettingsEditor(), SioRequestPane(), Props, Tok (+13 more)

### Community 50 - "attributes"
Cohesion: 0.13
Nodes (14): description, label, options, placeholder, value, body, attributes, id (+6 more)

### Community 52 - "model.ts"
Cohesion: 0.16
Nodes (14): cloneRequest(), insertNode(), mapTree(), MAX_PARAMS, METHODS, nodeIds(), placeNode(), removeFromTree() (+6 more)

### Community 53 - "GrpcEvent"
Cohesion: 0.18
Nodes (14): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+6 more)

### Community 54 - "Modals.tsx"
Cohesion: 0.15
Nodes (18): CODE_SIZES, FontRow(), Modals(), MONO_FONTS, ProjectModal(), PromptModal(), SaveModal(), Shell() (+10 more)

### Community 55 - "script.rs"
Cohesion: 0.05
Nodes (38): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_ref_file(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file() (+30 more)

### Community 56 - "GqlPane.tsx"
Cohesion: 0.08
Nodes (49): Args(), DocsBrowser(), fieldCount(), FieldRow(), KIND_LABEL, kindLabel(), OPEN_GQL_LINE, OpenGqlLine (+41 more)

### Community 57 - "ResponsePane.tsx"
Cohesion: 0.22
Nodes (14): ScriptsEditor(), ExampleBanner(), ConsoleList(), ConsoleView(), GqlErrorList(), HttpResponsePane(), openScript(), ResponsePane() (+6 more)

### Community 58 - "ws.ts"
Cohesion: 0.05
Nodes (72): RFC-6455, capEnvironments(), gqlAsHttp(), prepareGrpc(), base64Utf8(), CONTENT_TYPES, prepare(), WireBody (+64 more)

### Community 59 - ".build"
Cohesion: 0.17
Nodes (8): bootstrap(), custom_group(), doh_resolver(), net_configure(), NetConfig, secure_dns_and_check(), system_lookup(), v4()

### Community 60 - "Net"
Cohesion: 0.22
Nodes (6): connect_any(), http_connect(), Net, net_test(), Proxy, Resolve

### Community 63 - "body"
Cohesion: 0.13
Nodes (14): description, label, options, value, body, attributes, id, type (+6 more)

### Community 64 - "Conns"
Cohesion: 0.13
Nodes (15): Cmd, Close, Send, ConnGuard, Conns, Conns<C>, ws_close(), ws_connect() (+7 more)

### Community 69 - "GrpcState"
Cohesion: 0.38
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

### Community 70 - "net.ts"
Cohesion: 0.19
Nodes (12): apply(), checkHost(), DEFAULT_NET, DNS_PROVIDERS, listeners, NetCheck, netSettings(), NetStep (+4 more)

### Community 71 - "varsFormat.ts"
Cohesion: 0.33
Nodes (10): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+2 more)

### Community 72 - "Runs.tsx"
Cohesion: 0.33
Nodes (6): when(), GRPC_CODES, RunBanner(), RunCells(), RunsButton(), useRuns()

### Community 73 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2 (+10 more)

### Community 74 - "stripJsonComments"
Cohesion: 0.34
Nodes (12): CodeArea(), GqlQueryEditor(), resolveForCheck(), MessageEditor(), NetworkPane(), SettingsModal(), UpdatesPane(), BodyEditor() (+4 more)

### Community 75 - "GrpcResponse.tsx"
Cohesion: 0.14
Nodes (19): duration(), EndRow(), GrpcResponsePane(), MessageList(), MessageRow(), pretty(), SaveExampleButton(), seconds() (+11 more)

### Community 76 - "react"
Cohesion: 0.30
Nodes (6): react, ico, KVEditor(), Props, Row, Select()

### Community 77 - "Kv"
Cohesion: 0.67
Nodes (3): apply_metadata(), metadata_list(), Kv

### Community 78 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 79 - "contact_links"
Cohesion: 0.33
Nodes (5): blank_issues_enabled, contact_links, about, name, url

### Community 80 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Checklist, How I tested it, Screenshots, What and why

### Community 81 - "har.ts"
Cohesion: 0.18
Nodes (19): commandsSummary(), importCommands(), nameOf(), splitCommands(), Note, harBody(), harHeaders(), HarOptions (+11 more)

### Community 82 - "Enforcement Guidelines"
Cohesion: 0.40
Nodes (5): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Enforcement Guidelines

### Community 83 - "Architecture"
Cohesion: 0.25
Nodes (8): Architecture, Import and export, Live connections, Network and TLS, Sending an HTTP request, State and persistence, Two halves, Updates

### Community 84 - "jsonc.ts"
Cohesion: 0.28
Nodes (7): Props, dropTrailingCommas(), hasJsonComments(), LineEdit, toggleLineComments(), Tok, tokenize()

### Community 86 - "Security policy"
Cohesion: 0.40
Nodes (5): How voidHTTP protects your data, Reporting a vulnerability, Scope, Security policy, Supported versions

### Community 87 - "connect"
Cohesion: 0.29
Nodes (6): address_gets_scheme_and_port(), connect(), parse_address(), describe_error(), root_cause(), current()

### Community 88 - "highlightLines"
Cohesion: 0.40
Nodes (9): esc(), GQL_KEYWORDS, highlightGraphql(), highlightJson(), highlightLines(), jsLines(), jsRuns(), KEYWORDS (+1 more)

### Community 89 - "SioEvent"
Cohesion: 0.13
Nodes (19): collect(), endpoint(), endpoints(), join_emit_ack_disconnect(), live_server(), run(), sio_connect(), SioEvent (+11 more)

### Community 90 - "updater.ts"
Cohesion: 0.39
Nodes (6): checkForUpdate(), hasPendingUpdate(), installUpdate(), message(), NOTE_PREFIX, restartToUpdate()

### Community 92 - "UpdateChip"
Cohesion: 0.43
Nodes (3): UpdateChip(), UpdateState, Updates

### Community 93 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, tauri, typecheck

### Community 98 - "RequestBody"
Cohesion: 0.29
Nodes (6): build_multipart(), MultipartField, RequestBody, FormUrlEncoded, Multipart, Text

## Knowledge Gaps
- **28 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `voidhttp`, `Http`, `Socks5` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 544 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prepare()` connect `ws.ts` to `RequestPane.tsx`, `ImportModal.tsx`, `stripJsonComments`, `ExportModal.tsx`, `har.ts`, `Architecture`, `GqlPane.tsx`, `GrpcPane.tsx`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `voidhttp` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.08534850640113797 - nodes in this community are weakly interconnected._
- **Why does `Sending an HTTP request` connect `Architecture` to `ws.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `net.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.08143939393939394 - nodes in this community are weakly interconnected._
- **Why does `Architecture` connect `Architecture` to `CONTRIBUTING.md`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `ws.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09269162210338681 - nodes in this community are weakly interconnected._