# Graph Report - voidHTTP  (2026-11-12)

## Corpus Check
- 49 files · ~51,749 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .css 6, (none) 3, .lock 1)

## Summary
- 604 nodes · 1290 edges · 31 communities (21 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `93b835cc`
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
- themes.ts
- Crate Package
- store.ts
- curl.ts
- mask.ts
- types.ts
- App.tsx
- model.ts
- Home.tsx
- useStore
- main.tsx

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
- `App()` --calls--> `RequestPane()`  [EXTRACTED]
  src/App.tsx → src/components/RequestPane.tsx
- `RequestPane()` --calls--> `KVEditor()`  [EXTRACTED]
  src/components/RequestPane.tsx → src/components/KVEditor.tsx
- `RequestPane()` --calls--> `looksLikeCurl()`  [EXTRACTED]
  src/components/RequestPane.tsx → src/lib/curl.ts
- `RequestPane()` --calls--> `parseCurl()`  [EXTRACTED]
  src/components/RequestPane.tsx → src/lib/curl.ts

## Import Cycles
- 1-file cycle: `src-tauri/src/store.rs -> src-tauri/src/store.rs`

## Communities (31 total, 10 thin omitted)

### Community 0 - "voidHTTP"
Cohesion: 0.29
Nodes (6): Development, Features (v0.1), Layout, Not yet, Shortcuts, voidHTTP

### Community 1 - "Rust HTTP Engine"
Cohesion: 0.05
Nodes (27): FontList, list_fonts(), mono_names(), named_mono(), scan(), build_multipart(), cancel_request(), describe_error() (+19 more)

### Community 2 - "Sidebar.tsx"
Cohesion: 0.14
Nodes (14): react, EnvItem(), MenuItem, RowMenu(), CollectionView(), DragCtx, DragItem, Drop (+6 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.07
Nodes (34): dependencies, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-dialog@^2.0.0, zustand@^4.5.5, devDependencies (+26 more)

### Community 4 - "RequestPane.tsx"
Cohesion: 0.07
Nodes (36): CodeArea(), Props, AuthEditor(), BODY_MODES, BodyEditor(), RequestPane(), Section, Props (+28 more)

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
Cohesion: 0.14
Nodes (20): CODE_SIZES, FontRow(), ImportModal(), Modals(), MONO_FONTS, ProjectModal(), PromptModal(), SaveModal() (+12 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 12 - "ResponsePane.tsx"
Cohesion: 0.08
Nodes (28): EXAMPLES, Filtered, filters, markMatches(), ResponsePane(), esc(), highlightJson(), highlightLines() (+20 more)

### Community 13 - "Tauri Capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "themes.ts"
Cohesion: 0.17
Nodes (21): useTheme(), alpha(), BUILTIN, BuiltinId, contrast(), DEFAULT_SCHEME, FAMILIES, findScheme() (+13 more)

### Community 20 - "store.ts"
Cohesion: 0.13
Nodes (14): insertNode(), mapTree(), dataOf(), DEFAULT_SETTINGS, emptyData(), findExample(), liveData(), mapExamples() (+6 more)

### Community 21 - "curl.ts"
Cohesion: 0.08
Nodes (45): KVEditor(), Props, Row, VariablesModal(), ANSI, decodeForm(), LONG_VALUE, looksForm() (+37 more)

### Community 23 - "mask.ts"
Cohesion: 0.13
Nodes (25): allRequests(), ExampleModal(), key(), dropTarget(), applyMasks(), findSensitive(), isSecretKey(), isVarRef() (+17 more)

### Community 24 - "types.ts"
Cohesion: 0.13
Nodes (12): BodyMode, Collection, Environment, Example, FolderNode, RequestDef, RequestNode, SavedRef (+4 more)

### Community 25 - "App.tsx"
Cohesion: 0.19
Nodes (7): SIDEBAR_DEFAULT, stack(), useTypeTokens(), ico, icoLg, Mark(), SideView

### Community 26 - "model.ts"
Cohesion: 0.20
Nodes (10): cloneNode(), cloneRequest(), DropWhere, METHODS, nodeIds(), parseQuery(), pathTo(), placeNode() (+2 more)

### Community 27 - "Home.tsx"
Cohesion: 0.33
Nodes (6): greeting(), Home(), pathOf(), ago(), startOfDay(), HistoryEntry

### Community 28 - "useStore"
Cohesion: 0.39
Nodes (9): App(), AppStrip(), HistoryList(), HistoryRow(), sameDrop(), Sidebar(), TabsBar(), methodLabel() (+1 more)

## Knowledge Gaps
- **6 isolated node(s):** `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded`, `Multipart`, `Text` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 227 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `State` connect `Zustand Store Actions` to `Sidebar.tsx`, `RequestPane.tsx`, `ResponsePane.tsx`, `store.ts`, `mask.ts`, `types.ts`, `model.ts`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **What connects `#root Mount Element`, `voidHTTP App Icon`, `FormUrlEncoded` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rust HTTP Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.0544464609800363 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Sidebar.tsx` to `NPM Dependencies`, `RequestPane.tsx`, `Modals.tsx`, `ResponsePane.tsx`, `curl.ts`, `mask.ts`, `App.tsx`, `Home.tsx`, `main.tsx`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `Sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1383399209486166 - nodes in this community are weakly interconnected._
- **Why does `Parser` connect `Parser` to `ResponsePane.tsx`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0746031746031746 - nodes in this community are weakly interconnected._