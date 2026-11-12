import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "../store";
import type { Environment, KV } from "../types";
import { listFolders, uid } from "../lib/model";
import { KVEditor } from "./KVEditor";
import { Plus, ico } from "./Icon";

export function Modals() {
  const modal = useStore((s) => s.modal);
  const close = () => useStore.getState().openModal(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!modal) return null;
  switch (modal.kind) {
    case "prompt":
      return <PromptModal title={modal.title} initial={modal.initial} onSubmit={(v) => (modal.onSubmit(v), close())} onClose={close} />;
    case "confirm":
      return (
        <Shell title={modal.title} onClose={close}>
          <p>{modal.message}</p>
          <footer>
            <button type="button" className="btn" onClick={close}>
              Cancel
            </button>
            <button type="button" className="btn btn--danger" autoFocus onClick={() => (modal.onConfirm(), close())}>
              {modal.confirmLabel ?? "Delete"}
            </button>
          </footer>
        </Shell>
      );
    case "save":
      return <SaveModal tabId={modal.tabId} onClose={close} />;
    case "environments":
      return <VariablesModal onClose={close} />;
    case "settings":
      return <SettingsModal onClose={close} />;
  }
}

function Shell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function PromptModal({ title, initial, onSubmit, onClose }: { title: string; initial: string; onSubmit: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(initial);
  return (
    <Shell title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (v.trim()) onSubmit(v.trim());
        }}
      >
        <input className="field" aria-label={title} autoFocus value={v} onFocus={(e) => e.target.select()} onChange={(e) => setV(e.target.value)} />
        <footer>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            OK
          </button>
        </footer>
      </form>
    </Shell>
  );
}

function SaveModal({ tabId, onClose }: { tabId: string; onClose: () => void }) {
  const s = useStore.getState();
  const tab = s.tabs.find((t) => t.id === tabId);
  const [name, setName] = useState(tab?.request.name ?? "Untitled request");
  const [target, setTarget] = useState(() => {
    const c = s.collections[0];
    return c ? `${c.id}|` : "";
  });
  const [newCol, setNewCol] = useState("My collection");

  const submit = () => {
    if (!name.trim()) return;
    let [collectionId, parentId] = target.split("|");
    if (!collectionId) collectionId = s.createCollection(newCol.trim() || "My collection");
    s.saveTabAs(tabId, collectionId, parentId || null, name.trim());
    onClose();
  };

  return (
    <Shell title="Save request" onClose={onClose}>
      <label>
        Name
        <input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      </label>
      <label>
        Save to
        <select className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
          {s.collections.map((c) => [
            <option key={c.id} value={`${c.id}|`}>
              {c.name}
            </option>,
            ...listFolders(c.children).map(({ folder, depth }) => (
              <option key={folder.id} value={`${c.id}|${folder.id}`}>
                {"  ".repeat(depth + 1)}
                {folder.name}
              </option>
            )),
          ])}
          <option value="">New collection…</option>
        </select>
      </label>
      {target === "" && (
        <label>
          Collection name
          <input className="field" value={newCol} onChange={(e) => setNewCol(e.target.value)} />
        </label>
      )}
      <footer>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" onClick={submit}>
          Save
        </button>
      </footer>
    </Shell>
  );
}

/** Environments + collection variables, edited on a local draft and committed on Save. */
function VariablesModal({ onClose }: { onClose: () => void }) {
  const s = useStore.getState();
  const [envs, setEnvs] = useState<Environment[]>(() => structuredClone(s.environments));
  const [colVars, setColVars] = useState<Record<string, KV[]>>(() =>
    Object.fromEntries(s.collections.map((c) => [c.id, structuredClone(c.variables)])),
  );
  const [sel, setSel] = useState<string>(s.activeEnvironmentId ?? envs[0]?.id ?? s.collections[0]?.id ?? "");

  const env = envs.find((e) => e.id === sel);
  const col = s.collections.find((c) => c.id === sel);

  const addEnv = () => {
    const e: Environment = { id: uid(), name: `Environment ${envs.length + 1}`, variables: [] };
    setEnvs([...envs, e]);
    setSel(e.id);
  };
  const patchEnv = (patch: Partial<Environment>) => setEnvs(envs.map((e) => (e.id === sel ? { ...e, ...patch } : e)));

  const save = () => {
    s.setEnvironments(envs);
    for (const c of s.collections) if (colVars[c.id] !== c.variables) s.updateCollection(c.id, { variables: colVars[c.id] });
    onClose();
  };

  return (
    <Shell title="Variables" onClose={onClose} wide>
      <div className="vars">
        <ul>
          <li className="group">
            Environments
            <button type="button" className="icon-btn" title="Add environment" aria-label="Add environment" onClick={addEnv}>
              <Plus {...ico} />
            </button>
          </li>
          {envs.map((e) => (
            <li key={e.id}>
              <button type="button" aria-current={sel === e.id} onClick={() => setSel(e.id)}>
                {e.name}
              </button>
            </li>
          ))}
          {s.collections.length > 0 && <li className="group">Collection variables</li>}
          {s.collections.map((c) => (
            <li key={c.id}>
              <button type="button" aria-current={sel === c.id} onClick={() => setSel(c.id)}>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
        <div>
          {env && (
            <>
              <div className="env-head">
                <input className="field" aria-label="Environment name" value={env.name} onChange={(e) => patchEnv({ name: e.target.value })} />
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => {
                    const rest = envs.filter((e) => e.id !== env.id);
                    setEnvs(rest);
                    setSel(rest[0]?.id ?? "");
                  }}
                >
                  Delete
                </button>
              </div>
              <KVEditor rows={env.variables} nameLabel="Variable" addLabel="Add a variable" onChange={(variables) => patchEnv({ variables })} />
            </>
          )}
          {col && (
            <>
              <p className="muted">
                Used by requests saved in <b>{col.name}</b>. Environment values override these.
              </p>
              <KVEditor
                rows={colVars[col.id] ?? []}
                nameLabel="Variable"
                addLabel="Add a variable"
                onChange={(v) => setColVars({ ...colVars, [col.id]: v })}
              />
            </>
          )}
          {!env && !col && (
            <div className="empty">
              <strong>No environments yet</strong>
              <span>Add one to store variables like {"{{baseUrl}}"}.</span>
            </div>
          )}
        </div>
      </div>
      <footer>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" onClick={save}>
          Save
        </button>
      </footer>
    </Shell>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  return (
    <Shell title="Request settings" onClose={onClose}>
      <label>
        Timeout (ms)
        <input
          className="field"
          type="number"
          min={1}
          value={settings.timeoutMs}
          onChange={(e) => setSettings({ timeoutMs: Math.max(1, Number(e.target.value) || 30000) })}
        />
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.followRedirects} onChange={(e) => setSettings({ followRedirects: e.target.checked })} />
        Follow redirects
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.insecure} onChange={(e) => setSettings({ insecure: e.target.checked })} />
        Skip TLS certificate verification (insecure)
      </label>
      <footer>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      </footer>
    </Shell>
  );
}
