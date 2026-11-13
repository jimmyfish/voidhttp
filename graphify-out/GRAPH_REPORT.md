# Graph Report - voidHTTP  (2026-11-13)

## Corpus Check
- 60 files · ~57,595 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: .css 6, (none) 3, .lock 1)

## Summary
- 845 nodes · 2017 edges · 42 communities (33 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `78d3cd50`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- voidHTTP
- Rust HTTP Engine
- Sidebar.tsx
- NPM Dependencies
- jsonpath.ts
- Zustand Store Actions
- App Identity & Docs
- store.rs
- Tauri Config
- GrpcState
- TypeScript Config
- Parser
- Modals.tsx
- Tauri Capabilities
- Agent Instructions
- Visual Reference
- grpc.ts
- Crate Package
- GrpcPane.tsx
- postman.ts
- http.ts
- store.ts
- types.ts
- MessageDescriptor
- useStore
- grpc.rs
- RequestPane.tsx
- run_call
- DescriptorPool
- NoVerify
- Kv
- curl.ts
- mask.ts
- GrpcRequestPane
- ReflectError
- jsonc.ts
- decode_details
- model.ts
- UrlInput.tsx

## God Nodes (most connected - your core abstractions)
1. `State` - 52 edges
2. `useStore` - 38 edges
3. `RequestPane()` - 27 edges
4. `Parser` - 25 edges
5. `react` - 25 edges
6. `GrpcRequestPane()` - 24 edges
7. `kv()` - 18 edges
8. `findNode()` - 16 edges
9. `uid()` - 16 edges
10. `run_call()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `run_call()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `useTheme()` --calls--> `isDark()`  [EXTRACTED]
  src/App.tsx → src/lib/themes.ts
- `useTheme()` --calls--> `schemeTokens()`  [EXTRACTED]
  src/App.tsx → src/lib/themes.ts
- `ParsedGrpcurl` --references--> `RequestDef`  [EXTRACTED]
  src/lib/grpc.ts → src/types.ts

## Import Cycles
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (42 total, 9 thin omitted)

### Community 0 - "voidHTTP"
Cohesion: 0.29
Nodes (6): Development, Features (v0.1), Layout, Not yet, Shortcuts, voidHTTP

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.06
Nodes (24): FontList, list_fonts(), mono_names(), named_mono(), scan(), build_multipart(), cancel_request(), execute() (+16 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.10
Nodes (34): react, greeting(), Home(), pathOf(), icoLg, RenameField(), renameTab(), TitleName() (+26 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.07
Nodes (36): index.html SPA Entry, #root Mount Element, dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0 (+28 more)

### Community 4 - "jsonpath.ts"
Cohesion: 0.20
Nodes (17): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+9 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.05
Nodes (5): State, ExampleRef, ProjectData, ProjectMeta, Settings

### Community 7 - "store.rs"
Cohesion: 0.08
Nodes (25): example(), scalar_example(), well_known_example(), build(), CLOSE_TAB, CLOSE_WINDOW, on_event(), copy_atomic() (+17 more)

### Community 8 - "Tauri Config"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 9 - "GrpcState"
Cohesion: 0.47
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 12 - "Modals.tsx"
Cohesion: 0.06
Nodes (55): CODE_SIZES, EnvColor(), ImportModal(), Modals(), MONO_FONTS, ProjectModal(), PromptModal(), SaveModal() (+47 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "grpc.ts"
Cohesion: 0.10
Nodes (25): shellWords(), emit(), grpcCancel(), grpcEndSending(), GrpcEvent, grpcSend(), GRPCURL_VALUE, invokeGrpc() (+17 more)

### Community 20 - "GrpcPane.tsx"
Cohesion: 0.13
Nodes (4): Props, Section, VarInfo, Tab

### Community 21 - "postman.ts"
Cohesion: 0.26
Nodes (15): kv(), newRequest(), paramsFromUrl(), parseQuery(), Any, convertAuth(), convertBody(), convertItems() (+7 more)

### Community 23 - "http.ts"
Cohesion: 0.19
Nodes (10): cancel(), CONTENT_TYPES, send(), WireBody, WireKV, uid(), buildScope(), DYNAMIC (+2 more)

### Community 24 - "store.ts"
Cohesion: 0.11
Nodes (16): insertNode(), mapTree(), dataOf(), DEFAULT_SETTINGS, emptyData(), findExample(), liveData(), loadingRun (+8 more)

### Community 25 - "types.ts"
Cohesion: 0.12
Nodes (15): ParsedGrpcurl, Auth, BodyMode, Example, FolderNode, GrpcDef, GrpcEnd, GrpcMessage (+7 more)

### Community 26 - "MessageDescriptor"
Cohesion: 0.18
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 27 - "useStore"
Cohesion: 0.05
Nodes (49): App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTheme(), useTypeTokens(), EnvMenu(), duration() (+41 more)

### Community 28 - "grpc.rs"
Cohesion: 0.07
Nodes (15): address_gets_scheme_and_port(), connect(), ERROR_DETAILS_PROTO, home(), reflect_impl!, MAX_MESSAGE, MethodInfo, parse_address() (+7 more)

### Community 29 - "RequestPane.tsx"
Cohesion: 0.15
Nodes (11): MethodMenu(), BODY_MODES, RequestPane(), Section, isGrpc(), looksLikeGrpcurl(), METHODS, pathTo() (+3 more)

### Community 30 - "run_call"
Cohesion: 0.17
Nodes (15): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+7 more)

### Community 31 - "DescriptorPool"
Cohesion: 0.28
Nodes (14): cached_pool(), compile_protos(), describe(), grpc_describe(), load_pool(), pool_key(), protos_compile_and_describe(), reflect() (+6 more)

### Community 33 - "Kv"
Cohesion: 0.67
Nodes (3): apply_metadata(), metadata_list(), Kv

### Community 34 - "curl.ts"
Cohesion: 0.15
Nodes (17): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), looksLikeCurl(), parseCurl(), ParsedCurl (+9 more)

### Community 35 - "mask.ts"
Cohesion: 0.14
Nodes (25): allRequests(), ExampleModal(), key(), FontRow(), AuthEditor(), Select(), applyMasks(), findSensitive() (+17 more)

### Community 36 - "GrpcRequestPane"
Cohesion: 0.20
Nodes (11): GrpcRequestPane(), MethodPicker(), SchemaEditor(), time(), clientStreams(), defaultGrpc(), findMethod(), prepareGrpc() (+3 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "jsonc.ts"
Cohesion: 0.19
Nodes (14): CodeArea(), Props, MessageEditor(), KVEditor(), BodyEditor(), prepare(), dropTrailingCommas(), formatJsonc() (+6 more)

### Community 39 - "decode_details"
Cohesion: 0.33
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "model.ts"
Cohesion: 0.28
Nodes (7): cloneNode(), cloneRequest(), DropWhere, nodeIds(), placeNode(), removeFromTree(), toRequestDef()

### Community 41 - "UrlInput.tsx"
Cohesion: 0.47
Nodes (5): Props, Tok, tokenizeUrl(), UrlInput(), VarTip()

## Knowledge Gaps
- **11 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 278 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `GrpcRequestPane`, `jsonc.ts`, `model.ts`, `Modals.tsx`, `http.ts`, `store.ts`, `types.ts`, `useStore`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05660377358490566 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Sidebar.tsx` to `mask.ts`, `NPM Dependencies`, `jsonc.ts`, `UrlInput.tsx`, `Modals.tsx`, `grpc.ts`, `GrpcPane.tsx`, `useStore`, `RequestPane.tsx`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10465116279069768 - nodes in this community are weakly interconnected._
- **Why does `Parser` connect `Parser` to `useStore`, `jsonpath.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06538461538461539 - nodes in this community are weakly interconnected._