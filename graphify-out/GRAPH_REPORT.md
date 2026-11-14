# Graph Report - voidHTTP  (2026-11-14)

## Corpus Check
- 81 files · ~114,225 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: .css 8, (none) 3, .lock 1)

## Summary
- 1160 nodes · 3033 edges · 58 communities (46 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d1950a89`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Features
- Rust HTTP Engine
- Sidebar.tsx
- useStore
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
- grpc.ts
- Crate Package
- devDependencies
- with
- cache.yml
- App.tsx
- mask.ts
- GrpcPane.tsx
- updater.ts
- grpc.rs
- Home.tsx
- TabsBar.tsx
- DescriptorPool
- NoVerify
- Kv
- curl.ts
- formats/postman.ts
- UpdateChip.tsx
- ReflectError
- dependencies
- decode_details
- ImportModal.tsx
- scripts
- jsonc.ts
- react
- export-and-vars-security.test.ts
- common.ts
- varsFormat.ts
- har.ts
- store.ts
- run_call
- MessageDescriptor
- connect
- GrpcState
- uid
- audit-round2.test.ts

## God Nodes (most connected - your core abstractions)
1. `State` - 51 edges
2. `useStore` - 43 edges
3. `uid()` - 33 edges
4. `kv()` - 31 edges
5. `RequestPane()` - 28 edges
6. `react` - 28 edges
7. `Parser` - 25 edges
8. `GrpcRequestPane()` - 24 edges
9. `newRequest()` - 23 edges
10. `requestsOf()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `importSpec()` --calls--> `requestsOf()`  [EXTRACTED]
  tests/import-security.test.ts → src/lib/formats/common.ts
- `req()` --calls--> `newRequest()`  [EXTRACTED]
  tests/audit-round3.test.ts → src/lib/model.ts
- `fixture()` --calls--> `prepare()`  [EXTRACTED]
  tests/export-and-vars-security.test.ts → src/lib/http.ts
- `fixture()` --calls--> `buildScope()`  [EXTRACTED]
  tests/export-and-vars-security.test.ts → src/lib/vars.ts

## Import Cycles
- 1-file cycle: `src-tauri/src/files.rs -> src-tauri/src/files.rs`
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (58 total, 12 thin omitted)

### Community 0 - "Features"
Cohesion: 0.14
Nodes (13): Appearance and settings, Development, Features, gRPC, History and examples, HTTP, Import and export, Layout (+5 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.06
Nodes (24): FontList, list_fonts(), mono_names(), named_mono(), scan(), build_multipart(), cancel_request(), execute() (+16 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.11
Nodes (23): RenameField(), EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView(), DragCtx (+15 more)

### Community 3 - "useStore"
Cohesion: 0.11
Nodes (30): duration(), EndRow(), GrpcResponsePane(), MessageList(), MessageRow(), pretty(), seconds(), StatusLine() (+22 more)

### Community 4 - "Modals.tsx"
Cohesion: 0.12
Nodes (26): CODE_SIZES, EnvColor(), FontRow(), Modals(), MONO_FONTS, ProjectModal(), PromptModal(), SaveModal() (+18 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.05
Nodes (7): DropWhere, State, Example, ExampleRef, ProjectData, ProjectMeta, SavedRef

### Community 7 - "store.rs"
Cohesion: 0.07
Nodes (31): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_ref_file(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file() (+23 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.11
Nodes (28): Any, Source, HarRow, Build, buildAuth(), buildBody(), buildExamples(), buildOpenApi() (+20 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.14
Nodes (18): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+10 more)

### Community 12 - "themes.ts"
Cohesion: 0.17
Nodes (21): useTheme(), alpha(), BUILTIN, BuiltinId, contrast(), DEFAULT_SCHEME, FAMILIES, findScheme() (+13 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "grpc.ts"
Cohesion: 0.08
Nodes (34): shellWords(), defaultGrpc(), emit(), GRPCURL_VALUE, listeners, loadSchema(), MethodInfo, ParsedGrpcurl (+26 more)

### Community 20 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @tauri-apps/cli@^2.0.0, @types/react@^18.3.11, @types/react-dom@^18.3.1, typescript@^5.6.3, vite@^5.4.10, @vitejs/plugin-react@^4.3.2, @tauri-apps/cli (+5 more)

### Community 21 - "with"
Cohesion: 0.05
Nodes (38): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+30 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "App.tsx"
Cohesion: 0.13
Nodes (9): index.html SPA Entry, #root Mount Element, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTypeTokens(), Mark() (+1 more)

### Community 25 - "mask.ts"
Cohesion: 0.14
Nodes (25): allRequests(), ExampleModal(), key(), applyMasks(), COOKIE_ATTRS, COOKIE_FLAGS, findSensitive(), isCookieName() (+17 more)

### Community 26 - "GrpcPane.tsx"
Cohesion: 0.10
Nodes (28): GrpcRequestPane(), MethodPicker(), Props, SchemaEditor(), Section, time(), renameTab(), TitleName() (+20 more)

### Community 27 - "updater.ts"
Cohesion: 0.27
Nodes (7): checkForUpdate(), hasPendingUpdate(), installUpdate(), message(), restartToUpdate(), UpdateState, Updates

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (12): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+4 more)

### Community 29 - "Home.tsx"
Cohesion: 0.23
Nodes (9): greeting(), Home(), pathOf(), icoLg, UpdatesPane(), ago(), startOfDay(), HistoryEntry (+1 more)

### Community 31 - "DescriptorPool"
Cohesion: 0.28
Nodes (14): cached_pool(), compile_protos(), describe(), grpc_describe(), load_pool(), pool_key(), protos_compile_and_describe(), reflect() (+6 more)

### Community 33 - "Kv"
Cohesion: 0.33
Nodes (3): apply_metadata(), metadata_list(), Kv

### Community 34 - "curl.ts"
Cohesion: 0.16
Nodes (16): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+8 more)

### Community 35 - "formats/postman.ts"
Cohesion: 0.21
Nodes (20): str(), convertAuth(), convertBody(), convertExamples(), convertItems(), count(), hasScript(), importPostman() (+12 more)

### Community 36 - "UpdateChip.tsx"
Cohesion: 0.21
Nodes (6): Notes(), UpdateChip(), mb(), noteLines(), releaseDate(), RELEASES_URL

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (23): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2 (+15 more)

### Community 39 - "decode_details"
Cohesion: 0.25
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "ImportModal.tsx"
Cohesion: 0.11
Nodes (34): @tauri-apps/api, DropImport(), Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview() (+26 more)

### Community 41 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, tauri, typecheck

### Community 42 - "jsonc.ts"
Cohesion: 0.23
Nodes (12): CodeArea(), Props, MessageEditor(), BodyEditor(), dropTrailingCommas(), formatJsonc(), hasJsonComments(), LineEdit (+4 more)

### Community 43 - "react"
Cohesion: 0.20
Nodes (6): react, ico, Props, Row, METHODS, MultipartField

### Community 44 - "export-and-vars-security.test.ts"
Cohesion: 0.15
Nodes (16): parseDoc(), base64Utf8(), CONTENT_TYPES, prepare(), WireBody, WireKV, Budget, dynamic() (+8 more)

### Community 45 - "common.ts"
Cohesion: 0.21
Nodes (26): addressLike(), basicKept(), blankSecretJson(), blankSecretKv(), blankSecretXml(), credentialsOf(), decode(), FormatId (+18 more)

### Community 46 - "varsFormat.ts"
Cohesion: 0.29
Nodes (11): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+3 more)

### Community 48 - "har.ts"
Cohesion: 0.23
Nodes (15): harBody(), harHeaders(), HarOptions, harPlan(), harResponse(), harToCollection(), hostVar(), kv() (+7 more)

### Community 52 - "store.ts"
Cohesion: 0.07
Nodes (30): grpcCancel(), grpcEndSending(), GrpcEvent, grpcSend(), invokeGrpc(), isGrpc(), insertNode(), mapTree() (+22 more)

### Community 53 - "run_call"
Cohesion: 0.17
Nodes (15): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+7 more)

### Community 54 - "MessageDescriptor"
Cohesion: 0.28
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 55 - "connect"
Cohesion: 0.25
Nodes (6): address_gets_scheme_and_port(), connect(), parse_address(), tls_config(), describe_error(), root_cause()

### Community 56 - "GrpcState"
Cohesion: 0.38
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

### Community 57 - "uid"
Cohesion: 0.13
Nodes (26): importCommands(), nameOf(), splitCommands(), detect(), dropFilePaths(), ImportPlan, Note, HarFile (+18 more)

### Community 58 - "audit-round2.test.ts"
Cohesion: 0.18
Nodes (25): Envs, ExportModal(), Format, FORMATS, plural(), pickSavePath(), writeTextFile(), blankHarEnv() (+17 more)

## Knowledge Gaps
- **11 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 351 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `useStore`, `jsonc.ts`, `grpc.ts`, `store.ts`, `App.tsx`, `uid`, `GrpcPane.tsx`, `mask.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Features` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `Parser` connect `Parser` to `useStore`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05589225589225589 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `Sidebar.tsx`, `GrpcPane.tsx`, `useStore`, `Modals.tsx`, `dependencies`, `UpdateChip.tsx`, `ImportModal.tsx`, `jsonc.ts`, `grpc.ts`, `App.tsx`, `mask.ts`, `audit-round2.test.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10588235294117647 - nodes in this community are weakly interconnected._