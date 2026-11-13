# Graph Report - voidHTTP  (2026-11-13)

## Corpus Check
- 71 files · ~77,484 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: .css 7, (none) 3, .lock 1)

## Summary
- 980 nodes · 2524 edges · 56 communities (42 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `873c29e6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- voidHTTP
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
- App.tsx
- Tauri Capabilities
- Agent Instructions
- Visual Reference
- grpc.ts
- Crate Package
- GrpcPane.tsx
- common.ts
- RequestPane
- store.ts
- types.ts
- lib.rs
- GrpcResponse.tsx
- grpc.rs
- RequestPane.tsx
- run_call
- DescriptorPool
- NoVerify
- Kv
- curl.ts
- formats/postman.ts
- useStore
- ReflectError
- jsonc.ts
- decode_details
- ImportModal.tsx
- ExampleRef
- ProjectData
- commands.ts
- model.ts
- mask.ts
- har.ts
- Home.tsx
- ExportModal.tsx
- MessageDescriptor
- connect
- GrpcState
- Example
- mapTree
- DropWhere

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
- `exampleCount()` --calls--> `requestsOf()`  [EXTRACTED]
  src/lib/formats/openapi.ts → src/lib/formats/common.ts
- `run_call()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `useTheme()` --calls--> `useStore`  [EXTRACTED]
  src/App.tsx → src/store.ts
- `useTypeTokens()` --calls--> `useStore`  [EXTRACTED]
  src/App.tsx → src/store.ts

## Import Cycles
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (56 total, 14 thin omitted)

### Community 0 - "voidHTTP"
Cohesion: 0.29
Nodes (6): Development, Features (v0.1), Layout, Not yet, Shortcuts, voidHTTP

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.06
Nodes (24): FontList, list_fonts(), mono_names(), named_mono(), scan(), build_multipart(), cancel_request(), execute() (+16 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.12
Nodes (24): RenameField(), EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView(), DragCtx (+16 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.06
Nodes (37): index.html SPA Entry, #root Mount Element, dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0 (+29 more)

### Community 4 - "Modals.tsx"
Cohesion: 0.06
Nodes (58): @tauri-apps/api, AppStrip(), useTheme(), CODE_SIZES, EnvColor(), FontRow(), Modals(), MONO_FONTS (+50 more)

### Community 7 - "store.rs"
Cohesion: 0.14
Nodes (19): MAX_READ, copy_atomic(), doc_path(), load_response(), load_state(), local_dir(), LOCAL_DOCS, migrate_to_vault() (+11 more)

### Community 8 - "Tauri Config"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 9 - "openapi.ts"
Cohesion: 0.11
Nodes (27): Any, Source, HarRow, Build, buildAuth(), buildBody(), buildOpenApi(), chooseMedia() (+19 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.14
Nodes (18): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+10 more)

### Community 12 - "App.tsx"
Cohesion: 0.10
Nodes (11): App(), SIDEBAR_DEFAULT, stack(), useTypeTokens(), DropImport(), EnvMenu(), ico, Mark() (+3 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "grpc.ts"
Cohesion: 0.10
Nodes (23): emit(), grpcCancel(), grpcEndSending(), GrpcEvent, grpcSend(), GRPCURL_VALUE, invokeGrpc(), listeners (+15 more)

### Community 20 - "GrpcPane.tsx"
Cohesion: 0.13
Nodes (13): MethodPicker(), Props, SchemaEditor(), Section, time(), Props, Tok, tokenizeUrl() (+5 more)

### Community 21 - "common.ts"
Cohesion: 0.23
Nodes (13): blankKv(), blankSecretKv(), blankValues(), detect(), FormatId, isVarRef(), parseDoc(), scrubNodes() (+5 more)

### Community 23 - "RequestPane"
Cohesion: 0.19
Nodes (16): GrpcRequestPane(), RequestPane(), looksLikeCurl(), clientStreams(), defaultGrpc(), findMethod(), looksLikeGrpcurl(), prepareGrpc() (+8 more)

### Community 24 - "store.ts"
Cohesion: 0.11
Nodes (15): isGrpc(), dataOf(), DEFAULT_SETTINGS, emptyData(), findExample(), liveData(), loadingRun, Modal (+7 more)

### Community 25 - "types.ts"
Cohesion: 0.12
Nodes (15): Props, Row, Auth, BodyMode, FolderNode, GrpcDef, GrpcEnd, GrpcMessage (+7 more)

### Community 26 - "lib.rs"
Cohesion: 0.15
Nodes (4): build(), CLOSE_TAB, CLOSE_WINDOW, on_event()

### Community 27 - "GrpcResponse.tsx"
Cohesion: 0.13
Nodes (18): duration(), EndRow(), MessageList(), MessageRow(), pretty(), seconds(), StatusLine(), Sub (+10 more)

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (12): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+4 more)

### Community 29 - "RequestPane.tsx"
Cohesion: 0.15
Nodes (9): react, renameTab(), TitleName(), MethodMenu(), AuthEditor(), BODY_MODES, Section, Select() (+1 more)

### Community 30 - "run_call"
Cohesion: 0.17
Nodes (15): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+7 more)

### Community 31 - "DescriptorPool"
Cohesion: 0.28
Nodes (14): cached_pool(), compile_protos(), describe(), grpc_describe(), load_pool(), pool_key(), protos_compile_and_describe(), reflect() (+6 more)

### Community 33 - "Kv"
Cohesion: 0.33
Nodes (3): apply_metadata(), metadata_list(), Kv

### Community 34 - "curl.ts"
Cohesion: 0.13
Nodes (19): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+11 more)

### Community 35 - "formats/postman.ts"
Cohesion: 0.19
Nodes (21): analyze(), convertAuth(), convertBody(), convertItems(), count(), exportPostman(), hasScript(), importPostman() (+13 more)

### Community 36 - "useStore"
Cohesion: 0.22
Nodes (11): GrpcResponsePane(), UnaryBody(), PairsTable(), when(), HttpResponsePane(), GRPC_CODES, RunBanner(), RunCells() (+3 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "jsonc.ts"
Cohesion: 0.19
Nodes (14): CodeArea(), Props, MessageEditor(), KVEditor(), BodyEditor(), dropTrailingCommas(), formatJsonc(), hasJsonComments() (+6 more)

### Community 39 - "decode_details"
Cohesion: 0.25
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "ImportModal.tsx"
Cohesion: 0.12
Nodes (29): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+21 more)

### Community 43 - "commands.ts"
Cohesion: 0.18
Nodes (12): commandsSummary(), importCommands(), nameOf(), splitCommands(), ImportPlan, Note, HarFile, Analysis (+4 more)

### Community 44 - "model.ts"
Cohesion: 0.20
Nodes (17): importNative(), NATIVE_VERSION, sane(), buildExamples(), convertExamples(), cloneNode(), cloneRequest(), METHODS (+9 more)

### Community 45 - "mask.ts"
Cohesion: 0.16
Nodes (21): allRequests(), ExampleModal(), key(), applyMasks(), findSensitive(), isVarRef(), jsonPathOf(), Kind (+13 more)

### Community 46 - "har.ts"
Cohesion: 0.35
Nodes (10): harBody(), harHeaders(), harPlan(), harResponse(), harToCollection(), hostVar(), readHar(), siteOf() (+2 more)

### Community 47 - "Home.tsx"
Cohesion: 0.29
Nodes (7): greeting(), Home(), pathOf(), icoLg, ago(), startOfDay(), HistoryEntry

### Community 48 - "ExportModal.tsx"
Cohesion: 0.25
Nodes (13): Envs, ExportModal(), Format, FORMATS, plural(), pickSavePath(), writeTextFile(), fileStem() (+5 more)

### Community 49 - "MessageDescriptor"
Cohesion: 0.28
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 50 - "connect"
Cohesion: 0.25
Nodes (6): address_gets_scheme_and_port(), connect(), parse_address(), tls_config(), describe_error(), root_cause()

### Community 52 - "GrpcState"
Cohesion: 0.38
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

### Community 54 - "mapTree"
Cohesion: 0.67
Nodes (3): insertNode(), mapTree(), mapExamples()

## Knowledge Gaps
- **11 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 292 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `useStore`, `jsonc.ts`, `ExampleRef`, `ProjectData`, `commands.ts`, `App.tsx`, `mask.ts`, `RequestPane`, `Example`, `common.ts`, `DropWhere`, `store.ts`, `GrpcResponse.tsx`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05589225589225589 - nodes in this community are weakly interconnected._
- **Why does `react` connect `RequestPane.tsx` to `Sidebar.tsx`, `NPM Dependencies`, `Modals.tsx`, `useStore`, `jsonc.ts`, `ImportModal.tsx`, `App.tsx`, `mask.ts`, `ExportModal.tsx`, `grpc.ts`, `GrpcPane.tsx`, `types.ts`, `GrpcResponse.tsx`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
- **Why does `Parser` connect `Parser` to `GrpcResponse.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06341463414634146 - nodes in this community are weakly interconnected._