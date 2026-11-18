import { createContext, useContext, useEffect, useRef, useState } from "react";
import { RenameField } from "./InlineRename";
import { RowMenu, openAtPointer, type MenuItem, type MenuState } from "./RowMenu";
import { useStore } from "../store";
import type { Collection, Example, GrpcResult, HistoryEntry, TreeNode } from "../types";
import { countRequests, entryStatus, findNode, methodLabel, type DropWhere } from "../lib/model";
import {
  Bookmark,
  BookmarkPlus,
  Braces,
  ChevronDown,
  ChevronRight,
  CopyPlus,
  Ellipsis,
  FileOutput,
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

/**
 * Which collections and folders are open, kept here (not per row) so ⌥→ / ⌥← can open or close them all.
 * A collection starts open, a folder closed.
 */
const OpenCtx = createContext<{ isOpen: (id: string, byDefault: boolean) => boolean; setOpen: (id: string, open: boolean) => void }>({
  isOpen: (_, d) => d,
  setOpen: () => undefined,
});

/** Every collection and folder id, for expand and collapse all. */
function containerIds(collections: Collection[]): string[] {
  const walk = (nodes: TreeNode[]): string[] => nodes.flatMap((n) => (n.type === "folder" ? [n.id, ...walk(n.children)] : []));
  return collections.flatMap((c) => [c.id, ...walk(c.children)]);
}

/** Focus a row's clickable body once it has rendered (after a rename, or a collapse that hid the focused row). */
const focusRow = (id: string) =>
  requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`.tree .row[data-id="${CSS.escape(id)}"] > button.row-main`)?.focus());

/**
 * Sidebar keys on a focused row: ↑/↓ move between rows (↓ from the search box enters the list),
 * ⌥→ / ⌥← expand or collapse everything. Enter opens (the row is a button); → / ←, F2, ⌘D and ⌘⌫ live on the row.
 */
function navKeys(e: React.KeyboardEvent<HTMLElement>, setAll: (open: boolean) => void) {
  const t = e.target as HTMLElement;
  const fromSearch = t.matches(".search input");
  if (!fromSearch && !t.matches("button.row-main")) return;
  const rows = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(".tree button.row-main")];
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (fromSearch && e.key === "ArrowUp") return;
    e.preventDefault();
    const i = rows.indexOf(t as HTMLButtonElement);
    const next = fromSearch ? rows[0] : rows[i + (e.key === "ArrowDown" ? 1 : -1)];
    next?.focus();
    next?.scrollIntoView({ block: "nearest" });
  } else if (!fromSearch && e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    e.preventDefault();
    const open = e.key === "ArrowRight";
    setAll(open);
    // collapsing can hide the focused row: keep focus on its collection
    const row = t.closest<HTMLElement>(".row");
    if (!open && row?.dataset.col) focusRow(row.dataset.col);
  }
}

const sameDrop = (a: Drop | null, b: Drop | null) =>
  a === b || (!!a && !!b && a.targetId === b.targetId && a.where === b.where && a.collectionId === b.collectionId);

export function Sidebar({ view, onResizeStart }: { view: SideView; onResizeStart: (e: React.MouseEvent) => void }) {
  const [filter, setFilter] = useState("");
  const treeRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const ghostPos = useRef({ x: 0, y: 0 });
  const [dragId, setDragId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<DragItem | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const collections = useStore((st) => st.collections);
  const openCtx = {
    isOpen: (id: string, byDefault: boolean) => openIds[id] ?? byDefault,
    setOpen: (id: string, open: boolean) => setOpenIds((o) => (o[id] === open ? o : { ...o, [id]: open })),
  };
  const setAll = (open: boolean) => setOpenIds(Object.fromEntries(containerIds(useStore.getState().collections).map((id) => [id, open])));
  const s = useStore.getState(); // actions only

  const openImport = () => s.openModal({ kind: "import" });
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
    if (e.button !== 0 || (e.target as HTMLElement).closest(".row-more, .row-rename")) return;
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
      <aside className="sidebar" onKeyDown={(e) => navKeys(e, () => undefined)}>
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
    <aside className="sidebar" onKeyDown={(e) => navKeys(e, setAll)}>
      {resize}
      <div className="side-head">
        <h2>Collections</h2>
      </div>
      <div className="side-tools">
        {search}
        <button
          type="button"
          className="icon-btn icon-btn--outline"
          title="Import: Postman, OpenAPI / Swagger, HAR, voidHTTP, cURL"
          aria-label="Import"
          onClick={openImport}
        >
          <Import {...ico} />
        </button>
        <button type="button" className="icon-btn icon-btn--filled" title="New collection" aria-label="New collection" onClick={newCollection}>
          <Plus {...ico} />
        </button>
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
              <button type="button" className="link link--postman" onClick={openImport}>
                Import a collection
              </button>
            </span>
          </div>
        ) : (
          <DragCtx.Provider value={{ dragId, drop, start: startDrag }}>
            <OpenCtx.Provider value={openCtx}>
              {collections.map((c) => (
                <CollectionView key={c.id} collection={c} filter={f} />
              ))}
            </OpenCtx.Provider>
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
  const { isOpen, setOpen: setOpenId } = useContext(OpenCtx);
  const open = isOpen(collection.id, true);
  const setOpen = (v: boolean) => setOpenId(collection.id, v);
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
  // a folder's open state is shared (expand / collapse all); a request's examples list is its own
  const { isOpen, setOpen: setOpenId } = useContext(OpenCtx);
  const [exOpen, setExOpen] = useState(false);
  const open = node.type === "folder" ? isOpen(node.id, false) : exOpen;
  const setOpen = (v: boolean) => (node.type === "folder" ? setOpenId(node.id, v) : setExOpen(v));
  const openSaved = useStore((s) => s.openSaved);
  const activeNodeId = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.savedRef?.nodeId);
  const activeEx = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.example);
  // a folder opens by itself when it holds the request (or example) in the active tab; a request, when it holds the example
  const holdsActive =
    node.type === "folder"
      ? [activeNodeId, activeEx?.nodeId].some((id) => !!id && !!findNode(node.children, id))
      : activeEx?.collectionId === collectionId && activeEx.nodeId === node.id;
  useEffect(() => {
    if (holdsActive) setOpen(true);
    // setOpen is rebuilt each render; only a change of holdsActive should open the row
  }, [holdsActive]);

  if (node.type === "request") {
    const examples = node.examples ?? [];
    const shownEx = examples.length > 0 && (open || !!filter);
    return (
      <>
        <Row
          collectionId={collectionId}
          nodeId={node.id}
          name={node.name}
          method={node.method}
          depth={depth}
          active={activeNodeId === node.id}
          onClick={() => openSaved(collectionId, node.id)}
          open={examples.length ? shownEx : undefined}
          onToggle={examples.length ? () => setOpen(!open) : undefined}
        />
        {shownEx &&
          examples.map((ex) => (
            <ExampleRow
              key={ex.id}
              example={ex}
              collectionId={collectionId}
              nodeId={node.id}
              depth={depth}
              active={activeEx?.exampleId === ex.id && activeEx.nodeId === node.id && activeEx.collectionId === collectionId}
            />
          ))}
      </>
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
  const [menu, setMenu] = useState<MenuState>(false);
  const [editing, setEditing] = useState(false);
  const container = folder || isCollection;
  // a request with examples: the caret toggles them, the row still opens the request
  const expandable = !container && !!onToggle;
  const parentId = isCollection ? null : nodeId;
  const kind = isCollection ? "collection" : folder ? "folder" : "request";

  const rename = () => setEditing(true);
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
    ...(isCollection ? ([{ label: "Export…", icon: <FileOutput {...ico} />, run: () => s.openModal({ kind: "export", collectionId }) }] as MenuItem[]) : []),
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
      onContextMenu={openAtPointer(setMenu)}
      aria-current={active ? "page" : undefined}
      data-id={nodeId}
      data-col={collectionId}
      data-kind={kind}
      style={{ "--indent": `${depth * 16 + (container || expandable ? 0 : 24)}px` } as React.CSSProperties}
      onMouseDown={(e) => start(e, item)}
    >
      <RowMain
        editing={editing}
        aria-expanded={container || expandable ? !!open : undefined}
        onClick={container ? onToggle : onClick}
        onDoubleClick={rename}
        onKeyDown={(e) => {
          const mod = e.metaKey || e.ctrlKey;
          if ((container || expandable) && !e.altKey && !mod && (e.key === "ArrowRight" ? !open : e.key === "ArrowLeft" && open)) {
            e.preventDefault();
            onToggle!();
          } else if (e.key === "F2" && !mod) {
            e.preventDefault();
            rename();
          } else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "d") {
            e.preventDefault();
            s.duplicateNode(collectionId, nodeId);
          } else if (mod && (e.key === "Backspace" || e.key === "Delete")) {
            e.preventDefault();
            remove();
          }
        }}
      >
        {container && <span className="caret">{open ? <ChevronDown {...ico} /> : <ChevronRight {...ico} />}</span>}
        {expandable && (
          <span
            className="caret"
            title={open ? "Hide examples" : "Show examples"}
            onClick={(e) => {
              e.stopPropagation();
              onToggle!();
            }}
          >
            {open ? <ChevronDown {...ico} /> : <ChevronRight {...ico} />}
          </span>
        )}
        {folder && (
          <span className="folder">
            <Folder {...ico} />
          </span>
        )}
        {method && <span className={`m m-${method}`}>{methodLabel(method)}</span>}
        {editing ? (
          <RenameField initial={name} onDone={(v) => (setEditing(false), v !== null && s.renameNode(collectionId, nodeId, v), focusRow(nodeId))} />
        ) : (
          <span className="name" title={name}>
            {name}
          </span>
        )}
        {container && <span className="count">({count})</span>}
      </RowMain>
      <button
        ref={moreRef}
        type="button"
        className="icon-btn row-more"
        title="More actions"
        aria-label={`More actions for ${name}`}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={() => setMenu(!menu)}
      >
        <Ellipsis {...ico} />
      </button>
      {menu && <RowMenu anchor={moreRef} label={`${name} actions`} items={items} onClose={() => setMenu(false)} at={menu} />}
    </div>
  );
}

/** A saved example under its request: opens read-only; renamed or deleted from its "…" menu. Not draggable. */
function ExampleRow({ example, collectionId, nodeId, depth, active }: { example: Example; collectionId: string; nodeId: string; depth: number; active: boolean }) {
  const s = useStore.getState(); // actions only
  const moreRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<MenuState>(false);
  const [editing, setEditing] = useState(false);
  const ref = { collectionId, nodeId, exampleId: example.id };
  const remove = () =>
    s.openModal({ kind: "confirm", title: `Delete example “${example.name}”?`, message: "This cannot be undone.", onConfirm: () => s.deleteExample(ref) });
  const items: MenuItem[] = [
    {
      label: "Rename",
      icon: <Pencil {...ico} />,
      run: () => setEditing(true),
    },
    "sep",
    {
      label: "Delete",
      icon: <Trash2 {...ico} />,
      danger: true,
      run: remove,
    },
  ];
  // a gRPC example shows its status code the way history does: OK for 0
  const st = entryStatus({ request: example.request, status: example.grpc ? example.grpc.end?.code : example.response?.status });
  return (
    <div
      className={`row example${menu ? " menu-open" : ""}`}
      onContextMenu={openAtPointer(setMenu)}
      aria-current={active ? "page" : undefined}
      style={{ "--indent": `${depth * 16 + 40}px` } as React.CSSProperties}
    >
      <RowMain
        editing={editing}
        onClick={() => s.openExample(ref)}
        onDoubleClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "F2" && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            setEditing(true);
          } else if ((e.metaKey || e.ctrlKey) && (e.key === "Backspace" || e.key === "Delete")) {
            e.preventDefault();
            remove();
          }
        }}
      >
        <Bookmark {...ico} className="ico ex-ico" />
        {editing ? (
          <RenameField initial={example.name} onDone={(v) => (setEditing(false), v !== null && s.renameExample(ref, v))} />
        ) : (
          <span className="name" title={example.name}>
            {example.name}
          </span>
        )}
        <span className={`hstatus ${st.ok ? "ok" : "fail"}`}>{st.text}</span>
      </RowMain>
      <button
        ref={moreRef}
        type="button"
        className="icon-btn row-more"
        title="More actions"
        aria-label={`More actions for ${example.name}`}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={() => setMenu(!menu)}
      >
        <Ellipsis {...ico} />
      </button>
      {menu && <RowMenu anchor={moreRef} label={`${example.name} actions`} items={items} onClose={() => setMenu(false)} at={menu} />}
    </div>
  );
}

/** A row's clickable body; while renaming it becomes a plain div, since a text input cannot live inside a button. */
function RowMain({ editing, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { editing: boolean }) {
  if (editing) return <div className="row-main">{children}</div>;
  return (
    <button type="button" className="row-main" {...props}>
      {children}
    </button>
  );
}

function HistoryRow({ entry: h }: { entry: HistoryEntry }) {
  const s = useStore.getState(); // actions only
  const moreRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<MenuState>(false);
  const label = `${h.request.method} ${h.request.url}`;
  const asExample = async () => {
    const response = await s.historyResponse(h.id);
    if (!response) return s.notify("The saved response is missing");
    // a gRPC entry keeps its call (messages, status, metadata) in the same file
    s.openModal({ kind: "example", request: h.request, response: h.request.method === "GRPC" ? (response as unknown as GrpcResult) : response });
  };
  const toCollection = async () => {
    await s.openHistory(h.id);
    const tabId = useStore.getState().activeTabId;
    if (tabId) s.openModal({ kind: "save", tabId });
  };
  const items: MenuItem[] = [
    { label: "Open in new tab", icon: <FilePlus {...ico} />, run: () => s.openHistory(h.id) },
    // a WebSocket session has no example form
    ...(h.kept === "full" && h.request.method !== "WS" && h.request.method !== "SIO" && h.request.method !== "KAFKA" && h.request.method !== "MQTT" && h.request.method !== "PUBSUB" ? ([{ label: "Save response as example…", icon: <BookmarkPlus {...ico} />, run: asExample }] as MenuItem[]) : []),
    { label: "Save request to collection…", icon: <CopyPlus {...ico} />, run: toCollection },
    "sep",
    { label: "Delete from history", icon: <Trash2 {...ico} />, run: () => s.deleteHistory(h.id), danger: true },
  ];
  return (
    <div className={`row${menu ? " menu-open" : ""}`} onContextMenu={openAtPointer(setMenu)}>
      <button type="button" className="row-main" onClick={() => s.openHistory(h.id)}>
        <span className={`m m-${h.request.method}`}>{methodLabel(h.request.method)}</span>
        {h.request.grpc?.method ? (
          <span className="name" title={`${h.request.url} ${h.request.grpc.service}/${h.request.grpc.method}`}>
            {h.request.grpc.service.slice(h.request.grpc.service.lastIndexOf(".") + 1)}/{h.request.grpc.method}
          </span>
        ) : (
          <span className="name" title={h.request.url}>
            {h.request.url.replace(/^(https?:\/\/|\{\{[^}]+\}\})/, "") || "(empty)"}
          </span>
        )}
        <span className="htime">{new Date(h.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span className={`hstatus ${entryStatus(h).ok ? "ok" : "fail"}`}>{entryStatus(h).text}</span>
      </button>
      <button
        ref={moreRef}
        type="button"
        className="icon-btn row-more"
        title="More actions"
        aria-label={`More actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={() => setMenu(!menu)}
      >
        <Ellipsis {...ico} />
      </button>
      {menu && <RowMenu anchor={moreRef} label="History entry actions" items={items} onClose={() => setMenu(false)} at={menu} />}
    </div>
  );
}

function HistoryList({ filter }: { filter: string }) {
  const history = useStore((s) => s.history);
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
            <HistoryRow entry={h} />
          </div>
        );
      })}
    </div>
  );
}
