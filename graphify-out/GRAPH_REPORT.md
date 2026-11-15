# Graph Report - voidHTTP  (2026-11-15)

## Corpus Check
- 88 files · ~143,044 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: .css 12, (none) 3, .lock 1)

## Summary
- 1544 nodes · 4027 edges · 69 communities (51 shown, 18 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 51 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d195fad5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Features
- Rust HTTP Engine
- CertificatesPane.tsx
- net.rs
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
- react
- Crate Package
- common.ts
- with
- cache.yml
- themes.ts
- GrpcPane.tsx
- ws.ts
- curl.ts
- grpc.rs
- connect
- native.ts
- sio.rs
- certs.rs
- postman.ts
- ReflectError
- run
- DescriptorPool
- ImportModal.tsx
- Kv
- DescriptorPool
- useStore
- UpdateChip.tsx
- RequestPane.tsx
- store.ts
- run_call
- Modals.tsx
- fonts.rs
- Sidebar.tsx
- har.ts
- package.json
- varsFormat.ts
- ConnGuard<'_, C>
- dependencies
- Conns
- grpc_invoke
- updater.ts
- useStore
- Home.tsx
- scripts

## God Nodes (most connected - your core abstractions)
1. `useStore` - 60 edges
2. `State` - 55 edges
3. `uid()` - 35 edges
4. `RequestPane()` - 34 edges
5. `react` - 34 edges
6. `kv()` - 26 edges
7. `GrpcRequestPane()` - 25 edges
8. `Parser` - 25 edges
9. `ico` - 22 edges
10. `stripJsonComments()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `exampleCount()` --calls--> `requestsOf()`  [EXTRACTED]
  src/lib/formats/openapi.ts → src/lib/formats/common.ts
- `run_call()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `SioEvent` --references--> `Handshake`  [EXTRACTED]
  src-tauri/src/sio.rs → src-tauri/src/ws.rs
- `SioState` --references--> `Conns`  [EXTRACTED]
  src-tauri/src/sio.rs → src-tauri/src/ws.rs

## Import Cycles
- 1-file cycle: `src-tauri/src/files.rs -> src-tauri/src/files.rs`
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (69 total, 18 thin omitted)

### Community 0 - "Features"
Cohesion: 0.12
Nodes (15): Appearance and settings, Development, Features, gRPC, History and examples, HTTP, Import and export, Layout (+7 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.07
Nodes (20): build_multipart(), cancel_request(), ClientKey, execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState (+12 more)

### Community 2 - "CertificatesPane.tsx"
Cohesion: 0.12
Nodes (25): CaRow(), CERT_FILES, CertificatesPane(), ClientForm(), FilePick(), KEY_FILES, PFX_FILES, pickOne() (+17 more)

### Community 3 - "net.rs"
Cohesion: 0.06
Nodes (33): CERTS, ALWAYS_DIRECT, bootstrap(), connect_any(), custom_group(), doh_resolver(), http_connect(), http_connect_tunnel() (+25 more)

### Community 4 - "ws.rs"
Cohesion: 0.09
Nodes (18): Kv, SioRequest, bad_header_is_an_error(), build_request(), echo_and_close(), Handshake, handshake_headers_are_kept_and_extras_added(), header_list() (+10 more)

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
Cohesion: 0.10
Nodes (31): Any, parseDoc(), Source, HarRow, Build, buildAuth(), buildBody(), buildExamples() (+23 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.13
Nodes (19): child(), children(), CMP, compile(), equal(), evaluate(), Expr, has() (+11 more)

### Community 12 - "ExportModal.tsx"
Cohesion: 0.18
Nodes (19): Envs, ExportModal(), Format, FORMATS, plural(), baseName(), IMPORT_EXTENSIONS, pickImportFile() (+11 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "react"
Cohesion: 0.22
Nodes (15): react, CodeArea(), Props, MessageEditor(), BodyEditor(), EmitEditor(), MessageEditor(), dropTrailingCommas() (+7 more)

### Community 20 - "common.ts"
Cohesion: 0.08
Nodes (64): allRequests(), ExampleModal(), key(), statusName(), addressLike(), basicKept(), blankHarEnv(), blankKv() (+56 more)

### Community 21 - "with"
Cohesion: 0.05
Nodes (38): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+30 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "themes.ts"
Cohesion: 0.20
Nodes (17): alpha(), BUILTIN, BuiltinId, contrast(), FAMILIES, fit(), Ghostty, hex() (+9 more)

### Community 25 - "GrpcPane.tsx"
Cohesion: 0.08
Nodes (35): GrpcRequestPane(), MethodPicker(), SchemaEditor(), Section, time(), clientStreams(), defaultGrpc(), emit() (+27 more)

### Community 26 - "ws.ts"
Cohesion: 0.12
Nodes (25): RFC-6455, prepareGrpc(), base64Utf8(), CONTENT_TYPES, prepare(), WireBody, WireKV, prepareSio() (+17 more)

### Community 27 - "curl.ts"
Cohesion: 0.16
Nodes (17): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+9 more)

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (13): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+5 more)

### Community 29 - "connect"
Cohesion: 0.29
Nodes (6): address_gets_scheme_and_port(), connect(), parse_address(), describe_error(), root_cause(), current()

### Community 30 - "native.ts"
Cohesion: 0.21
Nodes (16): dropFilePaths(), importNative(), NATIVE_VERSION, NativeFile, num(), pairs(), rows(), sane() (+8 more)

### Community 31 - "sio.rs"
Cohesion: 0.08
Nodes (27): ACK, BINARY_ACK, BINARY_EVENT, Cmd, Close, Emit, CONNECT, CONNECT_ERROR (+19 more)

### Community 32 - "certs.rs"
Cohesion: 0.05
Nodes (53): a_dev_ca_and_a_client_certificate_reach_a_mutual_tls_server(), a_pfx_opens_with_its_passphrase_only(), a_private_key_is_not_taken_for_a_ca(), added_cert_fits(), AddedCertVerifier, an_openssl_self_signed_server_certificate_is_trusted_once_added(), ca_file_info_names_the_certificate(), CertConfig (+45 more)

### Community 35 - "postman.ts"
Cohesion: 0.19
Nodes (26): str(), harBody(), harToCollection(), convertAuth(), convertBody(), convertExamples(), convertItems(), count() (+18 more)

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "run"
Cohesion: 0.12
Nodes (22): collect(), join_emit_ack_disconnect(), live_server(), run(), sio_connect(), SioEvent, AckTimeout, Close (+14 more)

### Community 39 - "DescriptorPool"
Cohesion: 0.33
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "ImportModal.tsx"
Cohesion: 0.15
Nodes (26): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+18 more)

### Community 41 - "Kv"
Cohesion: 0.18
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 42 - "DescriptorPool"
Cohesion: 0.32
Nodes (12): cached_pool(), compile_protos(), grpc_describe(), InvokeRequest, load_pool(), pool_key(), reflect(), sample_pool() (+4 more)

### Community 43 - "useStore"
Cohesion: 0.05
Nodes (64): duration(), EndRow(), GrpcResponsePane(), MessageList(), MessageRow(), pretty(), SaveExampleButton(), seconds() (+56 more)

### Community 46 - "UpdateChip.tsx"
Cohesion: 0.17
Nodes (8): UpdatesPane(), Notes(), UpdateChip(), mb(), noteLines(), releaseDate(), Updates, useUpdates

### Community 47 - "RequestPane.tsx"
Cohesion: 0.10
Nodes (37): Props, renameTab(), TitleName(), KVEditor(), MethodMenu(), AuthEditor(), BODY_MODES, RequestPane() (+29 more)

### Community 52 - "store.ts"
Cohesion: 0.05
Nodes (47): capEnvironments(), ParsedGrpcurl, cloneNode(), cloneRequest(), insertNode(), mapTree(), MAX_PARAMS, nodeIds() (+39 more)

### Community 53 - "run_call"
Cohesion: 0.18
Nodes (10): apply_metadata(), Call, emit_message(), GrpcEvent, End, Headers, Message, metadata_list() (+2 more)

### Community 54 - "Modals.tsx"
Cohesion: 0.08
Nodes (38): EnvMenu(), CODE_SIZES, EnvColor(), FontRow(), Modals(), MONO_FONTS, NetworkPane(), PromptModal() (+30 more)

### Community 55 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 56 - "Sidebar.tsx"
Cohesion: 0.11
Nodes (24): ClientRow(), RenameField(), EnvItem(), MenuItem, MenuState, openAtPointer(), RowMenu(), CollectionView() (+16 more)

### Community 58 - "har.ts"
Cohesion: 0.20
Nodes (15): commandsSummary(), importCommands(), nameOf(), splitCommands(), detect(), ImportPlan, Note, HarFile (+7 more)

### Community 59 - "package.json"
Cohesion: 0.15
Nodes (13): devDependencies, @tauri-apps/cli@^2.0.0, @types/react@^18.3.11, @types/react-dom@^18.3.1, typescript@^5.6.3, vite@^5.4.10, @vitejs/plugin-react@^4.3.2, @tauri-apps/cli (+5 more)

### Community 60 - "varsFormat.ts"
Cohesion: 0.33
Nodes (10): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+2 more)

### Community 63 - "dependencies"
Cohesion: 0.11
Nodes (23): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2 (+15 more)

### Community 64 - "Conns"
Cohesion: 0.18
Nodes (9): Cmd, Close, Send, ConnGuard, Conns, Conns<C>, ws_close(), ws_send() (+1 more)

### Community 69 - "grpc_invoke"
Cohesion: 0.18
Nodes (13): CallGuard, describe(), find_method(), grpc_cancel(), grpc_end(), grpc_invoke(), grpc_send(), GrpcState (+5 more)

### Community 70 - "updater.ts"
Cohesion: 0.31
Nodes (7): checkForUpdate(), hasPendingUpdate(), installUpdate(), message(), RELEASES_URL, restartToUpdate(), UpdateState

### Community 71 - "useStore"
Cohesion: 0.08
Nodes (21): index.html SPA Entry, #root Mount Element, @tauri-apps/api, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTheme() (+13 more)

### Community 78 - "Home.tsx"
Cohesion: 0.24
Nodes (11): greeting(), Home(), pathOf(), ProjectModal(), PROJECT_COLORS, PROJECT_ICONS, ProjectTile(), tileStyle() (+3 more)

### Community 79 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, tauri, typecheck

## Knowledge Gaps
- **28 isolated node(s):** `Engine`, `Joined`, `ConnectError`, `Message`, `AckTimeout` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 440 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `useStore`, `react`, `store.ts`, `Sidebar.tsx`, `ws.ts`, `native.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `Engine`, `Joined`, `ConnectError` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Features` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `useStore` connect `useStore` to `CertificatesPane.tsx`, `ImportModal.tsx`, `useStore`, `ExportModal.tsx`, `Home.tsx`, `RequestPane.tsx`, `UpdateChip.tsx`, `react`, `common.ts`, `store.ts`, `Modals.tsx`, `Sidebar.tsx`, `GrpcPane.tsx`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07171717171717172 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `CertificatesPane.tsx`, `useStore`, `ImportModal.tsx`, `useStore`, `ExportModal.tsx`, `Home.tsx`, `RequestPane.tsx`, `UpdateChip.tsx`, `common.ts`, `Modals.tsx`, `Sidebar.tsx`, `GrpcPane.tsx`, `dependencies`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `CertificatesPane.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12298387096774194 - nodes in this community are weakly interconnected._