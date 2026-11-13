# Graph Report - voidHTTP  (2026-11-13)

## Corpus Check
- 73 files · ~85,916 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: .css 8, (none) 3, .lock 1)

## Summary
- 1031 nodes · 2580 edges · 54 communities (40 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4fa90ddc`
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
- model.ts
- SavedRef
- mask.ts
- UrlInput.tsx
- varsFormat.ts
- MessageDescriptor
- main.tsx
- ExampleRef
- mapTree
- DropWhere
- ProjectData

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
- `ParsedGrpcurl` --references--> `RequestDef`  [EXTRACTED]
  src/lib/grpc.ts → src/types.ts
- `run_call()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `State` --references--> `Settings`  [EXTRACTED]
  src/store.ts → src/types.ts
- `State` --inherits--> `ProjectData`  [EXTRACTED]
  src/store.ts → src/types.ts

## Import Cycles
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (54 total, 14 thin omitted)

### Community 0 - "Features"
Cohesion: 0.14
Nodes (13): Appearance and settings, Development, Features, gRPC, History and examples, HTTP, Import and export, Layout (+5 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.06
Nodes (24): FontList, list_fonts(), mono_names(), named_mono(), scan(), build_multipart(), cancel_request(), execute() (+16 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.10
Nodes (24): RenameField(), EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView(), DragCtx (+16 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.06
Nodes (41): dependencies, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-process@^2, @tauri-apps/plugin-updater@^2, yaml@2.6.1 (+33 more)

### Community 4 - "Modals.tsx"
Cohesion: 0.13
Nodes (23): CODE_SIZES, EnvColor(), FontRow(), Modals(), MONO_FONTS, ProjectModal(), PromptModal(), SaveModal() (+15 more)

### Community 7 - "store.rs"
Cohesion: 0.08
Nodes (23): MAX_READ, build(), CLOSE_TAB, CLOSE_WINDOW, on_event(), copy_atomic(), doc_path(), load_response() (+15 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.10
Nodes (31): Any, Source, HarFile, HarRow, Analysis, Build, buildAuth(), buildBody() (+23 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.13
Nodes (19): child(), children(), CMP, compile(), equal(), evaluate(), Expr, has() (+11 more)

### Community 12 - "connect"
Cohesion: 0.25
Nodes (6): address_gets_scheme_and_port(), connect(), parse_address(), tls_config(), describe_error(), root_cause()

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "grpc.ts"
Cohesion: 0.10
Nodes (30): GrpcRequestPane(), clientStreams(), defaultGrpc(), emit(), findMethod(), GRPCURL_VALUE, listeners, loadSchema() (+22 more)

### Community 20 - "GrpcPane.tsx"
Cohesion: 0.17
Nodes (8): MethodPicker(), Props, SchemaEditor(), Section, time(), VarInfo, shortService(), Tab

### Community 21 - "with"
Cohesion: 0.07
Nodes (27): GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, macos, runs-on, steps, name (+19 more)

### Community 23 - "react"
Cohesion: 0.12
Nodes (8): lucide-react@^0.460.0, lucide-react, EnvMenu(), ico, icoLg, Props, Row, TabsBar()

### Community 24 - "store.ts"
Cohesion: 0.08
Nodes (23): grpcCancel(), grpcEndSending(), GrpcEvent, grpcSend(), invokeGrpc(), nodeIds(), placeNode(), removeFromTree() (+15 more)

### Community 25 - "Home.tsx"
Cohesion: 0.36
Nodes (6): greeting(), Home(), pathOf(), entryStatus(), ago(), startOfDay()

### Community 26 - "common.ts"
Cohesion: 0.15
Nodes (19): @tauri-apps/api, DropImport(), Envs, ExportModal(), Format, FORMATS, plural(), baseName() (+11 more)

### Community 27 - "GrpcResponse.tsx"
Cohesion: 0.10
Nodes (35): duration(), EndRow(), GrpcResponsePane(), MessageList(), MessageRow(), pretty(), seconds(), StatusLine() (+27 more)

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (12): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+4 more)

### Community 29 - "RequestPane.tsx"
Cohesion: 0.12
Nodes (19): react, renameTab(), TitleName(), MethodMenu(), AuthEditor(), BODY_MODES, RequestPane(), Section (+11 more)

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
Cohesion: 0.20
Nodes (23): convertAuth(), convertBody(), convertExamples(), convertItems(), count(), exportPostman(), hasScript(), importPostman() (+15 more)

### Community 36 - "Kv"
Cohesion: 0.33
Nodes (3): apply_metadata(), metadata_list(), Kv

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "jsonc.ts"
Cohesion: 0.14
Nodes (18): CodeArea(), Props, MessageEditor(), KVEditor(), BodyEditor(), CONTENT_TYPES, Prepared, WireBody (+10 more)

### Community 39 - "decode_details"
Cohesion: 0.25
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "ImportModal.tsx"
Cohesion: 0.13
Nodes (29): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+21 more)

### Community 41 - "common.ts"
Cohesion: 0.38
Nodes (9): blankKv(), blankSecretKv(), blankValues(), detect(), FormatId, isVarRef(), parseDoc(), scrubNodes() (+1 more)

### Community 42 - "App.tsx"
Cohesion: 0.10
Nodes (28): App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTheme(), useTypeTokens(), Mark(), SchemeRow() (+20 more)

### Community 43 - "model.ts"
Cohesion: 0.13
Nodes (34): importCommands(), nameOf(), splitCommands(), ImportPlan, Note, harBody(), harResponse(), harToCollection() (+26 more)

### Community 45 - "mask.ts"
Cohesion: 0.15
Nodes (22): allRequests(), ExampleModal(), key(), Select(), applyMasks(), findSensitive(), isVarRef(), jsonPathOf() (+14 more)

### Community 46 - "UrlInput.tsx"
Cohesion: 0.47
Nodes (5): Props, Tok, tokenizeUrl(), UrlInput(), VarTip()

### Community 47 - "varsFormat.ts"
Cohesion: 0.33
Nodes (10): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+2 more)

### Community 48 - "MessageDescriptor"
Cohesion: 0.28
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 51 - "mapTree"
Cohesion: 0.67
Nodes (3): insertNode(), mapTree(), mapExamples()

## Knowledge Gaps
- **11 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 323 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `RequestPane.tsx` to `Sidebar.tsx`, `NPM Dependencies`, `Modals.tsx`, `jsonc.ts`, `ImportModal.tsx`, `App.tsx`, `mask.ts`, `UrlInput.tsx`, `grpc.ts`, `main.tsx`, `GrpcPane.tsx`, `react`, `common.ts`, `GrpcResponse.tsx`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Features` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `jsonc.ts`, `App.tsx`, `model.ts`, `SavedRef`, `mask.ts`, `grpc.ts`, `ExampleRef`, `DropWhere`, `ProjectData`, `store.ts`, `GrpcResponse.tsx`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05589225589225589 - nodes in this community are weakly interconnected._
- **Why does `useStore` connect `GrpcResponse.tsx` to `Sidebar.tsx`, `Modals.tsx`, `jsonc.ts`, `ImportModal.tsx`, `App.tsx`, `mask.ts`, `grpc.ts`, `GrpcPane.tsx`, `react`, `store.ts`, `Home.tsx`, `common.ts`, `RequestPane.tsx`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1006006006006006 - nodes in this community are weakly interconnected._