# Graph Report - voidHTTP  (2026-11-14)

## Corpus Check
- 82 files · ~103,803 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: .css 8, (none) 3, .lock 1)

## Summary
- 1177 nodes · 3119 edges · 57 communities (46 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `432a44d6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Features
- Rust HTTP Engine
- Sidebar.tsx
- App.tsx
- Modals.tsx
- Zustand Store Actions
- App Identity & Docs
- store.rs
- Tauri Config
- openapi.ts
- TypeScript Config
- Parser
- themes.ts
- Tauri Capabilities
- Agent Instructions
- Visual Reference
- App.tsx
- Crate Package
- GrpcPane.tsx
- with
- cache.yml
- devDependencies
- Home.tsx
- RequestPane.tsx
- UpdateChip.tsx
- grpc.rs
- ExportModal.tsx
- native.ts
- DescriptorPool
- NoVerify
- Kv
- curl.ts
- postman.ts
- RequestPane
- ReflectError
- dependencies
- decode_details
- ImportModal.tsx
- MessageDescriptor
- react
- connect
- GrpcState
- common.ts
- varsFormat.ts
- UrlInput.tsx
- scripts
- store.ts
- run_call
- findNode
- index.ts
- audit-round2.test.ts

## God Nodes (most connected - your core abstractions)
1. `State` - 51 edges
2. `useStore` - 45 edges
3. `kv()` - 34 edges
4. `uid()` - 33 edges
5. `RequestPane()` - 28 edges
6. `react` - 28 edges
7. `Parser` - 25 edges
8. `newRequest()` - 25 edges
9. `GrpcRequestPane()` - 24 edges
10. `requestsOf()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `call()` --calls--> `kv()`  [EXTRACTED]
  tests/grpc-examples.test.ts → src/lib/model.ts
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `run()` --calls--> `blankHarEnv()`  [EXTRACTED]
  tests/audit-round2.test.ts → src/lib/formats/common.ts
- `run()` --calls--> `blankHarEnv()`  [EXTRACTED]
  tests/audit-round3.test.ts → src/lib/formats/common.ts
- `run()` --calls--> `blankValues()`  [EXTRACTED]
  tests/audit-round2.test.ts → src/lib/formats/common.ts

## Import Cycles
- 1-file cycle: `src-tauri/src/files.rs -> src-tauri/src/files.rs`
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (57 total, 11 thin omitted)

### Community 0 - "Features"
Cohesion: 0.14
Nodes (13): Appearance and settings, Development, Features, gRPC, History and examples, HTTP, Import and export, Layout (+5 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.06
Nodes (24): FontList, list_fonts(), mono_names(), named_mono(), scan(), build_multipart(), cancel_request(), execute() (+16 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.15
Nodes (23): RenameField(), EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView(), DragCtx (+15 more)

### Community 3 - "App.tsx"
Cohesion: 0.10
Nodes (38): duration(), EndRow(), GrpcResponsePane(), MessageList(), MessageRow(), pretty(), SaveExampleButton(), seconds() (+30 more)

### Community 4 - "Modals.tsx"
Cohesion: 0.13
Nodes (19): CODE_SIZES, EnvColor(), FontRow(), Modals(), MONO_FONTS, PromptModal(), SaveModal(), SettingsModal() (+11 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.05
Nodes (6): DropWhere, State, ExampleRef, ProjectData, ProjectMeta, SavedRef

### Community 7 - "store.rs"
Cohesion: 0.07
Nodes (31): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_ref_file(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file() (+23 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.11
Nodes (27): Any, Source, HarRow, Build, buildAuth(), buildBody(), buildExamples(), buildOpenApi() (+19 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.14
Nodes (17): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+9 more)

### Community 12 - "themes.ts"
Cohesion: 0.16
Nodes (22): useTheme(), SchemeRow(), alpha(), BUILTIN, BuiltinId, contrast(), DEFAULT_SCHEME, FAMILIES (+14 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "App.tsx"
Cohesion: 0.09
Nodes (13): index.html SPA Entry, #root Mount Element, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTypeTokens(), EnvMenu() (+5 more)

### Community 20 - "GrpcPane.tsx"
Cohesion: 0.12
Nodes (13): MethodPicker(), Props, SchemaEditor(), Section, time(), VarInfo, clientStreams(), findMethod() (+5 more)

### Community 21 - "with"
Cohesion: 0.05
Nodes (38): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+30 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @tauri-apps/cli@^2.0.0, @types/react@^18.3.11, @types/react-dom@^18.3.1, typescript@^5.6.3, vite@^5.4.10, @vitejs/plugin-react@^4.3.2, @tauri-apps/cli (+5 more)

### Community 25 - "Home.tsx"
Cohesion: 0.22
Nodes (11): greeting(), Home(), pathOf(), ProjectModal(), PROJECT_COLORS, PROJECT_ICONS, ProjectTile(), tileStyle() (+3 more)

### Community 26 - "RequestPane.tsx"
Cohesion: 0.13
Nodes (8): Props, Row, AuthEditor(), BODY_MODES, Section, Select(), DYNAMIC, BodyMode

### Community 27 - "UpdateChip.tsx"
Cohesion: 0.13
Nodes (15): UpdatesPane(), Notes(), UpdateChip(), checkForUpdate(), hasPendingUpdate(), installUpdate(), mb(), message() (+7 more)

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (12): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+4 more)

### Community 29 - "ExportModal.tsx"
Cohesion: 0.16
Nodes (17): @tauri-apps/api@^2.0.0, @tauri-apps/api, DropImport(), Envs, ExportModal(), Format, FORMATS, plural() (+9 more)

### Community 30 - "native.ts"
Cohesion: 0.28
Nodes (13): ImportPlan, NATIVE_VERSION, NativeFile, num(), pairs(), rows(), sane(), saneAuth() (+5 more)

### Community 31 - "DescriptorPool"
Cohesion: 0.28
Nodes (14): cached_pool(), compile_protos(), describe(), grpc_describe(), load_pool(), pool_key(), protos_compile_and_describe(), reflect() (+6 more)

### Community 33 - "Kv"
Cohesion: 0.33
Nodes (3): apply_metadata(), metadata_list(), Kv

### Community 34 - "curl.ts"
Cohesion: 0.14
Nodes (22): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+14 more)

### Community 35 - "postman.ts"
Cohesion: 0.13
Nodes (34): str(), harBody(), harHeaders(), harPlan(), harResponse(), harToCollection(), hostVar(), readHar() (+26 more)

### Community 36 - "RequestPane"
Cohesion: 0.23
Nodes (13): GrpcRequestPane(), KVEditor(), MethodMenu(), BodyEditor(), RequestPane(), looksLikeCurl(), defaultGrpc(), emit() (+5 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "dependencies"
Cohesion: 0.12
Nodes (22): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2, @tauri-apps/plugin-updater@^2 (+14 more)

### Community 39 - "decode_details"
Cohesion: 0.25
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "ImportModal.tsx"
Cohesion: 0.13
Nodes (23): Check3(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal(), isUrl() (+15 more)

### Community 41 - "MessageDescriptor"
Cohesion: 0.28
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 42 - "react"
Cohesion: 0.20
Nodes (12): react, CodeArea(), Props, MessageEditor(), dropTrailingCommas(), formatJsonc(), hasJsonComments(), LineEdit (+4 more)

### Community 43 - "connect"
Cohesion: 0.25
Nodes (6): address_gets_scheme_and_port(), connect(), parse_address(), tls_config(), describe_error(), root_cause()

### Community 44 - "GrpcState"
Cohesion: 0.38
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

### Community 45 - "common.ts"
Cohesion: 0.08
Nodes (61): allRequests(), ExampleModal(), key(), statusName(), addressLike(), basicKept(), blankHarEnv(), blankKv() (+53 more)

### Community 46 - "varsFormat.ts"
Cohesion: 0.33
Nodes (10): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+2 more)

### Community 47 - "UrlInput.tsx"
Cohesion: 0.47
Nodes (5): Props, Tok, tokenizeUrl(), UrlInput(), VarTip()

### Community 50 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, tauri, typecheck

### Community 52 - "store.ts"
Cohesion: 0.05
Nodes (59): fetchText(), grpcCancel(), grpcEndSending(), GrpcEvent, grpcSend(), GRPCURL_VALUE, invokeGrpc(), listeners (+51 more)

### Community 53 - "run_call"
Cohesion: 0.17
Nodes (15): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+7 more)

### Community 54 - "findNode"
Cohesion: 0.83
Nodes (3): renameTab(), TitleName(), findNode()

### Community 57 - "index.ts"
Cohesion: 0.19
Nodes (14): detect(), dropFilePaths(), parseDoc(), requestsOf(), analyze(), importNative(), exampleCount(), loadOpenApi() (+6 more)

### Community 58 - "audit-round2.test.ts"
Cohesion: 0.14
Nodes (28): UrlTab(), capEnvironments(), capRequest(), capRows(), exportHar(), exportNative(), exportPostman(), prepareGrpc() (+20 more)

## Knowledge Gaps
- **11 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 352 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Parser` connect `Parser` to `App.tsx`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Features` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `App.tsx`, `RequestPane`, `react`, `store.ts`, `native.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05589225589225589 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `Sidebar.tsx`, `App.tsx`, `Modals.tsx`, `dependencies`, `ImportModal.tsx`, `common.ts`, `UrlInput.tsx`, `App.tsx`, `GrpcPane.tsx`, `store.ts`, `findNode`, `Home.tsx`, `RequestPane.tsx`, `UpdateChip.tsx`, `ExportModal.tsx`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14532019704433496 - nodes in this community are weakly interconnected._