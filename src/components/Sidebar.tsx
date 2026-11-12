import { useRef, useState } from "react";
import { useStore } from "../store";
import type { Collection, TreeNode } from "../types";
import { toRequestDef } from "../lib/model";

export function Sidebar() {
  const [view, setView] = useState<"collections" | "history">("collections");
  const [filter, setFilter] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const collections = useStore((st) => st.collections);
  const environments = useStore((st) => st.environments);
  const activeEnvironmentId = useStore((st) => st.activeEnvironmentId);
  const s = useStore.getState();

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const f of Array.from(e.target.files ?? [])) s.importText(await f.text());
    e.target.value = "";
  };

  const newCollection = () =>
    s.openModal({ kind: "prompt", title: "New collection", initial: "My collection", onSubmit: (n) => s.createCollection(n) });

  return (
    <aside className="sidebar">
      <header className="brand">
        <span className="logo">◉</span> voidHTTP
        <button className="icon push" title="Settings" onClick={() => s.openModal({ kind: "settings" })}>
          ⚙
        </button>
      </header>

      <div className="env-row">
        <select value={activeEnvironmentId ?? ""} onChange={(e) => s.setActiveEnvironment(e.target.value || null)}>
          <option value="">No environment</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>
        <button className="icon" title="Manage environments" onClick={() => s.openModal({ kind: "environments" })}>
          ✎
        </button>
      </div>

      <nav className="subtabs side">
        <button className={view === "collections" ? "on" : ""} onClick={() => setView("collections")}>
          Collections
        </button>
        <button className={view === "history" ? "on" : ""} onClick={() => setView("history")}>
          History
        </button>
      </nav>

      <div className="side-actions">
        <input className="filter" placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {view === "collections" ? (
          <>
            <button className="icon" title="New collection" onClick={newCollection}>
              ＋
            </button>
            <button className="icon" title="Import Postman collection / environment (v2.x JSON)" onClick={() => fileRef.current?.click()}>
              ⇪
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={onImport} />
          </>
        ) : (
          <button className="icon" title="Clear history" onClick={() => s.clearHistory()}>
            🗑
          </button>
        )}
      </div>

      <div className="side-scroll">
        {view === "collections" ? (
          collections.length === 0 ? (
            <div className="empty">
              No collections yet.
              <br />
              <button className="link" onClick={newCollection}>
                Create one
              </button>{" "}
              or{" "}
              <button className="link" onClick={() => fileRef.current?.click()}>
                import from Postman
              </button>
            </div>
          ) : (
            collections.map((c) => <CollectionView key={c.id} collection={c} filter={filter.toLowerCase()} />)
          )
        ) : (
          <HistoryList filter={filter.toLowerCase()} />
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
  return (
    <div className="tree">
      <Row
        collectionId={collection.id}
        nodeId={collection.id}
        name={collection.name}
        open={open}
        onToggle={() => setOpen(!open)}
        isCollection
        depth={0}
      />
      {(open || filter) && collection.children.filter((n) => matches(n, filter)).map((n) => (
        <Node key={n.id} node={n} collectionId={collection.id} depth={1} filter={filter} />
      ))}
    </div>
  );
}

function Node({ node, collectionId, depth, filter }: { node: TreeNode; collectionId: string; depth: number; filter: string }) {
  const [open, setOpen] = useState(false);
  const openSaved = useStore((s) => s.openSaved);
  const activeNodeId = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.savedRef?.nodeId);

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
  return (
    <>
      <Row collectionId={collectionId} nodeId={node.id} name={node.name} open={open || !!filter} onToggle={() => setOpen(!open)} depth={depth} folder />
      {(open || filter) &&
        node.children.filter((n) => matches(n, filter)).map((c) => (
          <Node key={c.id} node={c} collectionId={collectionId} depth={depth + 1} filter={filter} />
        ))}
    </>
  );
}

interface RowProps {
  collectionId: string;
  nodeId: string;
  name: string;
  depth: number;
  method?: string;
  open?: boolean;
  active?: boolean;
  folder?: boolean;
  isCollection?: boolean;
  onToggle?: () => void;
  onClick?: () => void;
}

function Row({ collectionId, nodeId, name, depth, method, open, active, folder, isCollection, onToggle, onClick }: RowProps) {
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
      className={`row ${active ? "active" : ""} ${isCollection ? "collection" : ""}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={container ? onToggle : onClick}
    >
      {container ? <span className="caret">{open ? "▾" : "▸"}</span> : <span className={`mtag m-${method}`}>{method}</span>}
      <span className="name" title={name}>
        {name}
      </span>
      <span className="row-actions" onClick={(e) => e.stopPropagation()}>
        {container && (
          <>
            <button className="icon" title="Add request" onClick={() => s.addRequest(collectionId, parentId)}>
              ＋
            </button>
            <button className="icon" title="Add folder" onClick={addFolder}>
              ⊞
            </button>
          </>
        )}
        {isCollection && (
          <button className="icon" title="Collection variables" onClick={() => s.openModal({ kind: "environments" })}>
            {"{}"}
          </button>
        )}
        <button className="icon" title="Rename" onClick={rename}>
          ✎
        </button>
        <button className="icon" title="Delete" onClick={remove}>
          ×
        </button>
      </span>
    </div>
  );
}

function HistoryList({ filter }: { filter: string }) {
  const history = useStore((s) => s.history);
  const newTab = useStore((s) => s.newTab);
  const items = history.filter((h) => !filter || h.request.url.toLowerCase().includes(filter));
  if (items.length === 0) return <div className="empty">No requests yet.</div>;

  let lastDay = "";
  return (
    <div className="tree">
      {items.map((h) => {
        const day = new Date(h.at).toLocaleDateString();
        const header = day !== lastDay ? <div className="day">{day}</div> : null;
        lastDay = day;
        return (
          <div key={h.id}>
            {header}
            <div className="row" style={{ paddingLeft: 8 }} onClick={() => newTab({ ...toRequestDef(h.request), name: h.request.url || h.request.name })}>
              <span className={`mtag m-${h.request.method}`}>{h.request.method}</span>
              <span className="name" title={h.request.url}>
                {h.request.url || "(empty)"}
              </span>
              <span className={`hstatus ${h.status ? (h.status < 400 ? "ok" : "fail") : "fail"}`}>{h.status ?? "ERR"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
