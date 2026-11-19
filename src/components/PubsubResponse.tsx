import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PubsubInfo, PubsubMode, PubsubSession, Tab, WsMessage, WsResult } from "../types";
import { formatBytes } from "../lib/model";
import { highlightLines } from "../lib/highlight";
import { hexDump, hexPreview } from "../lib/ws";
import { b64ToHex, recordTime } from "../lib/kafka";
import { defaultPubsub } from "../lib/pubsub";
import { useStore } from "../store";
import { LayoutSwitch } from "./LayoutSwitch";
import { RunBanner, RunsButton } from "./Runs";
import { ArrowDown, ArrowUp, Copy, CornerDownLeft, Download, Eye, Pause, Play, Plug, RefreshCw, Search, Trash2, TriangleAlert, ico, icoLg } from "./Icon";

type Sub = "messages" | "topic";
type Show = "all" | "in" | "out";

const seconds = (ms: number) => (ms < 10_000 ? `${(ms / 1000).toFixed(2)}s` : ms < 100_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`);
/** 96 ms · 4.2 s · 5m 02s · 1h 03m */
function duration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const s = Math.floor(ms / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
}
const num = (n: number) => n.toLocaleString("en-US").replace(/,/g, " ");
/** "sa-qa-pubsub@acme.iam.gserviceaccount.com" → "sa-qa-pubsub" */
const who = (email?: string) => email?.split("@")[0];

/** How each way of failing reads in the status line. */
const FAILED: Record<string, string> = {
  auth: "Sign-in failed",
  topic: "Topic not found",
  subscription: "Subscription failed",
};

/** The response side of a Pub/Sub tab: messages read and published, and the topic with its subscriptions. */
export function PubsubResponsePane({ tab, grow }: { tab: Tab; grow: number }) {
  const [sub, setSub] = useState<Sub>("messages");
  const w = tab.ws;
  // a new connection starts on its messages
  useEffect(() => setSub("messages"), [w?.connId]);

  const shell = (children: ReactNode) => (
    <section className="response" style={{ flexGrow: grow }} aria-label="Response">
      {children}
    </section>
  );

  if (tab.error)
    return shell(
      <>
        <div className="res-head">
          <LayoutSwitch />
        </div>
        <div className="error-box" role="alert">
          <strong>Could not connect</strong>
          <span className="msg">{tab.error}</span>
        </div>
      </>,
    );
  if (!w?.pubsub)
    return shell(
      <>
        <div className="res-head">
          <RunsButton tab={tab} />
          <LayoutSwitch />
        </div>
        <div className="empty">
          <Plug {...icoLg} />
          <strong>Not connected</strong>
          <span>Connect signs in, checks the topic, and starts reading as set in Read. Messages you read and publish show up here.</span>
          <span className="why">By default voidHTTP reads through its own temporary subscription, so your services' subscriptions keep every message.</span>
        </div>
      </>,
    );
  const p = w.pubsub;
  const live = !!tab.inflightId;
  if (!p.info && !p.failed)
    return shell(
      <>
        <div className="res-head">
          <LayoutSwitch />
        </div>
        <div className="empty" role="status">
          <div className="spinner" />
          <span>Signing in…</span>
        </div>
      </>,
    );

  const count = (w.dropped ?? 0) + w.messages.filter((m) => m.kind === "record").length;
  return shell(
    <>
      {tab.fromHistory && <RunBanner tab={tab} hint="Connect to read it again" />}
      <nav className="subtabs" aria-label="Response">
        <button type="button" className="subtab" aria-pressed={sub === "messages"} onClick={() => setSub("messages")}>
          Messages {count > 0 && <span className="n">{count}</span>}
        </button>
        <button type="button" className="subtab" aria-pressed={sub === "topic"} disabled={!p.info} onClick={() => setSub("topic")}>
          Topic
        </button>
        <StatusLine w={w} p={p} live={live} />
        {!live && <RunsButton tab={tab} />}
        <LayoutSwitch />
      </nav>
      {p.failed ? <Failed tab={tab} p={p} /> : sub === "topic" ? <TopicView tab={tab} info={p.info!} live={live} /> : <MessageList tab={tab} w={w} p={p} live={live} />}
    </>,
  );
}

function StatusLine({ w, p, live }: { w: WsResult; p: PubsubSession; live: boolean }) {
  const [, tick] = useState(0);
  // the time connected counts up
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [live]);
  const size = w.messages.reduce((n, m) => n + (m.kind === "record" ? m.size : 0), 0);
  if (p.failed)
    return (
      <span className="meta">
        <span className="fail">{FAILED[p.failed.stage] ?? "Failed"}</span>
        <span className="dim">{duration(p.failed.elapsedMs)}</span>
      </span>
    );
  const openFor = w.close ? w.close.elapsedMs : Math.max(0, Date.now() - w.startedAt - (p.connectedMs ?? 0));
  const pulls = p.pulls?.length ?? 0;
  return (
    <span className="meta">
      {w.close ? (
        <span className={w.close.by === "client" ? "ok" : "fail"}>{w.close.by === "client" ? "Disconnected" : "Connection lost"}</span>
      ) : p.mode === "peek" ? (
        <span className="redir">Peeking</span>
      ) : p.mode === "publish" ? (
        <span className="ok">Connected</span>
      ) : p.paused ? (
        <span className="redir">Paused</span>
      ) : (
        <span className="live">
          <span className="live-dot" aria-hidden="true" />
          Reading
        </span>
      )}
      {p.info?.subscription && <span className="dim">{p.info.subscription}</span>}
      {p.mode === "peek" && <span className="dim">{pulls === 1 ? "1 pull" : `${pulls} pulls`}</span>}
      <span className="dim">{duration(openFor)}</span>
      <span className="dim">{formatBytes(size)}</span>
    </span>
  );
}

// ---------- messages ----------

type Row = { m: WsMessage; n: number; slot: "msg" | "ack" | "wait"; recN?: number };

/** Messages in order, each publish answer moved under the publish it answers, with a wait line while it has none. */
function thread(shown: { m: WsMessage; n: number }[], all: { m: WsMessage; n: number }[], live: boolean): Row[] {
  const acks = new Map<number, { m: WsMessage; n: number }>();
  for (const x of all) if (x.m.kind === "ack" && x.m.ackId !== undefined) acks.set(x.m.ackId, x);
  const rows: Row[] = [];
  for (const x of shown) {
    if (x.m.kind === "ack") continue;
    rows.push({ ...x, slot: "msg" });
    if (x.m.dir !== "out" || x.m.ackId === undefined) continue;
    const a = acks.get(x.m.ackId);
    if (a) rows.push({ ...a, slot: "ack", recN: x.n });
    else if (live) rows.push({ ...x, slot: "wait" });
  }
  // an answer whose publish is no longer in the list still shows its error
  for (const x of shown) if (x.m.kind === "ack" && x.m.error && !all.some((y) => y.m.kind === "record" && y.m.ackId === x.m.ackId)) rows.push({ ...x, slot: "ack" });
  return rows;
}

const dataText = (m: WsMessage) => (m.valueBin ? hexPreview(m.data) : m.data);
const attrText = (m: WsMessage) => (m.headers ?? []).map((h) => `${h.key}=${h.value}`).join(" ");

const MODE_LINE: Record<PubsubMode, (info: PubsubInfo) => ReactNode> = {
  temp: (i) => (
    <span>
      temporary subscription <code>{i.subscription}</code> on <code>{i.topic}</code>
    </span>
  ),
  peek: (i) => (
    <>
      <span>
        peeking <code>{i.subscription}</code>
      </span>
      <span>nothing is acked</span>
    </>
  ),
  consume: (i) => (
    <>
      <span>
        consuming <code>{i.subscription}</code>
      </span>
      <span>every message is acked</span>
    </>
  ),
  publish: (i) => (
    <>
      <span>
        publishing to <code>{i.topic}</code>
      </span>
      <span>not reading</span>
    </>
  ),
};

function MessageList({ tab, w, p, live }: { tab: Tab; w: WsResult; p: PubsubSession; live: boolean }) {
  const notify = useStore((s) => s.notify);
  const clear = useStore((s) => s.clearSocketMessages);
  const pause = useStore((s) => s.pausePubsub);
  const pull = useStore((s) => s.pullPubsub);
  const reconnect = useStore((s) => s.openSocket);
  const [show, setShow] = useState<Show>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const base = w.dropped ?? 0;
  const info = p.info!;
  const pullMax = Math.min(1000, Math.max(1, Math.floor(tab.request.pubsub?.pullMax || defaultPubsub().pullMax)));

  // follow new messages while the list is scrolled to the bottom
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [w.messages.length, w.close, p.pulls?.length]);

  const all = useMemo(() => w.messages.map((m, i) => ({ m, n: base + i + 1 })), [w.messages, base]);
  const q = query.trim().toLowerCase();
  const keep = ({ m }: { m: WsMessage }) =>
    m.kind === "ack" ||
    ((show === "all" || m.dir === show) && (!q || dataText(m).toLowerCase().includes(q) || attrText(m).toLowerCase().includes(q) || (m.key ?? "").toLowerCase().includes(q)));
  const shown = all.filter(keep);
  const rows = thread(shown, all, live);
  const records = shown.filter(({ m }) => m.kind === "record");
  // Peek: each pull's line sits above the first message it brought
  const pullsBefore = (n: number) => (p.pulls ?? []).filter((x) => x.after === n - 1);
  const pullsAfterAll = (p.pulls ?? []).filter((x) => x.after >= base + w.messages.length);
  const pullLine = (x: NonNullable<PubsubSession["pulls"]>[number]) => (
    <div key={`p${x.n}`} className="smsg-sys">
      <Download {...ico} />
      <span className="t">{seconds(x.atMs)}</span>
      <span className="s">
        <span>
          Pull {x.n}: {x.count === 1 ? "1 message" : `${x.count} messages`}
          {x.skipped > 0 && `, ${x.skipped} already shown`}
          {x.count + x.skipped > 0 && ", handed back"}
        </span>
        {x.n === 1 && info.deadLetter && <span>dead-letter after {info.deadLetter.maxAttempts} attempts</span>}
      </span>
    </div>
  );

  const copyAll = async () => {
    try {
      const out = records.map(({ m }) => ({
        dir: m.dir === "in" ? "received" : "published",
        ...(m.messageId && { messageId: m.messageId }),
        ...(m.ts !== undefined && { publishTime: new Date(m.ts).toISOString() }),
        ...(m.key !== undefined && { orderingKey: m.key }),
        ...(m.headers?.length && { attributes: Object.fromEntries(m.headers.map((h) => [h.key, h.value])) }),
        data: m.valueBin ? { base64: m.data } : parseMaybe(m.data),
      }));
      await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
      notify(out.length === 1 ? "1 message copied" : `${out.length} messages copied`);
    } catch (e) {
      notify(`Copy failed: ${e}`);
    }
  };

  const toggle = (n: number) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const reading = p.mode === "temp" || p.mode === "consume";
  return (
    <>
      <div className="res-tools">
        <div className="seg" role="group" aria-label="Show">
          {(
            [
              ["all", "All"],
              ["in", "Received"],
              ["out", "Published"],
            ] as [Show, string][]
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={show === v} onClick={() => setShow(v)}>
              {label}
            </button>
          ))}
        </div>
        <label className="res-search">
          <Search {...ico} />
          <input placeholder="Data or attribute contains" aria-label="Filter by data or attribute" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <span style={{ marginLeft: "auto" }} />
        {live && p.mode === "peek" && (
          <button type="button" className="btn" title="Pull once; every message goes straight back to the subscription" onClick={() => pull(tab.id)}>
            <Download {...ico} />
            Pull {pullMax}
          </button>
        )}
        {live &&
          reading &&
          (p.paused ? (
            <button type="button" className="icon-btn" title="Resume reading" aria-label="Resume" onClick={() => pause(tab.id, false)}>
              <Play {...ico} />
            </button>
          ) : (
            <button type="button" className="icon-btn" title="Pause reading" aria-label="Pause" onClick={() => pause(tab.id, true)}>
              <Pause {...ico} />
            </button>
          ))}
        <button type="button" className="icon-btn" title="Copy messages as JSON" aria-label="Copy messages" disabled={!records.length} onClick={copyAll}>
          <Copy {...ico} />
        </button>
        <button type="button" className="icon-btn" title="Clear the list" aria-label="Clear the list" disabled={!w.messages.length} onClick={() => clear(tab.id)}>
          <Trash2 {...ico} />
        </button>
      </div>
      <div className="res-body">
        <div
          className="stream"
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
        >
          <div className="smsg-sys ok">
            {p.mode === "peek" ? <Eye {...ico} /> : <Plug {...ico} />}
            <span className="t">{seconds(0)}</span>
            <span className="s">
              <span>
                Connected to <b>{info.project}</b>
              </span>
              {MODE_LINE[info.mode](info)}
              {info.emulator ? <span>emulator</span> : info.identity && <span title={info.identity}>{who(info.identity)}</span>}
              {p.connectedMs !== undefined && <span>{p.connectedMs} ms</span>}
            </span>
          </div>
          {base > 0 && <div className="smsg-wait">{num(base)} earlier messages not kept</div>}
          {rows.map((r) => (
            <Fragment key={`${r.slot}${r.n}`}>
              {r.slot === "msg" && r.m.dir === "in" && pullsBefore(r.n).map(pullLine)}
              {r.slot === "wait" ? (
                <div className="smsg-wait ack-wait" role="status">
                  <span className="spinner" />
                  Waiting for Pub/Sub
                </div>
              ) : r.slot === "ack" ? (
                <AckRow n={r.recN ?? r.n} m={r.m} />
              ) : (
                <MessageRow n={r.n} m={r.m} info={info} open={open.has(r.n)} onToggle={() => toggle(r.n)} />
              )}
            </Fragment>
          ))}
          {pullsAfterAll.map(pullLine)}
          {live && reading && !p.paused && (
            <div className="smsg-wait">
              <span className="spinner" />
              Reading, waiting for new messages
            </div>
          )}
          {live && reading && p.paused && (
            <div className="smsg-wait paused">
              <Pause {...ico} />
              Paused. New messages wait on the subscription; Resume reads them.
            </div>
          )}
          {live && p.mode === "peek" && (
            <div className="smsg-wait">
              <Eye {...ico} />
              {p.pulls?.length ? "Pull reads again. Peek never reads on its own." : "Press Pull to look into the subscription. Peek never reads on its own."}
            </div>
          )}
          {w.close && (
            <div className="smsg-end" role="status">
              <span className={w.close.by === "client" ? "ok" : "fail"}>{w.close.by === "client" ? "Disconnected" : "Lost"}</span>
              <span className="end-text" title={w.close.reason}>
                {w.close.by === "client" ? `${w.close.reason || "You disconnected"} · after ${duration(w.close.elapsedMs)}` : `${w.close.reason} · after ${duration(w.close.elapsedMs)}`}
              </span>
              {!tab.example && !live && (
                <button type="button" className="link" onClick={() => reconnect(tab.id)}>
                  Reconnect
                </button>
              )}
            </div>
          )}
          {!live && !w.close && records.length === 0 && <div className="smsg-wait">No messages</div>}
        </div>
      </div>
    </>
  );
}

const parseMaybe = (s: string): unknown => {
  const t = s.trimStart();
  if (!t.startsWith("{") && !t.startsWith("[")) return s;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
};

function MessageRow({ n, m, info, open, onToggle }: { n: number; m: WsMessage; info: PubsubInfo; open: boolean; onToggle: () => void }) {
  const body = useMemo(() => {
    if (!open) return null;
    if (m.valueBin) return { hex: hexDump(m.data) };
    const p = parseMaybe(m.data);
    return typeof p === "string" ? { text: m.data } : { html: highlightLines(JSON.stringify(p, null, 2), true) };
  }, [open, m.valueBin, m.data]);
  const max = info.deadLetter?.maxAttempts;
  return (
    <>
      <button type="button" className={`smsg ${m.dir}`} aria-expanded={open} aria-label={`${m.dir === "in" ? "Received" : "Published"} message ${n}`} onClick={onToggle}>
        {m.dir === "in" ? <ArrowDown {...ico} /> : <ArrowUp {...ico} />}
        <span className="n">{n}</span>
        <span className="t">{seconds(m.atMs)}</span>
        <span className="p">
          {m.dir === "in" && m.messageId && <span className="kp">{m.messageId}</span>}
          {m.attempt !== undefined && <span className="rtag">attempt {m.attempt}</span>}
          {m.key ? <span className="ev">{m.key}</span> : <span className="ev nokey">unordered</span>}
          {dataText(m) || <i className="null">no data</i>}
        </span>
      </button>
      {open && body && (
        <div className="smsg-open">
          <dl className="kdetail">
            {m.messageId && (
              <>
                <dt>Message ID</dt>
                <dd>{m.messageId}</dd>
              </>
            )}
            {m.ts !== undefined && (
              <>
                <dt>Published</dt>
                <dd>{recordTime(m.ts)}</dd>
              </>
            )}
            <dt>Ordering key</dt>
            <dd>{m.key || <span className="dim">none</span>}</dd>
            {!!m.headers?.length && (
              <>
                <dt>Attributes</dt>
                <dd>
                  {m.headers.map((h, i) => (
                    <span key={i} className="hrow">
                      <span className="hk">{h.key}:</span> {h.bin ? `${b64ToHex(h.value)} (hex)` : h.value}
                    </span>
                  ))}
                </dd>
              </>
            )}
            {m.attempt !== undefined && (
              <>
                <dt>Delivery</dt>
                <dd>
                  attempt {m.attempt}
                  {max ? ` of ${max}` : ""}
                  {max && info.deadLetter && m.attempt >= max - 1 && <span className="dim"> one more and it moves to {info.deadLetter.topic}</span>}
                </dd>
              </>
            )}
            {m.handed && (
              <>
                <dt>Ack</dt>
                <dd>
                  {m.handed === "acked" ? "acked" : "handed back"}
                  <span className="dim">
                    {m.handed === "returned" ? " ack deadline set to 0" : info.mode === "temp" ? " temporary subscription, nobody else reads it" : ` gone from ${info.subscription}`}
                  </span>
                </dd>
              </>
            )}
          </dl>
          <p className="kvalue-h">Data · {formatBytes(m.size)}</p>
          {"html" in body ? (
            <pre className="code" dangerouslySetInnerHTML={{ __html: body.html! }} />
          ) : "hex" in body ? (
            <pre className="hex">{body.hex}</pre>
          ) : (
            <pre className="code ws-text">{body.text}</pre>
          )}
        </div>
      )}
    </>
  );
}

/** Pub/Sub's answer to a publish: the message ID it gave, or why it refused. */
function AckRow({ n, m }: { n: number; m: WsMessage }) {
  return (
    <div className={`smsg ack${m.error ? " ack-fail" : ""}`} role="status">
      <CornerDownLeft {...ico} />
      <span className="n">{n}</span>
      <span className="t">{seconds(m.atMs)}</span>
      <span className="p">
        {m.error ? (
          <>
            <span className="ack-tag">failed</span>
            {m.error}
          </>
        ) : (
          <>
            <span className="ack-tag">published</span>
            message ID <b>{m.messageId}</b>
            {m.ackMs !== undefined && ` · ${m.ackMs} ms`}
          </>
        )}
      </span>
    </div>
  );
}

// ---------- topic ----------

function TopicView({ tab, info, live }: { tab: Tab; info: PubsubInfo; live: boolean }) {
  const refresh = useStore((s) => s.refreshPubsub);
  const subs = info.subscriptions;
  return (
    <div className="res-body">
      <div className="hs">
        <div>
          <h4>
            {info.topic}
            {live && (
              <button type="button" className="btn btn--quiet hs-refresh" onClick={() => refresh(tab.id)}>
                <RefreshCw {...ico} />
                Refresh
              </button>
            )}
          </h4>
          <dl>
            <dt>Name</dt>
            <dd>
              projects/{info.project}/topics/{info.topic}
            </dd>
            <dt>Endpoint</dt>
            <dd>{info.emulator ? `${info.endpoint} (emulator)` : info.endpoint}</dd>
            <dt>Message retention</dt>
            <dd>{info.retention ?? <span className="dim">off</span>}</dd>
            <dt>Schema</dt>
            <dd>{info.schema ?? <span className="dim">none</span>}</dd>
            <dt>Encryption</dt>
            <dd>{info.kms ?? "Google-managed key"}</dd>
            {info.labels.length > 0 && (
              <>
                <dt>Labels</dt>
                <dd>
                  {info.labels.map((l) => (
                    <span key={l.key} className="hrow">
                      {l.key}: {l.value}
                    </span>
                  ))}
                </dd>
              </>
            )}
            {info.identity && (
              <>
                <dt>Signed in as</dt>
                <dd>{info.identity}</dd>
              </>
            )}
          </dl>
        </div>
        <div>
          <h4>
            Subscriptions {subs && <span className="dim">{subs.length}</span>}
          </h4>
          {subs ? (
            subs.length ? (
              <table className="ktable">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Delivery</th>
                    <th className="num">Ack deadline</th>
                    <th>Filter</th>
                    <th>Dead letter</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.name}>
                      <td>
                        {s.name}
                        {info.mode === "temp" && s.name === info.subscription && (
                          <>
                            {" "}
                            <span className="rpc-tag rpc-tag--stream">yours</span>
                          </>
                        )}
                      </td>
                      <td>{s.endpoint ? `${s.delivery} · ${s.endpoint}` : s.delivery}</td>
                      <td className="num">{s.delivery === "Pull" || s.delivery === "Push" ? `${s.ackDeadline} s` : "n/a"}</td>
                      <td className={s.filter ? "wrap" : "dim"}>{s.filter ?? "none"}</td>
                      <td className={s.deadLetter ? undefined : "dim"}>{s.deadLetter ?? "none"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="hs-note">No subscriptions on this topic yet.</p>
            )
          ) : (
            <p className="hs-note">{info.subsError ?? "Subscriptions could not be listed."}</p>
          )}
          <p className="hs-note">
            Peek and Consume work on Pull subscriptions only.
            {info.mode === "temp" && (
              <>
                {" "}
                <b>yours</b> is deleted on Disconnect.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- failures ----------

function Failed({ tab, p }: { tab: Tab; p: PubsubSession }) {
  const openModal = useStore((s) => s.openModal);
  const update = useStore((s) => s.updateRequest);
  const f = p.failed!;
  const def = tab.request.pubsub ?? defaultPubsub();
  const setMode = (mode: PubsubMode) => update(tab.id, { pubsub: { ...def, mode } });
  const title =
    f.stage === "auth"
      ? "Couldn’t get an access token"
      : f.stage === "topic"
        ? `Couldn’t open topic ${p.topic} in ${p.project}`
        : p.mode === "temp"
          ? "Couldn’t make the temporary subscription"
          : `Couldn’t read subscription ${def.subscription || ""}`.trim();
  const denied = /PERMISSION_DENIED|403/.test(f.message);
  const network = /dns|resolve|connect|timed out|unreachable|refused/i.test(f.message) && !/PERMISSION|UNAUTH/.test(f.message);
  return (
    <div className="res-body">
      <div className="ws-fail" role="alert">
        <strong>
          <TriangleAlert {...ico} />
          {title}
        </strong>
        <span className="msg">{f.message}</span>
        {f.hint && <span className="why">{f.hint}</span>}
        <div className="acts">
          {f.stage === "subscription" && p.mode === "temp" && denied && !tab.example && (
            <>
              <button type="button" className="link" onClick={() => setMode("peek")}>
                Peek instead
              </button>
              <button type="button" className="link" onClick={() => setMode("publish")}>
                Publish only
              </button>
            </>
          )}
          {(f.stage === "auth" || denied) && <span className="muted">Check the Auth tab.</span>}
          {network && (
            <button type="button" className="link" onClick={() => openModal({ kind: "settings", section: "network" })}>
              Open Network settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
