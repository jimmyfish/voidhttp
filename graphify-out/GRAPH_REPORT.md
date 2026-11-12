# Graph Report - voidHTTP  (2026-11-12)

## Corpus Check
- 49 files · ~51,615 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .css 6, (none) 3, .lock 1)

## Summary
- 603 nodes · 1286 edges · 23 communities (15 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1841817c`
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
- ResponsePane.tsx
- Tauri Capabilities
- Agent Instructions
- Visual Reference
- Crate Package
- store.ts
- mask.ts
- fonts.rs

## God Nodes (most connected - your core abstractions)
1. `State` - 47 edges
2. `Parser` - 25 edges
3. `useStore` - 25 edges
4. `RequestPane()` - 20 edges
5. `kv()` - 16 edges
6. `uid()` - 16 edges
7. `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` - 16 edges
8. `compilerOptions` - 15 edges
9. `react` - 15 edges
10. `findNode()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `Modals()` --calls--> `ExampleModal()`  [EXTRACTED]
  src/components/Modals.tsx → src/components/ExampleModal.tsx
- `VariablesModal()` --calls--> `kv()`  [EXTRACTED]
  src/components/Modals.tsx → src/lib/model.ts
- `VariablesModal()` --calls--> `uid()`  [EXTRACTED]
  src/components/Modals.tsx → src/lib/model.ts
- `EnvItem()` --calls--> `RowMenu()`  [EXTRACTED]
  src/components/Modals.tsx → src/components/RowMenu.tsx

## Import Cycles
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (23 total, 8 thin omitted)

### Community 0 - "voidHTTP"
Cohesion: 0.29
Nodes (6): Development, Features (v0.1), Layout, Not yet, Shortcuts, voidHTTP

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.07
Nodes (22): build_multipart(), cancel_request(), describe_error(), execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState (+14 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.07
Nodes (27): greeting(), Home(), pathOf(), ico, icoLg, MenuItem, RowMenu(), CollectionView() (+19 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.07
Nodes (37): index.html SPA Entry, #root Mount Element, dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0 (+29 more)

### Community 4 - "RequestPane.tsx"
Cohesion: 0.06
Nodes (40): Props, AuthEditor(), BODY_MODES, RequestPane(), Section, Props, Tok, tokenizeUrl() (+32 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.06
Nodes (5): State, ExampleRef, ProjectData, ProjectMeta, Settings

### Community 7 - "store.rs"
Cohesion: 0.11
Nodes (17): build(), CLOSE_TAB, CLOSE_WINDOW, on_event(), data_dir(), doc_path(), DOCS, load_response() (+9 more)

### Community 8 - "Tauri Config"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 9 - "Modals.tsx"
Cohesion: 0.05
Nodes (64): App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTheme(), useTypeTokens(), CodeArea(), Mark() (+56 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 12 - "ResponsePane.tsx"
Cohesion: 0.08
Nodes (28): EXAMPLES, Filtered, filters, markMatches(), ResponsePane(), esc(), highlightJson(), highlightLines() (+20 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 21 - "store.ts"
Cohesion: 0.05
Nodes (64): Props, Row, ANSI, decodeForm(), LONG_VALUE, looksForm(), looksJson(), parseCurl() (+56 more)

### Community 23 - "mask.ts"
Cohesion: 0.14
Nodes (23): allRequests(), ExampleModal(), key(), applyMasks(), findSensitive(), isSecretKey(), isVarRef(), jsonPathOf() (+15 more)

### Community 24 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

## Knowledge Gaps
- **6 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 227 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `RequestPane.tsx`, `Modals.tsx`, `ResponsePane.tsx`, `store.ts`, `mask.ts`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.06547619047619048 - nodes in this community are weakly interconnected._
- **Why does `react` connect `NPM Dependencies` to `Sidebar.tsx`, `RequestPane.tsx`, `Modals.tsx`, `ResponsePane.tsx`, `store.ts`, `mask.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07239819004524888 - nodes in this community are weakly interconnected._
- **Why does `Parser` connect `Parser` to `ResponsePane.tsx`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06585365853658537 - nodes in this community are weakly interconnected._