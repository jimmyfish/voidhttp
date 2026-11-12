# Graph Report - voidHTTP  (2026-11-12)

## Corpus Check
- Corpus is ~9,734 words - fits in a single context window. You may not need a graph.

## Summary
- 326 nodes · 611 edges · 18 communities (13 shown, 5 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.86)
- Token cost: 96,378 input · 6,200 output

## Community Hubs (Navigation)
- Rust HTTP Engine
- Frontend State & Send
- NPM Dependencies
- Request Editor & cURL
- App Shell & Response View
- App Identity & Stack
- Request Model & Postman Import
- README Feature Set
- Tauri Config
- TypeScript Config
- KV Editor & Modals
- Rust Disk Persistence
- Tauri Capabilities
- Crate Package
- URL Params Sync

## God Nodes (most connected - your core abstractions)
1. `State` - 30 edges
2. `useStore` - 17 edges
3. `RequestPane()` - 16 edges
4. `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` - 16 edges
5. `compilerOptions` - 15 edges
6. `uid()` - 12 edges
7. `HttpState` - 11 edges
8. `convertItems()` - 11 edges
9. `react` - 10 edges
10. `Modals()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `voidHTTP` --references--> `voidHTTP App Icon`  [EXTRACTED]
  README.md → app-icon.svg
- `voidHTTP App Icon` --conceptually_related_to--> `Tauri v2`  [EXTRACTED]
  app-icon.svg → README.md
- `App()` --calls--> `Modals()`  [EXTRACTED]
  src/App.tsx → src/components/Modals.tsx
- `App()` --calls--> `RequestPane()`  [EXTRACTED]
  src/App.tsx → src/components/RequestPane.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **voidHTTP Core Stack (Tauri shell, OS webview, React UI, Rust HTTP engine)** — readme_tauri_v2, readme_os_webview, readme_react_frontend, readme_rust_http_engine, index_html_entry [INFERRED 0.85]
- **Local JSON Persistence Flow** — readme_zustand_app_state, readme_atomic_json_persistence, readme_history, readme_collections, readme_local_first [INFERRED 0.85]
- **Request Send Pipeline (variables, preparation, Rust engine, response view)** — readme_environment_variables, readme_dynamic_variables, readme_request_preparation, readme_rust_http_engine, readme_response_viewer [INFERRED 0.75]

## Communities (18 total, 5 thin omitted)

### Community 0 - "Rust HTTP Engine"
Cohesion: 0.06
Nodes (22): build_multipart(), cancel_request(), describe_error(), execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState (+14 more)

### Community 1 - "Frontend State & Send"
Cohesion: 0.07
Nodes (24): cancel(), CONTENT_TYPES, send(), WireBody, WireKV, VarScope, DEFAULT_SETTINGS, Modal (+16 more)

### Community 2 - "NPM Dependencies"
Cohesion: 0.08
Nodes (32): dependencies, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, zustand@^4.5.5, devDependencies, @tauri-apps/cli@^2.0.0 (+24 more)

### Community 3 - "Request Editor & cURL"
Cohesion: 0.12
Nodes (20): Copy as cURL, CodeArea(), Props, AuthEditor(), BODY_MODES, BodyEditor(), RequestPane(), Section (+12 more)

### Community 4 - "App Shell & Response View"
Cohesion: 0.17
Nodes (17): JSON Highlighter, Response Viewer (status, time, size, headers, pretty JSON, raw, image), react, App(), ResponsePane(), CollectionView(), HistoryList(), matches() (+9 more)

### Community 5 - "App Identity & Stack"
Cohesion: 0.09
Nodes (8): voidHTTP App Icon, index.html SPA Entry, #root Mount Element, Not Yet Implemented (scripts, GraphQL, WebSocket/gRPC, OAuth 2, runner, codegen), React Frontend, Tauri v2, voidHTTP, voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)

### Community 6 - "Request Model & Postman Import"
Cohesion: 0.18
Nodes (22): cloneRequest(), findNode(), insertNode(), kv(), mapTree(), newRequest(), paramsFromUrl(), parseQuery() (+14 more)

### Community 7 - "README Feature Set"
Cohesion: 0.12
Nodes (16): Auth (Bearer, Basic, API key), Collections (nested folders, collection variables), In-Memory Cookie Jar, Dynamic Variables ($guid, $timestamp, $isoTimestamp, $randomInt), Environments with {{variables}}, Request History (last 200), Keyboard Shortcuts, Postman Import (v2.0/v2.1 collections, environments) (+8 more)

### Community 8 - "Tauri Config"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 10 - "KV Editor & Modals"
Cohesion: 0.29
Nodes (12): KVEditor(), Props, Row, Modals(), PromptModal(), SaveModal(), SettingsModal(), Shell() (+4 more)

### Community 11 - "Rust Disk Persistence"
Cohesion: 0.35
Nodes (5): data_dir(), doc_path(), DOCS, load_state(), save_state()

### Community 12 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

## Knowledge Gaps
- **14 isolated node(s):** `voidhttp`, `Text`, `FormUrlEncoded`, `Multipart`, `reqwest` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 130 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Request Preparation (src/lib)` connect `README Feature Set` to `Frontend State & Send`, `Request Editor & cURL`?**
  _High betweenness centrality (0.251) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` (e.g. with `voidHTTP App Icon` and `src-tauri/icons/128x128.png`) actually correct?**
  _`voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `voidhttp`, `Text`, `FormUrlEncoded` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.0636734693877551 - nodes in this community are weakly interconnected._
- **Why does `Rust HTTP Engine (http.rs)` connect `README Feature Set` to `Rust HTTP Engine`?**
  _High betweenness centrality (0.240) - this node is a cross-community bridge._
- **Should `Frontend State & Send` be split into smaller, more focused modules?**
  _Cohesion score 0.06938020351526364 - nodes in this community are weakly interconnected._
- **Why does `Atomic JSON Persistence (store.rs)` connect `README Feature Set` to `Rust Disk Persistence`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._