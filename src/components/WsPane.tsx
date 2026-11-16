import { useState, type ReactNode } from "react";
import { useStore } from "../store";
import type { Tab, WsDef } from "../types";
import { defaultWs } from "../lib/ws";
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
  /** switch the tab to another method (HTTP or gRPC) */
  onKind: (method: string) => void;
}

/** The request side of a WebSocket tab: URL, Connect / Disconnect, the next message, handshake headers and settings. */
export function WsRequestPane({ tab, grow, lookup, missing, path, saveControls, authEditor, onKind }: Props) {
  const [section, setSection] = useState<Section>("message");
  const update = useStore((s) => s.updateRequest);
  const st = useStore.getState(); // actions only

  const req = tab.request;
  const def: WsDef = req.ws ?? defaultWs();
  const setDef = (patch: Partial<WsDef>) => update(tab.id, { ws: { ...def, ...patch } });
  const ex = tab.example;
  const busy = !!tab.inflightId;
  const open = busy && !!tab.ws?.handshake;

  const n = (count: number) => (count ? <span className="n">{count}</span> : null);
  const enabledParams = req.params.filter((p) => p.enabled && p.key).length;
  const enabledHeaders = req.headers.filter((h) => h.enabled && h.key).length;
  const tabs: [Section, string, number][] = [
    ["message", "Message", 0],
    ["params", "Params", enabledParams],
    ["headers", "Headers", enabledHeaders],
    ["auth", "Auth", req.auth.type !== "none" ? 1 : 0],
    ["settings", "Settings", def.subprotocols.length + (def.pingSec > 0 ? 1 : 0)],
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
        <div className={`url-field${busy ? " is-live" : ""}`}>
          <MethodMenu
            value="WS"
            disabled={!!ex || busy}
            className="method-pick m-WS"
            title={busy ? "Disconnect to change the method" : undefined}
            onPick={onKind}
          >
            WS
          </MethodMenu>
          <UrlInput
            lookup={lookup}
            aria-label="URL"
            spellCheck={false}
            autoFocus={!ex}
            readOnly={!!ex || busy}
            title={busy ? "Disconnect to change the URL" : undefined}
            placeholder="wss://echo.example.com/ws or {{wsUrl}}"
            value={req.url}
            onChange={(e) => update(tab.id, { url: e.target.value, params: paramsFromUrl(e.target.value, req.params) })}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (ex || busy || !looksLikeCurl(text)) return;
              // a cURL command turns this tab back into an HTTP request
              e.preventDefault();
              const parsed = parseCurl(text);
              if (!parsed) return st.notify("Couldn’t find a URL in that cURL command");
              update(tab.id, parsed);
              st.notify("Imported from cURL");
            }}
          />
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
          {section === "message" && <MessageEditor tab={tab} open={open} />}
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
                Sent with the upgrade request. <code>Host</code>, <code>Connection</code>, <code>Upgrade</code> and the{" "}
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

// ---------- message ----------

function MessageEditor({ tab, open }: { tab: Tab; open: boolean }) {
  const update = useStore((s) => s.updateRequest);
  const notify = useStore((s) => s.notify);
  const wrap = useStore((s) => s.settings.wrapRequestBody ?? false);
  const setSettings = useStore((s) => s.setSettings);
  const st = useStore.getState();
  const body = tab.request.body;
  const json = body.mode !== "text";
  const setFormat = (mode: "json" | "text") => update(tab.id, { body: { ...body, mode } });

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
      <div className="msg-head">
        <span className="lbl">Message</span>
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
        label="Message"
        onChange={(raw) => update(tab.id, { body: { ...body, raw } })}
        placeholder={json ? '{ "type": "ping" }' : "Text to send"}
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
        <button type="button" className="btn btn--primary" disabled={!open} onClick={() => st.sendSocketMessage(tab.id)}>
          <Send {...ico} />
          Send message
        </button>
        {open ? (
          <span className="hint-text">
            <kbd>⌘</kbd> <kbd>Enter</kbd> sends the message
          </span>
        ) : (
          <span className="hint-text">Connect first, then send messages one by one.</span>
        )}
      </div>
    </>
  );
}

// ---------- settings ----------

function SettingsEditor({ def, onChange }: { def: WsDef; onChange: (patch: Partial<WsDef>) => void }) {
  // typed as text, kept as a list: "graphql-ws, json"
  const [protocols, setProtocols] = useState(def.subprotocols.join(", "));
  return (
    <div className="set-list ws-settings">
      <div className="set-item">
        <div className="set-text">
          <label className="set-label" htmlFor="ws-protocols">
            Subprotocols
          </label>
          <span className="desc">
            Offered in <code>Sec-WebSocket-Protocol</code>, comma-separated. The server picks one.
          </span>
        </div>
        <div className="set-ctl">
          <input
            id="ws-protocols"
            className="field"
            spellCheck={false}
            placeholder="graphql-ws, json"
            value={protocols}
            onChange={(e) => {
              setProtocols(e.target.value);
              onChange({ subprotocols: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) });
            }}
          />
        </div>
      </div>
      <div className="set-item">
        <div className="set-text">
          <label className="set-label" htmlFor="ws-ping">
            Keep-alive ping
          </label>
          <span className="desc">Seconds between pings while connected; 0 sends none. Pongs are not listed.</span>
        </div>
        <div className="set-ctl">
          <input
            id="ws-ping"
            className="field ws-num"
            type="number"
            min={0}
            step={1}
            value={def.pingSec}
            onChange={(e) => onChange({ pingSec: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
          />
        </div>
      </div>
    </div>
  );
}
