import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import type { Collection, TreeNode } from "../types";
import { countRequests, findNode, methodLabel, toRequestDef } from "../lib/model";
import { ChevronDown, ChevronRight, Folder, FolderPlus, Import, Pencil, Plus, Search, X, Braces, ico } from "./Icon";

export type SideView = "collections" | "history";

export function Sidebar({ view }: { view: SideView }) {
  const [filter, setFilter] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
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

  const f = filter.toLowerCase();
  const search = (
    <div className="search">
      <Search {...ico} />
      <input className="field" placeholder="Search" aria-label={`Search ${view}`} value={filter} onChange={(e) => setFilter(e.target.value)} />
    </div>
  );

  if (view === "history") {
    return (
      <aside className="sidebar">
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
      <div className="tree">
        {collections.length === 0 ? (
          <div className="empty">
            <strong>No collections yet</strong>
            <span>
              <button type="button" className="btn btn--quiet" onClick={newCollection}>
                Create one
              </button>{" "}
              or{" "}
              <button type="button" className="btn btn--quiet" onClick={() => fileRef.current?.click()}>
                import from Postman
              </button>
            </span>
          </div>
        ) : (
          collections.map((c) => <CollectionView key={c.id} collection={c} filter={f} />)
        )}
      </div>
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
  const container = folder || isCollection;
  const parentId = isCollection ? null : nodeId;

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

  return (
    <div
      className={`row ${isCollection ? "collection" : ""}`}
      aria-current={active ? "page" : undefined}
      style={{ paddingLeft: depth * 16 + (container ? 0 : 24) }}
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
      <span className="row-actions">
        {container && (
          <>
            <button type="button" className="icon-btn" title="Add request" aria-label={`Add request to ${name}`} onClick={() => s.addRequest(collectionId, parentId)}>
              <Plus {...ico} />
            </button>
            <button type="button" className="icon-btn" title="Add folder" aria-label={`Add folder to ${name}`} onClick={addFolder}>
              <FolderPlus {...ico} />
            </button>
          </>
        )}
        {isCollection && (
          <button type="button" className="icon-btn" title="Collection variables" aria-label={`Variables of ${name}`} onClick={() => s.openModal({ kind: "environments" })}>
            <Braces {...ico} />
          </button>
        )}
        <button type="button" className="icon-btn" title="Rename" aria-label={`Rename ${name}`} onClick={rename}>
          <Pencil {...ico} />
        </button>
        <button type="button" className="icon-btn" title="Delete" aria-label={`Delete ${name}`} onClick={remove}>
          <X {...ico} />
        </button>
      </span>
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
