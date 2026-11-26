import "./KafkaPane.css";
import { useEffect, useState, type ReactNode } from "react";
import { useDismiss } from "./useDismiss";
import { useStore } from "../store";
import type { KafkaDef, Tab } from "../types";
import { KEY_TYPES, defaultKafka } from "../lib/kafka";
import { formatJsonc, stripJsonComments } from "../lib/jsonc";
import { MethodMenu } from "./MethodMenu";
import { UrlInput, type VarInfo } from "./UrlInput";
import { KVEditor } from "./KVEditor";
import { CodeArea } from "./CodeArea";
import { TitleName } from "./InlineRename";
import { Check, ChevronDown, Plug, Send, Unplug, WandSparkles, WrapText, ico } from "./Icon";

type Section = "message" | "headers" | "auth" | "settings";

interface Props {
  tab: Tab;
  grow: number;
  lookup: (name: string) => VarInfo;
  /** {{vars}} in the brokers with no value */
  missing: string[];
  /** where the request lives, for the title row */
  path: string;
  /** Save and its state, shared with HTTP requests */
  saveControls: ReactNode;
  /** switch the tab to another method */
  onKind: (method: string) => void;
}

/** The request side of a Kafka tab: brokers and topic, Connect / Disconnect, the next record, auth and settings. */
export function KafkaRequestPane({ tab, grow, lookup, missing, path, saveControls, onKind }: Props) {
  const [section, setSection] = useState<Section>("message");
  const update = useStore((s) => s.updateRequest);
  const st = useStore.getState(); // actions only

  const req = tab.request;
  const def: KafkaDef = req.kafka ?? defaultKafka();
  const setDef = (patch: Partial<KafkaDef>) => update(tab.id, { kafka: { ...def, ...patch } });
  const ex = tab.example;
  const busy = !!tab.inflightId;
  const ready = busy && !!tab.ws?.kafka?.cluster;
  const lock = !!ex || busy;
  const topics = tab.ws?.kafka?.cluster?.topics ?? tab.ws?.kafka?.failed?.topics ?? [];
  const listId = `kafka-topics-${tab.id}`;

  const n = (count: number) => (count ? <span className="n">{count}</span> : null);
  const enabledHeaders = req.headers.filter((h) => h.enabled && h.key).length;
  const d = defaultKafka();
  const changed =
    (def.clientId.trim() && def.clientId.trim() !== d.clientId ? 1 : 0) +
    (def.from !== d.from ? 1 : 0) +
    (def.acks !== d.acks ? 1 : 0) +
    (def.compression !== d.compression ? 1 : 0) +
    (def.keep !== d.keep ? 1 : 0);
  const tabs: [Section, string, number][] = [
    ["message", "Message", 0],
    ["headers", "Headers", enabledHeaders],
    ["auth", "Auth", (def.sasl !== "none" ? 1 : 0) + (def.tls ? 1 : 0)],
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
        <div className={`url-field kafka-field${busy ? " is-live" : ""}`}>
          <MethodMenu
            value="KAFKA"
            disabled={lock}
            className="method-pick m-KAFKA"
            title={busy ? "Disconnect to change the method" : undefined}
            onPick={onKind}
          >
            KAFKA
          </MethodMenu>
          <UrlInput
            lookup={lookup}
            aria-label="Bootstrap brokers"
            spellCheck={false}
            autoFocus={!ex}
            readOnly={lock}
            title={busy ? "Disconnect to change the brokers" : "Bootstrap brokers, host:port, separated by commas"}
            placeholder="broker-1:9092, broker-2:9092 or {{kafkaBrokers}}"
            value={req.url}
            onChange={(e) => update(tab.id, { url: e.target.value })}
          />
          <span className="gf-sep" aria-hidden="true" />
          <label className="ns-seg" title={busy ? "Disconnect to change the topic" : undefined}>
            <span className="ns-lbl">Topic</span>
            <input
              aria-label="Topic"
              spellCheck={false}
              placeholder="topic name"
              readOnly={lock}
              list={listId}
              value={def.topic}
              onChange={(e) => setDef({ topic: e.target.value })}
            />
          </label>
          <datalist id={listId}>
            {topics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
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
        {tabs.map(([s, label, count]) => (
          <button key={s} type="button" className="subtab" aria-pressed={section === s} onClick={() => setSection(s)}>
            {label}
            {n(count)}
          </button>
        ))}
      </nav>

      <div className="section">
        <fieldset className="ro" disabled={!!ex}>
          {section === "message" && <RecordEditor tab={tab} def={def} onChange={setDef} />}
          {section === "headers" && (
            <>
              <KVEditor rows={req.headers} nameLabel="Header" addLabel="Add a header" onChange={(headers) => update(tab.id, { headers })} />
              <p className="kv-note">Record headers, sent with each produced record. Variables work here.</p>
            </>
          )}
          {section === "auth" && <AuthEditor def={def} onChange={setDef} />}
          {section === "settings" && <SettingsEditor def={def} onChange={setDef} />}
        </fieldset>
      </div>
    </div>
  );
}

// ---------- the next record ----------

function RecordEditor({ tab, def, onChange }: { tab: Tab; def: KafkaDef; onChange: (patch: Partial<KafkaDef>) => void }) {
  const update = useStore((s) => s.updateRequest);
  const notify = useStore((s) => s.notify);
  const wrap = useStore((s) => s.settings.wrapRequestBody ?? false);
  const setSettings = useStore((s) => s.setSettings);
  const st = useStore.getState();
  const body = tab.request.body;
  const json = body.mode !== "text";
  const setFormat = (mode: "json" | "text") => update(tab.id, { body: { ...body, mode } });
  const w = tab.ws;
  const ready = !!tab.inflightId && !!w?.kafka?.cluster && !w.close;
  const connecting = !!tab.inflightId && !ready;
  const partitions = w?.kafka?.cluster?.partitions.map((p) => p.partition) ?? [];

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
        <label className="lbl" htmlFor={`key-${tab.id}`}>
          Key
        </label>
        <div className="kkey">
          <input
            id={`key-${tab.id}`}
            className="kkey-input"
            spellCheck={false}
            placeholder={def.keyType === "string" ? "no key" : def.keyType === "hex" ? "00000000000004d2" : def.keyType === "base64" ? "AAAAAAAABNI=" : '{"id": 7}'}
            value={def.key}
            onChange={(e) => onChange({ key: e.target.value })}
          />
          <KeyTypePicker value={def.keyType} onChange={(keyType) => onChange({ keyType })} />
        </div>
        <span className="lbl gap">Partition</span>
        <PartitionPicker value={def.partition} partitions={partitions} onChange={(partition) => onChange({ partition })} />
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
        label="Record value"
        onChange={(raw) => update(tab.id, { body: { ...body, raw } })}
        placeholder={json ? '{ "transfer_id": "trf_77a0c3" }' : "Text value"}
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
        <button type="button" className="btn btn--primary" disabled={!ready} onClick={() => st.sendSocketMessage(tab.id)}>
          <Send {...ico} />
          Produce
        </button>
        {ready ? (
          <span className="hint-text push">
            <kbd>⌘</kbd> <kbd>Enter</kbd> produces to <code>{w!.kafka!.topic}</code>
          </span>
        ) : connecting ? (
          <span className="hint-text push">Connecting to the cluster…</span>
        ) : (
          <span className="hint-text push">Connect first, then produce records one by one.</span>
        )}
      </div>
    </>
  );
}

/** String / JSON / Base64 / Hex, at the end of the Key field. */
function KeyTypePicker({ value, onChange }: { value: KafkaDef["keyType"]; onChange: (v: KafkaDef["keyType"]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const label = KEY_TYPES.find(([v]) => v === value)?.[1] ?? "String";
  return (
    <div className="kkey-type-wrap" ref={ref}>
      <button type="button" className="kkey-type" aria-haspopup="menu" aria-expanded={open} title="How the key becomes bytes" onClick={() => setOpen(!open)}>
        {label}
        <ChevronDown {...ico} />
      </button>
      {open && (
        <div className="menu kkey-menu" role="menu" aria-label="Key type">
          {KEY_TYPES.map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="menuitemradio"
              aria-checked={v === value}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
            >
              {v === value ? <Check {...ico} /> : <span className="tick-gap" />}
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Auto, or one partition: the topic's partitions once connected, a number before that. */
function PartitionPicker({ value, partitions, onChange }: { value: number | null; partitions: number[]; onChange: (v: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const ref = useDismiss(open, () => setOpen(false));
  const pick = (v: number | null) => {
    onChange(v);
    setOpen(false);
  };
  return (
    <div className="kpart-wrap" ref={ref}>
      <button
        type="button"
        className="kpart-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        title={value === null ? "Auto: the key picks the partition, as Kafka's Java client does; round robin without a key" : `Partition ${value}`}
        onClick={() => setOpen(!open)}
      >
        {value === null ? "Auto" : value}
        <ChevronDown {...ico} />
      </button>
      {open && (
        <div className="menu kpart-menu" role="menu" aria-label="Partition">
          <button type="button" role="menuitemradio" aria-checked={value === null} onClick={() => pick(null)}>
            {value === null ? <Check {...ico} /> : <span className="tick-gap" />}
            Auto
            <span className="sub">from the key</span>
          </button>
          {partitions.length > 0 && <hr />}
          {partitions.map((p) => (
            <button key={p} type="button" role="menuitemradio" aria-checked={value === p} onClick={() => pick(p)}>
              {value === p ? <Check {...ico} /> : <span className="tick-gap" />}
              Partition {p}
            </button>
          ))}
          {partitions.length === 0 && (
            <form
              className="menu-form"
              onSubmit={(e) => {
                e.preventDefault();
                const v = Number(typed);
                if (typed.trim() && Number.isInteger(v) && v >= 0) pick(v);
              }}
            >
              <input className="field" inputMode="numeric" placeholder="Partition number" aria-label="Partition number" value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))} />
              <p className="menu-note">Connect to list the topic’s partitions.</p>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- auth ----------

function AuthEditor({ def, onChange }: { def: KafkaDef; onChange: (patch: Partial<KafkaDef>) => void }) {
  const sasl = def.sasl !== "none";
  return (
    <>
      <div className="set-list sio-settings kafka-settings">
        <div className="set-item">
          <div className="set-text">
            <span className="set-label" id="k-mech">
              SASL mechanism
            </span>
            <span className="desc">How the brokers check who you are. Amazon MSK with a username and password uses SCRAM-SHA-512.</span>
          </div>
          <div className="set-ctl">
            <div className="seg seg--lg" role="group" aria-labelledby="k-mech">
              {(
                [
                  ["none", "None"],
                  ["plain", "PLAIN"],
                  ["scram-sha-256", "SCRAM-SHA-256"],
                  ["scram-sha-512", "SCRAM-SHA-512"],
                ] as [KafkaDef["sasl"], string][]
              ).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={def.sasl === v} onClick={() => onChange({ sasl: v })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        {sasl && (
          <>
            <div className="set-item">
              <div className="set-text">
                <label className="set-label" htmlFor="k-user">
                  Username
                </label>
              </div>
              <div className="set-ctl">
                <input id="k-user" className="field mono" spellCheck={false} placeholder="{{kafkaUser}}" value={def.username} onChange={(e) => onChange({ username: e.target.value })} />
              </div>
            </div>
            <div className="set-item">
              <div className="set-text">
                <label className="set-label" htmlFor="k-pass">
                  Password
                </label>
                <span className="desc">Use a variable so the password stays out of exports.</span>
              </div>
              <div className="set-ctl">
                <input
                  id="k-pass"
                  className="field mono"
                  spellCheck={false}
                  type={def.password.startsWith("{{") ? "text" : "password"}
                  placeholder="{{kafkaPassword}}"
                  value={def.password}
                  onChange={(e) => onChange({ password: e.target.value })}
                />
              </div>
            </div>
          </>
        )}
        <div className="set-item">
          <div className="set-text">
            <span className="set-label" id="k-tls">
              TLS
            </span>
            <span className="desc">Encrypt the connection. CA and client certificates come from Settings › Certificates.</span>
          </div>
          <div className="set-ctl">
            <input type="checkbox" className="switch" role="switch" aria-labelledby="k-tls" checked={def.tls} onChange={(e) => onChange({ tls: e.target.checked })} />
          </div>
        </div>
      </div>
      <p className="k-foot">Not built yet: AWS IAM for MSK, OAUTHBEARER, Kerberos.</p>
    </>
  );
}

// ---------- settings ----------

function SettingsEditor({ def, onChange }: { def: KafkaDef; onChange: (patch: Partial<KafkaDef>) => void }) {
  const [keep, setKeep] = useState(String(def.keep));
  useEffect(() => setKeep(String(def.keep)), [def.keep]);
  return (
    <>
      <div className="set-list sio-settings kafka-settings">
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="k-cid">
              Client ID
            </label>
            <span className="desc">Shows up in broker logs and quotas.</span>
          </div>
          <div className="set-ctl">
            <input id="k-cid" className="field mono" spellCheck={false} placeholder="voidhttp" value={def.clientId} onChange={(e) => onChange({ clientId: e.target.value })} />
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <span className="set-label" id="k-from">
              Read from
            </span>
            <span className="desc">Where reading starts when you connect. Change it any time from the Messages toolbar.</span>
          </div>
          <div className="set-ctl">
            <div className="seg seg--lg" role="group" aria-labelledby="k-from">
              <button type="button" aria-pressed={def.from === "latest"} onClick={() => onChange({ from: "latest" })}>
                Latest
              </button>
              <button type="button" aria-pressed={def.from === "earliest"} onClick={() => onChange({ from: "earliest" })}>
                Earliest
              </button>
            </div>
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <span className="set-label" id="k-acks">
              Acks
            </span>
            <span className="desc">How many replicas must store a produced record before the broker answers.</span>
          </div>
          <div className="set-ctl">
            <div className="seg seg--lg" role="group" aria-labelledby="k-acks">
              {(
                [
                  [0, "None"],
                  [1, "Leader"],
                  [-1, "All"],
                ] as [KafkaDef["acks"], string][]
              ).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={def.acks === v} onClick={() => onChange({ acks: v })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <span className="set-label" id="k-comp">
              Compression
            </span>
            <span className="desc">For produced records. Reading handles every codec on its own.</span>
          </div>
          <div className="set-ctl">
            <div className="seg seg--lg" role="group" aria-labelledby="k-comp">
              {(["none", "gzip", "lz4", "snappy", "zstd"] as KafkaDef["compression"][]).map((v) => (
                <button key={v} type="button" aria-pressed={def.compression === v} onClick={() => onChange({ compression: v })}>
                  {v === "none" ? "None" : v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="k-keep">
              Keep in the list
            </label>
            <span className="desc">Older records drop off the list. Nothing changes on the topic.</span>
          </div>
          <div className="set-ctl">
            <input
              id="k-keep"
              className="field mono narrow"
              inputMode="numeric"
              value={keep}
              onChange={(e) => setKeep(e.target.value.replace(/\D/g, ""))}
              onBlur={() => {
                const v = Math.min(100_000, Math.max(50, Math.floor(Number(keep) || 1000)));
                setKeep(String(v));
                if (v !== def.keep) onChange({ keep: v });
              }}
            />
            <span className="unit">records</span>
          </div>
        </div>
      </div>
      <p className="k-foot">Not built yet: Avro and Protobuf values through a Schema Registry.</p>
    </>
  );
}
