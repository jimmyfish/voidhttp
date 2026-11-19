import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useStore } from "../store";
import type { Collection, Tab, TreeNode } from "../types";
import { findNode, methodLabel } from "../lib/model";
import { ago } from "../lib/time";
import { KEYS, act, tabKey } from "../shortcuts";
import { ProjectTile } from "./ProjectIcon";
import {
  Bookmark,
  Braces,
  ChevronRight,
  CircleX,
  Columns2,
  FolderPlus,
  House,
  Import,
  Info,
  Keyboard,
  Layers,
  Link,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Rows2,
  Save,
  Search,
  SearchX,
  Send,
  Settings,
  SunMoon,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  ico,
} from "./Icon";

/** One row of the list: what leads it (method or icon), its name and where it lives, and a key on the right. */
interface Item {
  id: string;
  group: string;
  lead: ReactNode;
  name: string;
  nameHits?: Set<number>;
  where?: string;
  whereHits?: Set<number>;
  dirty?: boolean;
  trail?: ReactNode;
  score: number;
  run: () => void;
}

// ---------- matching ----------

/** Where `q` matches inside `text`, case-insensitive: as one run (best), else letter by letter in order. */
function fuzzy(text: string, q: string): { score: number; hits: number[] } | null {
  const t = text.toLowerCase();
  const at = t.indexOf(q);
  if (at >= 0) {
    const wordStart = at === 0 || /[\s/_.\-:{}]/.test(t[at - 1]);
    return { score: 1000 - at + (wordStart ? 100 : 0), hits: Array.from({ length: q.length }, (_, i) => at + i) };
  }
  const hits: number[] = [];
  let gaps = 0;
  for (let i = 0, j = 0; i < t.length && j < q.length; i++) {
    if (t[i] !== q[j]) continue;
    if (hits.length) gaps += i - hits[hits.length - 1] - 1;
    hits.push(i);
    j++;
  }
  if (hits.length < q.length) return null;
  return { score: 400 - gaps * 4 - hits[0], hits };
}

/** A method typed as a word ("post login") filters by method instead of matching text. */
const METHOD_WORDS: Record<string, string> = {
  get: "GET", post: "POST", put: "PUT", patch: "PATCH", delete: "DELETE", del: "DELETE", head: "HEAD", options: "OPTIONS",
  grpc: "GRPC", ws: "WS", websocket: "WS", sio: "SIO", kafka: "KAFKA", mqtt: "MQTT", pubsub: "PUBSUB", psub: "PUBSUB", gql: "GQL", graphql: "GQL",
};

interface Fields {
  name: string;
  path: string;
  url?: string;
  method?: string;
}

/** Every word must match the name, the folder path, the URL or the method. Null when one does not. */
function score(f: Fields, words: string[]): { score: number; name: Set<number>; path: Set<number>; url: Set<number> } | null {
  const out = { score: 0, name: new Set<number>(), path: new Set<number>(), url: new Set<number>() };
  for (const w of words) {
    if (METHOD_WORDS[w] && f.method === METHOD_WORDS[w]) {
      out.score += 200;
      continue;
    }
    const tries = [
      { m: fuzzy(f.name, w), weight: 1, into: out.name },
      { m: fuzzy(f.path, w), weight: 0.6, into: out.path },
      { m: f.url ? fuzzy(f.url, w) : null, weight: 0.5, into: out.url },
    ].filter((x) => x.m);
    if (!tries.length) return null;
    const best = tries.reduce((a, b) => (b.m!.score * b.weight > a.m!.score * a.weight ? b : a));
    out.score += best.m!.score * best.weight;
    best.m!.hits.forEach((h) => best.into.add(h));
  }
  return out;
}

// ---------- what can be found ----------

interface Found {
  collection: Collection;
  node: Extract<TreeNode, { type: "request" }>;
  path: string;
}

function* requests(collections: Collection[]): Generator<Found> {
  function* walk(collection: Collection, nodes: TreeNode[], path: string): Generator<Found> {
    for (const n of nodes) {
      if (n.type === "request") yield { collection, node: n, path };
      else yield* walk(collection, n.children, `${path} / ${n.name}`);
    }
  }
  for (const c of collections) yield* walk(c, c.children, c.name);
}

/** "trx-service / Customers" for a saved request, else the URL. */
function pathOf(collections: Collection[], tab: Tab): string {
  const ref = tab.savedRef ?? tab.example;
  if (ref) {
    for (const f of requests(collections.filter((c) => c.id === ref.collectionId))) {
      if (f.node.id === ref.nodeId) return tab.example ? `${f.path} / ${f.node.name}` : f.path;
    }
  }
  return tab.request.url || "Unsaved";
}

const Method = ({ m }: { m: string }) => <span className={`m m-${m}`}>{methodLabel(m)}</span>;
const ExIcon = () => <Bookmark {...ico} className="ico ex-ico" />;

/** The text with the matched letters marked. */
function Marked({ text, hits }: { text: string; hits?: Set<number> }) {
  if (!hits?.size) return <>{text}</>;
  const parts: ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const on = hits.has(i);
    let j = i;
    while (j < text.length && hits.has(j) === on) j++;
    parts.push(on ? <mark key={i}>{text.slice(i, j)}</mark> : text.slice(i, j));
    i = j;
  }
  return <>{parts}</>;
}

/** ⌘P: find a request, example or open tab in this project. Typing ">" (or ⇧⌘P) switches to app actions. */
export function QuickOpen({ actions, onClose }: { actions?: boolean; onClose: () => void }) {
  const [q, setQ] = useState(actions ? ">" : "");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const collections = useStore((s) => s.collections);
  const history = useStore((s) => s.history);
  const settings = useStore((s) => s.settings);
  const project = useStore((s) => s.projects.find((p) => p.id === s.currentProjectId));
  const st = useStore.getState(); // actions only

  const actionMode = q.startsWith(">");
  const words = (actionMode ? q.slice(1) : q).trim().toLowerCase().split(/\s+/).filter(Boolean);

  /** close first, then run once the dialog is gone (some actions open another dialog or move focus) */
  const go = (fn: () => void) => {
    onClose();
    act.later(fn);
  };

  const items = useMemo<Item[]>(() => {
    if (actionMode) {
      const active = tabs.find((t) => t.id === activeTabId);
      const zoom = Math.round((settings.zoom ?? 1) * 100);
      const reopen = st.lastClosedTab();
      const dark = document.documentElement.dataset.theme === "dark";
      const list: { group: string; icon: ReactNode; name: string; where?: string; keys?: string; run: () => void; when?: boolean }[] = [
        { group: "Request", icon: <Send {...ico} />, name: "Send request", keys: KEYS.send, run: act.send, when: !!active && !active.example },
        { group: "Request", icon: <CircleX {...ico} />, name: "Cancel request", keys: KEYS.cancel, run: act.cancel, when: !!active?.inflightId },
        { group: "Request", icon: <Save {...ico} />, name: "Save", keys: KEYS.save, run: act.save, when: !!active && !active.example },
        { group: "Request", icon: <Save {...ico} />, name: "Save as…", keys: KEYS.saveAs, run: act.saveAs, when: !!active && !active.example },
        { group: "Request", icon: <Link {...ico} />, name: "Go to URL", keys: KEYS.focusUrl, run: act.focusUrl, when: !!active },
        { group: "Tabs", icon: <Plus {...ico} />, name: "New tab", keys: KEYS.newTab, run: act.newTab },
        { group: "Tabs", icon: <X {...ico} />, name: "Close tab", keys: KEYS.closeTab, run: act.closeTab, when: !!active && !active.pinned },
        { group: "Tabs", icon: <Undo2 {...ico} />, name: "Reopen closed tab", where: reopen, keys: KEYS.reopenTab, run: act.reopenTab, when: !!reopen },
        {
          group: "View",
          icon: settings.sidebarHidden ? <PanelLeftOpen {...ico} /> : <PanelLeftClose {...ico} />,
          name: settings.sidebarHidden ? "Show sidebar" : "Hide sidebar",
          keys: KEYS.toggleSidebar,
          run: act.toggleSidebar,
        },
        { group: "View", icon: <Search {...ico} />, name: "Search sidebar", keys: KEYS.searchSidebar, run: act.searchSidebar },
        {
          group: "View",
          icon: settings.layout === "split" ? <Rows2 {...ico} /> : <Columns2 {...ico} />,
          name: settings.layout === "split" ? "Response below the request" : "Response beside the request",
          run: act.toggleLayout,
        },
        { group: "View", icon: <ZoomIn {...ico} />, name: "Zoom in", keys: KEYS.zoomIn, run: act.zoomIn },
        { group: "View", icon: <ZoomOut {...ico} />, name: "Zoom out", keys: KEYS.zoomOut, run: act.zoomOut },
        { group: "View", icon: <RotateCcw {...ico} />, name: "Reset zoom", where: `${zoom}%`, keys: KEYS.zoomReset, run: act.zoomReset },
        { group: "View", icon: <SunMoon {...ico} />, name: `Theme: switch to ${dark ? "Light" : "Dark"}`, run: act.toggleTheme },
        { group: "App", icon: <Braces {...ico} />, name: "Variables", keys: KEYS.variables, run: act.variables },
        { group: "App", icon: <Layers {...ico} />, name: "Switch environment", keys: KEYS.environment, run: act.environment },
        { group: "App", icon: <Import {...ico} />, name: "Import…", keys: KEYS.import, run: act.importDialog },
        { group: "App", icon: <FolderPlus {...ico} />, name: "New collection", run: act.newCollection },
        { group: "App", icon: <Settings {...ico} />, name: "Settings", keys: KEYS.settings, run: act.settings },
        { group: "App", icon: <Keyboard {...ico} />, name: "Keyboard shortcuts", keys: KEYS.shortcuts, run: act.shortcuts },
        { group: "App", icon: <House {...ico} />, name: "Go to Home", run: () => st.goHome() },
        { group: "App", icon: <Info {...ico} />, name: "About voidHTTP", run: () => st.openModal({ kind: "about" }) },
      ];
      return list
        .filter((a) => a.when !== false)
        .flatMap((a, i) => {
          const m = words.length ? score({ name: `${a.name} ${a.group}`, path: "" }, words) : { score: -i, name: new Set<number>() };
          if (!m) return [];
          return [{ id: `a${i}`, group: a.group, lead: a.icon, name: a.name, nameHits: m.name, where: a.where, trail: a.keys && <kbd>{a.keys}</kbd>, score: m.score, run: () => go(a.run) }];
        });
    }

    const openNodes = new Set(tabs.flatMap((t) => (t.savedRef ? [t.savedRef.nodeId] : [])));
    const tabItems: Item[] = tabs.map((t, i) => ({
      id: `t${t.id}`,
      group: "Open tabs",
      lead: t.example ? <ExIcon /> : <Method m={t.request.method} />,
      name: t.request.name,
      where: pathOf(collections, t),
      dirty: t.dirty && !!t.savedRef,
      trail: tabKey(i, tabs.length) && <kbd>{tabKey(i, tabs.length)}</kbd>,
      score: -i,
      run: () => go(() => st.setActiveTab(t.id)),
    }));

    if (!words.length) {
      // nothing typed: the open tabs, then requests sent lately (from history) that are not open
      const seen = new Set(openNodes);
      const recent: Item[] = [];
      for (const h of history) {
        if (recent.length >= 6) break;
        if (!h.ref || seen.has(h.ref)) continue;
        const col = collections.find((c) => findNode(c.children, h.ref!));
        if (!col) continue;
        seen.add(h.ref);
        const f = [...requests([col])].find((x) => x.node.id === h.ref);
        if (!f) continue;
        recent.push({
          id: `r${f.node.id}`,
          group: "Recently sent",
          lead: <Method m={f.node.method} />,
          name: f.node.name,
          where: f.path,
          trail: <span className="tag">{ago(h.at)}</span>,
          score: -recent.length,
          run: () => go(() => st.openSaved(col.id, f.node.id)),
        });
      }
      return [...tabItems, ...recent];
    }

    const hitTabs = tabItems.flatMap((it, i) => {
      const t = tabs[i];
      const m = score({ name: it.name, path: it.where ?? "", url: t.request.url, method: t.request.method }, words);
      return m ? [{ ...it, nameHits: m.name, whereHits: m.path, score: m.score }] : [];
    });
    const reqs: Item[] = [];
    const exs: Item[] = [];
    for (const f of requests(collections)) {
      const { node, collection: col } = f;
      if (!openNodes.has(node.id)) {
        const m = score({ name: node.name, path: f.path, url: node.url, method: node.method }, words);
        if (m) {
          // matched on the URL only: show the URL where the folder path would be
          const byUrl = !m.path.size && m.url.size > 0;
          reqs.push({
            id: `q${node.id}`,
            group: "Requests",
            lead: <Method m={node.method} />,
            name: node.name,
            nameHits: m.name,
            where: byUrl ? node.url : f.path,
            whereHits: byUrl ? m.url : m.path,
            score: m.score,
            run: () => go(() => st.openSaved(col.id, node.id)),
          });
        }
      }
      for (const ex of node.examples ?? []) {
        const status = ex.response?.status ?? (ex.grpc ? "gRPC" : "");
        const where = `${node.name}${status !== "" ? ` · ${status}` : ""}`;
        const m = score({ name: ex.name, path: `${f.path} / ${node.name}` }, words);
        if (!m) continue;
        const ref = { collectionId: col.id, nodeId: node.id, exampleId: ex.id };
        exs.push({ id: `e${col.id}${node.id}${ex.id}`, group: "Examples", lead: <ExIcon />, name: ex.name, nameHits: m.name, where, score: m.score, run: () => go(() => st.openExample(ref)) });
      }
    }
    const top = (list: Item[], n: number) => list.sort((a, b) => b.score - a.score).slice(0, n);
    return [...top(hitTabs, 20), ...top(reqs, 50), ...top(exs, 20)];
    // st is the store's action bag (stable); words come from q
  }, [q, tabs, activeTabId, collections, history, settings]);

  // with a filter typed, actions are one list by best match
  const shown = actionMode && words.length ? [...items].sort((a, b) => b.score - a.score) : items;
  const cur = Math.min(sel, shown.length - 1);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cur]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (shown.length) setSel((cur + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length);
    } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      shown[cur]?.run();
    }
  };

  const grouped = !(actionMode && words.length);
  const rows: ReactNode[] = [];
  shown.forEach((it, i) => {
    if (grouped && it.group !== shown[i - 1]?.group) rows.push(<div key={`g-${it.group}`} className="qo-grp">{it.group}</div>);
    rows.push(
      <button
        key={it.id}
        id={`qo-${i}`}
        type="button"
        tabIndex={-1}
        className="qo-row"
        role="option"
        aria-selected={i === cur}
        onMouseMove={() => i !== cur && setSel(i)}
        onClick={it.run}
      >
        {it.lead}
        <span className="qo-txt">
          <span className="name">
            <Marked text={it.name} hits={it.nameHits} />
          </span>
          {it.dirty && <span className="dirty" role="img" aria-label="Unsaved changes" />}
          {it.where && (
            <span className="where">
              <Marked text={it.where} hits={it.whereHits} />
            </span>
          )}
        </span>
        {it.trail}
      </button>,
    );
  });

  return (
    <div className="qo-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`qo${actionMode ? " qo--actions" : ""}`} role="dialog" aria-modal="true" aria-label={actionMode ? "Actions" : "Quick open"}>
        <div className="qo-in">
          {actionMode ? <ChevronRight {...ico} /> : <Search {...ico} />}
          <input
            autoFocus
            value={q}
            placeholder="Search requests by name, URL or folder"
            aria-label={actionMode ? "Search actions" : "Search requests"}
            role="combobox"
            aria-expanded="true"
            aria-controls="qo-list"
            aria-activedescendant={shown.length ? `qo-${cur}` : undefined}
            spellCheck={false}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
          />
          {!actionMode && project && (
            <span className="qo-scope" title="Searching this project">
              <ProjectTile icon={project.icon} color={project.color} small />
              {project.name}
            </span>
          )}
        </div>
        <div className="qo-list" id="qo-list" role="listbox" aria-label={actionMode ? "Actions" : "Results"} ref={listRef}>
          {shown.length ? (
            rows
          ) : (
            <div className="qo-empty">
              <SearchX {...ico} />
              <strong>{actionMode ? "No action matches" : `No requests match “${q.trim()}”`}</strong>
              {!actionMode && (
                <span>
                  Only {project?.name ?? "this project"} is searched. Type <kbd>&gt;</kbd> to run an action instead.
                </span>
              )}
            </div>
          )}
        </div>
        <div className="qo-foot">
          {shown.length > 0 && (
            <>
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> move
              </span>
              <span>
                <kbd>↵</kbd> {actionMode ? "run" : "open"}
              </span>
            </>
          )}
          <span>
            <kbd>esc</kbd> close
          </span>
          <span className="push">
            {actionMode ? (
              <>
                Delete <kbd>&gt;</kbd> to search requests
              </>
            ) : (
              <>
                Type <kbd>&gt;</kbd> for actions
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
