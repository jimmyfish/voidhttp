# Graph Report - voidHTTP  (2026-11-12)

## Corpus Check
- 43 files · ~30,654 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: .css 5, (none) 3, .lock 1)

## Summary
- 485 nodes · 996 edges · 22 communities (14 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2dc850b9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- voidHTTP
- Rust HTTP Engine
- App Shell & Home
- NPM Dependencies
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
- http.ts
- store.ts
- fonts.rs

## God Nodes (most connected - your core abstractions)
1. `State` - 40 edges
2. `Parser` - 25 edges
3. `useStore` - 24 edges
4. `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` - 16 edges
5. `RequestPane()` - 15 edges
6. `compilerOptions` - 15 edges
7. `App()` - 14 edges
8. `uid()` - 13 edges
9. `react` - 13 edges
10. `Home()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `AppStrip()` --calls--> `ProjectTile()`  [EXTRACTED]
  src/App.tsx → src/components/ProjectIcon.tsx
- `App()` --calls--> `Modals()`  [EXTRACTED]
  src/App.tsx → src/components/Modals.tsx
- `App()` --calls--> `RequestPane()`  [EXTRACTED]
  src/App.tsx → src/components/RequestPane.tsx
- `App()` --calls--> `ResponsePane()`  [EXTRACTED]
  src/App.tsx → src/components/ResponsePane.tsx

## Import Cycles
- None detected.

## Communities (22 total, 8 thin omitted)

### Community 0 - "voidHTTP"
Cohesion: 0.29
Nodes (6): Development, Features (v0.1), Layout, Not yet, Shortcuts, voidHTTP

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.07
Nodes (22): build_multipart(), cancel_request(), describe_error(), execute(), form_pairs_are_encoded(), HttpRequest, HttpResponse, HttpState (+14 more)

### Community 2 - "App Shell & Home"
Cohesion: 0.06
Nodes (35): index.html SPA Entry, #root Mount Element, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTheme(), useTypeTokens() (+27 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.07
Nodes (34): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, zustand@^4.5.5, devDependencies (+26 more)

### Community 5 - "Zustand Store Actions"
Cohesion: 0.07
Nodes (4): State, ProjectData, ProjectMeta, Settings

### Community 7 - "store.rs"
Cohesion: 0.30
Nodes (6): data_dir(), doc_path(), DOCS, load_state(), save_state(), WRITE_ONLY

### Community 8 - "Tauri Config"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 9 - "Modals.tsx"
Cohesion: 0.10
Nodes (35): react, KVEditor(), CODE_SIZES, EnvItem(), FontRow(), ImportModal(), Modals(), MONO_FONTS (+27 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 12 - "ResponsePane.tsx"
Cohesion: 0.08
Nodes (31): CodeArea(), Props, BodyEditor(), EXAMPLES, Filtered, filters, markMatches(), ResponsePane() (+23 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 20 - "http.ts"
Cohesion: 0.09
Nodes (24): AuthEditor(), BODY_MODES, RequestPane(), Section, q(), toCurl(), cancel(), CONTENT_TYPES (+16 more)

### Community 21 - "store.ts"
Cohesion: 0.07
Nodes (48): Props, Row, cloneNode(), cloneRequest(), DropWhere, insertNode(), kv(), mapTree() (+40 more)

### Community 25 - "fonts.rs"
Cohesion: 0.33
Nodes (5): FontList, list_fonts(), mono_names(), named_mono(), scan()

## Knowledge Gaps
- **6 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 194 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `App Shell & Home`, `http.ts`, `ResponsePane.tsx`, `store.ts`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` (e.g. with `voidHTTP App Icon` and `src-tauri/icons/128x128.png`) actually correct?**
  _`voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.06547619047619048 - nodes in this community are weakly interconnected._
- **Why does `Parser` connect `Parser` to `ResponsePane.tsx`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Should `App Shell & Home` be split into smaller, more focused modules?**
  _Cohesion score 0.06394230769230769 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Modals.tsx` to `App Shell & Home`, `NPM Dependencies`, `ResponsePane.tsx`, `http.ts`, `store.ts`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._