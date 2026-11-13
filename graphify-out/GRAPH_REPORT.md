# Graph Report - voidHTTP  (2026-11-13)

## Corpus Check
- 55 files · ~54,789 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: .css 6, (none) 3, .lock 1)

## Summary
- 820 nodes · 1917 edges · 37 communities (28 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5b565a5c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- voidHTTP
- Rust HTTP Engine
- Sidebar.tsx
- NPM Dependencies
- RequestPane.tsx
- Zustand Store Actions
- App Identity & Docs
- store.rs
- Tauri Config
- Modals.tsx
- TypeScript Config
- Parser
- jsonpath.ts
- Tauri Capabilities
- Agent Instructions
- Visual Reference
- grpc.ts
- Crate Package
- fonts.rs
- KVEditor.tsx
- mask.ts
- store.ts
- types.ts
- useStore
- grpc.rs
- GrpcPane.tsx
- run_call
- DescriptorPool
- NoVerify
- run_call
- curl.ts
- model.ts
- ReflectError
- decode_details

## God Nodes (most connected - your core abstractions)
1. `State` - 52 edges
2. `useStore` - 37 edges
3. `Parser` - 25 edges
4. `RequestPane()` - 25 edges
5. `GrpcRequestPane()` - 22 edges
6. `react` - 20 edges
7. `kv()` - 18 edges
8. `uid()` - 16 edges
9. `run_call()` - 16 edges
10. `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` - 16 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `connect()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `useTheme()` --calls--> `useStore`  [EXTRACTED]
  src/App.tsx → src/store.ts
- `useTypeTokens()` --calls--> `useStore`  [EXTRACTED]
  src/App.tsx → src/store.ts
- `AppStrip()` --calls--> `useStore`  [EXTRACTED]
  src/App.tsx → src/store.ts

## Import Cycles
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (37 total, 9 thin omitted)

### Community 0 - "voidHTTP"
Cohesion: 0.29
Nodes (6): Development, Features (v0.1), Layout, Not yet, Shortcuts, voidHTTP

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.07
Nodes (18): build_multipart(), execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState, InflightGuard, MultipartField (+10 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.07
Nodes (28): greeting(), Home(), pathOf(), EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu() (+20 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.07
Nodes (33): index.html SPA Entry, #root Mount Element, dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, zustand@^4.5.5 (+25 more)

### Community 4 - "RequestPane.tsx"
Cohesion: 0.09
Nodes (22): AuthEditor(), BODY_MODES, RequestPane(), Section, looksLikeCurl(), looksLikeGrpcurl(), cancel(), CONTENT_TYPES (+14 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.05
Nodes (5): DropWhere, State, ExampleRef, ProjectData, ProjectMeta

### Community 7 - "store.rs"
Cohesion: 0.11
Nodes (17): build(), CLOSE_TAB, CLOSE_WINDOW, on_event(), data_dir(), doc_path(), DOCS, load_response() (+9 more)

### Community 8 - "Tauri Config"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 9 - "Modals.tsx"
Cohesion: 0.06
Nodes (51): @tauri-apps/api, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTheme(), useTypeTokens(), icoLg (+43 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 12 - "jsonpath.ts"
Cohesion: 0.20
Nodes (17): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+9 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "grpc.ts"
Cohesion: 0.11
Nodes (27): GrpcRequestPane(), clientStreams(), defaultGrpc(), emit(), findMethod(), grpcCancel(), grpcEndSending(), GrpcEvent (+19 more)

### Community 20 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 21 - "KVEditor.tsx"
Cohesion: 0.25
Nodes (5): @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-dialog, Props, Row, MultipartField

### Community 23 - "mask.ts"
Cohesion: 0.14
Nodes (24): allRequests(), ExampleModal(), key(), applyMasks(), findSensitive(), isSecretKey(), isVarRef(), jsonPathOf() (+16 more)

### Community 24 - "store.ts"
Cohesion: 0.11
Nodes (18): isGrpc(), insertNode(), mapTree(), dataOf(), DEFAULT_SETTINGS, emptyData(), findExample(), liveData() (+10 more)

### Community 25 - "types.ts"
Cohesion: 0.10
Nodes (16): ParsedGrpcurl, BodyMode, Environment, Example, FolderNode, GrpcDef, GrpcEnd, GrpcMessage (+8 more)

### Community 27 - "useStore"
Cohesion: 0.08
Nodes (45): react, CodeArea(), Props, MessageEditor(), duration(), EndRow(), GrpcResponsePane(), MessageList() (+37 more)

### Community 28 - "grpc.rs"
Cohesion: 0.06
Nodes (16): DynamicCodec, DynamicDecoder, DynamicEncoder, ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE (+8 more)

### Community 29 - "GrpcPane.tsx"
Cohesion: 0.10
Nodes (14): MethodPicker(), Props, SchemaEditor(), Section, time(), Props, Tok, tokenizeUrl() (+6 more)

### Community 30 - "run_call"
Cohesion: 0.15
Nodes (16): Call, CallGuard, emit_message(), grpc_cancel(), grpc_end(), grpc_invoke(), grpc_send(), GrpcEvent (+8 more)

### Community 31 - "DescriptorPool"
Cohesion: 0.15
Nodes (21): address_gets_scheme_and_port(), cached_pool(), compile_protos(), connect(), describe(), find_method(), grpc_describe(), InvokeRequest (+13 more)

### Community 33 - "run_call"
Cohesion: 0.28
Nodes (7): apply_metadata(), code_name(), metadata_list(), run_call(), describe_error(), Kv, root_cause()

### Community 34 - "curl.ts"
Cohesion: 0.16
Nodes (17): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+9 more)

### Community 35 - "model.ts"
Cohesion: 0.10
Nodes (37): KVEditor(), VariablesModal(), cloneNode(), cloneRequest(), kv(), newRequest(), nodeIds(), paramsFromUrl() (+29 more)

### Community 37 - "ReflectError"
Cohesion: 0.43
Nodes (3): ReflectError, Other, Unimplemented

### Community 39 - "decode_details"
Cohesion: 0.33
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

## Knowledge Gaps
- **11 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 273 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `model.ts`, `RequestPane.tsx`, `Modals.tsx`, `store.ts`, `types.ts`, `useStore`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.06976744186046512 - nodes in this community are weakly interconnected._
- **Why does `react` connect `useStore` to `Sidebar.tsx`, `NPM Dependencies`, `RequestPane.tsx`, `Modals.tsx`, `grpc.ts`, `KVEditor.tsx`, `mask.ts`, `GrpcPane.tsx`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07239819004524888 - nodes in this community are weakly interconnected._
- **Why does `Parser` connect `Parser` to `useStore`, `jsonpath.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06906906906906907 - nodes in this community are weakly interconnected._