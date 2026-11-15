# Graph Report - voidHTTP  (2026-11-15)

## Corpus Check
- 85 files · ~134,673 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: .css 12, (none) 3, .lock 1)

## Summary
- 1441 nodes · 3683 edges · 63 communities (46 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `65925bdd`
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
- useStore
- Crate Package
- common.ts
- with
- cache.yml
- themes.ts
- GrpcPane.tsx
- types.ts
- index.ts
- grpc.rs
- http.ts
- native.ts
- Kv
- certs.rs
- package.json
- curl.ts
- postman.ts
- Modals.tsx
- ReflectError
- decode_details
- ImportModal.tsx
- Kv
- DescriptorPool
- useStore
- har.ts
- UpdateChip.tsx
- RequestPane.tsx
- store.ts
- run_call
- net.ts
- fonts.rs
- Collection
- varsFormat.ts
- GrpcState

## God Nodes (most connected - your core abstractions)
1. `useStore` - 57 edges
2. `State` - 55 edges
3. `uid()` - 35 edges
4. `react` - 33 edges
5. `RequestPane()` - 31 edges
6. `kv()` - 26 edges
7. `Parser` - 25 edges
8. `GrpcRequestPane()` - 24 edges
9. `ico` - 21 edges
10. `HttpState` - 18 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `run_call()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `exampleCount()` --calls--> `requestsOf()`  [EXTRACTED]
  src/lib/formats/openapi.ts → src/lib/formats/common.ts
- `root_cause()` --calls--> `tls_hint()`  [EXTRACTED]
  src-tauri/src/http.rs → src-tauri/src/certs.rs
- `certs_configure()` --references--> `HttpState`  [EXTRACTED]
  src-tauri/src/certs.rs → src-tauri/src/http.rs

## Import Cycles
- 1-file cycle: `src-tauri/src/files.rs -> src-tauri/src/files.rs`
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (63 total, 17 thin omitted)

### Community 0 - "Features"
Cohesion: 0.13
Nodes (14): Appearance and settings, Development, Features, gRPC, History and examples, HTTP, Import and export, Layout (+6 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.07
Nodes (20): build_multipart(), cancel_request(), ClientKey, execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState (+12 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.05
Nodes (58): CaRow(), CERT_FILES, CertificatesPane(), ClientForm(), ClientRow(), FilePick(), KEY_FILES, PFX_FILES (+50 more)

### Community 3 - "net.rs"
Cohesion: 0.07
Nodes (31): ALWAYS_DIRECT, bootstrap(), connect_any(), custom_group(), doh_resolver(), http_connect(), http_connect_tunnel(), lists_cover_subdomains() (+23 more)

### Community 4 - "ws.rs"
Cohesion: 0.06
Nodes (28): bad_header_is_an_error(), build_request(), CLOSE_GRACE, Cmd, Close, Send, ConnGuard, echo_and_close() (+20 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.05
Nodes (7): State, Example, ExampleRef, HttpResponse, ProjectData, ProjectMeta, SavedRef

### Community 7 - "store.rs"
Cohesion: 0.07
Nodes (31): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_ref_file(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file() (+23 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.11
Nodes (29): Any, HarRow, Build, buildAuth(), buildBody(), buildExamples(), buildOpenApi(), chooseMedia() (+21 more)

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

### Community 17 - "useStore"
Cohesion: 0.13
Nodes (15): index.html SPA Entry, #root Mount Element, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTheme(), useTypeTokens() (+7 more)

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
Cohesion: 0.17
Nodes (16): alpha(), BUILTIN, BuiltinId, contrast(), DEFAULT_SCHEME, FAMILIES, fit(), Ghostty (+8 more)

### Community 25 - "GrpcPane.tsx"
Cohesion: 0.06
Nodes (43): GrpcRequestPane(), MethodPicker(), Props, SchemaEditor(), Section, time(), Props, Tok (+35 more)

### Community 26 - "types.ts"
Cohesion: 0.10
Nodes (17): Props, Row, ParsedGrpcurl, Auth, BodyMode, GrpcDef, GrpcEnd, GrpcMessage (+9 more)

### Community 27 - "index.ts"
Cohesion: 0.24
Nodes (10): detect(), parseDoc(), Source, HarFile, readHar(), siteOf(), Analysis, analyze() (+2 more)

### Community 28 - "grpc.rs"
Cohesion: 0.09
Nodes (12): describe(), ERROR_DETAILS_PROTO, example(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+4 more)

### Community 29 - "http.ts"
Cohesion: 0.08
Nodes (34): RFC-6455, base64Utf8(), CONTENT_TYPES, prepare(), Prepared, WireBody, WireKV, dropTrailingCommas() (+26 more)

### Community 30 - "native.ts"
Cohesion: 0.34
Nodes (14): dropFilePaths(), importNative(), NATIVE_VERSION, num(), pairs(), rows(), sane(), saneAuth() (+6 more)

### Community 31 - "Kv"
Cohesion: 0.67
Nodes (3): apply_metadata(), metadata_list(), Kv

### Community 32 - "certs.rs"
Cohesion: 0.05
Nodes (50): a_dev_ca_and_a_client_certificate_reach_a_mutual_tls_server(), a_pfx_opens_with_its_passphrase_only(), a_private_key_is_not_taken_for_a_ca(), ca_file_info_names_the_certificate(), CertConfig, Certs, certs_configure(), CERTS (+42 more)

### Community 33 - "package.json"
Cohesion: 0.06
Nodes (41): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2 (+33 more)

### Community 34 - "curl.ts"
Cohesion: 0.20
Nodes (14): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+6 more)

### Community 35 - "postman.ts"
Cohesion: 0.20
Nodes (21): str(), convertAuth(), convertBody(), convertExamples(), convertItems(), count(), exportPostman(), hasScript() (+13 more)

### Community 36 - "Modals.tsx"
Cohesion: 0.12
Nodes (26): CODE_SIZES, EnvColor(), FontRow(), Modals(), MONO_FONTS, ProjectModal(), PromptModal(), SaveModal() (+18 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 39 - "decode_details"
Cohesion: 0.19
Nodes (9): compile_protos(), decode_details(), EmbeddedFile, error_details_decode(), error_details_pool(), home(), protos_compile_and_describe(), sample_pool() (+1 more)

### Community 40 - "ImportModal.tsx"
Cohesion: 0.16
Nodes (24): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+16 more)

### Community 41 - "Kv"
Cohesion: 0.18
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 42 - "DescriptorPool"
Cohesion: 0.18
Nodes (17): address_gets_scheme_and_port(), cached_pool(), connect(), grpc_describe(), InvokeRequest, load_pool(), parse_address(), pool_key() (+9 more)

### Community 43 - "useStore"
Cohesion: 0.06
Nodes (61): react, Props, duration(), EndRow(), GrpcResponsePane(), MessageList(), MessageRow(), pretty() (+53 more)

### Community 44 - "har.ts"
Cohesion: 0.23
Nodes (15): commandsSummary(), importCommands(), nameOf(), splitCommands(), Note, harBody(), harHeaders(), HarOptions (+7 more)

### Community 46 - "UpdateChip.tsx"
Cohesion: 0.13
Nodes (15): UpdatesPane(), Notes(), UpdateChip(), checkForUpdate(), hasPendingUpdate(), installUpdate(), mb(), message() (+7 more)

### Community 47 - "RequestPane.tsx"
Cohesion: 0.15
Nodes (21): CodeArea(), MessageEditor(), TitleName(), KVEditor(), MethodMenu(), AuthEditor(), BODY_MODES, BodyEditor() (+13 more)

### Community 52 - "store.ts"
Cohesion: 0.07
Nodes (27): capEnvironments(), DropWhere, insertNode(), mapTree(), MAX_PARAMS, METHODS, nodeIds(), pathTo() (+19 more)

### Community 53 - "run_call"
Cohesion: 0.18
Nodes (14): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+6 more)

### Community 54 - "net.ts"
Cohesion: 0.19
Nodes (14): NetworkPane(), apply(), checkHost(), DEFAULT_NET, DNS_PROVIDERS, listeners, NetCheck, netSettings() (+6 more)

### Community 55 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 58 - "Collection"
Cohesion: 0.38
Nodes (4): ImportPlan, NativeFile, Collection, Environment

### Community 60 - "varsFormat.ts"
Cohesion: 0.33
Nodes (10): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+2 more)

### Community 69 - "GrpcState"
Cohesion: 0.38
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

## Knowledge Gaps
- **20 isolated node(s):** `Text`, `FormUrlEncoded`, `Multipart`, `#root Mount Element`, `voidHTTP App Icon` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 424 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `types.ts`, `useStore`, `RequestPane.tsx`, `store.ts`, `Collection`, `http.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `Text`, `FormUrlEncoded`, `Multipart` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Features` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Why does `useStore` connect `useStore` to `Sidebar.tsx`, `Modals.tsx`, `ImportModal.tsx`, `ExportModal.tsx`, `UpdateChip.tsx`, `RequestPane.tsx`, `useStore`, `common.ts`, `store.ts`, `net.ts`, `GrpcPane.tsx`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.06956521739130435 - nodes in this community are weakly interconnected._
- **Why does `react` connect `useStore` to `package.json`, `Sidebar.tsx`, `Modals.tsx`, `ImportModal.tsx`, `ExportModal.tsx`, `UpdateChip.tsx`, `RequestPane.tsx`, `useStore`, `common.ts`, `store.ts`, `net.ts`, `GrpcPane.tsx`, `types.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05209274314965372 - nodes in this community are weakly interconnected._