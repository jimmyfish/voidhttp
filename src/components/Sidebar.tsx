import { createContext, useContext, useEffect, useRef, useState } from "react";
import { RowMenu, type MenuItem } from "./RowMenu";
import { useStore } from "../store";
import type { Collection, TreeNode } from "../types";
import { countRequests, findNode, methodLabel, toRequestDef, type DropWhere } from "../lib/model";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  CopyPlus,
  Ellipsis,
  FilePlus,
  Folder,
  FolderPlus,
  Import,
  Pencil,
  Plus,
  Search,
  Trash2,
  ico,
} from "./Icon";

export type SideView = "collections" | "history";

type DragItem =
  | { kind: "node"; collectionId: string; nodeId: string; name: string; method?: string }
  | { kind: "collection"; collectionId: string; name: string };
type Drop = { collectionId: string; targetId: string; where: DropWhere };

/** Drag state shared by every row of the tree: which row is lifted, where it would land, and how to start a drag. */
const DragCtx = createContext<{ dragId: string | null; drop: Drop | null; start: (e: React.MouseEvent, item: DragItem) => void }>({
  dragId: null,
  drop: null,
  start: () => undefined,
});

/** The landing spot under the pointer for `item`, or null where it cannot go. */
function dropTarget(ev: MouseEvent, item: DragItem): Drop | null {
  const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>(".tree .row[data-id]");
  if (!el) return null;
  const { id, col, kind } = el.dataset as { id: string; col: string; kind: string };
  const r = el.getBoundingClientRect();
  const f = (ev.clientY - r.top) / r.height;
  if (item.kind === "collection") {
    if (kind !== "collection" || id === item.collectionId) return null;
    return { collectionId: col, targetId: id, where: f < 0.5 ? "before" : "after" };
  }
  if (id === item.nodeId) return null;
  // a folder cannot be dropped into itself or anything inside it
  const from = useStore.getState().collections.find((c) => c.id === item.collectionId);
  const dragged = from && findNode(from.children, item.nodeId);
  if (dragged?.type === "folder" && findNode(dragged.children, id)) return null;
  if (kind === "collection") return { collectionId: col, targetId: id, where: "inside" };
  if (kind === "folder") return { collectionId: col, targetId: id, where: f < 0.25 ? "before" : f > 0.75 ? "after" : "inside" };
  return { collectionId: col, targetId: id, where: f < 0.5 ? "before" : "after" };
}

const sameDrop = (a: Drop | null, b: Drop | null) =>
  a === b || (!!a && !!b && a.targetId === b.targetId && a.where === b.where && a.collectionId === b.collectionId);

export function Sidebar({ view, onResizeStart }: { view: SideView; onResizeStart: (e: React.MouseEvent) => void }) {
  const [filter, setFilter] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const ghostPos = useRef({ x: 0, y: 0 });
  const [dragId, setDragId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<DragItem | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const collections = useStore((st) => st.collections);
  const s = useStore.getState(); // actions only

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const f of Array.from(e.target.files ?? [])) s.importText(await f.text());
    e.target.value = "";
  };
  const newCollection = () =>
    s.openModal({ kind: "prompt", title: "New collection", initial: "My collection", onSubmit: (n) => s.createCollection(n) });
  const clearHistory = () =>
    s.openModal({
      kind: "confirm",
      title: "Clear history?",
      message: "Every request in history is removed. Saved collections are not touched.",
      onConfirm: () => s.clearHistory(),
      confirmLabel: "Clear",
    });

  /** Pointer-driven drag (HTML5 drag and drop is unreliable inside the Tauri webview). */
  const startDrag = (e: React.MouseEvent, item: DragItem) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest(".row-more")) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let active = false;
    let cur: Drop | null = null;
    const move = (ev: MouseEvent) => {
      if (!active) {
        if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 5) return;
        active = true;
        setDragId(item.kind === "node" ? item.nodeId : item.collectionId);
        setGhost(item);
        document.body.classList.add("tree-dragging");
      }
      ghostPos.current = { x: ev.clientX + 14, y: ev.clientY + 10 };
      if (ghostRef.current) ghostRef.current.style.transform = `translate(${ghostPos.current.x}px, ${ghostPos.current.y}px) rotate(-1.5deg)`;
      const tree = treeRef.current;
      if (tree) {
        const r = tree.getBoundingClientRect();
        if (ev.clientY < r.top + 28) tree.scrollTop -= 10;
        else if (ev.clientY > r.bottom - 28) tree.scrollTop += 10;
      }
      const next = dropTarget(ev, item);
      if (!sameDrop(cur, next)) setDrop((cur = next));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (!active) return;
      // the click that ends a drag must not also open or toggle the row
      const swallow = (ev: MouseEvent) => (ev.stopPropagation(), ev.preventDefault());
      window.addEventListener("click", swallow, true);
      setTimeout(() => window.removeEventListener("click", swallow, true), 0);
      document.body.classList.remove("tree-dragging");
      if (cur) {
        if (item.kind === "collection") s.moveCollection(item.collectionId, cur.targetId, cur.where === "before" ? "before" : "after");
        else s.moveNode(item.collectionId, item.nodeId, cur.collectionId, cur.targetId, cur.where);
      }
      setDragId(null);
      setGhost(null);
      setDrop(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const f = filter.toLowerCase();
  const search = (
    <div className="search">
      <Search {...ico} />
      <input className="field" placeholder="Search" aria-label={`Search ${view}`} value={filter} onChange={(e) => setFilter(e.target.value)} />
    </div>
  );
  const resize = (
    <div
      className="side-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      title="Drag to resize. Drag past the edge to hide."
      onMouseDown={onResizeStart}
    />
  );

  if (view === "history") {
    return (
      <aside className="sidebar">
        {resize}
        <div className="side-head">
          <h2>History</h2>
          <button type="button" className="btn" onClick={clearHistory}>
            Clear
          </button>
        </div>
        <div className="side-tools">{search}</div>
        <HistoryList filter={f} />
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      {resize}
      <div className="side-head">
        <h2>Collections</h2>
      </div>
      <div className="side-tools">
        {search}
        <button
          type="button"
          className="icon-btn icon-btn--outline"
          title="Import a Postman collection or environment (v2.x JSON)"
          aria-label="Import from Postman"
          onClick={() => fileRef.current?.click()}
        >
          <Import {...ico} />
        </button>
        <button type="button" className="icon-btn icon-btn--filled" title="New collection" aria-label="New collection" onClick={newCollection}>
          <Plus {...ico} />
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={onImport} />
      </div>
      <div className="tree" ref={treeRef}>
        {collections.length === 0 ? (
          <div className="empty">
            <strong>No collections yet</strong>
            <span className="empty-actions">
              <button type="button" className="link" onClick={newCollection}>
                Create one
              </button>
              <span>or</span>
              <button type="button" className="link link--postman" onClick={() => fileRef.current?.click()}>
                Import from Postman
              </button>
            </span>
          </div>
        ) : (
          <DragCtx.Provider value={{ dragId, drop, start: startDrag }}>
            {collections.map((c) => (
              <CollectionView key={c.id} collection={c} filter={f} />
            ))}
          </DragCtx.Provider>
        )}
      </div>
      {ghost && (
        <div
          ref={ghostRef}
          className="drag-ghost"
          aria-hidden="true"
          style={{ transform: `translate(${ghostPos.current.x}px, ${ghostPos.current.y}px) rotate(-1.5deg)` }}
        >
          {ghost.kind === "node" && ghost.method && <span className={`m m-${ghost.method}`}>{methodLabel(ghost.method)}</span>}
          {ghost.kind === "node" && !ghost.method && <Folder {...ico} />}
          {ghost.name}
        </div>
      )}
    </aside>
  );
}

function matches(n: TreeNode, f: string): boolean {
  if (!f) return true;
  if (n.name.toLowerCase().includes(f)) return true;
  if (n.type === "request") return n.url.toLowerCase().includes(f);
  return n.children.some((c) => matches(c, f));
}

function CollectionView({ collection, filter }: { collection: Collection; filter: string }) {
  const [open, setOpen] = useState(true);
  const shown = open || !!filter;
  return (
    <>
      <Row
        collectionId={collection.id}
        nodeId={collection.id}
        name={collection.name}
        count={countRequests(collection.children)}
        open={shown}
        onToggle={() => setOpen(!open)}
        isCollection
        depth={0}
      />
      {shown &&
        collection.children
          .filter((n) => matches(n, filter))
          .map((n) => <Node key={n.id} node={n} collectionId={collection.id} depth={1} filter={filter} />)}
    </>
  );
}

function Node({ node, collectionId, depth, filter }: { node: TreeNode; collectionId: string; depth: number; filter: string }) {
  const [open, setOpen] = useState(false);
  const openSaved = useStore((s) => s.openSaved);
  const activeNodeId = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.savedRef?.nodeId);
  // a folder opens by itself when it holds the request in the active tab
  const holdsActive = node.type === "folder" && !!activeNodeId && !!findNode(node.children, activeNodeId);
  useEffect(() => {
    if (holdsActive) setOpen(true);
  }, [holdsActive]);

  if (node.type === "request") {
    return (
      <Row
        collectionId={collectionId}
        nodeId={node.id}
        name={node.name}
        method={node.method}
        depth={depth}
        active={activeNodeId === node.id}
        onClick={() => openSaved(collectionId, node.id)}
      />
    );
  }
  const shown = open || !!filter;
  return (
    <>
      <Row
        collectionId={collectionId}
        nodeId={node.id}
        name={node.name}
        count={countRequests(node.children)}
        open={shown}
        onToggle={() => setOpen(!open)}
        depth={depth}
        folder
      />
      {shown &&
        node.children
          .filter((n) => matches(n, filter))
          .map((c) => <Node key={c.id} node={c} collectionId={collectionId} depth={depth + 1} filter={filter} />)}
    </>
  );
}

interface RowProps {
  collectionId: string;
  nodeId: string;
  name: string;
  depth: number;
  method?: string;
  count?: number;
  open?: boolean;
  active?: boolean;
  folder?: boolean;
  isCollection?: boolean;
  onToggle?: () => void;
  onClick?: () => void;
}

function Row({ collectionId, nodeId, name, depth, method, count, open, active, folder, isCollection, onToggle, onClick }: RowProps) {
  const s = useStore.getState(); // actions only; no subscription
  const { dragId, drop, start } = useContext(DragCtx);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const container = folder || isCollection;
  const parentId = isCollection ? null : nodeId;
  const kind = isCollection ? "collection" : folder ? "folder" : "request";

  const rename = () =>
    s.openModal({ kind: "prompt", title: "Rename", initial: name, onSubmit: (v) => s.renameNode(collectionId, nodeId, v) });
  const remove = () =>
    s.openModal({
      kind: "confirm",
      title: `Delete “${name}”?`,
      message: container ? "Everything inside it will be deleted too." : "This cannot be undone.",
      onConfirm: () => s.deleteNode(collectionId, nodeId),
    });
  const addFolder = () =>
    s.openModal({ kind: "prompt", title: "New folder", initial: "New folder", onSubmit: (v) => s.addFolder(collectionId, parentId, v) });

  const items: MenuItem[] = [
    ...(container
      ? ([
          { label: "Add request", icon: <FilePlus {...ico} />, run: () => s.addRequest(collectionId, parentId) },
          { label: "Add folder", icon: <FolderPlus {...ico} />, run: addFolder },
        ] as MenuItem[])
      : []),
    ...(isCollection
      ? ([{ label: "Edit variables", icon: <Braces {...ico} />, run: () => s.openModal({ kind: "environments", select: collectionId }) }] as MenuItem[])
      : []),
    ...(container ? (["sep"] as MenuItem[]) : []),
    { label: "Rename", icon: <Pencil {...ico} />, run: rename },
    { label: "Duplicate", icon: <CopyPlus {...ico} />, run: () => s.duplicateNode(collectionId, nodeId) },
    "sep",
    { label: "Delete", icon: <Trash2 {...ico} />, run: remove, danger: true },
  ];

  const dropHere = drop?.targetId === nodeId ? ` drop-${drop.where}` : "";
  const item: DragItem = isCollection
    ? { kind: "collection", collectionId, name }
    : { kind: "node", collectionId, nodeId, name, method };

  return (
    <div
      className={`row${isCollection ? " collection" : ""}${dragId === nodeId ? " dragging" : ""}${menu ? " menu-open" : ""}${dropHere}`}
      aria-current={active ? "page" : undefined}
      data-id={nodeId}
      data-col={collectionId}
      data-kind={kind}
      style={{ "--indent": `${depth * 16 + (container ? 0 : 24)}px` } as React.CSSProperties}
      onMouseDown={(e) => start(e, item)}
    >
      <button type="button" className="row-main" aria-expanded={container ? !!open : undefined} onClick={container ? onToggle : onClick}>
        {container && <span className="caret">{open ? <ChevronDown {...ico} /> : <ChevronRight {...ico} />}</span>}
        {folder && (
          <span className="folder">
            <Folder {...ico} />
          </span>
        )}
        {method && <span className={`m m-${method}`}>{methodLabel(method)}</span>}
        <span className="name" title={name}>
          {name}
        </span>
        {container && <span className="count">({count})</span>}
      </button>
      <button
        ref={moreRef}
        type="button"
        className="icon-btn row-more"
        title="More actions"
        aria-label={`More actions for ${name}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu(!menu)}
      >
        <Ellipsis {...ico} />
      </button>
      {menu && <RowMenu anchor={moreRef} label={`${name} actions`} items={items} onClose={() => setMenu(false)} />}
    </div>
  );
}

function HistoryList({ filter }: { filter: string }) {
  const history = useStore((s) => s.history);
  const newTab = useStore((s) => s.newTab);
  const items = history.filter((h) => !filter || h.request.url.toLowerCase().includes(filter));
  if (items.length === 0)
    return (
      <div className="tree">
        <div className="empty">
          <strong>No requests yet</strong>
          <span>Requests you send show up here.</span>
        </div>
      </div>
    );

  const today = new Date().toLocaleDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString();
  let lastDay = "";
  return (
    <div className="tree">
      {items.map((h) => {
        const d = new Date(h.at).toLocaleDateString();
        const day = d === today ? "Today" : d === yesterday ? "Yesterday" : d;
        const header = day !== lastDay ? <div className="day">{day}</div> : null;
        lastDay = day;
        return (
          <div key={h.id}>
            {header}
            <div className="row">
              <button
                type="button"
                className="row-main"
                onClick={() => newTab({ ...toRequestDef(h.request), name: h.request.url || h.request.name })}
              >
                <span className={`m m-${h.request.method}`}>{methodLabel(h.request.method)}</span>
                <span className="name" title={h.request.url}>
                  {h.request.url.replace(/^(https?:\/\/|\{\{[^}]+\}\})/, "") || "(empty)"}
                </span>
                <span className={`hstatus ${h.status && h.status < 400 ? "ok" : "fail"}`}>{h.status ?? "ERR"}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
