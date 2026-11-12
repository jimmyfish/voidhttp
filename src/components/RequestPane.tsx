import { useState } from "react";
import { useStore } from "../store";
import type { Auth, BodyMode, Tab } from "../types";
import { METHODS, paramsFromUrl, urlWithParams } from "../lib/model";
import { unresolved } from "../lib/vars";
import { prepare } from "../lib/http";
import { toCurl } from "../lib/curl";
import { KVEditor } from "./KVEditor";
import { CodeArea } from "./CodeArea";

type Section = "params" | "headers" | "body" | "auth";

export function RequestPane({ tab }: { tab: Tab }) {
  const [section, setSection] = useState<Section>("params");
  const update = useStore((s) => s.updateRequest);
  const sendTab = useStore((s) => s.sendTab);
  const cancelTab = useStore((s) => s.cancelTab);
  const scopeFor = useStore((s) => s.scopeFor);
  const notify = useStore((s) => s.notify);
  // re-render when env changes so the unresolved hint stays correct
  useStore((s) => s.activeEnvironmentId);
  useStore((s) => s.environments);

  const req = tab.request;
  const set = (patch: Parameters<typeof update>[1]) => update(tab.id, patch);
  const missing = unresolved(req.url, scopeFor(tab.id));
  const loading = !!tab.inflightId;

  const copyCurl = async () => {
    try {
      await navigator.clipboard.writeText(toCurl(prepare(req, scopeFor(tab.id))));
      notify("cURL copied to clipboard");
    } catch (e) {
      notify(`Copy failed: ${e}`);
    }
  };

  const count = (n: number) => (n ? <span className="count">{n}</span> : null);
  const enabledParams = req.params.filter((p) => p.enabled && p.key).length;
  const enabledHeaders = req.headers.filter((h) => h.enabled && h.key).length;

  return (
    <div className="request-pane">
      <form
        className="urlbar"
        onSubmit={(e) => {
          e.preventDefault();
          loading ? cancelTab(tab.id) : sendTab(tab.id);
        }}
      >
        <select className={`method m-${req.method}`} value={req.method} onChange={(e) => set({ method: e.target.value })}>
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          className="url"
          spellCheck={false}
          autoFocus
          placeholder="https://api.example.com/users?page=1   ·   {{baseUrl}}/users"
          value={req.url}
          onChange={(e) => set({ url: e.target.value, params: paramsFromUrl(e.target.value, req.params) })}
        />
        <button type="submit" className={loading ? "send cancel" : "send"}>
          {loading ? "Cancel" : "Send"}
        </button>
        <button type="button" className="ghost" title="Copy as cURL" onClick={copyCurl}>
          cURL
        </button>
      </form>
      {missing.length > 0 && (
        <div className="hint warn">Unresolved: {missing.map((m) => `{{${m}}}`).join(", ")}</div>
      )}

      <nav className="subtabs">
        {(["params", "headers", "body", "auth"] as Section[]).map((s) => (
          <button key={s} className={section === s ? "on" : ""} onClick={() => setSection(s)}>
            {s[0].toUpperCase() + s.slice(1)}
            {s === "params" && count(enabledParams)}
            {s === "headers" && count(enabledHeaders)}
            {s === "body" && req.body.mode !== "none" && <span className="dot" />}
            {s === "auth" && req.auth.type !== "none" && <span className="dot" />}
          </button>
        ))}
      </nav>

      <div className="section">
        {section === "params" && (
          <KVEditor rows={req.params} onChange={(params) => set({ params, url: urlWithParams(req.url, params) })} />
        )}
        {section === "headers" && <KVEditor rows={req.headers} onChange={(headers) => set({ headers })} keyPlaceholder="Header" />}
        {section === "body" && <BodyEditor tab={tab} />}
        {section === "auth" && <AuthEditor auth={req.auth} onChange={(auth) => set({ auth })} />}
      </div>
    </div>
  );
}

const BODY_MODES: { mode: BodyMode; label: string }[] = [
  { mode: "none", label: "None" },
  { mode: "json", label: "JSON" },
  { mode: "text", label: "Text" },
  { mode: "xml", label: "XML" },
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
    <div className="body-editor">
      <div className="radio-row">
        {BODY_MODES.map(({ mode, label }) => (
          <label key={mode}>
            <input type="radio" checked={body.mode === mode} onChange={() => set({ mode })} /> {label}
          </label>
        ))}
        {body.mode === "json" && (
          <button className="ghost small push" onClick={beautify}>
            Beautify
          </button>
        )}
      </div>
      {(body.mode === "json" || body.mode === "text" || body.mode === "xml") && (
        <CodeArea value={body.raw} onChange={(raw) => set({ raw })} placeholder={body.mode === "json" ? '{\n  "hello": "world"\n}' : ""} />
      )}
      {body.mode === "form" && <KVEditor rows={body.form} onChange={(form) => set({ form })} />}
      {body.mode === "multipart" && <KVEditor files rows={body.multipart} onChange={(multipart) => set({ multipart })} />}
      {body.mode === "none" && <p className="empty">This request has no body.</p>}
    </div>
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
    <div className="auth-editor">
      <label className="field">
        <span>Type</span>
        <select value={auth.type} onChange={(e) => switchType(e.target.value as Auth["type"])}>
          <option value="none">No auth</option>
          <option value="bearer">Bearer token</option>
          <option value="basic">Basic auth</option>
          <option value="apikey">API key</option>
        </select>
      </label>
      {auth.type === "bearer" && (
        <label className="field">
          <span>Token</span>
          <input spellCheck={false} value={auth.token} placeholder="{{token}}" onChange={(e) => onChange({ ...auth, token: e.target.value })} />
        </label>
      )}
      {auth.type === "basic" && (
        <>
          <label className="field">
            <span>Username</span>
            <input spellCheck={false} value={auth.username} onChange={(e) => onChange({ ...auth, username: e.target.value })} />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={auth.password} onChange={(e) => onChange({ ...auth, password: e.target.value })} />
          </label>
        </>
      )}
      {auth.type === "apikey" && (
        <>
          <label className="field">
            <span>Key</span>
            <input spellCheck={false} value={auth.key} placeholder="X-API-Key" onChange={(e) => onChange({ ...auth, key: e.target.value })} />
          </label>
          <label className="field">
            <span>Value</span>
            <input spellCheck={false} value={auth.value} onChange={(e) => onChange({ ...auth, value: e.target.value })} />
          </label>
          <label className="field">
            <span>Add to</span>
            <select value={auth.in} onChange={(e) => onChange({ ...auth, in: e.target.value as "header" | "query" })}>
              <option value="header">Header</option>
              <option value="query">Query params</option>
            </select>
          </label>
        </>
      )}
    </div>
  );
}
