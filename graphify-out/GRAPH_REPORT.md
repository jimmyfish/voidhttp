# Graph Report - voidHTTP  (2026-11-13)

## Corpus Check
- 57 files · ~56,029 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: .css 6, (none) 3, .lock 1)

## Summary
- 828 nodes · 1946 edges · 40 communities (31 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dc1f663b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- voidHTTP
- Rust HTTP Engine
- Sidebar.tsx
- NPM Dependencies
- http.ts
- Zustand Store Actions
- App Identity & Docs
- store.rs
- Tauri Config
- themes.ts
- TypeScript Config
- Parser
- jsonpath.ts
- Tauri Capabilities
- Agent Instructions
- Visual Reference
- grpc.ts
- Crate Package
- GrpcState
- store.ts
- types.ts
- Modals.tsx
- useStore
- grpc.rs
- GrpcPane.tsx
- run_call
- DescriptorPool
- NoVerify
- Kv
- curl.ts
- model.ts
- Home.tsx
- ReflectError
- TabsBar.tsx
- decode_details
- varsFormat.ts
- fonts.rs

## God Nodes (most connected - your core abstractions)
1. `State` - 52 edges
2. `useStore` - 37 edges
3. `RequestPane()` - 26 edges
4. `Parser` - 25 edges
5. `GrpcRequestPane()` - 23 edges
6. `react` - 22 edges
7. `kv()` - 18 edges
8. `uid()` - 16 edges
9. `run_call()` - 16 edges
10. `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` - 16 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `connect()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `run_call()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `Props` --references--> `Tab`  [EXTRACTED]
  src/components/GrpcPane.tsx → src/types.ts
- `GrpcRequestPane()` --calls--> `parseCurl()`  [EXTRACTED]
  src/components/GrpcPane.tsx → src/lib/curl.ts

## Import Cycles
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (40 total, 9 thin omitted)

### Community 0 - "voidHTTP"
Cohesion: 0.29
Nodes (6): Development, Features (v0.1), Layout, Not yet, Shortcuts, voidHTTP

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.08
Nodes (18): build_multipart(), describe_error(), execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, MultipartField, normalize_url() (+10 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.10
Nodes (20): EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView(), DragCtx, DragItem (+12 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.07
Nodes (35): index.html SPA Entry, #root Mount Element, dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0 (+27 more)

### Community 4 - "http.ts"
Cohesion: 0.15
Nodes (17): @tauri-apps/api, FontList, prepareGrpc(), CONTENT_TYPES, prepare(), WireBody, WireKV, dropTrailingCommas() (+9 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.05
Nodes (5): DropWhere, State, ExampleRef, ProjectData, ProjectMeta

### Community 7 - "store.rs"
Cohesion: 0.11
Nodes (17): build(), CLOSE_TAB, CLOSE_WINDOW, on_event(), data_dir(), doc_path(), DOCS, load_response() (+9 more)

### Community 8 - "Tauri Config"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 9 - "themes.ts"
Cohesion: 0.17
Nodes (21): useTheme(), alpha(), BUILTIN, BuiltinId, contrast(), DEFAULT_SCHEME, FAMILIES, findScheme() (+13 more)

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
Nodes (22): emit(), findMethod(), grpcCancel(), grpcEndSending(), GrpcEvent, grpcSend(), GRPCURL_VALUE, listeners (+14 more)

### Community 23 - "GrpcState"
Cohesion: 0.17
Nodes (8): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState, cancel_request(), HttpState, InflightGuard

### Community 24 - "store.ts"
Cohesion: 0.09
Nodes (22): invokeGrpc(), isGrpc(), cancel(), send(), insertNode(), mapTree(), buildScope(), dataOf() (+14 more)

### Community 25 - "types.ts"
Cohesion: 0.11
Nodes (16): ParsedGrpcurl, BodyMode, Example, FolderNode, GrpcDef, GrpcEnd, GrpcMessage, GrpcResult (+8 more)

### Community 26 - "Modals.tsx"
Cohesion: 0.18
Nodes (20): CODE_SIZES, FontRow(), ImportModal(), Modals(), MONO_FONTS, ProjectModal(), PromptModal(), SaveModal() (+12 more)

### Community 27 - "useStore"
Cohesion: 0.07
Nodes (48): react, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTypeTokens(), CodeArea(), Props (+40 more)

### Community 28 - "grpc.rs"
Cohesion: 0.07
Nodes (15): DynamicCodec, DynamicDecoder, DynamicEncoder, ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE (+7 more)

### Community 29 - "GrpcPane.tsx"
Cohesion: 0.07
Nodes (28): GrpcRequestPane(), MethodPicker(), Props, SchemaEditor(), Section, time(), KVEditor(), MethodMenu() (+20 more)

### Community 30 - "run_call"
Cohesion: 0.17
Nodes (15): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+7 more)

### Community 31 - "DescriptorPool"
Cohesion: 0.18
Nodes (18): address_gets_scheme_and_port(), cached_pool(), compile_protos(), connect(), describe(), grpc_describe(), load_pool(), parse_address() (+10 more)

### Community 33 - "Kv"
Cohesion: 0.33
Nodes (3): apply_metadata(), metadata_list(), Kv

### Community 34 - "curl.ts"
Cohesion: 0.15
Nodes (18): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+10 more)

### Community 35 - "model.ts"
Cohesion: 0.08
Nodes (49): allRequests(), ExampleModal(), key(), applyMasks(), findSensitive(), isSecretKey(), isVarRef(), jsonPathOf() (+41 more)

### Community 36 - "Home.tsx"
Cohesion: 0.35
Nodes (9): greeting(), Home(), pathOf(), icoLg, HistoryRow(), entryStatus(), methodLabel(), ago() (+1 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "TabsBar.tsx"
Cohesion: 0.15
Nodes (7): EnvColor(), TabsBar(), envStyle(), TAG_COLORS, TagColor, tagName(), Environment

### Community 39 - "decode_details"
Cohesion: 0.25
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "varsFormat.ts"
Cohesion: 0.29
Nodes (11): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+3 more)

### Community 41 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

## Knowledge Gaps
- **11 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 273 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `model.ts`, `TabsBar.tsx`, `store.ts`, `types.ts`, `useStore`, `GrpcPane.tsx`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07507507507507508 - nodes in this community are weakly interconnected._
- **Why does `react` connect `useStore` to `Sidebar.tsx`, `model.ts`, `NPM Dependencies`, `Home.tsx`, `TabsBar.tsx`, `grpc.ts`, `Modals.tsx`, `GrpcPane.tsx`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0962566844919786 - nodes in this community are weakly interconnected._
- **Why does `Parser` connect `Parser` to `useStore`, `jsonpath.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06612685560053981 - nodes in this community are weakly interconnected._