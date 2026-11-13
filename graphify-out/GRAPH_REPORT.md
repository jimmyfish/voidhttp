# Graph Report - voidHTTP  (2026-11-13)

## Corpus Check
- 59 files · ~57,201 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: .css 6, (none) 3, .lock 1)

## Summary
- 840 nodes · 1991 edges · 41 communities (33 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `152f45b8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- voidHTTP
- Rust HTTP Engine
- Sidebar.tsx
- NPM Dependencies
- model.ts
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
- postman.ts
- ExampleModal.tsx
- vars.ts
- store.ts
- types.ts
- KVEditor.tsx
- useStore
- grpc.rs
- GrpcPane.tsx
- run_call
- DescriptorPool
- NoVerify
- Kv
- curl.ts
- mask.ts
- UrlInput.tsx
- ReflectError
- jsonc.ts
- decode_details
- RequestPane.tsx

## God Nodes (most connected - your core abstractions)
1. `State` - 52 edges
2. `useStore` - 37 edges
3. `RequestPane()` - 26 edges
4. `Parser` - 25 edges
5. `react` - 24 edges
6. `GrpcRequestPane()` - 23 edges
7. `kv()` - 18 edges
8. `uid()` - 16 edges
9. `run_call()` - 16 edges
10. `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` - 16 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `run_call()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `Props` --references--> `Tab`  [EXTRACTED]
  src/components/GrpcPane.tsx → src/types.ts
- `ParsedGrpcurl` --references--> `RequestDef`  [EXTRACTED]
  src/lib/grpc.ts → src/types.ts
- `State` --references--> `Settings`  [EXTRACTED]
  src/store.ts → src/types.ts

## Import Cycles
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (41 total, 8 thin omitted)

### Community 0 - "voidHTTP"
Cohesion: 0.29
Nodes (6): Development, Features (v0.1), Layout, Not yet, Shortcuts, voidHTTP

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.06
Nodes (24): FontList, list_fonts(), mono_names(), named_mono(), scan(), build_multipart(), cancel_request(), execute() (+16 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.07
Nodes (31): EnvMenu(), greeting(), Home(), pathOf(), icoLg, EnvItem(), MenuItem, MenuState (+23 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.07
Nodes (34): index.html SPA Entry, #root Mount Element, dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/plugin-dialog@^2.0.0, zustand@^4.5.5 (+26 more)

### Community 4 - "model.ts"
Cohesion: 0.16
Nodes (14): cloneNode(), cloneRequest(), DropWhere, insertNode(), mapTree(), nodeIds(), parseQuery(), pathTo() (+6 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.06
Nodes (4): State, ExampleRef, ProjectData, ProjectMeta

### Community 7 - "store.rs"
Cohesion: 0.09
Nodes (22): build(), CLOSE_TAB, CLOSE_WINDOW, on_event(), copy_atomic(), doc_path(), load_response(), load_state() (+14 more)

### Community 8 - "Tauri Config"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 9 - "GrpcState"
Cohesion: 0.47
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.13
Nodes (19): child(), children(), CMP, compile(), equal(), evaluate(), Expr, has() (+11 more)

### Community 12 - "Modals.tsx"
Cohesion: 0.05
Nodes (68): @tauri-apps/api@^2.0.0, @tauri-apps/api, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTheme(), useTypeTokens() (+60 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "grpc.ts"
Cohesion: 0.10
Nodes (24): emit(), findMethod(), grpcCancel(), grpcEndSending(), GrpcEvent, grpcSend(), GRPCURL_VALUE, invokeGrpc() (+16 more)

### Community 20 - "postman.ts"
Cohesion: 0.32
Nodes (14): kv(), newRequest(), paramsFromUrl(), uid(), Any, convertAuth(), convertBody(), convertItems() (+6 more)

### Community 21 - "ExampleModal.tsx"
Cohesion: 0.36
Nodes (6): allRequests(), ExampleModal(), key(), findNode(), Collection, TreeNode

### Community 23 - "vars.ts"
Cohesion: 0.38
Nodes (6): buildScope(), DYNAMIC, dynamic(), resolve(), unresolved(), VarScope

### Community 24 - "store.ts"
Cohesion: 0.08
Nodes (23): isGrpc(), cancel(), CONTENT_TYPES, Prepared, send(), WireBody, WireKV, dataOf() (+15 more)

### Community 25 - "types.ts"
Cohesion: 0.12
Nodes (16): ParsedGrpcurl, Auth, Example, FolderNode, GrpcDef, GrpcEnd, GrpcMessage, GrpcResult (+8 more)

### Community 26 - "KVEditor.tsx"
Cohesion: 0.33
Nodes (4): Props, Row, KV, MultipartField

### Community 27 - "useStore"
Cohesion: 0.09
Nodes (38): react, CodeArea(), Props, MessageEditor(), duration(), EndRow(), GrpcResponsePane(), MessageList() (+30 more)

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (13): describe(), ERROR_DETAILS_PROTO, example(), reflect_impl!, MAX_MESSAGE, MethodInfo, protos_compile_and_describe(), RpcStatus (+5 more)

### Community 29 - "GrpcPane.tsx"
Cohesion: 0.13
Nodes (8): MethodPicker(), Props, SchemaEditor(), Section, time(), VarInfo, clientStreams(), shortService()

### Community 30 - "run_call"
Cohesion: 0.18
Nodes (14): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+6 more)

### Community 31 - "DescriptorPool"
Cohesion: 0.18
Nodes (16): address_gets_scheme_and_port(), cached_pool(), connect(), grpc_describe(), InvokeRequest, load_pool(), parse_address(), pool_key() (+8 more)

### Community 33 - "Kv"
Cohesion: 0.14
Nodes (6): apply_metadata(), DynamicCodec, DynamicDecoder, DynamicEncoder, metadata_list(), Kv

### Community 34 - "curl.ts"
Cohesion: 0.20
Nodes (14): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+6 more)

### Community 35 - "mask.ts"
Cohesion: 0.16
Nodes (19): applyMasks(), findSensitive(), isSecretKey(), isVarRef(), jsonPathOf(), Kind, kindOf(), Loc (+11 more)

### Community 36 - "UrlInput.tsx"
Cohesion: 0.47
Nodes (5): Props, Tok, tokenizeUrl(), UrlInput(), VarTip()

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "jsonc.ts"
Cohesion: 0.27
Nodes (9): prepareGrpc(), schemaOf(), prepare(), dropTrailingCommas(), hasJsonComments(), LineEdit, stripJsonComments(), Tok (+1 more)

### Community 39 - "decode_details"
Cohesion: 0.21
Nodes (8): compile_protos(), decode_details(), EmbeddedFile, error_details_decode(), error_details_pool(), home(), sample_pool(), tilde_paths_expand()

### Community 41 - "RequestPane.tsx"
Cohesion: 0.17
Nodes (12): GrpcRequestPane(), KVEditor(), MethodMenu(), BODY_MODES, RequestPane(), Section, looksLikeCurl(), defaultGrpc() (+4 more)

## Knowledge Gaps
- **11 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 278 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `model.ts`, `RequestPane.tsx`, `Modals.tsx`, `ExampleModal.tsx`, `store.ts`, `types.ts`, `useStore`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05660377358490566 - nodes in this community are weakly interconnected._
- **Why does `react` connect `useStore` to `Sidebar.tsx`, `NPM Dependencies`, `UrlInput.tsx`, `RequestPane.tsx`, `Modals.tsx`, `grpc.ts`, `ExampleModal.tsx`, `KVEditor.tsx`, `GrpcPane.tsx`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06623376623376623 - nodes in this community are weakly interconnected._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06827880512091039 - nodes in this community are weakly interconnected._
- **Should `Zustand Store Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.05668016194331984 - nodes in this community are weakly interconnected._