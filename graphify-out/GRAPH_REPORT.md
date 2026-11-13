# Graph Report - voidHTTP  (2026-11-13)

## Corpus Check
- 73 files · ~86,012 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: .css 8, (none) 3, .lock 1)

## Summary
- 1041 nodes · 2592 edges · 53 communities (44 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b00dc66d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Features
- Rust HTTP Engine
- Sidebar.tsx
- NPM Dependencies
- Modals.tsx
- Zustand Store Actions
- App Identity & Docs
- store.rs
- Tauri Config
- openapi.ts
- TypeScript Config
- Parser
- connect
- Tauri Capabilities
- Agent Instructions
- Visual Reference
- grpc.ts
- Crate Package
- GrpcPane.tsx
- with
- react
- store.ts
- Home.tsx
- common.ts
- GrpcResponse.tsx
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
- jsonc.ts
- decode_details
- ImportModal.tsx
- common.ts
- App.tsx
- uid
- types.ts
- mask.ts
- UrlInput.tsx
- ResponsePane.tsx
- MessageDescriptor
- har.ts
- jsonpath.ts
- http.ts
- model.ts

## God Nodes (most connected - your core abstractions)
1. `State` - 51 edges
2. `useStore` - 42 edges
3. `uid()` - 32 edges
4. `RequestPane()` - 27 edges
5. `react` - 27 edges
6. `Parser` - 25 edges
7. `GrpcRequestPane()` - 24 edges
8. `kv()` - 24 edges
9. `ico` - 17 edges
10. `Collection` - 16 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `run_call()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `ParsedGrpcurl` --references--> `RequestDef`  [EXTRACTED]
  src/lib/grpc.ts → src/types.ts
- `Props` --references--> `Tab`  [EXTRACTED]
  src/components/GrpcPane.tsx → src/types.ts
- `State` --references--> `Settings`  [EXTRACTED]
  src/store.ts → src/types.ts

## Import Cycles
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (53 total, 9 thin omitted)

### Community 0 - "Features"
Cohesion: 0.14
Nodes (13): Appearance and settings, Development, Features, gRPC, History and examples, HTTP, Import and export, Layout (+5 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.06
Nodes (24): FontList, list_fonts(), mono_names(), named_mono(), scan(), build_multipart(), cancel_request(), execute() (+16 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.14
Nodes (24): RenameField(), EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView(), DragCtx (+16 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.06
Nodes (42): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-process@^2, @tauri-apps/plugin-updater@^2 (+34 more)

### Community 4 - "Modals.tsx"
Cohesion: 0.06
Nodes (58): lucide-react, @tauri-apps/api, useTheme(), CODE_SIZES, EnvColor(), FontRow(), Modals(), MONO_FONTS (+50 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.06
Nodes (4): State, ExampleRef, ProjectData, ProjectMeta

### Community 7 - "store.rs"
Cohesion: 0.08
Nodes (23): MAX_READ, build(), CLOSE_TAB, CLOSE_WINDOW, on_event(), copy_atomic(), doc_path(), load_response() (+15 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.11
Nodes (29): Any, Source, HarFile, HarRow, Build, buildAuth(), buildBody(), buildExamples() (+21 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 12 - "connect"
Cohesion: 0.25
Nodes (6): address_gets_scheme_and_port(), connect(), parse_address(), tls_config(), describe_error(), root_cause()

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "grpc.ts"
Cohesion: 0.10
Nodes (25): defaultGrpc(), emit(), grpcCancel(), grpcEndSending(), GrpcEvent, grpcSend(), GRPCURL_VALUE, invokeGrpc() (+17 more)

### Community 20 - "GrpcPane.tsx"
Cohesion: 0.11
Nodes (9): MethodPicker(), Props, SchemaEditor(), Section, time(), VarInfo, SchemaState, shortService() (+1 more)

### Community 21 - "with"
Cohesion: 0.06
Nodes (37): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+29 more)

### Community 23 - "react"
Cohesion: 0.19
Nodes (4): react, EnvMenu(), ico, TabsBar()

### Community 24 - "store.ts"
Cohesion: 0.11
Nodes (18): isGrpc(), insertNode(), mapTree(), dataOf(), DEFAULT_SETTINGS, emptyData(), findExample(), liveData() (+10 more)

### Community 25 - "Home.tsx"
Cohesion: 0.29
Nodes (6): greeting(), Home(), pathOf(), icoLg, ago(), startOfDay()

### Community 26 - "common.ts"
Cohesion: 0.18
Nodes (18): Envs, ExportModal(), Format, FORMATS, plural(), baseName(), IMPORT_EXTENSIONS, pickImportFile() (+10 more)

### Community 27 - "GrpcResponse.tsx"
Cohesion: 0.12
Nodes (21): duration(), EndRow(), GrpcResponsePane(), MessageList(), MessageRow(), pretty(), seconds(), StatusLine() (+13 more)

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (12): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+4 more)

### Community 29 - "RequestPane.tsx"
Cohesion: 0.16
Nodes (15): GrpcRequestPane(), TitleName(), KVEditor(), MethodMenu(), AuthEditor(), BODY_MODES, BodyEditor(), RequestPane() (+7 more)

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
Cohesion: 0.13
Nodes (23): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+15 more)

### Community 35 - "formats/postman.ts"
Cohesion: 0.21
Nodes (20): analyze(), convertAuth(), convertBody(), convertItems(), count(), exportPostman(), hasScript(), importPostman() (+12 more)

### Community 36 - "Kv"
Cohesion: 0.33
Nodes (3): apply_metadata(), metadata_list(), Kv

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "jsonc.ts"
Cohesion: 0.20
Nodes (12): CodeArea(), Props, MessageEditor(), dropTrailingCommas(), formatJsonc(), hasJsonComments(), LineEdit, stripJsonComments() (+4 more)

### Community 39 - "decode_details"
Cohesion: 0.25
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "ImportModal.tsx"
Cohesion: 0.15
Nodes (24): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+16 more)

### Community 41 - "common.ts"
Cohesion: 0.35
Nodes (10): blankKv(), blankSecretKv(), blankValues(), detect(), FormatId, isVarRef(), parseDoc(), scrubNodes() (+2 more)

### Community 42 - "App.tsx"
Cohesion: 0.16
Nodes (11): index.html SPA Entry, #root Mount Element, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTypeTokens(), DropImport() (+3 more)

### Community 43 - "uid"
Cohesion: 0.21
Nodes (13): ImportPlan, requestsOf(), importNative(), NATIVE_VERSION, NativeFile, sane(), exampleCount(), convertExamples() (+5 more)

### Community 44 - "types.ts"
Cohesion: 0.14
Nodes (13): ParsedGrpcurl, BodyMode, Example, GrpcDef, GrpcEnd, GrpcMessage, GrpcResult, RequestDef (+5 more)

### Community 45 - "mask.ts"
Cohesion: 0.16
Nodes (21): allRequests(), ExampleModal(), key(), applyMasks(), findSensitive(), isVarRef(), jsonPathOf(), Kind (+13 more)

### Community 46 - "UrlInput.tsx"
Cohesion: 0.47
Nodes (5): Props, Tok, tokenizeUrl(), UrlInput(), VarTip()

### Community 47 - "ResponsePane.tsx"
Cohesion: 0.15
Nodes (12): renameTab(), when(), HttpResponsePane(), ResponsePane(), GRPC_CODES, RunBanner(), RunCells(), RunsButton() (+4 more)

### Community 48 - "MessageDescriptor"
Cohesion: 0.28
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 49 - "har.ts"
Cohesion: 0.19
Nodes (15): Props, Row, harBody(), HarOptions, harPlan(), harResponse(), harToCollection(), hostVar() (+7 more)

### Community 50 - "jsonpath.ts"
Cohesion: 0.20
Nodes (17): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+9 more)

### Community 51 - "http.ts"
Cohesion: 0.25
Nodes (8): CONTENT_TYPES, WireBody, WireKV, DYNAMIC, dynamic(), resolve(), unresolved(), VarScope

### Community 52 - "model.ts"
Cohesion: 0.18
Nodes (11): cloneNode(), cloneRequest(), DropWhere, METHODS, nodeIds(), placeNode(), removeFromTree(), runKey() (+3 more)

## Knowledge Gaps
- **11 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 327 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Parser` connect `Parser` to `jsonpath.ts`, `GrpcResponse.tsx`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Features` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `Sidebar.tsx`, `NPM Dependencies`, `Modals.tsx`, `jsonc.ts`, `ImportModal.tsx`, `App.tsx`, `mask.ts`, `UrlInput.tsx`, `ResponsePane.tsx`, `har.ts`, `grpc.ts`, `GrpcPane.tsx`, `model.ts`, `common.ts`, `GrpcResponse.tsx`, `RequestPane.tsx`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05589225589225589 - nodes in this community are weakly interconnected._
- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `jsonc.ts`, `uid`, `types.ts`, `mask.ts`, `ResponsePane.tsx`, `http.ts`, `model.ts`, `store.ts`, `GrpcResponse.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14022988505747128 - nodes in this community are weakly interconnected._