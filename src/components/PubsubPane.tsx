import { useEffect, useState, type ReactNode } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useDismiss } from "./useDismiss";
import { useStore } from "../store";
import type { PubsubDef, Tab } from "../types";
import { AUTH_KINDS, MODES, authLabel, authOf, defaultPubsub, pubsubInspect, pubsubList, shortName, type ListArgs, type PubsubInspect, type PubsubListItem } from "../lib/pubsub";
import { resolve } from "../lib/vars";
import { formatJsonc, stripJsonComments } from "../lib/jsonc";
import { MethodMenu } from "./MethodMenu";
import { UrlInput, type VarInfo } from "./UrlInput";
import { KVEditor } from "./KVEditor";
import { CodeArea } from "./CodeArea";
import { TitleName } from "./InlineRename";
import { Check, ChevronDown, Cloud, FileKey, Plug, RefreshCw, Search, Send, TriangleAlert, Unplug, WandSparkles, WrapText, ico } from "./Icon";

type Section = "message" | "attributes" | "read" | "auth" | "settings";

interface Props {
  tab: Tab;
  grow: number;
  lookup: (name: string) => VarInfo;
  /** {{vars}} in the project ID with no value */
  missing: string[];
  /** where the request lives, for the title row */
  path: string;
  /** Save and its state, shared with HTTP requests */
  saveControls: ReactNode;
  /** switch the tab to another method */
  onKind: (method: string) => void;
}

/** The request side of a Pub/Sub tab: project and topic, Connect / Disconnect, the next message, how to read, auth and settings. */
export function PubsubRequestPane({ tab, grow, lookup, missing, path, saveControls, onKind }: Props) {
  const [section, setSection] = useState<Section>("message");
  const update = useStore((s) => s.updateRequest);
  const st = useStore.getState(); // actions only

  const req = tab.request;
  const def: PubsubDef = req.pubsub ?? defaultPubsub();
  const setDef = (patch: Partial<PubsubDef>) => update(tab.id, { pubsub: { ...def, ...patch } });
  const ex = tab.example;
  const busy = !!tab.inflightId;
  const ready = busy && !!tab.ws?.pubsub?.info;
  const lock = !!ex || busy;

  const n = (count: number) => (count ? <span className="n">{count}</span> : null);
  const enabledAttrs = req.headers.filter((h) => h.enabled && h.key).length;
  const d = defaultPubsub();
  const changed = (def.endpoint.trim() ? 1 : 0) + (def.ackDeadline !== d.ackDeadline ? 1 : 0) + (def.keep !== d.keep ? 1 : 0);
  const tabs: [Section, string, number][] = [
    ["message", "Message", 0],
    ["attributes", "Attributes", enabledAttrs],
    ["read", "Read", 0],
    ["auth", "Auth", 0],
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
        <div className={`url-field pubsub-field${busy ? " is-live" : ""}`}>
          <MethodMenu value="PUBSUB" disabled={lock} className="method-pick m-PUBSUB" title={busy ? "Disconnect to change the method" : undefined} onPick={onKind}>
            PSUB
          </MethodMenu>
          <div className="rpc-anchor ps-anchor">
            <UrlInput
              lookup={lookup}
              aria-label="Google Cloud project ID"
              spellCheck={false}
              autoFocus={!ex}
              readOnly={lock}
              title={busy ? "Disconnect to change the project" : "The Google Cloud project ID"}
              placeholder="Project ID, e.g. acme-staging, or {{gcpProject}}"
              value={req.url}
              onChange={(e) => update(tab.id, { url: e.target.value })}
            />
            {!lock && <ProjectPicker tab={tab} def={def} onPick={(url) => update(tab.id, { url })} />}
          </div>
          <span className="mq-scheme" title="How voidHTTP signs in. Change it in Auth.">
            {authLabel(def)}
          </span>
          <span className="gf-sep" aria-hidden="true" />
          <div className="rpc-anchor ps-topic">
            <label className="ns-seg" title={busy ? "Disconnect to change the topic" : undefined}>
              <span className="ns-lbl">Topic</span>
              <input aria-label="Topic" spellCheck={false} placeholder="topic id" readOnly={lock} value={def.topic} onChange={(e) => setDef({ topic: e.target.value })} />
            </label>
            {!lock && <TopicPicker tab={tab} def={def} onPick={(topic) => setDef({ topic })} />}
          </div>
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
          {section === "message" && <MessageEditor tab={tab} def={def} onChange={setDef} />}
          {section === "attributes" && (
            <>
              <KVEditor rows={req.headers} nameLabel="Attribute" addLabel="Add an attribute" onChange={(headers) => update(tab.id, { headers })} />
              <p className="kv-note">
                Sent with each published message, up to 100. Subscription filters such as <code>attributes.eventType = "x"</code> match on these. Variables work here.
              </p>
            </>
          )}
          {section === "read" && <ReadEditor tab={tab} def={def} lock={busy} onChange={setDef} />}
          {section === "auth" && <AuthEditor tab={tab} def={def} onChange={setDef} />}
          {section === "settings" && <SettingsEditor def={def} onChange={setDef} />}
        </fieldset>
      </div>
    </div>
  );
}

// ---------- the next message ----------

function MessageEditor({ tab, def, onChange }: { tab: Tab; def: PubsubDef; onChange: (patch: Partial<PubsubDef>) => void }) {
  const update = useStore((s) => s.updateRequest);
  const notify = useStore((s) => s.notify);
  const wrap = useStore((s) => s.settings.wrapRequestBody ?? false);
  const setSettings = useStore((s) => s.setSettings);
  const st = useStore.getState();
  const body = tab.request.body;
  const json = body.mode !== "text";
  const setFormat = (mode: "json" | "text") => update(tab.id, { body: { ...body, mode } });
  const w = tab.ws;
  const ready = !!tab.inflightId && !!w?.pubsub?.info && !w.close;
  const connecting = !!tab.inflightId && !ready;

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
        <label className="lbl" htmlFor={`ok-${tab.id}`}>
          Ordering key
        </label>
        <input
          id={`ok-${tab.id}`}
          className="ev-input"
          spellCheck={false}
          placeholder="none"
          title="Messages with the same key reach subscribers in order, when the subscription has ordering on"
          value={def.orderingKey}
          onChange={(e) => onChange({ orderingKey: e.target.value })}
        />
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
        label="Message data"
        onChange={(raw) => update(tab.id, { body: { ...body, raw } })}
        placeholder={json ? '{ "transfer_id": "trf_77a0c3" }' : "Text data"}
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
          Publish
        </button>
        {ready ? (
          <span className="hint-text push">
            <kbd>⌘</kbd> <kbd>Enter</kbd> publishes to <code>{w!.pubsub!.topic}</code>
          </span>
        ) : connecting ? (
          <span className="hint-text push">Signing in…</span>
        ) : (
          <span className="hint-text push">Connect first, then publish. How messages are read is set in Read.</span>
        )}
      </div>
    </>
  );
}

// ---------- lists: project, topic, subscription (the gRPC method picker) ----------

type Group = { label: string; items: (PubsubListItem & { tag?: string })[] };
interface Loaded {
  groups: Group[];
  /** a list that could not be read, said in plain words */
  msg?: string;
  foot: ReactNode;
}

/** The list arguments for this tab, variables applied. */
function listArgs(tab: Tab, def: PubsubDef, what: ListArgs["what"]): ListArgs {
  const st = useStore.getState();
  const scope = st.scopeFor(tab.id);
  return {
    auth: authOf(def, scope),
    endpoint: resolve(def.endpoint, scope).trim(),
    insecure: st.settings.insecure,
    timeoutMs: st.settings.timeoutMs,
    what,
    project: resolve(tab.request.url, scope).trim(),
    topic: shortName(resolve(def.topic, scope).trim()),
  };
}

const clock = () => new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** Why a list came back empty-handed, without the Google boilerplate. */
function listError(e: unknown, what: string, need: string): string {
  const s = String(e);
  if (/PERMISSION_DENIED|403/.test(s)) return `This account may not list ${what} (${need}). Type the name instead.`;
  return `${s}. Type the name instead.`;
}

/** A chevron that opens a searchable list; picking fills the field, typing still works. */
function ListPicker({ label, search, current, load, onPick }: { label: string; search: string; current: string; load: () => Promise<Loaded>; onPick: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const run = () => {
    setLoading(true);
    load()
      .then(setData)
      .catch((e) => setData({ groups: [], msg: String(e), foot: null }))
      .finally(() => setLoading(false));
  };
  const toggle = () => {
    if (!open) {
      setQ("");
      run();
    }
    setOpen(!open);
  };
  const needle = q.trim().toLowerCase();
  const groups = (data?.groups ?? [])
    .map((g) => ({ ...g, items: g.items.filter((i) => !needle || i.name.toLowerCase().includes(needle) || (i.detail ?? "").toLowerCase().includes(needle)) }))
    .filter((g) => g.items.length);
  const pick = (name: string) => {
    onPick(name);
    setOpen(false);
  };
  return (
    <div ref={ref} style={{ display: "contents" }}>
      <button type="button" className="icon-btn" aria-label={label} title={label} aria-haspopup="listbox" aria-expanded={open} onClick={toggle}>
        <ChevronDown {...ico} />
      </button>
      {open && (
        <div className="menu rpc-menu" role="dialog" aria-label={label}>
          <div className="search">
            <Search {...ico} />
            <input
              className="field"
              placeholder={search}
              aria-label={search}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                // the picker sits in the request form: Enter picks the first match instead of connecting
                if (e.key !== "Enter") return;
                e.preventDefault();
                const first = groups.flatMap((g) => g.items).find((i) => !i.disabled);
                if (first) pick(first.name);
              }}
            />
          </div>
          <div className="rpc-list" role="listbox" aria-label={label}>
            {loading && !data ? (
              <div className="rpc-msg">
                <span className="spinner" />
                Loading…
              </div>
            ) : (
              <>
                {groups.map((g) => (
                  <div key={g.label} role="group" aria-label={g.label}>
                    <div className="rpc-group">{g.label}</div>
                    {g.items.map((i) => {
                      const cur = i.name === current;
                      return (
                        <button
                          key={`${g.label}/${i.name}`}
                          type="button"
                          role="option"
                          aria-selected={cur}
                          aria-current={cur || undefined}
                          disabled={i.disabled}
                          title={i.detail}
                          onClick={() => pick(i.name)}
                        >
                          {cur ? <Check {...ico} /> : <span className="tick-gap" />}
                          <span className="name">{i.name}</span>
                          {(i.tag ?? i.detail) && <span className="rpc-tag">{i.tag ?? i.detail}</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {data?.msg && <div className="rpc-msg">{data.msg}</div>}
                {!data?.msg && !groups.length && !loading && <div className="rpc-msg">{needle ? "Nothing matches" : "Nothing to pick from"}</div>}
              </>
            )}
          </div>
          {data?.foot && (
            <div className="rpc-foot">
              {data.foot}
              <button type="button" className="icon-btn" title="Load again" aria-label="Load again" disabled={loading} onClick={run}>
                <RefreshCw {...ico} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Projects: the variable, what the sign-in files name, then what Cloud Resource Manager lists. */
function ProjectPicker({ tab, def, onPick }: { tab: Tab; def: PubsubDef; onPick: (url: string) => void }) {
  const url = tab.request.url;
  const load = async (): Promise<Loaded> => {
    const args = listArgs(tab, def, "projects");
    const groups: Group[] = [];
    if (url.includes("{{")) groups.push({ label: "Variable", items: [{ name: url, tag: args.project || "no value" }] });
    const local: PubsubInspect = await pubsubInspect(args.auth).catch((e) => ({ kind: "", projects: [], error: String(e) }));
    if (local.projects.length) groups.push({ label: "From your sign-in", items: local.projects.map((p) => ({ name: p.id, tag: p.source })) });
    if (def.auth === "emulator") return { groups, foot: null, msg: groups.length ? undefined : "The emulator takes any project ID." };
    const seen = new Set(local.projects.map((p) => p.id));
    try {
      const remote = (await pubsubList(args)).filter((p) => !seen.has(p.name));
      if (remote.length) groups.push({ label: "Cloud Resource Manager", items: remote });
      return {
        groups,
        foot: (
          <>
            <Cloud {...ico} />
            From Cloud Resource Manager · {clock()}
          </>
        ),
      };
    } catch (e) {
      return {
        groups,
        msg: listError(e, "projects", "resourcemanager.projects.get"),
        foot: (
          <>
            <FileKey {...ico} />
            From the credentials file and gcloud config
          </>
        ),
      };
    }
  };
  return <ListPicker label="Pick a project" search="Search projects" current={url} load={load} onPick={onPick} />;
}

function TopicPicker({ tab, def, onPick }: { tab: Tab; def: PubsubDef; onPick: (topic: string) => void }) {
  const load = async (): Promise<Loaded> => {
    const args = listArgs(tab, def, "topics");
    if (!args.project) return { groups: [], msg: "Enter the project ID first.", foot: null };
    try {
      const items = await pubsubList(args);
      return {
        groups: [{ label: args.project, items }],
        foot: (
          <>
            <Cloud {...ico} />
            {items.length === 1 ? "1 topic" : `${items.length} topics`} · {clock()}
          </>
        ),
      };
    } catch (e) {
      return { groups: [], msg: listError(e, "topics", "pubsub.topics.list"), foot: null };
    }
  };
  return <ListPicker label="Pick a topic" search="Search topics" current={def.topic} load={load} onPick={onPick} />;
}

function SubscriptionPicker({ tab, def, onPick }: { tab: Tab; def: PubsubDef; onPick: (sub: string) => void }) {
  const load = async (): Promise<Loaded> => {
    const args = listArgs(tab, def, "subscriptions");
    if (!args.project || !args.topic) return { groups: [], msg: "Enter the project ID and the topic first.", foot: null };
    try {
      const items = await pubsubList(args);
      return {
        groups: [{ label: args.topic, items }],
        msg: items.length ? undefined : `No subscriptions on ${args.topic}.`,
        foot: (
          <>
            <Cloud {...ico} />
            Only Pull subscriptions can be read
          </>
        ),
      };
    } catch (e) {
      return { groups: [], msg: listError(e, "subscriptions", "pubsub.subscriptions.list"), foot: null };
    }
  };
  return <ListPicker label="Pick a subscription" search="Search subscriptions" current={def.subscription} load={load} onPick={onPick} />;
}

// ---------- read ----------

function ReadEditor({ tab, def, lock, onChange }: { tab: Tab; def: PubsubDef; lock: boolean; onChange: (patch: Partial<PubsubDef>) => void }) {
  const [pullMax, setPullMax] = useState(String(def.pullMax));
  useEffect(() => setPullMax(String(def.pullMax)), [def.pullMax]);
  const existing = def.mode === "peek" || def.mode === "consume";
  const sub = def.subscription.trim() || "the subscription";
  return (
    <>
      <div className="set-list sio-settings kafka-settings">
        <div className="set-item">
          <div className="set-text">
            <span className="set-label" id="ps-mode">
              Read
            </span>
            <span className="desc">
              {def.mode === "temp"
                ? "voidHTTP makes its own subscription on the topic and deletes it on Disconnect. Your services' subscriptions are not touched."
                : def.mode === "peek"
                  ? "Pull from an existing subscription when you press Pull, and hand every message straight back."
                  : def.mode === "consume"
                    ? "Read an existing subscription and ack, like a real subscriber."
                    : "Don't read; only publish. For accounts that may only publish."}
            </span>
          </div>
          <div className="set-ctl">
            <div className="seg seg--lg" role="group" aria-labelledby="ps-mode" title={lock ? "Disconnect to change how it reads" : undefined}>
              {MODES.map(([v, l]) => (
                <button key={v} type="button" aria-pressed={def.mode === v} disabled={lock} onClick={() => onChange({ mode: v })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {def.mode === "temp" && (
          <>
            <div className="set-item">
              <div className="set-text">
                <label className="set-label" htmlFor="ps-filter">
                  Filter
                </label>
                <span className="desc">
                  Optional. Only messages whose attributes match reach the list, e.g. <code>attributes.eventType = "transfer.completed"</code>.
                </span>
              </div>
              <div className="set-ctl">
                <input id="ps-filter" className="field mono" spellCheck={false} placeholder="all messages" readOnly={lock} value={def.filter} onChange={(e) => onChange({ filter: e.target.value })} />
              </div>
            </div>
            <div className="set-item">
              <div className="set-text">
                <span className="set-label" id="ps-order">
                  Message ordering
                </span>
                <span className="desc">Messages with the same ordering key arrive in order.</span>
              </div>
              <div className="set-ctl">
                <input type="checkbox" className="switch" role="switch" aria-labelledby="ps-order" disabled={lock} checked={def.ordering} onChange={(e) => onChange({ ordering: e.target.checked })} />
              </div>
            </div>
          </>
        )}

        {existing && (
          <div className="set-item">
            <div className="set-text">
              <label className="set-label" htmlFor="ps-sub">
                Subscription
              </label>
              <span className="desc">
                A Pull subscription on <code>{def.topic.trim() || "the topic"}</code>.
              </span>
            </div>
            <div className="set-ctl">
              <div className="rpc-anchor ps-sub">
                <input
                  id="ps-sub"
                  className="field mono"
                  spellCheck={false}
                  placeholder="subscription id"
                  readOnly={lock}
                  value={def.subscription}
                  onChange={(e) => onChange({ subscription: e.target.value })}
                />
                {!lock && <SubscriptionPicker tab={tab} def={def} onPick={(subscription) => onChange({ subscription })} />}
              </div>
            </div>
          </div>
        )}
        {def.mode === "peek" && (
          <div className="set-item">
            <div className="set-text">
              <label className="set-label" htmlFor="ps-max">
                Messages per pull
              </label>
              <span className="desc">Messages already in the list are skipped.</span>
            </div>
            <div className="set-ctl">
              <input
                id="ps-max"
                className="field mono narrow"
                inputMode="numeric"
                value={pullMax}
                onChange={(e) => setPullMax(e.target.value.replace(/\D/g, ""))}
                onBlur={() => {
                  const v = Math.min(1000, Math.max(1, Math.floor(Number(pullMax) || 10)));
                  setPullMax(String(v));
                  if (v !== def.pullMax) onChange({ pullMax: v });
                }}
              />
              <span className="unit">messages</span>
            </div>
          </div>
        )}
      </div>
      {def.mode === "temp" && (
        <p className="k-foot">
          Only messages published after Connect arrive. Needs <code>pubsub.subscriptions.create</code> (Pub/Sub Editor); without it, use Peek. If voidHTTP quits without deleting
          it, Google removes the subscription after 24 hours unused.
        </p>
      )}
      {def.mode === "peek" && (
        <p className="set-notice" role="note">
          <TriangleAlert {...ico} />
          <span>
            Each peek counts as a <b>delivery attempt</b>. On a subscription with a dead-letter policy, a message peeked too often moves to the dead-letter topic.
          </span>
        </p>
      )}
      {def.mode === "consume" && (
        <p className="set-notice" role="note">
          <TriangleAlert {...ico} />
          <span>
            Messages voidHTTP reads here are <b>acked and gone</b> for every reader of <code>{sub}</code>, including the service that owns it. Use a subscription made for testing.
          </span>
        </p>
      )}
    </>
  );
}

// ---------- auth ----------

function AuthEditor({ tab, def, onChange }: { tab: Tab; def: PubsubDef; onChange: (patch: Partial<PubsubDef>) => void }) {
  const [info, setInfo] = useState<PubsubInspect | null>(null);
  const file = def.auth === "key" ? def.keyFile : def.auth === "adc" ? def.adcFile : "";
  // who the file signs in as: read locally, a moment after typing stops
  useEffect(() => {
    if (def.auth !== "key" && def.auth !== "adc") return setInfo(null);
    if (def.auth === "key" && !file.trim()) return setInfo(null);
    let live = true;
    const t = setTimeout(() => {
      pubsubInspect(authOf(def, useStore.getState().scopeFor(tab.id)))
        .then((r) => live && setInfo(r))
        .catch((e) => live && setInfo({ kind: "", projects: [], error: String(e) }));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [def.auth, file, def.impersonate, tab.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (key: "keyFile" | "adcFile") => {
    const picked = await openDialog({ multiple: false, filters: [{ name: "JSON", extensions: ["json"] }] });
    if (typeof picked === "string") onChange({ [key]: picked });
  };
  // a file that can't be used says so in a row of its own, red, like Certificates does
  const problem = info?.error ? (
    <p className="set-problem" role="alert">
      <TriangleAlert {...ico} />
      {info.error}
    </p>
  ) : null;
  const who = info?.error ? null : info?.email ? (
    <span className="desc">
      Signs in as <code>{info.email}</code>
      {info.kind && info.kind !== "service account" ? ` (${info.kind})` : ""}.
    </span>
  ) : info?.kind ? (
    <span className="desc">Signs in with your {info.kind}.</span>
  ) : null;

  return (
    <>
      <div className="set-list sio-settings kafka-settings">
        <div className="set-item">
          <div className="set-text">
            <span className="set-label" id="ps-auth">
              Credentials
            </span>
            <span className="desc">How voidHTTP gets a Google access token.</span>
          </div>
          <div className="set-ctl">
            <div className="seg seg--lg" role="group" aria-labelledby="ps-auth">
              {AUTH_KINDS.map(([v, l]) => (
                <button key={v} type="button" aria-pressed={def.auth === v} onClick={() => onChange({ auth: v })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {def.auth === "key" && (
          <div className="set-item">
            <div className="set-text">
              <label className="set-label" htmlFor="ps-key">
                Key file
              </label>
              <span className="desc">Kept by path only; the private key never goes into the workspace or an export.</span>
              {who}
            </div>
            <div className="set-ctl">
              <input id="ps-key" className="field mono" spellCheck={false} placeholder="~/keys/service-account.json" title={def.keyFile} value={def.keyFile} onChange={(e) => onChange({ keyFile: e.target.value })} />
              <button type="button" className="btn" onClick={() => choose("keyFile")}>
                Choose…
              </button>
            </div>
          </div>
        )}
        {def.auth === "key" && problem}
        {def.auth === "adc" && (
          <div className="set-item">
            <div className="set-text">
              <label className="set-label" htmlFor="ps-adc">
                Credentials file
              </label>
              <span className="desc">
                Made by <code>gcloud auth application-default login</code>. Empty uses gcloud's default file.
              </span>
              {who}
            </div>
            <div className="set-ctl">
              <input
                id="ps-adc"
                className="field mono"
                spellCheck={false}
                placeholder="~/.config/gcloud/application_default_credentials.json"
                title={def.adcFile}
                value={def.adcFile}
                onChange={(e) => onChange({ adcFile: e.target.value })}
              />
              <button type="button" className="btn" onClick={() => choose("adcFile")}>
                Choose…
              </button>
            </div>
          </div>
        )}
        {def.auth === "adc" && problem}
        {(def.auth === "key" || def.auth === "adc") && (
          <div className="set-item">
            <div className="set-text">
              <label className="set-label" htmlFor="ps-imp">
                Act as service account
              </label>
              <span className="desc">Optional. Sign in as yourself, then work as this account; for teams that may not download keys. Needs Service Account Token Creator on it.</span>
            </div>
            <div className="set-ctl">
              <input
                id="ps-imp"
                className="field mono"
                spellCheck={false}
                placeholder="name@project.iam.gserviceaccount.com"
                title={def.impersonate}
                value={def.impersonate}
                onChange={(e) => onChange({ impersonate: e.target.value })}
              />
            </div>
          </div>
        )}
        {def.auth === "token" && (
          <div className="set-item">
            <div className="set-text">
              <label className="set-label" htmlFor="ps-token">
                Access token
              </label>
              <span className="desc">
                From <code>gcloud auth print-access-token</code>. Expires after about an hour and is not refreshed. Use a variable so it stays out of exports.
              </span>
            </div>
            <div className="set-ctl">
              <input
                id="ps-token"
                className="field mono"
                spellCheck={false}
                type={def.token.startsWith("{{") ? "text" : "password"}
                placeholder="{{gcpToken}}"
                value={def.token}
                onChange={(e) => onChange({ token: e.target.value })}
              />
            </div>
          </div>
        )}
        {def.auth === "emulator" && (
          <>
            <div className="set-item">
              <div className="set-text">
                <label className="set-label" htmlFor="ps-emu">
                  Emulator host
                </label>
                <span className="desc">
                  The local Pub/Sub emulator, same as <code>PUBSUB_EMULATOR_HOST</code>. No sign-in, plain HTTP.
                </span>
              </div>
              <div className="set-ctl">
                <input id="ps-emu" className="field mono" spellCheck={false} placeholder="localhost:8085" value={def.emulatorHost} onChange={(e) => onChange({ emulatorHost: e.target.value })} />
              </div>
            </div>
            <div className="set-item">
              <div className="set-text">
                <span className="set-label" id="ps-create">
                  Create the topic if missing
                </span>
                <span className="desc">The emulator starts empty. Real projects are never changed this way.</span>
              </div>
              <div className="set-ctl">
                <input type="checkbox" className="switch" role="switch" aria-labelledby="ps-create" checked={def.createTopic} onChange={(e) => onChange({ createTopic: e.target.checked })} />
              </div>
            </div>
          </>
        )}
      </div>
      <p className="k-foot">Not built yet: Workload Identity Federation, signing in with Google inside the app.</p>
    </>
  );
}

// ---------- settings ----------

function SettingsEditor({ def, onChange }: { def: PubsubDef; onChange: (patch: Partial<PubsubDef>) => void }) {
  const [ack, setAck] = useState(String(def.ackDeadline));
  const [keep, setKeep] = useState(String(def.keep));
  useEffect(() => setAck(String(def.ackDeadline)), [def.ackDeadline]);
  useEffect(() => setKeep(String(def.keep)), [def.keep]);
  return (
    <>
      <div className="set-list sio-settings kafka-settings">
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="ps-ep">
              Endpoint
            </label>
            <span className="desc">
              A regional endpoint such as <code>asia-southeast2-pubsub.googleapis.com</code> keeps messages in that region.
            </span>
          </div>
          <div className="set-ctl">
            <input id="ps-ep" className="field mono" spellCheck={false} placeholder="pubsub.googleapis.com" value={def.endpoint} onChange={(e) => onChange({ endpoint: e.target.value })} />
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="ps-ack">
              Ack deadline
            </label>
            <span className="desc">For Temporary and Consume. How long a message stays with voidHTTP before Pub/Sub sends it again.</span>
          </div>
          <div className="set-ctl">
            <input
              id="ps-ack"
              className="field mono narrow"
              inputMode="numeric"
              value={ack}
              onChange={(e) => setAck(e.target.value.replace(/\D/g, ""))}
              onBlur={() => {
                const v = Math.min(600, Math.max(10, Math.floor(Number(ack) || 60)));
                setAck(String(v));
                if (v !== def.ackDeadline) onChange({ ackDeadline: v });
              }}
            />
            <span className="unit">seconds</span>
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <label className="set-label" htmlFor="ps-keep">
              Keep in the list
            </label>
            <span className="desc">Older messages drop off the list. Nothing changes on the topic.</span>
          </div>
          <div className="set-ctl">
            <input
              id="ps-keep"
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
            <span className="unit">messages</span>
          </div>
        </div>
      </div>
      <p className="k-foot">Not built yet: Avro and Protobuf data through Pub/Sub schemas, seeking a subscription to a time or snapshot.</p>
    </>
  );
}
