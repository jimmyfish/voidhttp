# Graph Report - voidHTTP  (2026-11-12)

## Corpus Check
- 42 files · ~27,618 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .css 6, (none) 4, .icns 1)

## Summary
- 463 nodes · 900 edges · 22 communities (15 shown, 7 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e53d8116`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- varsFormat.ts
- Rust HTTP Engine
- App Shell & Home
- NPM Dependencies
- RequestPane.tsx
- Zustand Store Actions
- App Identity & Docs
- Rust Persistence & Features
- Tauri Config
- Modals.tsx
- TypeScript Config
- Response Viewer
- Tauri Capabilities
- Agent Instructions
- Visual Reference
- Crate Package
- URL Params Sync
- store.ts
- fonts.rs

## God Nodes (most connected - your core abstractions)
1. `State` - 40 edges
2. `useStore` - 24 edges
3. `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` - 16 edges
4. `RequestPane()` - 15 edges
5. `compilerOptions` - 15 edges
6. `App()` - 14 edges
7. `uid()` - 13 edges
8. `react` - 13 edges
9. `Home()` - 11 edges
10. `kv()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `voidHTTP App Icon` --conceptually_related_to--> `Tauri v2`  [EXTRACTED]
  app-icon.svg → README.md
- `voidHTTP` --references--> `voidHTTP App Icon`  [EXTRACTED]
  README.md → app-icon.svg
- `useTheme()` --calls--> `useStore`  [EXTRACTED]
  src/App.tsx → src/store.ts
- `useTypeTokens()` --calls--> `useStore`  [EXTRACTED]
  src/App.tsx → src/store.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Request Send Pipeline (variables, preparation, Rust engine, response view)** — readme_environment_variables, readme_dynamic_variables, readme_request_preparation, readme_rust_http_engine, readme_response_viewer [INFERRED 0.75]
- **voidHTTP Core Stack (Tauri shell, OS webview, React UI, Rust HTTP engine)** — readme_tauri_v2, readme_os_webview, readme_react_frontend, readme_rust_http_engine, index_html_entry [INFERRED 0.85]
- **Local JSON Persistence Flow** — readme_zustand_app_state, readme_atomic_json_persistence, readme_history, readme_collections, readme_local_first [INFERRED 0.85]

## Communities (22 total, 7 thin omitted)

### Community 0 - "varsFormat.ts"
Cohesion: 0.33
Nodes (10): formatVars(), fromDotenv(), fromJson(), needsQuotes(), parseVars(), rowFor(), toDotenv(), toJson() (+2 more)

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.07
Nodes (22): build_multipart(), cancel_request(), describe_error(), execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState (+14 more)

### Community 2 - "App Shell & Home"
Cohesion: 0.06
Nodes (25): react-dom, App(), SIDEBAR_DEFAULT, stack(), useTheme(), useTypeTokens(), greeting(), Home() (+17 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.08
Nodes (33): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, zustand@^4.5.5, devDependencies (+25 more)

### Community 4 - "RequestPane.tsx"
Cohesion: 0.10
Nodes (23): KVEditor(), AuthEditor(), BODY_MODES, BodyEditor(), RequestPane(), Section, q(), toCurl() (+15 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.07
Nodes (3): State, ProjectData, ProjectMeta

### Community 6 - "App Identity & Docs"
Cohesion: 0.07
Nodes (13): voidHTTP App Icon, index.html SPA Entry, #root Mount Element, Development, Features (v0.1), Layout, Not yet, Not Yet Implemented (scripts, GraphQL, WebSocket/gRPC, OAuth 2, runner, codegen) (+5 more)

### Community 7 - "Rust Persistence & Features"
Cohesion: 0.09
Nodes (23): Auth (Bearer, Basic, API key), Collections (nested folders, collection variables), In-Memory Cookie Jar, Copy as cURL, Dynamic Variables ($guid, $timestamp, $isoTimestamp, $randomInt), Environments with {{variables}}, Request History (last 200), Keyboard Shortcuts (+15 more)

### Community 8 - "Tauri Config"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 9 - "Modals.tsx"
Cohesion: 0.07
Nodes (37): react, AppStrip(), CODE_SIZES, EnvItem(), FontRow(), ImportModal(), Modals(), MONO_FONTS (+29 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Response Viewer"
Cohesion: 0.33
Nodes (7): JSON Highlighter, Response Viewer (status, time, size, headers, pretty JSON, raw, image), CodeArea(), Props, esc(), highlightJson(), highlightLines()

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 21 - "store.ts"
Cohesion: 0.07
Nodes (51): HistoryList(), cancel(), CONTENT_TYPES, send(), WireBody, WireKV, cloneNode(), cloneRequest() (+43 more)

### Community 25 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

## Knowledge Gaps
- **14 isolated node(s):** `URL / Query Params Sync`, `#root Mount Element`, `Not Yet Implemented (scripts, GraphQL, WebSocket/gRPC, OAuth 2, runner, codegen)`, `Auth (Bearer, Basic, API key)`, `In-Memory Cookie Jar` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 190 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Request Preparation (src/lib)` connect `Rust Persistence & Features` to `RequestPane.tsx`, `store.ts`?**
  _High betweenness centrality (0.219) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` (e.g. with `voidHTTP App Icon` and `src-tauri/icons/128x128.png`) actually correct?**
  _`voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `URL / Query Params Sync`, `#root Mount Element`, `Not Yet Implemented (scripts, GraphQL, WebSocket/gRPC, OAuth 2, runner, codegen)` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.06547619047619048 - nodes in this community are weakly interconnected._
- **Why does `Rust HTTP Engine (http.rs)` connect `Rust Persistence & Features` to `Rust HTTP Engine`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Should `App Shell & Home` be split into smaller, more focused modules?**
  _Cohesion score 0.06386066763425254 - nodes in this community are weakly interconnected._
- **Why does `State` connect `Zustand Store Actions` to `Modals.tsx`, `App Shell & Home`, `RequestPane.tsx`, `store.ts`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._