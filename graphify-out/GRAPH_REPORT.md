# Graph Report - voidHTTP  (2026-11-15)

## Corpus Check
- 80 files · ~104,642 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 16 file(s) not represented in the graph (top: .css 9, (none) 3, .lock 1)

## Summary
- 1259 nodes · 3210 edges · 64 communities (47 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `047c6469`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Features
- Rust HTTP Engine
- Sidebar.tsx
- Runs.tsx
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
- App.tsx
- Crate Package
- WsResponse.tsx
- with
- cache.yml
- Modals.tsx
- types.ts
- model.ts
- @tauri-apps/api
- grpc.rs
- http.ts
- native.ts
- devDependencies
- NoVerify
- dependencies
- curl.ts
- postman.ts
- GrpcPane.tsx
- ReflectError
- react
- decode_details
- ImportModal.tsx
- Kv
- Home.tsx
- ResponseBody.tsx
- updater.ts
- common.ts
- UpdateChip.tsx
- jsonc.ts
- commands.ts
- Updates
- store.ts
- run_call
- scripts
- fonts.rs
- RequestPane.tsx
- Kv

## God Nodes (most connected - your core abstractions)
1. `State` - 55 edges
2. `useStore` - 50 edges
3. `uid()` - 33 edges
4. `RequestPane()` - 31 edges
5. `react` - 30 edges
6. `kv()` - 26 edges
7. `Parser` - 25 edges
8. `GrpcRequestPane()` - 24 edges
9. `ico` - 20 edges
10. `parseCurl()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `exampleCount()` --calls--> `requestsOf()`  [EXTRACTED]
  src/lib/formats/openapi.ts → src/lib/formats/common.ts
- `connect()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `run_call()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `ExportModal()` --calls--> `blankHarEnv()`  [EXTRACTED]
  src/components/ExportModal.tsx → src/lib/formats/common.ts

## Import Cycles
- 1-file cycle: `src-tauri/src/files.rs -> src-tauri/src/files.rs`
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (64 total, 17 thin omitted)

### Community 0 - "Features"
Cohesion: 0.13
Nodes (14): Appearance and settings, Development, Features, gRPC, History and examples, HTTP, Import and export, Layout (+6 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.07
Nodes (21): build_multipart(), cancel_request(), describe_error(), execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState (+13 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.11
Nodes (23): RenameField(), EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView(), DragCtx (+15 more)

### Community 3 - "Runs.tsx"
Cohesion: 0.31
Nodes (8): when(), GRPC_CODES, RunBanner(), RunCells(), RunsButton(), useRuns(), runKey(), runsOf()

### Community 4 - "ws.rs"
Cohesion: 0.05
Nodes (29): tls_config(), bad_header_is_an_error(), build_request(), CLOSE_GRACE, Cmd, Close, Send, ConnGuard (+21 more)

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
Cohesion: 0.09
Nodes (34): Any, detect(), parseDoc(), Source, HarFile, HarRow, Analysis, Build (+26 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.14
Nodes (18): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+10 more)

### Community 12 - "ExportModal.tsx"
Cohesion: 0.19
Nodes (18): Envs, ExportModal(), Format, FORMATS, plural(), baseName(), IMPORT_EXTENSIONS, pickImportFile() (+10 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "App.tsx"
Cohesion: 0.13
Nodes (13): index.html SPA Entry, #root Mount Element, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTypeTokens(), DropImport() (+5 more)

### Community 20 - "WsResponse.tsx"
Cohesion: 0.11
Nodes (27): RFC-6455, closeLabel(), CloseRow(), duration(), Handshake(), MessageList(), MessageRow(), Pair() (+19 more)

### Community 21 - "with"
Cohesion: 0.05
Nodes (38): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+30 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "Modals.tsx"
Cohesion: 0.07
Nodes (52): useTheme(), CODE_SIZES, EnvColor(), Modals(), MONO_FONTS, ProjectModal(), PromptModal(), SaveModal() (+44 more)

### Community 25 - "types.ts"
Cohesion: 0.08
Nodes (29): grpcCancel(), grpcEndSending(), GrpcEvent, grpcSend(), GRPCURL_VALUE, invokeGrpc(), listeners, MethodInfo (+21 more)

### Community 26 - "model.ts"
Cohesion: 0.16
Nodes (23): harBody(), harHeaders(), HarOptions, harResponse(), harToCollection(), hostVar(), readHar(), siteOf() (+15 more)

### Community 27 - "@tauri-apps/api"
Cohesion: 0.40
Nodes (4): @tauri-apps/api@^2.0.0, @tauri-apps/api, FontList, systemFonts()

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (32): address_gets_scheme_and_port(), cached_pool(), compile_protos(), connect(), describe(), ERROR_DETAILS_PROTO, example(), grpc_cancel() (+24 more)

### Community 29 - "http.ts"
Cohesion: 0.18
Nodes (17): prepareGrpc(), base64Utf8(), CONTENT_TYPES, prepare(), WireBody, WireKV, stripJsonComments(), Budget (+9 more)

### Community 30 - "native.ts"
Cohesion: 0.27
Nodes (15): ImportPlan, importNative(), NATIVE_VERSION, NativeFile, num(), pairs(), rows(), sane() (+7 more)

### Community 31 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @tauri-apps/cli@^2.0.0, @types/react@^18.3.11, @types/react-dom@^18.3.1, typescript@^5.6.3, vite@^5.4.10, @vitejs/plugin-react@^4.3.2, @tauri-apps/cli (+5 more)

### Community 33 - "dependencies"
Cohesion: 0.12
Nodes (22): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2, @tauri-apps/plugin-updater@^2 (+14 more)

### Community 34 - "curl.ts"
Cohesion: 0.17
Nodes (16): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+8 more)

### Community 35 - "postman.ts"
Cohesion: 0.21
Nodes (21): dropFilePaths(), str(), analyze(), convertAuth(), convertBody(), convertItems(), count(), exportPostman() (+13 more)

### Community 36 - "GrpcPane.tsx"
Cohesion: 0.12
Nodes (18): GrpcRequestPane(), MethodPicker(), SchemaEditor(), Section, time(), clientStreams(), defaultGrpc(), emit() (+10 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "react"
Cohesion: 0.16
Nodes (6): react, EnvMenu(), ico, Props, Row, TabsBar()

### Community 39 - "decode_details"
Cohesion: 0.25
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "ImportModal.tsx"
Cohesion: 0.14
Nodes (26): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+18 more)

### Community 41 - "Kv"
Cohesion: 0.28
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 42 - "Home.tsx"
Cohesion: 0.26
Nodes (7): greeting(), Home(), pathOf(), icoLg, ago(), startOfDay(), HistoryEntry

### Community 43 - "ResponseBody.tsx"
Cohesion: 0.13
Nodes (26): duration(), EndRow(), GrpcResponsePane(), MessageList(), MessageRow(), pretty(), SaveExampleButton(), seconds() (+18 more)

### Community 44 - "updater.ts"
Cohesion: 0.39
Nodes (6): checkForUpdate(), hasPendingUpdate(), installUpdate(), message(), RELEASES_URL, restartToUpdate()

### Community 45 - "common.ts"
Cohesion: 0.08
Nodes (64): allRequests(), ExampleModal(), key(), statusName(), FontRow(), Select(), addressLike(), basicKept() (+56 more)

### Community 46 - "UpdateChip.tsx"
Cohesion: 0.24
Nodes (6): Notes(), UpdateChip(), mb(), noteLines(), releaseDate(), useUpdates

### Community 47 - "jsonc.ts"
Cohesion: 0.23
Nodes (11): CodeArea(), Props, MessageEditor(), MessageEditor(), dropTrailingCommas(), formatJsonc(), hasJsonComments(), LineEdit (+3 more)

### Community 48 - "commands.ts"
Cohesion: 0.43
Nodes (6): commandsSummary(), importCommands(), nameOf(), splitCommands(), Note, RequestNode

### Community 52 - "store.ts"
Cohesion: 0.08
Nodes (24): capEnvironments(), isGrpc(), insertNode(), mapTree(), nodeIds(), placeNode(), removeFromTree(), isWs() (+16 more)

### Community 53 - "run_call"
Cohesion: 0.15
Nodes (17): Call, CallGuard, emit_message(), find_method(), grpc_invoke(), grpc_send(), GrpcEvent, End (+9 more)

### Community 54 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, tauri, typecheck

### Community 55 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 58 - "RequestPane.tsx"
Cohesion: 0.10
Nodes (29): Props, renameTab(), TitleName(), KVEditor(), MethodMenu(), AuthEditor(), BODY_MODES, BodyEditor() (+21 more)

### Community 60 - "Kv"
Cohesion: 0.33
Nodes (3): apply_metadata(), metadata_list(), Kv

## Knowledge Gaps
- **18 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 388 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `Runs.tsx`, `ResponseBody.tsx`, `App.tsx`, `store.ts`, `types.ts`, `http.ts`, `native.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Features` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `dependencies`, `Sidebar.tsx`, `Runs.tsx`, `GrpcPane.tsx`, `ImportModal.tsx`, `ResponseBody.tsx`, `ExportModal.tsx`, `common.ts`, `UpdateChip.tsx`, `jsonc.ts`, `App.tsx`, `WsResponse.tsx`, `Modals.tsx`, `types.ts`, `RequestPane.tsx`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.06859903381642513 - nodes in this community are weakly interconnected._
- **Why does `Parser` connect `Parser` to `ResponseBody.tsx`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10756302521008404 - nodes in this community are weakly interconnected._