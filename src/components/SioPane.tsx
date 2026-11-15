import { useMemo, useState, type ReactNode } from "react";
import { useStore } from "../store";
import type { SioDef, Tab } from "../types";
import { defaultSio } from "../lib/sio";
import { formatJsonc, stripJsonComments } from "../lib/jsonc";
import { looksLikeCurl, parseCurl } from "../lib/curl";
import { paramsFromUrl, urlWithParams } from "../lib/model";
import { MethodMenu } from "./MethodMenu";
import { UrlInput, type VarInfo } from "./UrlInput";
import { KVEditor } from "./KVEditor";
import { CodeArea } from "./CodeArea";
import { TitleName } from "./InlineRename";
import { Plug, Send, Unplug, WandSparkles, WrapText, ico } from "./Icon";

type Section = "message" | "params" | "headers" | "auth" | "settings";

interface Props {
  tab: Tab;
  grow: number;
  lookup: (name: string) => VarInfo;
  /** {{vars}} in the URL with no value */
  missing: string[];
  /** where the request lives, for the title row */
  path: string;
  /** Save and its state, shared with HTTP requests */
  saveControls: ReactNode;
  authEditor: ReactNode;
  /** switch the tab to another method */
  onKind: (method: string) => void;
}

/** The request side of a Socket.IO tab: server URL and namespace, Connect / Disconnect, the next emit and the settings. */
export function SioRequestPane({ tab, grow, lookup, missing, path, saveControls, authEditor, onKind }: Props) {
  const [section, setSection] = useState<Section>("message");
  const update = useStore((s) => s.updateRequest);
  const st = useStore.getState(); // actions only

  const req = tab.request;
  const def: SioDef = req.sio ?? defaultSio();
  const setDef = (patch: Partial<SioDef>) => update(tab.id, { sio: { ...def, ...patch } });
  const ex = tab.example;
  const busy = !!tab.inflightId;
  const open = busy && !!tab.ws?.handshake;
  const lock = !!ex || busy;

  const n = (count: number) => (count ? <span className="n">{count}</span> : null);
  const enabledParams = req.params.filter((p) => p.enabled && p.key).length;
  const enabledHeaders = req.headers.filter((h) => h.enabled && h.key).length;
  const changed = (def.eio !== 4 ? 1 : 0) + (def.path.trim() && def.path.trim() !== "/socket.io" ? 1 : 0) + (def.auth.trim() ? 1 : 0);
  const tabs: [Section, string, number][] = [
    ["message", "Message", 0],
    ["params", "Params", enabledParams],
    ["headers", "Headers", enabledHeaders],
    ["auth", "Auth", req.auth.type !== "none" ? 1 : 0],
    ["settings", "Settings", changed],
  ];

  return (
    <div className="req-pane" style={{ flexGrow: grow }}>
      <form
        className="request-line"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ex) busy ? st.closeSocket(tab.id) : st.openSocket(tab.id);
        }}
      >
        <div className={`url-field sio-field${busy ? " is-live" : ""}`}>
          <MethodMenu
            value="SIO"
            disabled={lock}
            className="method-pick m-SIO"
            title={busy ? "Disconnect to change the method" : undefined}
            onPick={onKind}
          >
            SIO
          </MethodMenu>
          <UrlInput
            lookup={lookup}
            aria-label="Server URL"
            spellCheck={false}
            autoFocus={!ex}
            readOnly={lock}
            title={busy ? "Disconnect to change the URL" : undefined}
            placeholder="https://example.com or {{socketUrl}}"
            value={req.url}
            onChange={(e) => update(tab.id, { url: e.target.value, params: paramsFromUrl(e.target.value, req.params) })}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (lock || !looksLikeCurl(text)) return;
              // a cURL command turns this tab back into an HTTP request
              e.preventDefault();
              const parsed = parseCurl(text);
              if (!parsed) return st.notify("Couldn’t find a URL in that cURL command");
              update(tab.id, parsed);
              st.notify("Imported from cURL");
            }}
          />
          <span className="gf-sep" aria-hidden="true" />
          <label className="ns-seg" title={busy ? "Disconnect to change the namespace" : "Empty or / takes the URL’s path, as socket.io-client does"}>
            <span className="ns-lbl">Namespace</span>
            <input
              aria-label="Namespace"
              spellCheck={false}
              placeholder="/"
              readOnly={lock}
              value={def.namespace}
              onChange={(e) => setDef({ namespace: e.target.value })}
            />
          </label>
        </div>

        {ex ? null : busy ? (
          <button type="submit" className="btn ws-disconnect" aria-busy={!open || undefined}>
            <Unplug {...ico} />
            {open ? "Disconnect" : "Cancel"}
          </button>
        ) : (
          <button type="submit" className="btn btn--primary ws-connect">
            <Plug {...ico} />
            Connect
          </button>
        )}
        {saveControls}
      </form>

      <div className="req-title">
        <TitleName tab={tab} />
        <span className="path">{path}</span>
        {missing.length > 0 && <span className="hint">Unresolved: {missing.map((m) => `{{${m}}}`).join(", ")}</span>}
      </div>

      <nav className="subtabs" aria-label="Request">
        {tabs.map(([s, label, count]) => (
          <button key={s} type="button" className="subtab" aria-pressed={section === s} onClick={() => setSection(s)}>
            {label}
            {n(count)}
          </button>
        ))}
      </nav>

      <div className="section">
        <fieldset className="ro" disabled={!!ex}>
          {section === "message" && <EmitEditor tab={tab} def={def} onChange={setDef} />}
          {section === "params" && (
            <KVEditor
              rows={req.params}
              addLabel="Add a param"
              onChange={(params) => update(tab.id, { params, url: urlWithParams(req.url, params) })}
            />
          )}
          {section === "headers" && (
            <>
              <KVEditor rows={req.headers} nameLabel="Header" addLabel="Add a header" onChange={(headers) => update(tab.id, { headers })} />
              <p className="kv-note">
                Sent with the WebSocket upgrade. <code>Host</code>, <code>Connection</code>, <code>Upgrade</code> and the{" "}
                <code>Sec-WebSocket-Key</code> / <code>-Version</code> pair are set by the handshake.
              </p>
            </>
          )}
          {section === "auth" && authEditor}
          {section === "settings" && <SettingsEditor def={def} onChange={setDef} />}
        </fieldset>
      </div>
    </div>
  );
}

// ---------- the next emit ----------

function EmitEditor({ tab, def, onChange }: { tab: Tab; def: SioDef; onChange: (patch: Partial<SioDef>) => void }) {
  const update = useStore((s) => s.updateRequest);
  const notify = useStore((s) => s.notify);
  const wrap = useStore((s) => s.settings.wrapRequestBody ?? false);
  const setSettings = useStore((s) => s.setSettings);
  const st = useStore.getState();
  const body = tab.request.body;
  const json = body.mode !== "text";
  const setFormat = (mode: "json" | "text") => update(tab.id, { body: { ...body, mode } });
  const w = tab.ws;
  const joined = !!tab.inflightId && w?.sio?.joinedMs !== undefined && !w.close;
  const joining = !!tab.inflightId && !joined;
  const listId = `ev-recent-${tab.id}`;

  // event names this connection has seen, newest first, for the name field's suggestions
  const recent = useMemo(() => {
    const names: string[] = [];
    const msgs = w?.messages ?? [];
    for (let i = msgs.length - 1; i >= 0 && names.length < 20; i--) {
      const e = msgs[i].event;
      if (e && !names.includes(e)) names.push(e);
    }
    return names;
  }, [w?.messages]);

  const beautify = () => {
    try {
      JSON.parse(stripJsonComments(body.raw));
      update(tab.id, { body: { ...body, raw: formatJsonc(body.raw) } });
    } catch (e) {
      notify(`Invalid JSON: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <div className="emit-head">
        <label className="lbl" htmlFor={`ev-${tab.id}`}>
          Event
        </label>
        <input
          id={`ev-${tab.id}`}
          className="ev-input"
          spellCheck={false}
          placeholder="event name"
          list={listId}
          value={def.event}
          onChange={(e) => onChange({ event: e.target.value })}
        />
        <datalist id={listId}>
          {recent.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <div className="seg" role="group" aria-label="Format">
          <button type="button" aria-pressed={!json} onClick={() => setFormat("text")}>
            Text
          </button>
          <button type="button" aria-pressed={json} onClick={() => setFormat("json")}>
            JSON
          </button>
        </div>
      </div>
      <CodeArea
        value={body.raw}
        json={json}
        label="Argument"
        onChange={(raw) => update(tab.id, { body: { ...body, raw } })}
        placeholder={json ? '{ "room": "lobby" }  (empty emits no argument)' : "Text argument; empty emits none"}
        wrap={wrap}
        tools={
          <>
            <button
              type="button"
              className="icon-btn"
              title={wrap ? "Don't wrap lines" : "Wrap lines"}
              aria-label="Wrap lines"
              aria-pressed={wrap}
              onClick={() => setSettings({ wrapRequestBody: !wrap })}
            >
              <WrapText {...ico} />
            </button>
            {json && (
              <button type="button" className="btn btn--quiet" onClick={beautify}>
                <WandSparkles {...ico} />
                Beautify
              </button>
            )}
          </>
        }
      />
      <div className="composer-bar">
        <button type="button" className="btn btn--primary" disabled={!joined} onClick={() => st.sendSocketMessage(tab.id)}>
          <Send {...ico} />
          Emit
        </button>
        <label className="ack-ctl">
          <input type="checkbox" className="switch" role="switch" checked={def.ack} onChange={(e) => onChange({ ack: e.target.checked })} />
          Wait for ack
        </label>
        {def.ack && (
          <label className="ack-ctl" title="0 waits as long as the socket is open">
            <input
              className="ack-ms"
              aria-label="Ack timeout in milliseconds"
              inputMode="numeric"
              value={def.ackTimeoutMs}
              onChange={(e) => onChange({ ackTimeoutMs: Math.max(0, Math.floor(Number(e.target.value.replace(/\D/g, "")) || 0)) })}
            />
            <span className="unit">ms</span>
          </label>
        )}
        {joined ? (
          <span className="hint-text push">
            <kbd>⌘</kbd> <kbd>Enter</kbd> emits
          </span>
        ) : joining ? (
          <span className="hint-text push">Joining the namespace…</span>
        ) : (
          <span className="hint-text push">Connect first, then emit events one by one.</span>
        )}
      </div>
    </>
  );
}

// ---------- settings ----------

function SettingsEditor({ def, onChange }: { def: SioDef; onChange: (patch: Partial<SioDef>) => void }) {
  return (
    <div className="set-list sio-settings">
      <div className="set-item">
        <div className="set-text">
          <span className="set-label" id="sio-ver">
            Server version
          </span>
          <span className="desc">Socket.IO 3 and 4 speak Engine.IO 4; Socket.IO 2 speaks Engine.IO 3.</span>
        </div>
        <div className="set-ctl">
          <div className="seg seg--lg" role="group" aria-labelledby="sio-ver">
            <button type="button" aria-pressed={def.eio === 4} onClick={() => onChange({ eio: 4 })}>
              Socket.IO 3 / 4
            </button>
            <button type="button" aria-pressed={def.eio === 3} onClick={() => onChange({ eio: 3 })}>
              Socket.IO 2
            </button>
          </div>
        </div>
      </div>
      <div className="set-item">
        <div className="set-text">
          <label className="set-label" htmlFor="sio-path">
            Path
          </label>
          <span className="desc">
            Where the server mounts Socket.IO; <code>/socket.io</code> unless it was changed.
          </span>
        </div>
        <div className="set-ctl">
          <input id="sio-path" className="field" spellCheck={false} placeholder="/socket.io" value={def.path} onChange={(e) => onChange({ path: e.target.value })} />
        </div>
      </div>
      <div className="set-item stack">
        <div className="set-text">
          <span className="set-label">Handshake auth</span>
          <span className="desc">
            {def.eio === 4 ? (
              <>
                Sent as <code>auth</code> when joining the namespace, where the server’s middleware reads it. Variables work here.
              </>
            ) : (
              <>Socket.IO 2 has no handshake auth, so this is not sent. Put tokens in Params or Headers.</>
            )}
          </span>
        </div>
        <CodeArea value={def.auth} json label="Handshake auth" placeholder='{ "token": "{{accessToken}}" }' onChange={(auth) => onChange({ auth })} />
      </div>
    </div>
  );
}
