import "./MqttPane.css";
import { useEffect, useState, type ReactNode } from "react";
import { useDismiss } from "./useDismiss";
import { useStore } from "../store";
import type { MqttDef, MqttQos, MqttSub, MqttWill, Tab } from "../types";
import { defaultMqtt, filterProblem, mqttSub, propCount, schemeLabel, transportOf } from "../lib/mqtt";
import { resolve } from "../lib/vars";
import { formatJsonc, stripJsonComments } from "../lib/jsonc";
import { MethodMenu } from "./MethodMenu";
import { UrlInput, type VarInfo } from "./UrlInput";
import { KVEditor } from "./KVEditor";
import { CodeArea } from "./CodeArea";
import { TitleName } from "./InlineRename";
import { CircleCheck, Ellipsis, Plug, Send, Unplug, WandSparkles, WrapText, X, ico } from "./Icon";

type Section = "message" | "topics" | "auth" | "will" | "settings";

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
  /** switch the tab to another method */
  onKind: (method: string) => void;
}

/** The request side of an MQTT tab: broker URL, Connect / Disconnect, the next message, the subscriptions, auth, Last Will and settings. */
export function MqttRequestPane({ tab, grow, lookup, missing, path, saveControls, onKind }: Props) {
  const [section, setSection] = useState<Section>("message");
  const update = useStore((s) => s.updateRequest);
  const st = useStore.getState(); // actions only

  const req = tab.request;
  const def: MqttDef = req.mqtt ?? defaultMqtt();
  const setDef = (patch: Partial<MqttDef>) => update(tab.id, { mqtt: { ...def, ...patch } });
  const ex = tab.example;
  const busy = !!tab.inflightId;
  const ready = busy && !!tab.ws?.mqtt?.conn && !tab.ws.close;
  const lock = !!ex || busy;

  // while connected, the Topics list is the broker's: an edit subscribes or unsubscribes shortly after
  const subsKey = JSON.stringify(def.subs.map((s) => [s.filter, s.qos, s.enabled, s.noLocal, s.retainAsPublished, s.retainHandling]));
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => useStore.getState().syncMqttSubs(tab.id), 400);
    return () => clearTimeout(t);
  }, [ready, subsKey, tab.id]);

  const n = (count: number) => (count ? <span className="n">{count}</span> : null);
  const d = defaultMqtt();
  const changed =
    (def.version !== d.version ? 1 : 0) +
    (def.clientId.trim() ? 1 : 0) +
    (def.cleanStart !== d.cleanStart ? 1 : 0) +
    (def.version === "5" && def.sessionExpiry > 0 ? 1 : 0) +
    (def.keepAlive !== d.keepAlive ? 1 : 0) +
    (def.keep !== d.keep ? 1 : 0);
  const tabs: [Section, string, ReactNode][] = [
    ["message", "Message", null],
    ["topics", "Topics", n(def.subs.filter((s) => s.enabled && s.filter.trim()).length)],
    ["auth", "Auth", n(def.username ? 1 : 0)],
    ["will", "Last Will", def.will.enabled ? <span className="mq-has" aria-label="on" /> : null],
    ["settings", "Settings", n(changed)],
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
        <div className={`url-field mqtt-field${busy ? " is-live" : ""}`}>
          <MethodMenu value="MQTT" disabled={lock} className="method-pick m-MQTT" title={busy ? "Disconnect to change the method" : undefined} onPick={onKind}>
            MQTT
          </MethodMenu>
          <UrlInput
            lookup={lookup}
            aria-label="Broker URL"
            spellCheck={false}
            autoFocus={!ex}
            readOnly={lock}
            title={busy ? "Disconnect to change the broker" : "mqtt:// TCP · mqtts:// TCP + TLS · ws:// WebSocket · wss:// WebSocket + TLS"}
            placeholder="mqtt://broker.example.com:1883 or {{mqttBroker}}"
            value={req.url}
            onChange={(e) => update(tab.id, { url: e.target.value })}
          />
          <SchemeChip url={req.url} version={def.version} tab={tab} />
        </div>

        {ex ? null : busy ? (
          <button type="submit" className="btn ws-disconnect" aria-busy={!ready || undefined}>
            <Unplug {...ico} />
            {ready ? "Disconnect" : "Cancel"}
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
        {tabs.map(([s, label, badge]) => (
          <button key={s} type="button" className="subtab" aria-pressed={section === s} onClick={() => setSection(s)}>
            {label}
            {badge}
          </button>
        ))}
      </nav>

      <div className="section">
        <fieldset className="ro" disabled={!!ex}>
          {section === "message" && <MessageEditor tab={tab} def={def} onChange={setDef} />}
          {section === "topics" && <TopicsEditor tab={tab} def={def} onChange={setDef} />}
          {section === "auth" && <AuthEditor tab={tab} def={def} onChange={setDef} />}
          {section === "will" && <WillEditor def={def} onChange={setDef} />}
          {section === "settings" && <SettingsEditor def={def} onChange={setDef} />}
        </fieldset>
      </div>
    </div>
  );
}

/** "MQTT 5 · TLS": the version, and the transport the URL's scheme picks. */
function SchemeChip({ url, version, tab }: { url: string; version: MqttDef["version"]; tab: Tab }) {
  const resolved = resolve(url, useStore.getState().scopeFor(tab.id));
  const known = transportOf(resolved) !== null;
  return (
    <span
      className={`mq-scheme${known ? "" : " bad"}`}
      title={known ? "From the URL: mqtt:// TCP, mqtts:// TCP + TLS, ws:// WebSocket, wss:// WebSocket + TLS" : "Use mqtt://, mqtts://, ws:// or wss://"}
    >
      {known ? schemeLabel(resolved, version) : "Unknown scheme"}
    </span>
  );
}

// ---------- small controls ----------

function QosSeg({ value, onChange, label = "QoS", lg }: { value: MqttQos; onChange: (q: MqttQos) => void; label?: string; lg?: boolean }) {
  return (
    <div className={`seg${lg ? " seg--lg" : ""}`} role="group" aria-label={label} title="0 at most once · 1 at least once · 2 exactly once">
      {([0, 1, 2] as MqttQos[]).map((q) => (
        <button key={q} type="button" aria-pressed={value === q} onClick={() => onChange(q)}>
          {q}
        </button>
      ))}
    </div>
  );
}

/** A whole number typed freely, kept when the field loses focus. Empty = `empty` (null for "never"). */
function NumField({
  id,
  value,
  onChange,
  min = 0,
  max = 4_294_967_295,
  placeholder,
  disabled,
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => setText(value === null ? "" : String(value)), [value]);
  return (
    <input
      id={id}
      className="field mono narrow"
      inputMode="numeric"
      placeholder={placeholder}
      disabled={disabled}
      value={text}
      onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
      onBlur={() => {
        const v = text.trim() === "" ? (placeholder ? null : min) : Math.min(max, Math.max(min, Math.floor(Number(text))));
        setText(v === null ? "" : String(v));
        if (v !== value) onChange(v);
      }}
    />
  );
}

// ---------- message ----------

function MessageEditor({ tab, def, onChange }: { tab: Tab; def: MqttDef; onChange: (patch: Partial<MqttDef>) => void }) {
  const [part, setPart] = useState<"payload" | "props">("payload");
  const update = useStore((s) => s.updateRequest);
  const notify = useStore((s) => s.notify);
  const wrap = useStore((s) => s.settings.wrapRequestBody ?? false);
  const setSettings = useStore((s) => s.setSettings);
  const st = useStore.getState();
  const body = tab.request.body;
  const json = body.mode !== "text";
  const v5 = def.version === "5";
  const w = tab.ws;
  const ready = !!tab.inflightId && !!w?.mqtt?.conn && !w.close;
  const connecting = !!tab.inflightId && !ready;
  const props = propCount(tab.request);
  const showProps = part === "props" && v5;

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
      <div className="mq-head">
        <label className="lbl" htmlFor={`mq-topic-${tab.id}`}>
          Topic
        </label>
        <input
          id={`mq-topic-${tab.id}`}
          className="ev-input"
          spellCheck={false}
          placeholder="devices/42/cmd"
          value={def.topic}
          onChange={(e) => onChange({ topic: e.target.value })}
        />
        <span className="lbl gap">QoS</span>
        <QosSeg value={def.qos} onChange={(qos) => onChange({ qos })} />
        <label className="mq-check gap" title="The broker keeps the last retained message of a topic and hands it to new subscribers">
          <input type="checkbox" className="switch" role="switch" checked={def.retain} onChange={(e) => onChange({ retain: e.target.checked })} />
          Retain
        </label>
        <div className="seg push" role="group" aria-label="Part">
          <button type="button" aria-pressed={!showProps} onClick={() => setPart("payload")}>
            Payload
          </button>
          <button type="button" aria-pressed={showProps} disabled={!v5} title={v5 ? "MQTT 5 publish properties" : "MQTT 5 only: switch the version in Settings"} onClick={() => setPart("props")}>
            Properties
            {v5 && props > 0 && <span className="mq-has" aria-label="has properties" />}
          </button>
        </div>
      </div>

      {showProps ? (
        <PropsEditor tab={tab} def={def} onChange={onChange} />
      ) : (
        <CodeArea
          value={body.raw}
          json={json}
          label="Payload"
          onChange={(raw) => update(tab.id, { body: { ...body, raw } })}
          placeholder={json ? '{ "reason": "cash_jam" }' : "Text payload"}
          wrap={wrap}
          tools={
            <>
              <div className="seg" role="group" aria-label="Format">
                <button type="button" aria-pressed={!json} onClick={() => update(tab.id, { body: { ...body, mode: "text" } })}>
                  Text
                </button>
                <button type="button" aria-pressed={json} onClick={() => update(tab.id, { body: { ...body, mode: "json" } })}>
                  JSON
                </button>
              </div>
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
      )}
      <div className="composer-bar">
        <button type="button" className="btn btn--primary" disabled={!ready} onClick={() => st.sendSocketMessage(tab.id)}>
          <Send {...ico} />
          Publish
        </button>
        {ready ? (
          <span className="hint-text push">
            <kbd>⌘</kbd> <kbd>Enter</kbd> publishes to <code>{resolve(def.topic, st.scopeFor(tab.id)).trim() || "…"}</code>
          </span>
        ) : connecting ? (
          <span className="hint-text push">Connecting to the broker…</span>
        ) : (
          <span className="hint-text push">Connect first, then publish. Subscriptions live in Topics.</span>
        )}
      </div>
    </>
  );
}

/** MQTT 5 publish properties: a row list, then user properties as key/value rows (the request's headers). */
function PropsEditor({ tab, def, onChange }: { tab: Tab; def: MqttDef; onChange: (patch: Partial<MqttDef>) => void }) {
  const update = useStore((s) => s.updateRequest);
  return (
    <>
      <div className="set-list sio-settings mq-props">
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="p-ct">
              Content type
            </label>
            <span className="desc">Any string the subscriber understands, usually a MIME type.</span>
          </div>
          <div className="set-ctl">
            <input id="p-ct" className="field mono" spellCheck={false} placeholder="application/json" value={def.contentType} onChange={(e) => onChange({ contentType: e.target.value })} />
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <span className="set-label" id="p-pf">
              Payload format
            </span>
            <span className="desc">UTF-8 tells the broker and subscribers the payload is text.</span>
          </div>
          <div className="set-ctl">
            <div className="seg seg--lg" role="group" aria-labelledby="p-pf">
              <button type="button" aria-pressed={!def.utf8} onClick={() => onChange({ utf8: false })}>
                Bytes
              </button>
              <button type="button" aria-pressed={def.utf8} onClick={() => onChange({ utf8: true })}>
                UTF-8
              </button>
            </div>
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="p-rt">
              Response topic
            </label>
            <span className="desc">Where the receiver should answer. Subscribe to it in Topics to see the reply.</span>
          </div>
          <div className="set-ctl">
            <input id="p-rt" className="field mono" spellCheck={false} placeholder="devices/42/cmd/reply" value={def.responseTopic} onChange={(e) => onChange({ responseTopic: e.target.value })} />
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="p-cd">
              Correlation data
            </label>
            <span className="desc">Echoed back with the reply, so you can match the two.</span>
          </div>
          <div className="set-ctl">
            <input id="p-cd" className="field mono" spellCheck={false} placeholder="{{$guid}}" value={def.correlation} onChange={(e) => onChange({ correlation: e.target.value })} />
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="p-exp">
              Message expiry
            </label>
            <span className="desc">The broker drops the message if nobody took it in time. Empty = never.</span>
          </div>
          <div className="set-ctl">
            <NumField id="p-exp" value={def.messageExpiry} min={1} placeholder="never" onChange={(messageExpiry) => onChange({ messageExpiry })} />
            <span className="unit">seconds</span>
          </div>
        </div>
      </div>
      <p className="mq-sub-h">User properties</p>
      <KVEditor rows={tab.request.headers} nameLabel="Name" addLabel="Add a user property" onChange={(headers) => update(tab.id, { headers })} />
    </>
  );
}

// ---------- topics ----------

function TopicsEditor({ tab, def, onChange }: { tab: Tab; def: MqttDef; onChange: (patch: Partial<MqttDef>) => void }) {
  const [draft, setDraft] = useState("");
  const scope = useStore.getState().scopeFor(tab.id);
  const w = tab.ws;
  const ready = !!tab.inflightId && !!w?.mqtt?.conn && !w.close;
  const v5 = def.version === "5";
  const setSub = (id: string, patch: Partial<MqttSub>) => onChange({ subs: def.subs.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const add = () => {
    const f = draft.trim();
    if (!f) return;
    onChange({ subs: [...def.subs, mqttSub(f, def.subs[def.subs.length - 1]?.qos ?? 0)] });
    setDraft("");
  };

  const state = (s: MqttSub): ReactNode => {
    const filter = resolve(s.filter, scope).trim();
    if (!filter) return null;
    if (!s.enabled) return <span className="dim">Off</span>;
    const local = filterProblem(filter);
    if (local) return <span className="fail" title={local}>{local}</span>;
    if (!ready) return null;
    const got = w!.mqtt!.subs[filter];
    if (!got || got.qos !== s.qos) return <span className="dim">Subscribing…</span>;
    if (got.error)
      return (
        <span className="fail" title={got.error}>
          {got.error}
        </span>
      );
    return (
      <>
        <span className="ok">Granted QoS {got.granted}</span>
        {got.granted !== undefined && got.granted < got.qos && <span className="dim"> · asked {got.qos}</span>}
      </>
    );
  };

  return (
    <>
      <table className="kv subs">
        <thead>
          <tr>
            <th className="check">
              <span className="visually-hidden">Subscribed</span>
            </th>
            <th>Topic filter</th>
            <th className="qos-cell">QoS</th>
            <th className="state-cell">{ready ? "Broker" : ""}</th>
            <th className="opt-cell">
              <span className="visually-hidden">Options</span>
            </th>
            <th className="del">
              <span className="visually-hidden">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {def.subs.map((s) => {
            const st = state(s);
            const denied = ready && s.enabled && !!w!.mqtt!.subs[resolve(s.filter, scope).trim()]?.error;
            return (
              <tr key={s.id} className={!s.enabled ? "off" : denied ? "denied" : ""}>
                <td className="check">
                  <input type="checkbox" checked={s.enabled} aria-label={`Subscribe to ${s.filter}`} onChange={(e) => setSub(s.id, { enabled: e.target.checked })} />
                </td>
                <td>
                  <FilterInput value={s.filter} onCommit={(filter) => setSub(s.id, { filter })} />
                </td>
                <td className="qos-cell">
                  <QosSeg value={s.qos} onChange={(qos) => setSub(s.id, { qos })} />
                </td>
                <td className="state-cell">{st}</td>
                <td className="opt-cell">{v5 && <SubOptions sub={s} onChange={(patch) => setSub(s.id, patch)} />}</td>
                <td className="del">
                  <button type="button" className="icon-btn" aria-label={`Remove ${s.filter}`} title="Remove" onClick={() => onChange({ subs: def.subs.filter((x) => x.id !== s.id) })}>
                    <X {...ico} />
                  </button>
                </td>
              </tr>
            );
          })}
          <tr className="add">
            <td className="check" />
            <td>
              <input
                className="field"
                spellCheck={false}
                placeholder="Add a topic filter, e.g. sensors/+/temp"
                aria-label="Add a topic filter"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
                onBlur={add}
              />
            </td>
            <td className="qos-cell" />
            <td className="state-cell" />
            <td className="opt-cell" />
            <td className="del" />
          </tr>
        </tbody>
      </table>
      <div className="subs-foot">
        <span className="hint-text">
          {ready ? "Changes apply at once while connected. " : "Connect subscribes to every row that's on. "}
          <code>+</code> matches one level, <code>#</code> the rest. {v5 && <><code>$share/group/…</code> shares messages with other clients in the group.</>}
        </span>
      </div>
    </>
  );
}

/** A topic filter, kept on Enter or when the field loses focus (Escape goes back), so a half-typed filter is never subscribed. */
function FilterInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    if (text !== value) onCommit(text);
  };
  return (
    <input
      className="field"
      spellCheck={false}
      aria-label="Topic filter"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") setText(value);
      }}
    />
  );
}

/** MQTT 5 options of one subscription, behind its "…". */
function SubOptions({ sub, onChange }: { sub: MqttSub; onChange: (patch: Partial<MqttSub>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const set = sub.noLocal || sub.retainAsPublished || sub.retainHandling !== 0;
  return (
    <div className="opt-wrap" ref={ref}>
      <button
        type="button"
        className={`icon-btn${set ? " on" : ""}`}
        aria-label={`Options for ${sub.filter}`}
        title={set ? "MQTT 5 options (changed)" : "MQTT 5 options"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Ellipsis {...ico} />
      </button>
      {open && (
        <div className="menu sub-menu" role="menu" aria-label="Subscription options">
          <label className="opt">
            <span>
              <span className="t">No local</span>
              <span className="d">Skip messages this connection published itself</span>
            </span>
            <input type="checkbox" className="switch" role="switch" checked={sub.noLocal} onChange={(e) => onChange({ noLocal: e.target.checked })} />
          </label>
          <label className="opt">
            <span>
              <span className="t">Retain as published</span>
              <span className="d">Keep the retain flag the publisher set</span>
            </span>
            <input type="checkbox" className="switch" role="switch" checked={sub.retainAsPublished} onChange={(e) => onChange({ retainAsPublished: e.target.checked })} />
          </label>
          <hr />
          <div className="opt">
            <span>
              <span className="t">Retained messages</span>
              <span className="d">What the broker sends right after subscribing</span>
            </span>
            <div className="seg" role="group" aria-label="Retained messages">
              {(
                [
                  [0, "Send"],
                  [1, "If new"],
                  [2, "Never"],
                ] as [MqttSub["retainHandling"], string][]
              ).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={sub.retainHandling === v} onClick={() => onChange({ retainHandling: v })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <p className="menu-note">MQTT 5 only. A change subscribes again.</p>
        </div>
      )}
    </div>
  );
}

// ---------- auth ----------

function AuthEditor({ tab, def, onChange }: { tab: Tab; def: MqttDef; onChange: (patch: Partial<MqttDef>) => void }) {
  const t = transportOf(resolve(tab.request.url, useStore.getState().scopeFor(tab.id)));
  return (
    <>
      <div className="set-list sio-settings mq-settings">
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="mq-user">
              Username
            </label>
            <span className="desc">Leave both empty for a broker without login.</span>
          </div>
          <div className="set-ctl">
            <input id="mq-user" className="field mono" spellCheck={false} placeholder="{{mqttUser}}" value={def.username} onChange={(e) => onChange({ username: e.target.value })} />
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="mq-pass">
              Password
            </label>
            <span className="desc">Use a variable so the password stays out of exports.</span>
          </div>
          <div className="set-ctl">
            <input
              id="mq-pass"
              className="field mono"
              spellCheck={false}
              type={def.password.startsWith("{{") ? "text" : "password"}
              placeholder="{{mqttPassword}}"
              value={def.password}
              onChange={(e) => onChange({ password: e.target.value })}
            />
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <span className="set-label">TLS</span>
            <span className="desc">
              {t?.tls ? "On: " : "Off: "}
              the URL starts with <code>{t?.tls ? (t.ws ? "wss://" : "mqtts://") : t?.ws ? "ws://" : "mqtt://"}</code>. For TLS use <code>mqtts://</code> or <code>wss://</code>. CA and client certificates (mTLS, as
              AWS IoT Core needs) come from Settings › Certificates.
            </span>
          </div>
          <div className="set-ctl">{t?.tls ? <CircleCheck {...ico} className="ico ok-ico" /> : <span className="unit">Off</span>}</div>
        </div>
      </div>
      <p className="k-foot">Not built yet: MQTT 5 enhanced authentication (AUTH packets, e.g. SCRAM or Kerberos).</p>
    </>
  );
}

// ---------- last will ----------

function WillEditor({ def, onChange }: { def: MqttDef; onChange: (patch: Partial<MqttDef>) => void }) {
  const w = def.will;
  const set = (patch: Partial<MqttWill>) => onChange({ will: { ...w, ...patch } });
  const wrap = useStore((s) => s.settings.wrapRequestBody ?? false);
  const notify = useStore((s) => s.notify);
  const v5 = def.version === "5";
  const off = !w.enabled;
  const beautify = () => {
    try {
      JSON.parse(stripJsonComments(w.payload));
      set({ payload: formatJsonc(w.payload) });
    } catch (e) {
      notify(`Invalid JSON: ${(e as Error).message}`);
    }
  };
  return (
    <>
      <div className="set-list sio-settings mq-settings">
        <div className="set-item">
          <div className="set-text">
            <span className="set-label" id="w-on">
              Send a Last Will
            </span>
            <span className="desc">If voidHTTP drops off without Disconnect, the broker publishes this message for you.</span>
          </div>
          <div className="set-ctl">
            <input type="checkbox" className="switch" role="switch" aria-labelledby="w-on" checked={w.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          </div>
        </div>
        <div className={`set-item${off ? " off" : ""}`}>
          <div className="set-text">
            <label className="set-label" htmlFor="w-topic">
              Topic
            </label>
          </div>
          <div className="set-ctl">
            <input id="w-topic" className="field mono" spellCheck={false} disabled={off} placeholder="devices/42/status" value={w.topic} onChange={(e) => set({ topic: e.target.value })} />
          </div>
        </div>
        <div className={`set-item${off ? " off" : ""}`}>
          <div className="set-text">
            <span className="set-label">QoS</span>
          </div>
          <div className="set-ctl">
            <QosSeg value={w.qos} lg label="Last Will QoS" onChange={(qos) => set({ qos })} />
          </div>
        </div>
        <div className={`set-item${off ? " off" : ""}`}>
          <div className="set-text">
            <span className="set-label" id="w-ret">
              Retain
            </span>
            <span className="desc">Late subscribers still see the will.</span>
          </div>
          <div className="set-ctl">
            <input type="checkbox" className="switch" role="switch" aria-labelledby="w-ret" disabled={off} checked={w.retain} onChange={(e) => set({ retain: e.target.checked })} />
          </div>
        </div>
        <div className={`set-item${off || !v5 ? " off" : ""}`}>
          <div className="set-text">
            <label className="set-label" htmlFor="w-delay">
              Will delay <span className="v5">MQTT 5</span>
            </label>
            <span className="desc">Wait this long before publishing; a quick reconnect cancels it.</span>
          </div>
          <div className="set-ctl">
            <NumField id="w-delay" value={w.delay} disabled={off || !v5} onChange={(v) => set({ delay: v ?? 0 })} />
            <span className="unit">seconds</span>
          </div>
        </div>
      </div>
      <div className={`mq-head${off ? " off" : ""}`}>
        <span className="lbl">Will message</span>
        <div className="seg push" role="group" aria-label="Format">
          <button type="button" aria-pressed={!w.json} onClick={() => set({ json: false })}>
            Text
          </button>
          <button type="button" aria-pressed={w.json} onClick={() => set({ json: true })}>
            JSON
          </button>
        </div>
      </div>
      <div className={off ? "mq-off" : undefined}>
        <CodeArea
          value={w.payload}
          json={w.json}
          label="Will message"
          onChange={(payload) => set({ payload })}
          placeholder={w.json ? '{ "state": "OFFLINE" }' : "Text message"}
          wrap={wrap}
          tools={
            w.json ? (
              <button type="button" className="btn btn--quiet" onClick={beautify}>
                <WandSparkles {...ico} />
                Beautify
              </button>
            ) : undefined
          }
        />
      </div>
    </>
  );
}

// ---------- settings ----------

function SettingsEditor({ def, onChange }: { def: MqttDef; onChange: (patch: Partial<MqttDef>) => void }) {
  const v5 = def.version === "5";
  return (
    <>
      <div className="set-list sio-settings mq-settings">
        <div className="set-item">
          <div className="set-text">
            <span className="set-label" id="s-ver">
              MQTT version
            </span>
            <span className="desc">3.1.1 has no publish properties and no MQTT 5 topic options.</span>
          </div>
          <div className="set-ctl">
            <div className="seg seg--lg" role="group" aria-labelledby="s-ver">
              {(["5", "3.1.1"] as MqttDef["version"][]).map((v) => (
                <button key={v} type="button" aria-pressed={def.version === v} onClick={() => onChange({ version: v })}>
                  {v === "5" ? "5.0" : v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="s-cid">
              Client ID
            </label>
            <span className="desc">Two clients with the same ID kick each other off. Empty = a new random ID on every Connect.</span>
          </div>
          <div className="set-ctl">
            <input id="s-cid" className="field mono" spellCheck={false} placeholder="random: voidhttp + 10 hex digits" value={def.clientId} onChange={(e) => onChange({ clientId: e.target.value })} />
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <span className="set-label" id="s-clean">
              Clean start
            </span>
            <span className="desc">Start fresh: the broker forgets old subscriptions and drops messages it queued for this client ID.</span>
          </div>
          <div className="set-ctl">
            <input type="checkbox" className="switch" role="switch" aria-labelledby="s-clean" checked={def.cleanStart} onChange={(e) => onChange({ cleanStart: e.target.checked })} />
          </div>
        </div>
        <div className={`set-item${v5 ? "" : " off"}`}>
          <div className="set-text">
            <label className="set-label" htmlFor="s-exp">
              Session expiry <span className="v5">MQTT 5</span>
            </label>
            <span className="desc">How long the broker keeps the session after you disconnect. 0 = ends with the connection.</span>
          </div>
          <div className="set-ctl">
            <NumField id="s-exp" value={def.sessionExpiry} disabled={!v5} onChange={(v) => onChange({ sessionExpiry: v ?? 0 })} />
            <span className="unit">seconds</span>
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="s-ka">
              Keep alive
            </label>
            <span className="desc">voidHTTP pings the broker this often when nothing else is sent. 0 = never.</span>
          </div>
          <div className="set-ctl">
            <NumField id="s-ka" value={def.keepAlive} max={65_535} onChange={(v) => onChange({ keepAlive: v ?? 0 })} />
            <span className="unit">seconds</span>
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="s-keep">
              Keep in the list
            </label>
            <span className="desc">Older messages drop off the list. Nothing changes on the broker.</span>
          </div>
          <div className="set-ctl">
            <NumField id="s-keep" value={def.keep} min={50} max={100_000} onChange={(v) => onChange({ keep: v ?? 1000 })} />
            <span className="unit">messages</span>
          </div>
        </div>
      </div>
      <p className="k-foot">
        WebSocket brokers: put the path in the URL, e.g. <code>wss://broker.example.com/mqtt</code>; without a path voidHTTP uses <code>/mqtt</code>. Not built yet: MQTT 3.1 (protocol
        level 3), topic aliases.
      </p>
    </>
  );
}
