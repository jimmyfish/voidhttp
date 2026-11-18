import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MqttConnInfo, MqttSession, Tab, WsMessage, WsResult } from "../types";
import { formatBytes } from "../lib/model";
import { highlightLines } from "../lib/highlight";
import { hexDump, hexPreview } from "../lib/ws";
import { recordTime } from "../lib/kafka";
import { reasonWords, topicMatches } from "../lib/mqtt";
import { useStore } from "../store";
import { RunBanner, RunsButton } from "./Runs";
import { useDismiss } from "./useDismiss";
import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, CornerDownLeft, ListFilter, Pause, Play, Plug, Search, Trash2, TriangleAlert, ico, icoLg } from "./Icon";

type Sub = "messages" | "connection";
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
const hex = (c: number) => `0x${c.toString(16).toUpperCase().padStart(2, "0")}`;

/** How each way of failing reads in the status line. */
const FAILED: Record<string, string> = {
  connect: "No connection",
  tls: "TLS failed",
  ws: "WebSocket refused",
  mqtt: "No MQTT answer",
  refused: "Refused",
};

/** The response side of an MQTT tab: messages received and published, and the broker's answer to Connect. */
export function MqttResponsePane({ tab, grow }: { tab: Tab; grow: number }) {
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
      <div className="error-box" role="alert">
        <strong>Could not connect</strong>
        <span className="msg">{tab.error}</span>
      </div>,
    );
  if (!w?.mqtt)
    return shell(
      <>
        <div className="res-head">
          <RunsButton tab={tab} />
        </div>
        <div className="empty">
          <Plug {...icoLg} />
          <strong>Not connected</strong>
          <span>Connect subscribes to the filters in Topics. Messages you receive and publish show up here.</span>
        </div>
      </>,
    );
  const m = w.mqtt;
  const live = !!tab.inflightId;
  if (!m.conn && !m.failed && !w.close)
    return shell(
      <div className="empty" role="status">
        <div className="spinner" />
        <span>Connecting to the broker…</span>
      </div>,
    );

  const count = (w.dropped ?? 0) + w.messages.filter((x) => x.kind === "publish").length;
  return shell(
    <>
      {tab.fromHistory && <RunBanner tab={tab} hint="Connect to subscribe again" />}
      <nav className="subtabs" aria-label="Response">
        <button type="button" className="subtab" aria-pressed={sub === "messages"} onClick={() => setSub("messages")}>
          Messages {count > 0 && <span className="n">{count}</span>}
        </button>
        <button type="button" className="subtab" aria-pressed={sub === "connection"} disabled={!m.conn} onClick={() => setSub("connection")}>
          Connection
        </button>
        <StatusLine w={w} m={m} live={live} />
        {!live && <RunsButton tab={tab} />}
      </nav>
      {m.failed ? <Failed m={m} /> : sub === "connection" && m.conn ? <ConnectionView c={m.conn} /> : <MessageList tab={tab} w={w} m={m} live={live} />}
    </>,
  );
}

function StatusLine({ w, m, live }: { w: WsResult; m: MqttSession; live: boolean }) {
  const [, tick] = useState(0);
  // the time connected counts up
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [live]);
  const size = w.messages.reduce((n, x) => n + (x.kind === "publish" ? x.size : 0), 0);
  if (m.failed)
    return (
      <span className="meta">
        <span className="fail">{m.failed.stage === "refused" && m.failed.code !== undefined ? m.failed.message.replace(/^CONNACK /, "") : (FAILED[m.failed.stage] ?? "Failed")}</span>
        <span className="dim">{duration(m.failed.elapsedMs)}</span>
      </span>
    );
  const openFor = w.close ? w.close.elapsedMs : Math.max(0, Date.now() - w.startedAt - (m.conn?.connectMs ?? 0));
  const granted = Object.values(m.subs).filter((s) => s.granted !== undefined).length;
  const c = w.close;
  return (
    <span className="meta">
      {c ? (
        <span className={c.by === "client" ? "ok" : "fail"}>{c.by === "client" ? "Disconnected" : c.by === "server" ? reasonWords(c.reason).split(":")[0] : "Connection lost"}</span>
      ) : (
        <span className="live">
          <span className="live-dot" aria-hidden="true" />
          Connected
        </span>
      )}
      <span className="dim">{granted === 1 ? "1 subscription" : `${granted} subscriptions`}</span>
      <span className="dim">{duration(openFor)}</span>
      <span className="dim">{formatBytes(size)}</span>
    </span>
  );
}

// ---------- messages ----------

type Row = { m: WsMessage; n: number; slot: "msg" | "ack" | "wait" | "sent"; pubN?: number };

/** Messages in order, each ack moved under the publish it answers; a wait line while it has none, "sent" for QoS 0. */
function thread(shown: { m: WsMessage; n: number }[], all: { m: WsMessage; n: number }[], live: boolean): Row[] {
  const acks = new Map<number, { m: WsMessage; n: number }>();
  for (const x of all) if (x.m.kind === "ack" && x.m.ackId !== undefined) acks.set(x.m.ackId, x);
  const pubs = new Set(all.filter((x) => x.m.kind === "publish" && x.m.dir === "out").map((x) => x.m.ackId));
  const rows: Row[] = [];
  for (const x of shown) {
    if (x.m.kind === "ack") continue;
    rows.push({ ...x, slot: "msg" });
    if (x.m.dir !== "out" || x.m.ackId === undefined) continue;
    const a = acks.get(x.m.ackId);
    if (a) rows.push({ ...a, slot: "ack", pubN: x.n });
    else if (!x.m.qos) rows.push({ ...x, slot: "sent" });
    else if (live) rows.push({ ...x, slot: "wait" });
  }
  // a publish refused before it left (bad topic, over the broker's limits) has an ack and no publish row
  for (const x of shown) if (x.m.kind === "ack" && x.m.error && !pubs.has(x.m.ackId)) rows.push({ ...x, slot: "ack" });
  return rows;
}

const payloadText = (m: WsMessage) => (m.valueBin ? hexPreview(m.data) : m.data);

function MessageList({ tab, w, m, live }: { tab: Tab; w: WsResult; m: MqttSession; live: boolean }) {
  const notify = useStore((s) => s.notify);
  const clear = useStore((s) => s.clearSocketMessages);
  const reconnect = useStore((s) => s.openSocket);
  const [show, setShow] = useState<Show>("all");
  const [only, setOnly] = useState<Set<string> | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  // paused: the list stops growing here (messages still arrive and are kept)
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const base = w.dropped ?? 0;
  useEffect(() => setPausedAt(null), [w.connId]);

  // follow new messages while the list is scrolled to the bottom
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [w.messages.length, w.close, pausedAt]);

  const total = base + w.messages.length;
  const cut = pausedAt === null ? w.messages.length : Math.max(0, Math.min(w.messages.length, pausedAt - base));
  const all = useMemo(() => w.messages.slice(0, cut).map((x, i) => ({ m: x, n: base + i + 1 })), [w.messages, base, cut]);
  const waiting = pausedAt === null ? 0 : w.messages.slice(cut).filter((x) => x.kind === "publish" && x.dir === "in").length;
  const topics = useMemo(() => {
    const seen = new Map<string, number>();
    for (const x of w.messages) if (x.kind === "publish" && x.topic) seen.set(x.topic, (seen.get(x.topic) ?? 0) + 1);
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [w.messages]);
  const q = query.trim().toLowerCase();
  const keep = ({ m: x }: { m: WsMessage }) =>
    x.kind === "ack" ||
    ((show === "all" || x.dir === show) && (!only || only.has(x.topic ?? "")) && (!q || (x.topic ?? "").toLowerCase().includes(q) || payloadText(x).toLowerCase().includes(q)));
  const shown = all.filter(keep);
  const rows = thread(shown, all, live);
  const pubs = shown.filter(({ m: x }) => x.kind === "publish");

  const copyAll = async () => {
    try {
      const out = pubs.map(({ m: x }) => ({
        dir: x.dir === "in" ? "received" : "published",
        topic: x.topic,
        qos: x.qos ?? 0,
        ...(x.retain && { retain: true }),
        ...(x.props && { properties: x.props }),
        payload: x.valueBin ? { base64: x.data } : parseMaybe(x.data),
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

  const conn = m.conn;
  const subs = Object.entries(m.subs);
  const denied = subs.filter(([, s]) => s.error);
  const lowered = subs.filter(([, s]) => s.granted !== undefined && s.granted < s.qos);
  const granted = subs.filter(([, s]) => s.granted !== undefined);
  // where a received message came from: the granted filters it matches
  const matched = (topic?: string) => (topic ? granted.filter(([f]) => topicMatches(f, topic)).map(([f, s]) => `${f} · QoS ${s.granted}`) : []);
  const startAt = w.startedAt + (conn?.connectMs ?? 0);

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
        <TopicFilter topics={topics} only={only} onChange={setOnly} />
        <label className="res-search">
          <Search {...ico} />
          <input placeholder="Topic or payload contains" aria-label="Filter by topic or payload" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <span style={{ marginLeft: "auto" }} />
        {live &&
          (pausedAt !== null ? (
            <button type="button" className="icon-btn" title="Resume the list" aria-label="Resume" onClick={() => setPausedAt(null)}>
              <Play {...ico} />
            </button>
          ) : (
            <button type="button" className="icon-btn" title="Pause the list (messages are still received)" aria-label="Pause" onClick={() => setPausedAt(total)}>
              <Pause {...ico} />
            </button>
          ))}
        <button type="button" className="icon-btn" title="Copy messages as JSON" aria-label="Copy messages" disabled={!pubs.length} onClick={copyAll}>
          <Copy {...ico} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="Clear the list"
          aria-label="Clear the list"
          disabled={!w.messages.length}
          onClick={() => {
            setPausedAt(null);
            clear(tab.id);
          }}
        >
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
          {conn && (
            <div className="smsg-sys ok">
              <Plug {...ico} />
              <span className="t">{seconds(0)}</span>
              <span className="s">
                <span>
                  Connected to <b>{conn.broker}</b>
                </span>{" "}
                · MQTT {conn.version} · {conn.transport}
                {conn.cleanStart ? " · clean start" : conn.sessionPresent ? " · session resumed" : " · new session"} · {conn.connectMs} ms
              </span>
            </div>
          )}
          {subs.length > 0 && (
            <div className={`smsg-sys${denied.length ? " warn" : " ok"}`}>
              {denied.length ? <TriangleAlert {...ico} /> : <Check {...ico} />}
              <span className="t" />
              <span className="s" title={subs.map(([f, s]) => `${f}: ${s.error ?? `QoS ${s.granted}`}`).join("\n")}>
                Subscribed to{" "}
                <span className="grant">
                  {granted.length === subs.length ? (granted.length === 1 ? "1 filter" : `${granted.length} filters`) : `${granted.length} of ${subs.length}`}
                </span>
                {denied.map(([f, s]) => (
                  <span key={f}>
                    {" · "}
                    <code>{f}</code> <span className="deny">{s.error}</span>
                  </span>
                ))}
                {lowered.map(([f, s]) => (
                  <span key={f}>
                    {" · "}
                    <code>{f}</code> granted QoS {s.granted}, asked {s.qos}
                  </span>
                ))}
              </span>
            </div>
          )}
          {base > 0 && <div className="smsg-wait">{num(base)} earlier messages not kept</div>}
          {rows.map((r) =>
            r.slot === "wait" ? (
              <div key={`w${r.n}`} className="smsg-wait ack-wait" role="status">
                <span className="spinner" />
                Waiting for the broker
              </div>
            ) : r.slot === "sent" ? (
              <div key={`s${r.n}`} className="smsg ack q0" role="status">
                <CornerDownLeft {...ico} />
                <span className="n">{r.n}</span>
                <span className="t">{seconds(r.m.atMs)}</span>
                <span className="p">
                  <span className="ack-tag">sent</span>QoS 0 has no ack from the broker
                </span>
              </div>
            ) : r.slot === "ack" ? (
              <AckRow key={`a${r.n}`} n={r.pubN ?? r.n} m={r.m} />
            ) : (
              <MessageRow key={r.n} n={r.n} m={r.m} open={open.has(r.n)} onToggle={() => toggle(r.n)} matched={matched} startAt={startAt} />
            ),
          )}
          {live && pausedAt === null && (
            <div className="smsg-wait">
              <span className="spinner" />
              {granted.length ? `Listening on ${granted.length === 1 ? "1 topic filter" : `${granted.length} topic filters`}` : "Connected. Add a topic filter in Topics to receive messages."}
            </div>
          )}
          {live && pausedAt !== null && (
            <div className="smsg-wait paused">
              <Pause {...ico} />
              {waiting === 0 ? "Paused. Nothing new yet." : `Paused. ${num(waiting)} new ${waiting === 1 ? "message" : "messages"} since then; Resume shows them.`}
            </div>
          )}
          {w.close && <CloseRow tab={tab} w={w} conn={conn} live={live} onReconnect={() => reconnect(tab.id)} />}
          {!live && !w.close && pubs.length === 0 && <div className="smsg-wait">No messages</div>}
        </div>
      </div>
    </>
  );
}

function CloseRow({ tab, w, conn, live, onReconnect }: { tab: Tab; w: WsResult; conn?: MqttConnInfo; live: boolean; onReconnect: () => void }) {
  const c = w.close!;
  const after = `after ${duration(c.elapsedMs)}`;
  let lead: ReactNode;
  let text: string;
  if (c.by === "client") {
    lead = <span className="ok">Disconnected</span>;
    text = c.reason === "Cancelled" ? "You stopped the connect" : `You disconnected ${after}`;
  } else if (c.by === "server") {
    lead = <span className="warn">{`${hex(c.code)} ${reasonWords(c.reason).split(":")[0]}`}</span>;
    const why = c.reason.includes(":") ? c.reason.slice(c.reason.indexOf(":") + 1).trim() : "";
    text =
      c.code === 0x8e
        ? `Broker closed the connection ${after}: another client connected with client ID ${conn?.clientId ?? "this one"}.${conn && !conn.randomId ? " Leave Client ID empty for a random one." : ""}`
        : `Broker closed the connection ${after}${why ? `: ${why}` : ""}`;
  } else {
    lead = <span className="fail">Lost</span>;
    text = `${c.reason} · ${after}`;
  }
  return (
    <div className="smsg-end" role="status">
      {lead}
      <span className="end-text" title={c.reason}>
        {text}
      </span>
      {!tab.example && !live && (
        <button type="button" className="link" onClick={onReconnect}>
          Reconnect
        </button>
      )}
    </div>
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

function MessageRow({
  n,
  m,
  open,
  onToggle,
  matched,
  startAt,
}: {
  n: number;
  m: WsMessage;
  open: boolean;
  onToggle: () => void;
  matched: (topic?: string) => string[];
  startAt: number;
}) {
  const text = payloadText(m);
  const body = useMemo(() => {
    if (!open) return null;
    if (m.valueBin) return { hex: hexDump(m.data) };
    if (!m.data) return { text: "" };
    const p = parseMaybe(m.data);
    return typeof p === "string" ? { text: m.data } : { html: highlightLines(JSON.stringify(p, null, 2), true) };
  }, [open, m.valueBin, m.data]);
  const p = m.props;
  const from = m.dir === "in" ? matched(m.topic) : [];
  return (
    <>
      <button type="button" className={`smsg ${m.dir}`} aria-expanded={open} aria-label={`${m.dir === "in" ? "Received" : "Published"} message ${n}`} onClick={onToggle}>
        {m.dir === "in" ? <ArrowDown {...ico} /> : <ArrowUp {...ico} />}
        <span className="n">{n}</span>
        <span className="t">{seconds(m.atMs)}</span>
        <span className="p">
          <span className="ev" title={m.topic}>
            {m.topic}
          </span>
          <span className="qtag">Q{m.qos ?? 0}</span>
          {m.retain && <span className="rtag">retained</span>}
          {m.size === 0 ? <i className="null">empty</i> : text}
        </span>
      </button>
      {open && body && (
        <div className="smsg-open">
          <dl className="kdetail">
            <dt>Topic</dt>
            <dd>{m.topic}</dd>
            {from.length > 0 && (
              <>
                <dt>Matched</dt>
                <dd>
                  {from.map((f) => (
                    <span key={f} className="hrow">
                      {f}
                    </span>
                  ))}
                </dd>
              </>
            )}
            <dt>QoS</dt>
            <dd>
              {m.qos ?? 0}
              {m.packetId !== undefined && <span className="dim"> · packet {m.packetId}</span>}
              {m.dup && <span className="dim"> · resent (dup)</span>}
            </dd>
            <dt>Retained</dt>
            <dd>{m.retain ? (m.dir === "in" ? "yes: the broker kept it and sent it on subscribe" : "yes") : "no"}</dd>
            <dt>Time</dt>
            <dd>{recordTime(startAt + m.atMs)}</dd>
            {p && (
              <>
                <dt>Properties</dt>
                <dd>
                  {p.contentType !== undefined && (
                    <span className="hrow">
                      <span className="hk">content-type:</span> {p.contentType}
                    </span>
                  )}
                  {p.utf8 !== undefined && (
                    <span className="hrow">
                      <span className="hk">payload-format:</span> {p.utf8 ? "UTF-8" : "bytes"}
                    </span>
                  )}
                  {p.messageExpiry !== undefined && (
                    <span className="hrow">
                      <span className="hk">message-expiry:</span> {p.messageExpiry} s
                    </span>
                  )}
                  {p.responseTopic !== undefined && (
                    <span className="hrow">
                      <span className="hk">response-topic:</span> {p.responseTopic}
                    </span>
                  )}
                  {p.correlation !== undefined && (
                    <span className="hrow">
                      <span className="hk">correlation-data:</span> {p.correlationBin ? `${hexPreview(p.correlation)} (hex)` : p.correlation}
                    </span>
                  )}
                  {p.subscriptionIds?.length ? (
                    <span className="hrow">
                      <span className="hk">subscription-id:</span> {p.subscriptionIds.join(", ")}
                    </span>
                  ) : null}
                  {p.user?.map((u, i) => (
                    <span key={i} className="hrow">
                      <span className="hk">{u.key}:</span> {u.value} <span className="dim">user property</span>
                    </span>
                  ))}
                </dd>
              </>
            )}
          </dl>
          <p className="kvalue-h">
            Payload · {formatBytes(m.size)}
            {m.valueBin && " · not text, shown as hex"}
          </p>
          {"html" in body ? (
            <pre className="code" dangerouslySetInnerHTML={{ __html: body.html! }} />
          ) : "hex" in body ? (
            <pre className="hex">{body.hex}</pre>
          ) : (
            <pre className="code ws-text">{body.text || <i className="null">empty</i>}</pre>
          )}
        </div>
      )}
    </>
  );
}

/** The broker's answer to a publish, or why it never left. */
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
            <span className="ack-tag">{m.ack === "PUBACK" ? "acked" : "delivered"}</span>
            <b>{m.ack}</b>
            {m.packetId !== undefined && ` · packet ${m.packetId}`}
            {m.reason ? ` · ${m.reason}` : " · 0x00 Success"}
            {m.ackMs !== undefined && ` · ${m.ackMs} ms`}
          </>
        )}
      </span>
    </div>
  );
}

/** Which topics the list shows. */
function TopicFilter({ topics, only, onChange }: { topics: [string, number][]; only: Set<string> | null; onChange: (s: Set<string> | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const names = topics.map(([t]) => t);
  const toggle = (t: string) => {
    const next = new Set(only ?? names);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    onChange(names.every((x) => next.has(x)) ? null : next);
  };
  const shown = only ? names.filter((t) => only.has(t)).length : names.length;
  return (
    <div className="ev-filter-wrap" ref={ref}>
      <button type="button" className="ev-filter" aria-haspopup="menu" aria-expanded={open} disabled={!topics.length} onClick={() => setOpen(!open)}>
        <ListFilter {...ico} />
        {only ? (
          <span className="on">
            Topics: {shown} of {names.length}
          </span>
        ) : (
          "Topics: all"
        )}
        <ChevronDown {...ico} />
      </button>
      {open && (
        <div className="menu ev-menu" role="menu" aria-label="Topics to show">
          {topics.map(([t, count]) => {
            const on = !only || only.has(t);
            return (
              <button key={t} type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => toggle(t)}>
                {on ? <Check {...ico} /> : <span className="tick-gap" />}
                <code>{t}</code>
                <span className="cnt">{count}</span>
              </button>
            );
          })}
          <hr />
          <button type="button" role="menuitem" disabled={!only} onClick={() => onChange(null)}>
            <span className="tick-gap" />
            Show all topics
          </button>
          <p className="menu-note">Only the list is filtered; the subscriptions stay as they are.</p>
        </div>
      )}
    </div>
  );
}

// ---------- connection ----------

const yesNo = (b?: boolean) => (b === undefined ? "available" : b ? "available" : "not available");

function ConnectionView({ c }: { c: MqttConnInfo }) {
  const v5 = c.version.startsWith("5");
  const row = (label: string, value: ReactNode) => (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
  return (
    <div className="res-body">
      <div className="hs">
        <div>
          <h4>CONNECT</h4>
          <dl>
            {row(
              "Broker",
              <>
                {c.broker}
                {c.ip && <span className="dim"> ({c.ip})</span>}
              </>,
            )}
            {row(
              "Transport",
              <>
                {c.transport}
                {c.path && <span className="dim"> · path {c.path}</span>}
              </>,
            )}
            {row("Protocol", `MQTT ${c.version}`)}
            {row(
              "Client ID",
              <>
                {c.clientId}
                {c.assignedId ? <span className="dim"> assigned by the broker</span> : c.randomId ? <span className="dim"> random</span> : null}
              </>,
            )}
            {row("Clean start", c.cleanStart ? "yes" : "no")}
            {v5 &&
              row(
                "Session expiry",
                c.sessionExpiry === 0 ? (
                  <>
                    0 <span className="dim">ends with the connection</span>
                  </>
                ) : (
                  `${num(c.sessionExpiry)} s`
                ),
              )}
            {row("Username", c.username ?? <span className="dim">none</span>)}
            {row("Last Will", c.will ?? <span className="dim">none</span>)}
          </dl>
        </div>
        <div>
          <h4>
            CONNACK <span className="ok">0x00 {v5 ? "Success" : "Connection Accepted"}</span>
          </h4>
          <dl>
            {row("Session present", c.sessionPresent ? "yes: the broker kept your earlier subscriptions and queued messages" : "no")}
            {row(
              "Keep alive",
              c.serverKeepAlive !== undefined ? (
                <>
                  <span className="warn-v">{c.keepAlive} s</span> <span className="dim">the broker set it</span>
                </>
              ) : c.keepAlive === 0 ? (
                "off"
              ) : (
                `${c.keepAlive} s`
              ),
            )}
            {v5 && (
              <>
                {row("Maximum QoS", c.maxQos ?? 2)}
                {row("Retain", yesNo(c.retainAvailable))}
                {row("Wildcards", yesNo(c.wildcards))}
                {row("Shared subscriptions", yesNo(c.shared))}
                {row("Subscription IDs", yesNo(c.subIds))}
                {row("Receive maximum", c.receiveMax ?? 65535)}
                {row("Max packet size", c.maxPacketSize !== undefined ? formatBytes(c.maxPacketSize) : <span className="dim">no limit</span>)}
                {row("Topic alias maximum", c.topicAliasMax ?? 0)}
                {c.responseInfo !== undefined && row("Response information", c.responseInfo)}
                {c.reason !== undefined && row("Reason", c.reason)}
                {!!c.user?.length &&
                  row(
                    "User properties",
                    c.user.map((u, i) => (
                      <span key={i} className="hrow">
                        <span className="hk">{u.key}:</span> {u.value}
                      </span>
                    )),
                  )}
              </>
            )}
          </dl>
          {!v5 && <p className="hs-note">MQTT 3.1.1 brokers don’t say more about themselves; MQTT 5 ones list their limits here.</p>}
        </div>
      </div>
    </div>
  );
}

// ---------- failures ----------

function Failed({ m }: { m: MqttSession }) {
  const openModal = useStore((s) => s.openModal);
  const f = m.failed!;
  const title =
    f.stage === "refused"
      ? `${f.broker} refused the connection`
      : f.stage === "tls"
        ? `TLS with ${f.broker} failed`
        : f.stage === "ws"
          ? `${f.broker} refused the WebSocket`
          : f.stage === "mqtt"
            ? `${f.broker} didn’t answer as an MQTT broker`
            : `Couldn’t reach ${f.broker}`;
  const network = f.stage === "connect" && /resolve|DNS|VPN/.test(f.hint ?? "");
  const login = f.stage === "refused" && f.code !== undefined && [0x86, 0x87, 4, 5].includes(f.code);
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
          {(login || f.stage === "tls") && <span className="muted">Check the Auth tab.</span>}
          {network && (
            <button type="button" className="link" onClick={() => openModal({ kind: "settings", section: "network" })}>
              Open Network settings
            </button>
          )}
          {f.stage === "tls" && (
            <button type="button" className="link" onClick={() => openModal({ kind: "settings", section: "certificates" })}>
              Open Certificates
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
