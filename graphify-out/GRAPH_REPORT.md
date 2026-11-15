# Graph Report - voidHTTP  (2026-11-15)

## Corpus Check
- 82 files · ~117,525 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: .css 10, (none) 3, .lock 1)

## Summary
- 1343 nodes · 3400 edges · 72 communities (55 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4ed7ed5e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Features
- Rust HTTP Engine
- Sidebar.tsx
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
- App.tsx
- Crate Package
- WsResponse.tsx
- with
- cache.yml
- themes.ts
- types.ts
- types.ts
- Home.tsx
- grpc.rs
- http.ts
- native.ts
- package.json
- NoVerify
- connect
- curl.ts
- postman.ts
- Modals.tsx
- ReflectError
- Runs.tsx
- decode_details
- ImportModal.tsx
- Kv
- DescriptorPool
- ResponseBody.tsx
- commands.ts
- common.ts
- UpdateChip.tsx
- jsonc.ts
- index.ts
- RequestPane.tsx
- store.ts
- run_call
- Collection
- fonts.rs
- react
- ws_connect
- RequestBody
- net.ts
- har.ts
- varsFormat.ts
- WsState
- Kv
- GrpcState

## God Nodes (most connected - your core abstractions)
1. `State` - 55 edges
2. `useStore` - 53 edges
3. `uid()` - 33 edges
4. `RequestPane()` - 31 edges
5. `react` - 31 edges
6. `kv()` - 26 edges
7. `Parser` - 25 edges
8. `GrpcRequestPane()` - 24 edges
9. `ico` - 20 edges
10. `parseCurl()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `exampleCount()` --calls--> `requestsOf()`  [EXTRACTED]
  src/lib/formats/openapi.ts → src/lib/formats/common.ts
- `run_call()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `ws_connect()` --calls--> `tls_config()`  [INFERRED]
  src-tauri/src/ws.rs → src-tauri/src/grpc.rs
- `useTheme()` --calls--> `useStore`  [EXTRACTED]
  src/App.tsx → src/store.ts

## Import Cycles
- 1-file cycle: `src-tauri/src/files.rs -> src-tauri/src/files.rs`
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (72 total, 17 thin omitted)

### Community 0 - "Features"
Cohesion: 0.13
Nodes (14): Appearance and settings, Development, Features, gRPC, History and examples, HTTP, Import and export, Layout (+6 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.08
Nodes (15): build_multipart(), cancel_request(), execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState, InflightGuard (+7 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.11
Nodes (24): EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView(), DragCtx, DragItem (+16 more)

### Community 3 - "net.rs"
Cohesion: 0.06
Nodes (32): ALWAYS_DIRECT, bootstrap(), connect_any(), custom_group(), doh_resolver(), http_connect(), http_connect_tunnel(), lists_cover_subdomains() (+24 more)

### Community 4 - "ws.rs"
Cohesion: 0.09
Nodes (13): bad_header_is_an_error(), build_request(), CLOSE_GRACE, echo_and_close(), handshake_headers_are_kept_and_extras_added(), is_handshake_header(), MAX_REFUSED_BODY, normalize_url() (+5 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.05
Nodes (4): State, ExampleRef, ProjectData, ProjectMeta

### Community 7 - "store.rs"
Cohesion: 0.07
Nodes (31): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_ref_file(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file() (+23 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.11
Nodes (29): Any, Note, HarRow, Build, buildAuth(), buildBody(), buildExamples(), buildOpenApi() (+21 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.14
Nodes (18): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+10 more)

### Community 12 - "ExportModal.tsx"
Cohesion: 0.17
Nodes (19): @tauri-apps/api, DropImport(), Envs, ExportModal(), Format, FORMATS, plural(), baseName() (+11 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "App.tsx"
Cohesion: 0.14
Nodes (14): index.html SPA Entry, #root Mount Element, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTypeTokens(), Mark() (+6 more)

### Community 20 - "WsResponse.tsx"
Cohesion: 0.19
Nodes (17): closeLabel(), CloseRow(), duration(), Handshake(), MessageList(), MessageRow(), Pair(), pretty() (+9 more)

### Community 21 - "with"
Cohesion: 0.05
Nodes (38): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+30 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "themes.ts"
Cohesion: 0.17
Nodes (21): useTheme(), SchemeRow(), alpha(), BUILTIN, BuiltinId, contrast(), FAMILIES, findScheme() (+13 more)

### Community 25 - "types.ts"
Cohesion: 0.08
Nodes (35): GrpcRequestPane(), MethodPicker(), SchemaEditor(), Section, time(), clientStreams(), defaultGrpc(), emit() (+27 more)

### Community 26 - "types.ts"
Cohesion: 0.12
Nodes (15): ParsedGrpcurl, BodyMode, Example, GrpcDef, GrpcEnd, GrpcMessage, HttpResponse, RequestDef (+7 more)

### Community 27 - "Home.tsx"
Cohesion: 0.29
Nodes (6): greeting(), Home(), pathOf(), icoLg, ago(), startOfDay()

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (13): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+5 more)

### Community 29 - "http.ts"
Cohesion: 0.11
Nodes (26): RFC-6455, prepareGrpc(), base64Utf8(), CONTENT_TYPES, prepare(), Prepared, WireBody, WireKV (+18 more)

### Community 30 - "native.ts"
Cohesion: 0.34
Nodes (14): dropFilePaths(), importNative(), NATIVE_VERSION, num(), pairs(), rows(), sane(), saneAuth() (+6 more)

### Community 31 - "package.json"
Cohesion: 0.06
Nodes (41): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2 (+33 more)

### Community 33 - "connect"
Cohesion: 0.22
Nodes (7): address_gets_scheme_and_port(), connect(), parse_address(), tls_config(), describe_error(), root_cause(), lost()

### Community 34 - "curl.ts"
Cohesion: 0.17
Nodes (16): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+8 more)

### Community 35 - "postman.ts"
Cohesion: 0.23
Nodes (19): str(), convertAuth(), convertBody(), convertItems(), count(), exportPostman(), hasScript(), importPostman() (+11 more)

### Community 36 - "Modals.tsx"
Cohesion: 0.14
Nodes (23): KVEditor(), CODE_SIZES, FontRow(), Modals(), MONO_FONTS, NetworkPane(), ProjectModal(), PromptModal() (+15 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "Runs.tsx"
Cohesion: 0.26
Nodes (7): when(), GRPC_CODES, RunBanner(), RunCells(), RunsButton(), useRuns(), HistoryEntry

### Community 39 - "decode_details"
Cohesion: 0.33
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "ImportModal.tsx"
Cohesion: 0.15
Nodes (26): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+18 more)

### Community 41 - "Kv"
Cohesion: 0.18
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 42 - "DescriptorPool"
Cohesion: 0.30
Nodes (13): cached_pool(), compile_protos(), describe(), grpc_describe(), load_pool(), pool_key(), protos_compile_and_describe(), reflect() (+5 more)

### Community 43 - "ResponseBody.tsx"
Cohesion: 0.11
Nodes (29): duration(), EndRow(), GrpcResponsePane(), MessageList(), MessageRow(), pretty(), SaveExampleButton(), seconds() (+21 more)

### Community 44 - "commands.ts"
Cohesion: 0.39
Nodes (8): commandsSummary(), importCommands(), nameOf(), splitCommands(), convertExamples(), stripNode(), parseGrpcurl(), newRequest()

### Community 45 - "common.ts"
Cohesion: 0.08
Nodes (63): allRequests(), ExampleModal(), key(), statusName(), addressLike(), basicKept(), blankHarEnv(), blankKv() (+55 more)

### Community 46 - "UpdateChip.tsx"
Cohesion: 0.13
Nodes (15): UpdatesPane(), Notes(), UpdateChip(), checkForUpdate(), hasPendingUpdate(), installUpdate(), mb(), message() (+7 more)

### Community 47 - "jsonc.ts"
Cohesion: 0.23
Nodes (13): CodeArea(), Props, MessageEditor(), BodyEditor(), MessageEditor(), dropTrailingCommas(), formatJsonc(), hasJsonComments() (+5 more)

### Community 48 - "index.ts"
Cohesion: 0.24
Nodes (10): detect(), parseDoc(), Source, HarFile, readHar(), siteOf(), Analysis, analyze() (+2 more)

### Community 50 - "RequestPane.tsx"
Cohesion: 0.11
Nodes (26): Props, RenameField(), renameTab(), TitleName(), MethodMenu(), AuthEditor(), BODY_MODES, RequestPane() (+18 more)

### Community 52 - "store.ts"
Cohesion: 0.08
Nodes (26): capEnvironments(), DropWhere, insertNode(), mapTree(), MAX_PARAMS, METHODS, nodeIds(), pathTo() (+18 more)

### Community 53 - "run_call"
Cohesion: 0.16
Nodes (16): Call, CallGuard, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers (+8 more)

### Community 54 - "Collection"
Cohesion: 0.32
Nodes (5): ImportPlan, NativeFile, TagColor, Collection, Environment

### Community 55 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 56 - "react"
Cohesion: 0.13
Nodes (10): react, EnvMenu(), ico, Props, Row, EnvColor(), envStyle(), TAG_COLORS (+2 more)

### Community 57 - "ws_connect"
Cohesion: 0.18
Nodes (8): header_list(), run(), ws_connect(), WsEvent, Close, Message, Open, Refused

### Community 58 - "RequestBody"
Cohesion: 0.40
Nodes (5): MultipartField, RequestBody, FormUrlEncoded, Multipart, Text

### Community 59 - "net.ts"
Cohesion: 0.21
Nodes (11): apply(), checkHost(), DEFAULT_NET, DNS_PROVIDERS, listeners, NetCheck, netSettings(), NetStep (+3 more)

### Community 60 - "har.ts"
Cohesion: 0.38
Nodes (9): harBody(), harHeaders(), HarOptions, harPlan(), harResponse(), harToCollection(), hostVar(), kv() (+1 more)

### Community 65 - "varsFormat.ts"
Cohesion: 0.33
Nodes (10): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+2 more)

### Community 67 - "WsState"
Cohesion: 0.20
Nodes (7): Cmd, Close, Send, ConnGuard, ws_close(), ws_send(), WsState

### Community 68 - "Kv"
Cohesion: 0.67
Nodes (3): apply_metadata(), metadata_list(), Kv

### Community 69 - "GrpcState"
Cohesion: 0.47
Nodes (4): grpc_cancel(), grpc_end(), grpc_send(), GrpcState

## Knowledge Gaps
- **20 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 413 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `Runs.tsx`, `ResponseBody.tsx`, `jsonc.ts`, `store.ts`, `Collection`, `types.ts`, `http.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Features` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Why does `useStore` connect `App.tsx` to `Sidebar.tsx`, `Modals.tsx`, `Runs.tsx`, `ImportModal.tsx`, `net.ts`, `ResponseBody.tsx`, `ExportModal.tsx`, `common.ts`, `UpdateChip.tsx`, `jsonc.ts`, `RequestPane.tsx`, `WsResponse.tsx`, `store.ts`, `themes.ts`, `types.ts`, `react`, `Home.tsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.0782051282051282 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `Sidebar.tsx`, `Modals.tsx`, `Runs.tsx`, `ImportModal.tsx`, `ResponseBody.tsx`, `ExportModal.tsx`, `common.ts`, `UpdateChip.tsx`, `jsonc.ts`, `App.tsx`, `RequestPane.tsx`, `store.ts`, `WsResponse.tsx`, `types.ts`, `net.ts`, `package.json`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10873440285204991 - nodes in this community are weakly interconnected._