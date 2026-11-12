import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import type { Auth, BodyMode, Tab } from "../types";
import { METHODS, findNode, paramsFromUrl, pathTo, urlWithParams } from "../lib/model";
import { unresolved } from "../lib/vars";
import { prepare } from "../lib/http";
import { toCurl } from "../lib/curl";
import { KVEditor } from "./KVEditor";
import { CodeArea } from "./CodeArea";
import { ChevronDown, CircleCheck, CircleDashed, CircleDot, CodeXml, SlidersHorizontal, WandSparkles, ico } from "./Icon";

type Section = "params" | "headers" | "body" | "auth";

export function RequestPane({ tab, grow }: { tab: Tab; grow: number }) {
  const [section, setSection] = useState<Section>(tab.request.body.mode !== "none" ? "body" : "params");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const update = useStore((s) => s.updateRequest);
  const scopeFor = useStore((s) => s.scopeFor);
  // re-render when variables change so the unresolved hint stays correct
  useStore((s) => s.activeEnvironmentId);
  useStore((s) => s.environments);
  const collections = useStore((s) => s.collections);
  const st = useStore.getState(); // actions only

  const req = tab.request;
  const set = (patch: Parameters<typeof update>[1]) => update(tab.id, patch);
  const missing = unresolved(req.url, scopeFor(tab.id));
  const loading = !!tab.inflightId;

  // where the saved request lives, for the title row
  const col = tab.savedRef && collections.find((c) => c.id === tab.savedRef!.collectionId);
  const saved = !!(col && findNode(col.children, tab.savedRef!.nodeId));
  const folders = saved ? pathTo(col!.children, tab.savedRef!.nodeId) ?? [] : [];

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const copyCurl = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(toCurl(prepare(req, scopeFor(tab.id))));
      st.notify("cURL copied to clipboard");
    } catch (e) {
      st.notify(`Copy failed: ${e}`);
    }
  };
  const remove = () =>
    st.openModal({
      kind: "confirm",
      title: `Delete “${req.name}”?`,
      message: "It is removed from its collection. This tab stays open as an unsaved request.",
      onConfirm: () => st.deleteSaved(tab.id),
    });

  const n = (count: number) => (count ? <span className="n">{count}</span> : null);
  const enabledParams = req.params.filter((p) => p.enabled && p.key).length;
  const enabledHeaders = req.headers.filter((h) => h.enabled && h.key).length;

  return (
    <div className="req-pane" style={{ flexGrow: grow }}>
      <form
        className="request-line"
        onSubmit={(e) => {
          e.preventDefault();
          loading ? st.cancelTab(tab.id) : st.sendTab(tab.id);
        }}
      >
        <div className="url-field">
          {/* the label sizes to the method; the real <select> lies over it */}
          <label className={`method-pick m-${req.method}`}>
            {req.method}
            <select aria-label="Method" value={req.method} onChange={(e) => set({ method: e.target.value })}>
              {METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <input
            aria-label="URL"
            spellCheck={false}
            autoFocus
            placeholder="https://api.example.com/users or {{baseUrl}}/users"
            value={req.url}
            onChange={(e) => set({ url: e.target.value, params: paramsFromUrl(e.target.value, req.params) })}
          />
        </div>

        {loading ? (
          <button type="submit" className="btn btn--danger" aria-busy="true">
            Cancel
          </button>
        ) : (
          <div className="joined send-group" ref={menuRef}>
            <button type="submit" className="btn btn--primary">
              Send
            </button>
            <button
              type="button"
              className="btn btn--primary joined-tail"
              aria-label="More send options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <ChevronDown {...ico} />
            </button>
            {menuOpen && (
              <div className="menu" role="menu" aria-label="Send options">
                <button type="button" role="menuitem" onClick={copyCurl}>
                  <CodeXml {...ico} />
                  Copy as cURL
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    st.openModal({ kind: "settings", section: "requests" });
                  }}
                >
                  <SlidersHorizontal {...ico} />
                  Request settings
                </button>
              </div>
            )}
          </div>
        )}

        <div className="joined">
          <button type="button" className="btn" onClick={() => st.saveTab(tab.id)}>
            Save
          </button>
          {!saved ? (
            <span className="btn joined-tail save-state" role="img" aria-label="Not saved yet" title="Not saved yet">
              <CircleDashed {...ico} />
            </span>
          ) : tab.dirty ? (
            <span className="btn joined-tail save-state dirty-state" role="img" aria-label="Unsaved changes" title="Unsaved changes">
              <CircleDot {...ico} />
            </span>
          ) : (
            <span className="btn joined-tail save-state ok" role="img" aria-label="Saved" title="Saved">
              <CircleCheck {...ico} />
            </span>
          )}
        </div>
        {saved && (
          <button type="button" className="btn" onClick={remove}>
            Delete
          </button>
        )}
      </form>

      <div className="req-title">
        <span className="name">{req.name}</span>
        <span className="path">{saved ? [col!.name, ...folders].join(" / ") : "Not saved"}</span>
        {missing.length > 0 && <span className="hint">Unresolved: {missing.map((m) => `{{${m}}}`).join(", ")}</span>}
      </div>

      <nav className="subtabs" aria-label="Request">
        {(["params", "body", "headers", "auth"] as Section[]).map((s) => (
          <button key={s} type="button" className="subtab" aria-pressed={section === s} onClick={() => setSection(s)}>
            {s[0].toUpperCase() + s.slice(1)}
            {s === "params" && n(enabledParams)}
            {s === "body" && n(req.body.mode !== "none" ? 1 : 0)}
            {s === "headers" && n(enabledHeaders)}
            {s === "auth" && n(req.auth.type !== "none" ? 1 : 0)}
          </button>
        ))}
        <button type="button" className="icon-btn push" title="Copy as cURL" aria-label="Copy as cURL" onClick={copyCurl}>
          <CodeXml {...ico} />
        </button>
      </nav>

      <div className="section">
        {section === "params" && (
          <KVEditor
            rows={req.params}
            addLabel="Add a param"
            onChange={(params) => set({ params, url: urlWithParams(req.url, params) })}
          />
        )}
        {section === "headers" && <KVEditor rows={req.headers} nameLabel="Header" addLabel="Add a header" onChange={(headers) => set({ headers })} />}
        {section === "body" && <BodyEditor tab={tab} />}
        {section === "auth" && <AuthEditor auth={req.auth} onChange={(auth) => set({ auth })} />}
      </div>
    </div>
  );
}

const BODY_MODES: { mode: BodyMode; label: string }[] = [
  { mode: "none", label: "none" },
  { mode: "json", label: "json" },
  { mode: "text", label: "text" },
  { mode: "xml", label: "xml" },
  { mode: "form", label: "x-www-form-urlencoded" },
  { mode: "multipart", label: "form-data" },
];

function BodyEditor({ tab }: { tab: Tab }) {
  const update = useStore((s) => s.updateRequest);
  const notify = useStore((s) => s.notify);
  const body = tab.request.body;
  const set = (patch: Partial<typeof body>) => update(tab.id, { body: { ...body, ...patch } });

  const beautify = () => {
    try {
      set({ raw: JSON.stringify(JSON.parse(body.raw), null, 2) });
    } catch (e) {
      notify(`Invalid JSON: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <div className="modes" role="group" aria-label="Body type">
        {BODY_MODES.map(({ mode, label }) => (
          <button key={mode} type="button" className="mode" aria-pressed={body.mode === mode} onClick={() => set({ mode })}>
            {label}
          </button>
        ))}
      </div>
      {(body.mode === "json" || body.mode === "text" || body.mode === "xml") && (
        <CodeArea
          value={body.raw}
          json={body.mode === "json"}
          onChange={(raw) => set({ raw })}
          placeholder={body.mode === "json" ? '{ "hello": "world" }' : ""}
          tools={
            body.mode === "json" && (
              <button type="button" className="btn btn--quiet" onClick={beautify}>
                <WandSparkles {...ico} />
                Beautify
              </button>
            )
          }
        />
      )}
      {body.mode === "form" && <KVEditor rows={body.form} addLabel="Add a field" onChange={(form) => set({ form })} />}
      {body.mode === "multipart" && <KVEditor files rows={body.multipart} addLabel="Add a field" onChange={(multipart) => set({ multipart })} />}
      {body.mode === "none" && <p className="muted">This request has no body.</p>}
    </>
  );
}

function AuthEditor({ auth, onChange }: { auth: Auth; onChange: (a: Auth) => void }) {
  const switchType = (type: Auth["type"]) => {
    switch (type) {
      case "none":
        return onChange({ type });
      case "bearer":
        return onChange({ type, token: "" });
      case "basic":
        return onChange({ type, username: "", password: "" });
      case "apikey":
        return onChange({ type, key: "", value: "", in: "header" });
    }
  };
  return (
    <div>
      <label className="form-row">
        <span>Type</span>
        <select className="field" value={auth.type} onChange={(e) => switchType(e.target.value as Auth["type"])}>
          <option value="none">No auth</option>
          <option value="bearer">Bearer token</option>
          <option value="basic">Basic auth</option>
          <option value="apikey">API key</option>
        </select>
      </label>
      {auth.type === "bearer" && (
        <label className="form-row">
          <span>Token</span>
          <input className="field" spellCheck={false} value={auth.token} placeholder="{{token}}" onChange={(e) => onChange({ ...auth, token: e.target.value })} />
        </label>
      )}
      {auth.type === "basic" && (
        <>
          <label className="form-row">
            <span>Username</span>
            <input className="field" spellCheck={false} value={auth.username} onChange={(e) => onChange({ ...auth, username: e.target.value })} />
          </label>
          <label className="form-row">
            <span>Password</span>
            <input className="field" type="password" value={auth.password} onChange={(e) => onChange({ ...auth, password: e.target.value })} />
          </label>
        </>
      )}
      {auth.type === "apikey" && (
        <>
          <label className="form-row">
            <span>Key</span>
            <input className="field" spellCheck={false} value={auth.key} placeholder="X-API-Key" onChange={(e) => onChange({ ...auth, key: e.target.value })} />
          </label>
          <label className="form-row">
            <span>Value</span>
            <input className="field" spellCheck={false} value={auth.value} onChange={(e) => onChange({ ...auth, value: e.target.value })} />
          </label>
          <label className="form-row">
            <span>Add to</span>
            <select className="field" value={auth.in} onChange={(e) => onChange({ ...auth, in: e.target.value as "header" | "query" })}>
              <option value="header">Header</option>
              <option value="query">Query params</option>
            </select>
          </label>
        </>
      )}
    </div>
  );
}
