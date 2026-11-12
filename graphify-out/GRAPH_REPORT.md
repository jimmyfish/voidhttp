# Graph Report - voidHTTP  (2026-11-12)

## Corpus Check
- 46 files · ~36,423 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: .css 5, (none) 3, .lock 1)

## Summary
- 532 nodes · 1110 edges · 22 communities (13 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `32d521fd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- voidHTTP
- Rust HTTP Engine
- App Shell & Home
- NPM Dependencies
- curl.ts
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

## God Nodes (most connected - your core abstractions)
1. `State` - 40 edges
2. `Parser` - 25 edges
3. `useStore` - 24 edges
4. `RequestPane()` - 17 edges
5. `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` - 16 edges
6. `compilerOptions` - 15 edges
7. `App()` - 14 edges
8. `kv()` - 13 edges
9. `uid()` - 13 edges
10. `react` - 13 edges

## Surprising Connections (you probably didn't know these)
- `voidHTTP App Icon` --conceptually_related_to--> `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)`  [INFERRED]
  app-icon.svg → src-tauri/icons/icon.png
- `VariablesModal()` --calls--> `CodeArea()`  [EXTRACTED]
  src/components/Modals.tsx → src/components/CodeArea.tsx
- `BodyEditor()` --calls--> `CodeArea()`  [EXTRACTED]
  src/components/RequestPane.tsx → src/components/CodeArea.tsx
- `App()` --calls--> `ResponsePane()`  [EXTRACTED]
  src/App.tsx → src/components/ResponsePane.tsx
- `ResponsePane()` --calls--> `useStore`  [EXTRACTED]
  src/components/ResponsePane.tsx → src/store.ts

## Import Cycles
- None detected.

## Communities (22 total, 9 thin omitted)

### Community 0 - "voidHTTP"
Cohesion: 0.29
Nodes (6): Development, Features (v0.1), Layout, Not yet, Shortcuts, voidHTTP

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.05
Nodes (27): FontList, list_fonts(), mono_names(), named_mono(), scan(), build_multipart(), cancel_request(), describe_error() (+19 more)

### Community 2 - "App Shell & Home"
Cohesion: 0.06
Nodes (37): index.html SPA Entry, #root Mount Element, react, App(), AppStrip(), SIDEBAR_DEFAULT, stack(), useTypeTokens() (+29 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.07
Nodes (34): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, zustand@^4.5.5, devDependencies (+26 more)

### Community 4 - "curl.ts"
Cohesion: 0.06
Nodes (45): KVEditor(), AuthEditor(), BODY_MODES, BodyEditor(), RequestPane(), Section, ANSI, decodeForm() (+37 more)

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
Cohesion: 0.07
Nodes (52): useTheme(), CODE_SIZES, FontRow(), ImportModal(), Modals(), MONO_FONTS, ProjectModal(), PromptModal() (+44 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 12 - "ResponsePane.tsx"
Cohesion: 0.08
Nodes (31): CodeArea(), Props, EXAMPLES, Filtered, filters, markMatches(), ResponsePane(), esc() (+23 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 21 - "store.ts"
Cohesion: 0.07
Nodes (50): Props, Row, cloneNode(), cloneRequest(), DropWhere, insertNode(), kv(), mapTree() (+42 more)

## Knowledge Gaps
- **6 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 207 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `App Shell & Home`, `curl.ts`, `store.ts`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` (e.g. with `voidHTTP App Icon` and `src-tauri/icons/128x128.png`) actually correct?**
  _`voidHTTP App Icon Design (dark rounded square, purple ring, teal inner circle with horizontal stubs)` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.0544464609800363 - nodes in this community are weakly interconnected._
- **Why does `Parser` connect `Parser` to `ResponsePane.tsx`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `App Shell & Home` be split into smaller, more focused modules?**
  _Cohesion score 0.061381074168797956 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App Shell & Home` to `NPM Dependencies`, `curl.ts`, `Modals.tsx`, `ResponsePane.tsx`, `store.ts`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._