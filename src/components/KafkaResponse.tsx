import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KafkaCluster, KafkaSeek, KafkaSession, Tab, WsMessage, WsResult } from "../types";
import { formatBytes } from "../lib/model";
import { highlightLines } from "../lib/highlight";
import { hexDump, hexPreview } from "../lib/ws";
import { b64ToHex, recordTime, seekLabel } from "../lib/kafka";
import { useStore } from "../store";
import { LayoutSwitch } from "./LayoutSwitch";
import { RunBanner, RunsButton } from "./Runs";
import { useDismiss } from "./useDismiss";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  CornerDownLeft,
  HistoryIcon,
  ListFilter,
  Pause,
  Play,
  Plug,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
  ico,
  icoLg,
} from "./Icon";

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
const ACKS: Record<number, string> = { 0: "none", 1: "leader", [-1]: "all" };

/** How each way of failing reads in the status line. */
const FAILED: Record<string, string> = {
  connect: "No connection",
  tls: "TLS failed",
  sasl: "SASL login failed",
  broker: "Broker unreachable",
  topic: "Topic not found",
};

/** The response side of a Kafka tab: records read and produced, and the topic's partitions. */
export function KafkaResponsePane({ tab, grow }: { tab: Tab; grow: number }) {
  const [sub, setSub] = useState<Sub>("messages");
  const w = tab.ws;
  // a new connection starts on its records
  useEffect(() => setSub("messages"), [w?.connId]);

  const shell = (children: React.ReactNode) => (
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
  if (!w?.kafka)
    return shell(
      <>
        <div className="res-head">
          <RunsButton tab={tab} />
          <LayoutSwitch />
        </div>
        <div className="empty">
          <Plug {...icoLg} />
          <strong>Not connected</strong>
          <span>Connect reads the topic. Records you read and records you produce show up here.</span>
          <span className="why">voidHTTP reads without a consumer group and never commits offsets, so your services keep every record.</span>
        </div>
      </>,
    );
  const k = w.kafka;
  const live = !!tab.inflightId;
  if (!k.cluster && !k.failed)
    return shell(
      <>
        <div className="res-head">
          <LayoutSwitch />
        </div>
        <div className="empty" role="status">
          <div className="spinner" />
          <span>Connecting to the cluster…</span>
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
        <button type="button" className="subtab" aria-pressed={sub === "topic"} disabled={!k.cluster} onClick={() => setSub("topic")}>
          Topic
        </button>
        <StatusLine w={w} k={k} live={live} />
        {!live && <RunsButton tab={tab} />}
        <LayoutSwitch />
      </nav>
      {k.failed ? (
        <Failed k={k} />
      ) : sub === "topic" ? (
        <TopicView tab={tab} cluster={k.cluster!} live={live} />
      ) : (
        <RecordList tab={tab} w={w} k={k} live={live} />
      )}
    </>,
  );
}

function StatusLine({ w, k, live }: { w: WsResult; k: KafkaSession; live: boolean }) {
  const [, tick] = useState(0);
  // the time connected counts up
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [live]);
  const size = w.messages.reduce((n, m) => n + (m.kind === "record" ? m.size : 0), 0);
  if (k.failed)
    return (
      <span className="meta">
        <span className="fail">{FAILED[k.failed.stage] ?? "Failed"}</span>
        <span className="dim">{duration(k.failed.elapsedMs)}</span>
      </span>
    );
  const openFor = w.close ? w.close.elapsedMs : Math.max(0, Date.now() - w.startedAt - (k.connectedMs ?? 0));
  const parts = k.cluster?.partitions.length ?? 0;
  return (
    <span className="meta">
      {w.close ? (
        <span className={w.close.by === "client" ? "ok" : "fail"}>{w.close.by === "client" ? "Disconnected" : "Connection lost"}</span>
      ) : k.paused ? (
        <span className="redir">Paused</span>
      ) : (
        <span className="live">
          <span className="live-dot" aria-hidden="true" />
          Reading
        </span>
      )}
      <span className="dim">{parts === 1 ? "1 partition" : `${parts} partitions`}</span>
      <span className="dim">{duration(openFor)}</span>
      <span className="dim">{formatBytes(size)}</span>
    </span>
  );
}

// ---------- records ----------

type Row = { m: WsMessage; n: number; slot: "msg" | "ack" | "wait"; recN?: number };

/** Records in order, each ack moved under the produce it answers, with a wait line while it has none. */
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
  // an ack whose produce is no longer in the list (a seek, or dropped off the top) still shows its error
  for (const x of shown) if (x.m.kind === "ack" && x.m.error && !all.some((y) => y.m.kind === "record" && y.m.ackId === x.m.ackId)) rows.push({ ...x, slot: "ack" });
  return rows;
}

const keyText = (m: WsMessage) => (m.key === undefined ? null : m.keyBin ? b64ToHex(m.key, 24) : m.key);
const valueText = (m: WsMessage) => (m.valueNull ? null : m.valueBin ? hexPreview(m.data) : m.data);

function RecordList({ tab, w, k, live }: { tab: Tab; w: WsResult; k: KafkaSession; live: boolean }) {
  const notify = useStore((s) => s.notify);
  const clear = useStore((s) => s.clearSocketMessages);
  const pause = useStore((s) => s.pauseKafka);
  const reconnect = useStore((s) => s.openSocket);
  const [show, setShow] = useState<Show>("all");
  const [only, setOnly] = useState<Set<number> | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const base = w.dropped ?? 0;
  const cluster = k.cluster!;

  // follow new records while the list is scrolled to the bottom
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [w.messages.length, w.close]);

  const all = useMemo(() => w.messages.map((m, i) => ({ m, n: base + i + 1 })), [w.messages, base]);
  const q = query.trim().toLowerCase();
  const keep = ({ m }: { m: WsMessage }) =>
    m.kind === "ack" ||
    ((show === "all" || m.dir === show) &&
      (!only || only.has(m.partition ?? -1)) &&
      (!q || (keyText(m) ?? "").toLowerCase().includes(q) || (valueText(m) ?? "").toLowerCase().includes(q)));
  const shown = all.filter(keep);
  const rows = thread(shown, all, live);
  const records = shown.filter(({ m }) => m.kind === "record");

  const copyAll = async () => {
    try {
      const out = records.map(({ m }) => ({
        dir: m.dir === "in" ? "read" : "produced",
        partition: m.partition,
        ...(m.offset !== undefined && { offset: m.offset }),
        ...(m.ts !== undefined && { timestamp: new Date(m.ts).toISOString() }),
        key: m.key === undefined ? null : m.keyBin ? { base64: m.key } : m.key,
        ...(m.headers?.length && { headers: Object.fromEntries(m.headers.map((h) => [h.key, h.bin ? { base64: h.value } : h.value])) }),
        value: m.valueNull ? null : m.valueBin ? { base64: m.data } : parseMaybe(m.data),
      }));
      await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
      notify(out.length === 1 ? "1 record copied" : `${out.length} records copied`);
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

  const ended = !live;
  return (
    <>
      <div className="res-tools">
        <div className="seg" role="group" aria-label="Show">
          {(
            [
              ["all", "All"],
              ["in", "Read"],
              ["out", "Produced"],
            ] as [Show, string][]
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={show === v} onClick={() => setShow(v)}>
              {label}
            </button>
          ))}
        </div>
        <SeekMenu tab={tab} k={k} disabled={ended} />
        <PartitionFilter partitions={cluster.partitions.map((p) => p.partition)} only={only} onChange={setOnly} />
        <label className="res-search">
          <Search {...ico} />
          <input placeholder="Key or value contains" aria-label="Filter by key or value" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <span style={{ marginLeft: "auto" }} />
        {live &&
          (k.paused ? (
            <button type="button" className="icon-btn" title="Resume reading" aria-label="Resume" onClick={() => pause(tab.id, false)}>
              <Play {...ico} />
            </button>
          ) : (
            <button type="button" className="icon-btn" title="Pause reading" aria-label="Pause" onClick={() => pause(tab.id, true)}>
              <Pause {...ico} />
            </button>
          ))}
        <button type="button" className="icon-btn" title="Copy records as JSON" aria-label="Copy records" disabled={!records.length} onClick={copyAll}>
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
            <Plug {...ico} />
            <span className="t">{seconds(0)}</span>
            <span className="s">
              <span>
                Connected to <b>{cluster.brokers.length === 1 ? "1 broker" : `${cluster.brokers.length} brokers`}</b>
              </span>
              <span>
                <code>{cluster.topic}</code>, {cluster.partitions.length === 1 ? "1 partition" : `${cluster.partitions.length} partitions`}
              </span>
              <span>from {seekLabel(k.from)}</span>
              {(cluster.sasl || cluster.tls) && <span>{[cluster.sasl, cluster.tls && "TLS"].filter(Boolean).join(" · ")}</span>}
              {k.connectedMs !== undefined && <span>{k.connectedMs} ms</span>}
            </span>
          </div>
          {base > 0 && <div className="smsg-wait">{num(base)} earlier records not kept</div>}
          {rows.map((r) =>
            r.slot === "wait" ? (
              <div key={`w${r.n}`} className="smsg-wait ack-wait" role="status">
                <span className="spinner" />
                Waiting for the broker
              </div>
            ) : r.slot === "ack" ? (
              <AckRow key={`a${r.n}`} n={r.recN ?? r.n} m={r.m} />
            ) : (
              <RecordRow key={r.n} n={r.n} m={r.m} open={open.has(r.n)} onToggle={() => toggle(r.n)} />
            ),
          )}
          {live && !k.paused && (
            <div className="smsg-wait">
              <span className="spinner" />
              Reading, waiting for new records
            </div>
          )}
          {live && k.paused && (
            <div className="smsg-wait paused">
              <Pause {...ico} />
              {k.waiting === undefined
                ? "Paused. Resume to read on."
                : k.waiting === 0
                  ? "Paused. Nothing new on the topic yet."
                  : `Paused. ${num(k.waiting)} new ${k.waiting === 1 ? "record" : "records"} on the topic since then; Resume shows them.`}
            </div>
          )}
          {w.close && (
            <div className="smsg-end" role="status">
              <span className={w.close.by === "client" ? "ok" : "fail"}>{w.close.by === "client" ? "Disconnected" : "Lost"}</span>
              <span className="end-text" title={w.close.reason}>
                {w.close.by === "client" ? `You disconnected after ${duration(w.close.elapsedMs)}` : `${w.close.reason} · after ${duration(w.close.elapsedMs)}`}
              </span>
              {!tab.example && !live && (
                <button type="button" className="link" onClick={() => reconnect(tab.id)}>
                  Reconnect
                </button>
              )}
            </div>
          )}
          {!live && !w.close && records.length === 0 && <div className="smsg-wait">No records</div>}
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

function RecordRow({ n, m, open, onToggle }: { n: number; m: WsMessage; open: boolean; onToggle: () => void }) {
  const key = keyText(m);
  const value = valueText(m);
  const body = useMemo(() => {
    if (!open) return null;
    if (m.valueNull) return { text: "null (a tombstone: the record has no value)" };
    if (m.valueBin) return { hex: hexDump(m.data) };
    const p = parseMaybe(m.data);
    return typeof p === "string" ? { text: m.data } : { html: highlightLines(JSON.stringify(p, null, 2), true) };
  }, [open, m.valueNull, m.valueBin, m.data]);
  return (
    <>
      <button
        type="button"
        className={`smsg ${m.dir}`}
        aria-expanded={open}
        aria-label={`${m.dir === "in" ? "Read" : "Produced"} record ${n}`}
        onClick={onToggle}
      >
        {m.dir === "in" ? <ArrowDown {...ico} /> : <ArrowUp {...ico} />}
        <span className="n">{n}</span>
        <span className="t">{seconds(m.atMs)}</span>
        <span className="p">
          {m.dir === "in" && (
            <span className="kp">
              {m.partition} · {m.offset}
            </span>
          )}
          {key === null ? <span className="ev nokey">no key</span> : <span className="ev">{key}</span>}
          {value === null ? <i className="null">null</i> : value}
        </span>
      </button>
      {open && body && (
        <div className="smsg-open">
          <dl className="kdetail">
            <dt>Partition</dt>
            <dd>{m.dir === "out" && m.offset === undefined ? `${m.partition} (picked)` : m.partition}</dd>
            {m.offset !== undefined && (
              <>
                <dt>Offset</dt>
                <dd>{m.offset}</dd>
              </>
            )}
            {m.ts !== undefined && (
              <>
                <dt>Time</dt>
                <dd>{recordTime(m.ts)}</dd>
              </>
            )}
            <dt>Key</dt>
            <dd>
              {key === null ? <span className="dim">none</span> : key}
              {m.keyBin && <span className="dim"> hex</span>}
            </dd>
            {!!m.headers?.length && (
              <>
                <dt>Headers</dt>
                <dd>
                  {m.headers.map((h, i) => (
                    <span key={i} className="hrow">
                      <span className="hk">{h.key}:</span> {h.bin ? `${b64ToHex(h.value)} (hex)` : h.value}
                    </span>
                  ))}
                </dd>
              </>
            )}
          </dl>
          <p className="kvalue-h">Value · {formatBytes(m.size)}</p>
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

/** The broker's answer to a produce: where it stored the record, or why it did not. */
function AckRow({ n, m }: { n: number; m: WsMessage }) {
  const acks = ACKS[m.acks ?? -1] ?? "all";
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
        ) : m.offset === undefined ? (
          <>
            <span className="ack-tag">sent</span>
            partition <b>{m.partition}</b> · acks none, so the broker doesn’t confirm
          </>
        ) : (
          <>
            <span className="ack-tag">stored</span>
            partition <b>{m.partition}</b> · offset <b>{m.offset}</b> · acks {acks}
            {m.ackMs !== undefined && ` · ${m.ackMs} ms`}
          </>
        )}
      </span>
    </div>
  );
}

// ---------- toolbar menus ----------

/** Where reading starts: latest, earliest, the last 100, a time, or one partition at an offset. */
function SeekMenu({ tab, k, disabled }: { tab: Tab; k: KafkaSession; disabled: boolean }) {
  const seek = useStore((s) => s.seekKafka);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<null | "time" | "offset">(null);
  const close = () => {
    setOpen(false);
    setForm(null);
  };
  const ref = useDismiss(open, close);
  const parts = k.cluster?.partitions ?? [];
  const now = new Date(Date.now() - 10 * 60_000);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const [time, setTime] = useState(local);
  const [part, setPart] = useState(parts[0]?.partition ?? 0);
  const [offset, setOffset] = useState("");
  const go = (from: KafkaSeek) => {
    seek(tab.id, from);
    close();
  };
  const is = (kind: KafkaSeek["kind"], n?: number) => k.from.kind === kind && (n === undefined || (k.from.kind === "last" && k.from.n === n));
  const item = (label: string, sub: string, on: boolean, run: () => void) => (
    <button type="button" role="menuitemradio" aria-checked={on} onClick={run}>
      {on ? <Check {...ico} /> : <span className="tick-gap" />}
      <span>{label}</span>
      <span className="sub">{sub}</span>
    </button>
  );
  const range = parts.find((p) => p.partition === part);

  return (
    <div className="ev-filter-wrap" ref={ref}>
      <button type="button" className="ev-filter" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => (open ? close() : setOpen(true))}>
        <HistoryIcon {...ico} />
        From: {seekLabel(k.from)}
        <ChevronDown {...ico} />
      </button>
      {open && (
        <div className="menu ev-menu seek-menu" role="menu" aria-label="Read from">
          {item("Latest", "new records only", is("latest"), () => go({ kind: "latest" }))}
          {item("Earliest", "all the topic keeps", is("earliest"), () => go({ kind: "earliest" }))}
          {item("Last 100", "per partition", is("last", 100), () => go({ kind: "last", n: 100 }))}
          {item("From a time…", "e.g. 10 minutes ago", is("time"), () => setForm(form === "time" ? null : "time"))}
          {form === "time" && (
            <form
              className="menu-form"
              onSubmit={(e) => {
                e.preventDefault();
                const ms = new Date(time).getTime();
                if (Number.isFinite(ms)) go({ kind: "time", ms });
              }}
            >
              <input className="field" type="datetime-local" aria-label="Read from this time" value={time} onChange={(e) => setTime(e.target.value)} />
              <button type="submit" className="btn btn--primary">
                Read
              </button>
            </form>
          )}
          {item("From an offset…", "one partition", is("offset"), () => setForm(form === "offset" ? null : "offset"))}
          {form === "offset" && (
            <form
              className="menu-form"
              onSubmit={(e) => {
                e.preventDefault();
                const o = Number(offset);
                if (offset.trim() && Number.isInteger(o)) go({ kind: "offset", partition: part, offset: o });
              }}
            >
              <select className="field" aria-label="Partition" value={part} onChange={(e) => setPart(Number(e.target.value))}>
                {parts.map((p) => (
                  <option key={p.partition} value={p.partition}>
                    Partition {p.partition}
                  </option>
                ))}
              </select>
              <input
                className="field"
                inputMode="numeric"
                aria-label="Offset"
                placeholder={range?.earliest !== undefined ? `${range.earliest}–${range.latest}` : "offset"}
                value={offset}
                onChange={(e) => setOffset(e.target.value.replace(/\D/g, ""))}
              />
              <button type="submit" className="btn btn--primary">
                Read
              </button>
            </form>
          )}
          <p className="menu-note">Changing this clears the list and reads again.</p>
        </div>
      )}
    </div>
  );
}

/** Which partitions the list shows. */
function PartitionFilter({ partitions, only, onChange }: { partitions: number[]; only: Set<number> | null; onChange: (s: Set<number> | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const toggle = (p: number) => {
    const next = new Set(only ?? partitions);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    onChange(partitions.every((x) => next.has(x)) ? null : next);
  };
  const shown = only ? partitions.filter((p) => only.has(p)).length : partitions.length;
  return (
    <div className="ev-filter-wrap" ref={ref}>
      <button type="button" className="ev-filter" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ListFilter {...ico} />
        {only ? (
          <span className="on">
            Partitions: {shown} of {partitions.length}
          </span>
        ) : (
          "Partitions: all"
        )}
        <ChevronDown {...ico} />
      </button>
      {open && (
        <div className="menu ev-menu" role="menu" aria-label="Partitions to show">
          {partitions.map((p) => {
            const on = !only || only.has(p);
            return (
              <button key={p} type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => toggle(p)}>
                {on ? <Check {...ico} /> : <span className="tick-gap" />}
                <code>Partition {p}</code>
                <span className="cnt" />
              </button>
            );
          })}
          <hr />
          <button type="button" role="menuitem" disabled={!only} onClick={() => onChange(null)}>
            <span className="tick-gap" />
            Show all partitions
          </button>
          <p className="menu-note">Only the list is filtered; every partition is still read.</p>
        </div>
      )}
    </div>
  );
}

// ---------- topic ----------

function TopicView({ tab, cluster, live }: { tab: Tab; cluster: KafkaCluster; live: boolean }) {
  const refresh = useStore((s) => s.refreshKafka);
  const host = (id: number) => cluster.brokers.find((b) => b.id === id);
  const replication = Math.max(0, ...cluster.partitions.map((p) => p.replicas.length));
  const under = cluster.partitions.filter((p) => p.isr.length < p.replicas.length);
  const controller = cluster.controllerId !== undefined ? host(cluster.controllerId) : undefined;
  return (
    <div className="res-body">
      <div className="hs">
        <div>
          <h4>
            Cluster
            {live && (
              <button type="button" className="btn btn--quiet hs-refresh" onClick={() => refresh(tab.id)}>
                <RefreshCw {...ico} />
                Refresh
              </button>
            )}
          </h4>
          <dl>
            {cluster.clusterId && (
              <>
                <dt>Cluster ID</dt>
                <dd>{cluster.clusterId}</dd>
              </>
            )}
            {controller && (
              <>
                <dt>Controller</dt>
                <dd>
                  broker {controller.id} · {controller.host}:{controller.port}
                </dd>
              </>
            )}
            <dt>Brokers</dt>
            <dd>
              {cluster.brokers.map((b) => (
                <span key={b.id} className="hrow">
                  {b.id} · {b.host}:{b.port}
                  {b.rack && <span className="dim"> · rack {b.rack}</span>}
                </span>
              ))}
            </dd>
            <dt>Answered by</dt>
            <dd>{cluster.bootstrap}</dd>
          </dl>
        </div>
        <div>
          <h4>
            {cluster.topic}{" "}
            <span className="dim">
              {cluster.partitions.length === 1 ? "1 partition" : `${cluster.partitions.length} partitions`} · replication {replication}
            </span>
          </h4>
          <table className="ktable">
            <thead>
              <tr>
                <th>Partition</th>
                <th>Leader</th>
                <th>Replicas</th>
                <th>In sync</th>
                <th className="num">Earliest</th>
                <th className="num">Latest</th>
                <th className="num">Records</th>
              </tr>
            </thead>
            <tbody>
              {cluster.partitions.map((p) => (
                <tr key={p.partition}>
                  <td>{p.partition}</td>
                  <td className={p.leader < 0 ? "warn" : undefined}>{p.leader < 0 ? "none" : p.leader}</td>
                  <td>{p.replicas.join(", ")}</td>
                  <td className={p.isr.length < p.replicas.length ? "warn" : undefined}>{p.isr.join(", ") || "none"}</td>
                  <td className="num">{p.earliest !== undefined ? num(p.earliest) : "–"}</td>
                  <td className="num">{p.latest !== undefined ? num(p.latest) : "–"}</td>
                  <td className="num">{p.earliest !== undefined && p.latest !== undefined ? num(p.latest - p.earliest) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hs-note">
            {under.length > 0 && (
              <>
                <span className="warn">
                  {under.length === 1 ? `Partition ${under[0].partition} is under-replicated:` : `${under.length} partitions are under-replicated:`}
                </span>{" "}
                a replica has fallen behind.{" "}
              </>
            )}
            Records = latest − earliest; a compacted topic may hold fewer.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- failures ----------

function Failed({ k }: { k: KafkaSession }) {
  const openModal = useStore((s) => s.openModal);
  const f = k.failed!;
  const title =
    f.stage === "sasl"
      ? `${f.broker ?? "The broker"} refused the login`
      : f.stage === "broker"
        ? `Reached the cluster, but not broker ${f.broker?.split(" ·")[0] ?? ""}`.trim()
        : f.stage === "topic"
          ? `Topic ${k.topic} isn’t there`
          : f.stage === "tls"
            ? `TLS with ${f.broker ?? "the broker"} failed`
            : `Couldn’t reach ${f.broker ?? "the brokers"}`;
  const network = f.stage === "broker" || (f.stage === "connect" && /resolve|DNS|VPN/.test(f.hint ?? ""));
  return (
    <div className="res-body">
      <div className="ws-fail" role="alert">
        <strong>
          <TriangleAlert {...ico} />
          {title}
        </strong>
        <span className="msg">{f.stage === "broker" && f.broker ? `${f.broker.split(" · ")[1] ?? f.broker}: ${f.message}` : f.message}</span>
        {f.hint && <span className="why">{f.hint}</span>}
        {f.stage === "topic" && !!f.topics?.length && (
          <span className="why">
            Topics on this cluster: {f.topics.slice(0, 12).join(", ")}
            {f.topics.length > 12 ? `, and ${f.topics.length - 12} more` : ""}
          </span>
        )}
        <div className="acts">
          {(f.stage === "sasl" || f.stage === "tls") && <span className="muted">Check the Auth tab.</span>}
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
