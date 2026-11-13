# Graph Report - voidHTTP  (2026-11-13)

## Corpus Check
- 76 files · ~88,076 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: .css 8, (none) 3, .lock 1)

## Summary
- 1090 nodes · 2692 edges · 52 communities (44 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6f8c5f9b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Features
- Rust HTTP Engine
- Sidebar.tsx
- package.json
- Modals.tsx
- Zustand Store Actions
- App Identity & Docs
- store.rs
- Tauri Config
- openapi.ts
- TypeScript Config
- Parser
- types.ts
- Tauri Capabilities
- Agent Instructions
- Visual Reference
- grpc.ts
- Crate Package
- GrpcPane.tsx
- with
- cache.yml
- store.ts
- App.tsx
- common.ts
- useStore
- grpc.rs
- RequestPane.tsx
- GrpcState
- DescriptorPool
- NoVerify
- run_call
- curl.ts
- formats/postman.ts
- Kv
- ReflectError
- http.ts
- decode_details
- ImportModal.tsx
- themes.ts
- model.ts
- connect
- jsonc.ts
- mask.ts
- tags.ts
- varsFormat.ts
- MessageDescriptor
- har.ts
- uid
- UpdateChip.tsx

## God Nodes (most connected - your core abstractions)
1. `State` - 51 edges
2. `useStore` - 43 edges
3. `uid()` - 32 edges
4. `react` - 28 edges
5. `RequestPane()` - 27 edges
6. `Parser` - 25 edges
7. `GrpcRequestPane()` - 24 edges
8. `kv()` - 24 edges
9. `ico` - 18 edges
10. `Collection` - 16 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `run_call()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `useTheme()` --calls--> `useStore`  [EXTRACTED]
  src/App.tsx → src/store.ts
- `useTypeTokens()` --calls--> `useStore`  [EXTRACTED]
  src/App.tsx → src/store.ts
- `AppStrip()` --calls--> `ProjectTile()`  [EXTRACTED]
  src/App.tsx → src/components/ProjectIcon.tsx

## Import Cycles
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (52 total, 8 thin omitted)

### Community 0 - "Features"
Cohesion: 0.14
Nodes (13): Appearance and settings, Development, Features, gRPC, History and examples, HTTP, Import and export, Layout (+5 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.05
Nodes (25): FontList, list_fonts(), mono_names(), named_mono(), scan(), build_multipart(), cancel_request(), describe_error() (+17 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.09
Nodes (32): greeting(), Home(), pathOf(), RenameField(), renameTab(), TitleName(), EnvItem(), MenuItem (+24 more)

### Community 3 - "package.json"
Cohesion: 0.07
Nodes (40): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2, @tauri-apps/plugin-updater@^2 (+32 more)

### Community 4 - "Modals.tsx"
Cohesion: 0.14
Nodes (24): KVEditor(), CODE_SIZES, FontRow(), Modals(), MONO_FONTS, ProjectModal(), PromptModal(), SaveModal() (+16 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.05
Nodes (5): DropWhere, State, ExampleRef, ProjectData, ProjectMeta

### Community 7 - "store.rs"
Cohesion: 0.07
Nodes (24): MAX_READ, build(), CHECK_UPDATES, CLOSE_TAB, CLOSE_WINDOW, on_event(), copy_atomic(), doc_path() (+16 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.11
Nodes (26): Any, HarRow, Build, buildAuth(), buildBody(), buildExamples(), buildOpenApi(), chooseMedia() (+18 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.13
Nodes (19): child(), children(), CMP, compile(), equal(), evaluate(), Expr, has() (+11 more)

### Community 12 - "types.ts"
Cohesion: 0.12
Nodes (13): ParsedGrpcurl, Auth, BodyMode, FolderNode, GrpcDef, GrpcEnd, GrpcMessage, GrpcResult (+5 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "grpc.ts"
Cohesion: 0.11
Nodes (22): emit(), grpcCancel(), grpcEndSending(), GrpcEvent, grpcSend(), GRPCURL_VALUE, invokeGrpc(), listeners (+14 more)

### Community 20 - "GrpcPane.tsx"
Cohesion: 0.10
Nodes (17): MethodPicker(), Props, SchemaEditor(), Section, time(), Props, Tok, tokenizeUrl() (+9 more)

### Community 21 - "with"
Cohesion: 0.05
Nodes (38): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+30 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "store.ts"
Cohesion: 0.10
Nodes (19): insertNode(), mapTree(), nodeIds(), placeNode(), removeFromTree(), dataOf(), DEFAULT_SETTINGS, emptyData() (+11 more)

### Community 25 - "App.tsx"
Cohesion: 0.13
Nodes (11): index.html SPA Entry, #root Mount Element, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTypeTokens(), icoLg (+3 more)

### Community 26 - "common.ts"
Cohesion: 0.12
Nodes (26): @tauri-apps/api@^2.0.0, @tauri-apps/api, DropImport(), Envs, ExportModal(), Format, FORMATS, plural() (+18 more)

### Community 27 - "useStore"
Cohesion: 0.06
Nodes (44): react, CodeArea(), Props, EnvMenu(), duration(), EndRow(), GrpcResponsePane(), MessageList() (+36 more)

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (12): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+4 more)

### Community 29 - "RequestPane.tsx"
Cohesion: 0.17
Nodes (12): GrpcRequestPane(), MethodMenu(), AuthEditor(), BODY_MODES, RequestPane(), Section, looksLikeCurl(), defaultGrpc() (+4 more)

### Community 30 - "GrpcState"
Cohesion: 0.38
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

### Community 31 - "DescriptorPool"
Cohesion: 0.28
Nodes (14): cached_pool(), compile_protos(), describe(), grpc_describe(), load_pool(), pool_key(), protos_compile_and_describe(), reflect() (+6 more)

### Community 33 - "run_call"
Cohesion: 0.17
Nodes (15): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+7 more)

### Community 34 - "curl.ts"
Cohesion: 0.20
Nodes (14): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+6 more)

### Community 35 - "formats/postman.ts"
Cohesion: 0.19
Nodes (21): analyze(), convertAuth(), convertBody(), convertExamples(), convertItems(), count(), hasScript(), importPostman() (+13 more)

### Community 36 - "Kv"
Cohesion: 0.67
Nodes (3): apply_metadata(), metadata_list(), Kv

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "http.ts"
Cohesion: 0.25
Nodes (9): CONTENT_TYPES, Prepared, WireBody, WireKV, DYNAMIC, dynamic(), resolve(), unresolved() (+1 more)

### Community 39 - "decode_details"
Cohesion: 0.33
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "ImportModal.tsx"
Cohesion: 0.16
Nodes (23): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+15 more)

### Community 41 - "themes.ts"
Cohesion: 0.18
Nodes (20): useTheme(), alpha(), BUILTIN, BuiltinId, contrast(), FAMILIES, findScheme(), fit() (+12 more)

### Community 42 - "model.ts"
Cohesion: 0.47
Nodes (8): importNative(), NATIVE_VERSION, sane(), cloneNode(), cloneRequest(), newRequest(), uid(), TreeNode

### Community 43 - "connect"
Cohesion: 0.29
Nodes (5): address_gets_scheme_and_port(), connect(), parse_address(), tls_config(), root_cause()

### Community 44 - "jsonc.ts"
Cohesion: 0.26
Nodes (10): MessageEditor(), BodyEditor(), dropTrailingCommas(), formatJsonc(), hasJsonComments(), LineEdit, stripJsonComments(), Tok (+2 more)

### Community 45 - "mask.ts"
Cohesion: 0.15
Nodes (22): allRequests(), ExampleModal(), key(), applyMasks(), findSensitive(), isSecretKey(), isVarRef(), jsonPathOf() (+14 more)

### Community 46 - "tags.ts"
Cohesion: 0.38
Nodes (6): UrlTab(), EnvColor(), envStyle(), TAG_COLORS, TagColor, tagName()

### Community 47 - "varsFormat.ts"
Cohesion: 0.33
Nodes (10): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+2 more)

### Community 48 - "MessageDescriptor"
Cohesion: 0.18
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 49 - "har.ts"
Cohesion: 0.20
Nodes (16): requestsOf(), exportHar(), harBody(), harHeaders(), HarOptions, harResponse(), harToCollection(), hostVar() (+8 more)

### Community 52 - "uid"
Cohesion: 0.16
Nodes (20): commandsSummary(), importCommands(), nameOf(), splitCommands(), detect(), FormatId, ImportPlan, Note (+12 more)

### Community 54 - "UpdateChip.tsx"
Cohesion: 0.13
Nodes (13): Notes(), UpdateChip(), checkForUpdate(), hasPendingUpdate(), installUpdate(), mb(), message(), noteLines() (+5 more)

## Knowledge Gaps
- **11 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 342 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `useStore` to `Sidebar.tsx`, `package.json`, `Modals.tsx`, `ImportModal.tsx`, `mask.ts`, `tags.ts`, `grpc.ts`, `GrpcPane.tsx`, `UpdateChip.tsx`, `App.tsx`, `common.ts`, `RequestPane.tsx`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Features` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `types.ts`, `mask.ts`, `jsonc.ts`, `uid`, `store.ts`, `App.tsx`, `useStore`, `RequestPane.tsx`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05454545454545454 - nodes in this community are weakly interconnected._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08776595744680851 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06504065040650407 - nodes in this community are weakly interconnected._