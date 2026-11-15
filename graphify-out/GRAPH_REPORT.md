# Graph Report - voidHTTP  (2026-11-15)

## Corpus Check
- 86 files · ~138,454 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: .css 12, (none) 3, .lock 1)

## Summary
- 1508 nodes · 3869 edges · 78 communities (60 shown, 18 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 51 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1b034caf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Features
- Rust HTTP Engine
- Sidebar.tsx
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
- useStore
- Crate Package
- common.ts
- with
- cache.yml
- themes.ts
- GrpcPane.tsx
- react
- har.ts
- grpc.rs
- http.ts
- native.ts
- sio.rs
- certs.rs
- net.ts
- curl.ts
- postman.ts
- connect
- ReflectError
- SioEvent
- DescriptorPool
- ImportModal.tsx
- Kv
- DescriptorPool
- ResponsePane.tsx
- UpdateChip.tsx
- RequestPane.tsx
- types.ts
- store.ts
- run_call
- Modals.tsx
- fonts.rs
- store.rs
- jsonc.ts
- commands.ts
- package.json
- varsFormat.ts
- ConnGuard<'_, C>
- WsResponse.tsx
- Conns
- GrpcState
- .build
- GrpcResponse.tsx
- ResponseBody.tsx
- Net
- index.ts
- RequestBody
- tags.ts
- Kv

## God Nodes (most connected - your core abstractions)
1. `useStore` - 57 edges
2. `State` - 55 edges
3. `uid()` - 35 edges
4. `react` - 33 edges
5. `RequestPane()` - 31 edges
6. `kv()` - 26 edges
7. `Parser` - 25 edges
8. `GrpcRequestPane()` - 24 edges
9. `ico` - 21 edges
10. `parseCurl()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `run_call()` --calls--> `root_cause()`  [INFERRED]
  src-tauri/src/grpc.rs → src-tauri/src/http.rs
- `SioRequest` --references--> `Kv`  [EXTRACTED]
  src-tauri/src/sio.rs → src-tauri/src/http.rs
- `SioEvent` --references--> `Handshake`  [EXTRACTED]
  src-tauri/src/sio.rs → src-tauri/src/ws.rs
- `SioState` --references--> `Conns`  [EXTRACTED]
  src-tauri/src/sio.rs → src-tauri/src/ws.rs

## Import Cycles
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`
- 1-file cycle: `src-tauri/src/files.rs -> src-tauri/src/files.rs`

## Communities (78 total, 18 thin omitted)

### Community 0 - "Features"
Cohesion: 0.13
Nodes (14): Appearance and settings, Development, Features, gRPC, History and examples, HTTP, Import and export, Layout (+6 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.09
Nodes (14): cancel_request(), ClientKey, execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState, InflightGuard (+6 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.06
Nodes (52): CaRow(), CERT_FILES, CertificatesPane(), ClientForm(), ClientRow(), FilePick(), KEY_FILES, PFX_FILES (+44 more)

### Community 3 - "net.rs"
Cohesion: 0.08
Nodes (19): CERTS, ALWAYS_DIRECT, http_connect_tunnel(), lists_cover_subdomains(), matches_any(), NET, NetCheck, NetStep (+11 more)

### Community 4 - "ws.rs"
Cohesion: 0.08
Nodes (17): bad_header_is_an_error(), build_request(), CLOSE_GRACE, echo_and_close(), Handshake, handshake_headers_are_kept_and_extras_added(), header_list(), is_handshake_header() (+9 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.05
Nodes (4): State, ExampleRef, ProjectData, ProjectMeta

### Community 7 - "store.rs"
Cohesion: 0.09
Nodes (13): a_spec_in_the_home_folder_reaches_no_secrets_beside_it(), an_export_does_not_follow_a_planted_temp_symlink(), MAX_READ, read_ref(), read_ref_file(), read_text_file(), ref_files_stay_in_the_spec_folder_through_symlinks(), write_text_file() (+5 more)

### Community 8 - "Tauri Config"
Cohesion: 0.08
Nodes (24): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+16 more)

### Community 9 - "openapi.ts"
Cohesion: 0.12
Nodes (27): Any, Source, HarRow, Build, buildAuth(), buildBody(), buildExamples(), buildOpenApi() (+19 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Parser"
Cohesion: 0.14
Nodes (17): child(), children(), CMP, equal(), evaluate(), Expr, has(), isObj() (+9 more)

### Community 12 - "ExportModal.tsx"
Cohesion: 0.18
Nodes (19): Envs, ExportModal(), Format, FORMATS, plural(), baseName(), IMPORT_EXTENSIONS, pickImportFile() (+11 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "useStore"
Cohesion: 0.16
Nodes (17): index.html SPA Entry, #root Mount Element, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTheme(), useTypeTokens() (+9 more)

### Community 20 - "common.ts"
Cohesion: 0.08
Nodes (63): allRequests(), ExampleModal(), key(), statusName(), addressLike(), basicKept(), blankHarEnv(), blankKv() (+55 more)

### Community 21 - "with"
Cohesion: 0.05
Nodes (38): outputs, runs-on, steps, GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, jobs, create-release (+30 more)

### Community 23 - "cache.yml"
Cohesion: 0.08
Nodes (24): jobs, macos, runs-on, steps, strategy, target, name, on (+16 more)

### Community 24 - "themes.ts"
Cohesion: 0.18
Nodes (18): alpha(), BUILTIN, BuiltinId, contrast(), DEFAULT_SCHEME, FAMILIES, fit(), Ghostty (+10 more)

### Community 25 - "GrpcPane.tsx"
Cohesion: 0.07
Nodes (35): GrpcRequestPane(), MethodPicker(), SchemaEditor(), Section, time(), clientStreams(), defaultGrpc(), emit() (+27 more)

### Community 26 - "react"
Cohesion: 0.18
Nodes (4): react, EnvMenu(), ico, icoLg

### Community 27 - "har.ts"
Cohesion: 0.35
Nodes (10): harBody(), harHeaders(), HarOptions, harPlan(), harResponse(), harToCollection(), hostVar(), kv() (+2 more)

### Community 28 - "grpc.rs"
Cohesion: 0.08
Nodes (13): ERROR_DETAILS_PROTO, example(), home(), reflect_impl!, MAX_MESSAGE, MethodInfo, RpcStatus, scalar_example() (+5 more)

### Community 29 - "http.ts"
Cohesion: 0.11
Nodes (29): RFC-6455, @tauri-apps/api@^2.0.0, @tauri-apps/api, prepareGrpc(), base64Utf8(), CONTENT_TYPES, prepare(), WireBody (+21 more)

### Community 30 - "native.ts"
Cohesion: 0.21
Nodes (18): dropFilePaths(), ImportPlan, importNative(), NATIVE_VERSION, NativeFile, num(), pairs(), rows() (+10 more)

### Community 31 - "sio.rs"
Cohesion: 0.11
Nodes (21): ACK, BINARY_ACK, BINARY_EVENT, Cmd, Close, Emit, CONNECT, CONNECT_ERROR (+13 more)

### Community 32 - "certs.rs"
Cohesion: 0.05
Nodes (53): a_dev_ca_and_a_client_certificate_reach_a_mutual_tls_server(), a_pfx_opens_with_its_passphrase_only(), a_private_key_is_not_taken_for_a_ca(), added_cert_fits(), AddedCertVerifier, an_openssl_self_signed_server_certificate_is_trusted_once_added(), ca_file_info_names_the_certificate(), CertConfig (+45 more)

### Community 33 - "net.ts"
Cohesion: 0.20
Nodes (13): NetworkPane(), apply(), checkHost(), DEFAULT_NET, DNS_PROVIDERS, listeners, NetCheck, netSettings() (+5 more)

### Community 34 - "curl.ts"
Cohesion: 0.18
Nodes (15): ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl(), ParsedCurl, plausibleUrl() (+7 more)

### Community 35 - "postman.ts"
Cohesion: 0.18
Nodes (23): str(), convertAuth(), convertBody(), convertExamples(), convertItems(), count(), exportPostman(), hasScript() (+15 more)

### Community 36 - "connect"
Cohesion: 0.29
Nodes (6): address_gets_scheme_and_port(), connect(), parse_address(), describe_error(), root_cause(), current()

### Community 37 - "ReflectError"
Cohesion: 0.36
Nodes (4): code_name(), ReflectError, Other, Unimplemented

### Community 38 - "SioEvent"
Cohesion: 0.12
Nodes (21): collect(), handle(), join_emit_ack_disconnect(), Next, Close, Go, run(), Session (+13 more)

### Community 39 - "DescriptorPool"
Cohesion: 0.33
Nodes (4): decode_details(), EmbeddedFile, error_details_decode(), error_details_pool()

### Community 40 - "ImportModal.tsx"
Cohesion: 0.16
Nodes (25): Check3(), fetchText(), FileCard(), FileTab(), Frame(), HarReview(), Head(), ImportModal() (+17 more)

### Community 41 - "Kv"
Cohesion: 0.18
Nodes (3): DynamicCodec, DynamicDecoder, DynamicEncoder

### Community 42 - "DescriptorPool"
Cohesion: 0.28
Nodes (14): cached_pool(), compile_protos(), describe(), grpc_describe(), InvokeRequest, load_pool(), pool_key(), protos_compile_and_describe() (+6 more)

### Community 43 - "ResponsePane.tsx"
Cohesion: 0.21
Nodes (17): GrpcResponsePane(), ExampleBanner(), PairsTable(), useTabExample(), when(), HttpResponsePane(), ResponsePane(), GRPC_CODES (+9 more)

### Community 46 - "UpdateChip.tsx"
Cohesion: 0.13
Nodes (14): Notes(), UpdateChip(), checkForUpdate(), hasPendingUpdate(), installUpdate(), mb(), message(), noteLines() (+6 more)

### Community 47 - "RequestPane.tsx"
Cohesion: 0.10
Nodes (29): Props, RenameField(), renameTab(), TitleName(), KVEditor(), MethodMenu(), AuthEditor(), BODY_MODES (+21 more)

### Community 50 - "types.ts"
Cohesion: 0.09
Nodes (20): Props, Row, ParsedGrpcurl, Auth, BodyMode, Example, GrpcDef, GrpcEnd (+12 more)

### Community 52 - "store.ts"
Cohesion: 0.07
Nodes (26): cloneRequest(), DropWhere, insertNode(), mapTree(), MAX_PARAMS, nodeIds(), placeNode(), removeFromTree() (+18 more)

### Community 53 - "run_call"
Cohesion: 0.18
Nodes (14): Call, emit_message(), find_method(), grpc_invoke(), GrpcEvent, End, Headers, Message (+6 more)

### Community 54 - "Modals.tsx"
Cohesion: 0.13
Nodes (24): lucide-react, CODE_SIZES, FontRow(), Modals(), MONO_FONTS, ProjectModal(), PromptModal(), SaveModal() (+16 more)

### Community 55 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

### Community 56 - "store.rs"
Cohesion: 0.22
Nodes (18): copy_atomic(), doc_path(), load_response(), load_state(), local_dir(), LOCAL_DOCS, migrate_to_vault(), MIGRATED_MARKER (+10 more)

### Community 57 - "jsonc.ts"
Cohesion: 0.22
Nodes (11): CodeArea(), Props, MessageEditor(), MessageEditor(), formatJsonc(), hasJsonComments(), LineEdit, toggleLineComments() (+3 more)

### Community 58 - "commands.ts"
Cohesion: 0.46
Nodes (7): commandsSummary(), importCommands(), nameOf(), splitCommands(), Note, parseGrpcurl(), newRequest()

### Community 59 - "package.json"
Cohesion: 0.07
Nodes (39): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/plugin-dialog@^2.0.0, @tauri-apps/plugin-opener@^2, @tauri-apps/plugin-process@^2, @tauri-apps/plugin-updater@^2 (+31 more)

### Community 60 - "varsFormat.ts"
Cohesion: 0.33
Nodes (10): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+2 more)

### Community 63 - "WsResponse.tsx"
Cohesion: 0.22
Nodes (17): closeLabel(), CloseRow(), duration(), Handshake(), MessageList(), MessageRow(), Pair(), pretty() (+9 more)

### Community 64 - "Conns"
Cohesion: 0.13
Nodes (15): Cmd, Close, Send, ConnGuard, Conns, Conns<C>, ws_close(), ws_connect() (+7 more)

### Community 69 - "GrpcState"
Cohesion: 0.38
Nodes (5): CallGuard, grpc_cancel(), grpc_end(), grpc_send(), GrpcState

### Community 70 - ".build"
Cohesion: 0.17
Nodes (8): bootstrap(), custom_group(), doh_resolver(), net_configure(), NetConfig, secure_dns_and_check(), system_lookup(), v4()

### Community 71 - "GrpcResponse.tsx"
Cohesion: 0.18
Nodes (10): duration(), EndRow(), MessageList(), MessageRow(), pretty(), SaveExampleButton(), seconds(), StatusLine() (+2 more)

### Community 72 - "ResponseBody.tsx"
Cohesion: 0.18
Nodes (10): BodyViewer(), EXAMPLES, Filtered, filters, markMatches(), esc(), highlightJson(), highlightLines() (+2 more)

### Community 73 - "Net"
Cohesion: 0.22
Nodes (6): connect_any(), http_connect(), Net, net_test(), Proxy, Resolve

### Community 74 - "index.ts"
Cohesion: 0.28
Nodes (8): detect(), parseDoc(), HarFile, readHar(), siteOf(), Analysis, analyze(), RefLoader

### Community 75 - "RequestBody"
Cohesion: 0.29
Nodes (6): build_multipart(), MultipartField, RequestBody, FormUrlEncoded, Multipart, Text

### Community 76 - "tags.ts"
Cohesion: 0.47
Nodes (5): EnvColor(), envStyle(), TAG_COLORS, TagColor, tagName()

### Community 77 - "Kv"
Cohesion: 0.67
Nodes (3): apply_metadata(), metadata_list(), Kv

## Knowledge Gaps
- **28 isolated node(s):** `voidhttp`, `Engine`, `Joined`, `ConnectError`, `Message` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 434 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `GrpcResponse.tsx`, `ResponsePane.tsx`, `types.ts`, `store.ts`, `GrpcPane.tsx`, `native.ts`, `jsonc.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `voidhttp`, `Engine`, `Joined` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Features` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `net.ts`, `Sidebar.tsx`, `GrpcResponse.tsx`, `ImportModal.tsx`, `ResponseBody.tsx`, `ResponsePane.tsx`, `ExportModal.tsx`, `tags.ts`, `UpdateChip.tsx`, `RequestPane.tsx`, `useStore`, `types.ts`, `common.ts`, `Modals.tsx`, `jsonc.ts`, `package.json`, `GrpcPane.tsx`, `WsResponse.tsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.08534850640113797 - nodes in this community are weakly interconnected._
- **Why does `Parser` connect `Parser` to `ResponseBody.tsx`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05707762557077625 - nodes in this community are weakly interconnected._