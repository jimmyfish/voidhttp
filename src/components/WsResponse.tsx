import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SioSession, Tab, WsClose, WsMessage, WsResult } from "../types";
import { formatBytes } from "../lib/model";
import { highlightLines } from "../lib/highlight";
import { CLOSE_NAMES, closeOk, hexDump, hexPreview } from "../lib/ws";
import { argsPreview, refusedHint } from "../lib/sio";
import { useStore } from "../store";
import { RunBanner, RunsButton } from "./Runs";
import { ArrowDown, ArrowUp, Check, ChevronDown, Clock, Copy, CornerDownLeft, ListFilter, Plug, Trash2, TriangleAlert, ico, icoLg } from "./Icon";

type Sub = "messages" | "handshake";
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
const pretty = (text: string): string | null => {
  const t = text.trimStart();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return null;
  }
};
const closeLabel = (c: Pick<WsClose, "code">) => `${c.code} ${CLOSE_NAMES[c.code] ?? ""}`.trim();

/** Socket.IO's disconnect reasons, as the status line says them. */
const SIO_ENDS: Record<string, string> = {
  "io server disconnect": "Disconnected by server",
  "io client disconnect": "Disconnected",
  "transport close": "Connection closed",
  "transport error": "Connection lost",
  "ping timeout": "Ping timeout",
  "parse error": "Parse error",
  connect_error: "connect_error",
};
const sioOk = (c: WsClose) => c.reason === "io client disconnect";

/** The response side of a WebSocket tab: the live message list, and the handshake. */
export function WsResponsePane({ tab, grow }: { tab: Tab; grow: number }) {
  const [sub, setSub] = useState<Sub>("messages");
  const w = tab.ws;
  // a new connection starts on its messages
  useEffect(() => setSub("messages"), [w?.connId]);

  const shell = (children: React.ReactNode) => (
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
  if (!w)
    return shell(
      <>
        <div className="res-head">
          <RunsButton tab={tab} />
        </div>
        <div className="empty">
          <Plug {...icoLg} />
          <strong>Not connected</strong>
          <span>
            {tab.request.method === "SIO"
              ? "Connect opens the socket and joins the namespace. Events show up here as they come and go."
              : "Connect opens the socket. Messages show up here as they come and go."}
          </span>
        </div>
      </>,
    );
  if (!w.handshake)
    return shell(
      <div className="empty" role="status">
        <div className="spinner" />
        <span>Connecting…</span>
      </div>,
    );

  const live = !!tab.inflightId;
  const count = (w.dropped ?? 0) + w.messages.length;
  return shell(
    <>
      {tab.fromHistory && <RunBanner tab={tab} hint="Connect to open it again" />}
      <nav className="subtabs" aria-label="Response">
        <button type="button" className="subtab" aria-pressed={sub === "messages"} onClick={() => setSub("messages")}>
          {w.sio ? "Events" : "Messages"} {count > 0 && <span className="n">{count}</span>}
        </button>
        <button type="button" className="subtab" aria-pressed={sub === "handshake"} onClick={() => setSub("handshake")}>
          Handshake
        </button>
        <StatusLine w={w} live={live} />
        {!live && <RunsButton tab={tab} />}
      </nav>
      {sub === "handshake" ? (
        <Handshake w={w} />
      ) : w.refused ? (
        <Refused tab={tab} w={w} onHandshake={() => setSub("handshake")} />
      ) : w.sio?.error ? (
        <NamespaceRefused sio={w.sio} onHandshake={() => setSub("handshake")} />
      ) : (
        <MessageList tab={tab} w={w} live={live} />
      )}
    </>,
  );
}

function StatusLine({ w, live }: { w: WsResult; live: boolean }) {
  const [, tick] = useState(0);
  // the time open counts up while connected
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [live]);
  const hs = w.handshake!;
  const count = (w.dropped ?? 0) + w.messages.length;
  const size = w.messages.reduce((n, m) => n + m.size, 0);
  const openFor = w.close ? w.close.elapsedMs : Date.now() - w.startedAt - hs.elapsedMs;
  if (w.sio) {
    const sio = w.sio;
    const ended = sio.error ? hs.elapsedMs : w.refused ? hs.elapsedMs : Math.max(0, openFor);
    return (
      <span className="meta">
        {w.refused ? (
          <span className="fail">
            {hs.status} {hs.statusText}
          </span>
        ) : sio.error ? (
          <span className="fail">connect_error</span>
        ) : w.close ? (
          <span className={sioOk(w.close) ? "ok" : "fail"}>{SIO_ENDS[w.close.reason] ?? w.close.reason}</span>
        ) : (
          <span className="live">
            <span className="live-dot" aria-hidden="true" />
            {sio.joinedMs === undefined ? "Joining" : "Connected"}
          </span>
        )}
        {!w.refused && <span className="dim">{sio.namespace}</span>}
        <span className="dim">{duration(ended)}</span>
        {!w.refused && !sio.error && <span className="dim">{formatBytes(size)}</span>}
      </span>
    );
  }
  return (
    <span className="meta">
      {w.refused ? (
        <span className="fail">
          {hs.status} {hs.statusText}
        </span>
      ) : w.close ? (
        <span className={closeOk(w.close) ? "ok" : "fail"}>{closeLabel(w.close)}</span>
      ) : (
        <span className="live">
          <span className="live-dot" aria-hidden="true" />
          Connected
        </span>
      )}
      <span className="dim">{duration(w.refused ? hs.elapsedMs : Math.max(0, openFor))}</span>
      {!w.refused && <span className="dim">{count === 1 ? "1 message" : `${count} messages`}</span>}
      {!w.refused && <span className="dim">{formatBytes(size)}</span>}
    </span>
  );
}

/** Messages, newest last; click one to read it in full. */
function MessageList({ tab, w, live }: { tab: Tab; w: WsResult; live: boolean }) {
  const notify = useStore((s) => s.notify);
  const clear = useStore((s) => s.clearSocketMessages);
  const reconnect = useStore((s) => s.openSocket);
  const [show, setShow] = useState<Show>("all");
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const base = w.dropped ?? 0;
  const hs = w.handshake!;

  // follow new messages while the list is scrolled to the bottom
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [w.messages.length, w.close]);

  const sio = w.sio;
  const [only, setOnly] = useState<Set<string> | null>(null);
  const all = useMemo(() => w.messages.map((m, i) => ({ m, n: base + i + 1 })), [w.messages, base]);
  const keep = ({ m }: { m: WsMessage }) => (show === "all" || m.dir === show) && (!only || m.kind === "ack" || only.has(m.event ?? ""));
  const shown = all.filter(keep);
  const rows: Row[] = sio ? threadAcks(shown, w, live) : shown.map((x) => ({ ...x, slot: "msg" }));
  const waiting = rows.some((r) => r.slot === "wait");
  const [, tick] = useState(0);
  // the ack wait counts up
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => tick((x) => x + 1), 200);
    return () => clearInterval(t);
  }, [waiting]);

  const copyAll = async () => {
    try {
      const out = shown.map(({ m }) =>
        sio
          ? {
              dir: m.dir === "in" ? "received" : "sent",
              ...(m.kind === "ack" ? { ack: m.ackId } : { event: m.event, ...(m.ackId !== undefined && { ackId: m.ackId }) }),
              args: parseArgs(m.data),
              atMs: m.atMs,
            }
          : {
              dir: m.dir === "in" ? "received" : "sent",
              atMs: m.atMs,
              ...(m.kind === "binary" ? { binary: m.data } : { data: m.data }),
            },
      );
      await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
      const noun = sio ? "event" : "message";
      notify(out.length === 1 ? `1 ${noun} copied` : `${out.length} ${noun}s copied`);
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

  return (
    <>
      <div className="res-tools">
        <div className="seg" role="group" aria-label="Show">
          {(
            [
              ["all", "All"],
              ["in", "Received"],
              ["out", "Sent"],
            ] as [Show, string][]
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={show === v} onClick={() => setShow(v)}>
              {label}
            </button>
          ))}
        </div>
        {sio && <EventFilter messages={w.messages} only={only} onChange={setOnly} />}
        <span style={{ marginLeft: "auto" }} />
        <button
          type="button"
          className="icon-btn"
          title={sio ? "Copy events as JSON" : "Copy messages as JSON"}
          aria-label={sio ? "Copy events" : "Copy messages"}
          disabled={!shown.length}
          onClick={copyAll}
        >
          <Copy {...ico} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title={sio ? "Clear events" : "Clear messages"}
          aria-label={sio ? "Clear events" : "Clear messages"}
          disabled={!w.messages.length}
          onClick={() => clear(tab.id)}
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
          {!sio ? (
            <div className="smsg-sys ok">
              <Plug {...ico} />
              <span className="t">{seconds(0)}</span>
              <span className="s">
                Connected to <b>{w.url}</b> · {hs.status} {hs.statusText}
                {hs.protocol ? ` · ${hs.protocol}` : ""} · {hs.elapsedMs} ms
              </span>
            </div>
          ) : (
            sio.joinedMs !== undefined && (
              <div className="smsg-sys ok">
                <Plug {...ico} />
                <span className="t">{seconds(sio.joinedMs)}</span>
                <span className="s">
                  <span>
                    Joined <b>{sio.namespace}</b>
                  </span>
                  {sio.sid && (
                    <span>
                      sid <code>{sio.sid}</code>
                    </span>
                  )}
                  <span>websocket</span>
                  <span>{hs.elapsedMs + sio.joinedMs} ms</span>
                </span>
              </div>
            )
          )}
          {base > 0 && <div className="smsg-wait">{base} earlier {sio ? "events" : "messages"} not kept</div>}
          {rows.map((r) =>
            r.slot === "wait" ? (
              <AckWait key={`w${r.n}`} m={r.m} w={w} />
            ) : r.slot === "late" ? (
              <div key={`l${r.n}`} className="smsg-wait ack-late">
                <Clock {...ico} />
                No ack within {r.m.ackMs} ms
              </div>
            ) : (
              <MessageRow key={r.m.kind === "ack" ? `a${r.n}` : r.n} n={r.slot === "ack" ? r.emitN! : r.n} m={r.m} open={open.has(r.n)} onToggle={() => toggle(r.n)} />
            ),
          )}
          {live && (
            <div className="smsg-wait">
              <span className="spinner" />
              {!sio ? "Connected · waiting for messages" : sio.joinedMs === undefined ? `Joining ${sio.namespace}…` : "Connected, listening for events"}
            </div>
          )}
          {w.close && !sio?.error && <CloseRow close={w.close} sio={!!sio} onReconnect={tab.example || live ? undefined : () => reconnect(tab.id)} />}
          {!live && !w.close && w.messages.length === 0 && <div className="smsg-wait">{sio ? "No events" : "No messages"}</div>}
        </div>
      </div>
    </>
  );
}

function MessageRow({ n, m, open, onToggle }: { n: number; m: WsMessage; open: boolean; onToggle: () => void }) {
  const binary = m.kind === "binary";
  const sio = m.kind === "event" || m.kind === "ack";
  const body = useMemo(() => {
    if (!open) return null;
    if (binary) return { hex: hexDump(m.data) };
    if (sio) {
      // one argument shows as itself, several as their array; a string argument as plain text
      const args = parseArgs(m.data);
      const v = Array.isArray(args) && args.length === 1 ? args[0] : args;
      return typeof v === "string" ? { text: v } : { html: highlightLines(JSON.stringify(v, null, 2) ?? "", true) };
    }
    const p = pretty(m.data);
    return p ? { html: highlightLines(p, true) } : { text: m.data };
  }, [open, binary, sio, m.data]);
  const ack = m.kind === "ack";
  return (
    <>
      <button
        type="button"
        className={`smsg ${ack ? "ack" : m.dir}`}
        aria-expanded={open}
        aria-label={ack ? `Ack for event ${n}` : `${m.dir === "in" ? "Received" : "Sent"} ${sio ? "event" : "message"} ${n}`}
        title={m.kind === "event" && m.dir === "in" && m.ackId !== undefined ? "The server asked for an ack" : undefined}
        onClick={onToggle}
      >
        {ack ? <CornerDownLeft {...ico} /> : m.dir === "in" ? <ArrowDown {...ico} /> : <ArrowUp {...ico} />}
        <span className="n">{n}</span>
        <span className="t">{seconds(m.atMs)}</span>
        <span className="p">
          {sio ? (
            <>
              {ack ? <span className="ack-tag">ack</span> : <span className="ev">{m.event}</span>}
              {argsPreview(m)}
            </>
          ) : binary ? (
            <>
              <span className="bin">Binary · {formatBytes(m.size)}</span>
              {hexPreview(m.data)}
            </>
          ) : (
            m.data
          )}
        </span>
      </button>
      {body && (
        <div className="smsg-open">
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

function CloseRow({ close, sio, onReconnect }: { close: WsClose; sio?: boolean; onReconnect?: () => void }) {
  const after = duration(close.elapsedMs);
  if (sio) {
    const text =
      close.reason === "io server disconnect"
        ? `The server disconnected the socket after ${after}`
        : close.reason === "ping timeout"
          ? `The server stopped answering pings; closed after ${after}`
          : close.by === "server"
            ? `The server closed the connection after ${after}`
            : close.by === "client"
              ? `You disconnected after ${after}`
              : `Connection lost after ${after}`;
    return (
      <div className="smsg-end" role="status">
        <span className={sioOk(close) ? "ok" : "fail"}>{close.reason}</span>
        <span className="end-text">{text}</span>
        {onReconnect && (
          <button type="button" className="link" onClick={onReconnect}>
            Reconnect
          </button>
        )}
      </div>
    );
  }
  const text =
    close.by === "server"
      ? `Server closed the connection after ${after}`
      : close.by === "client"
        ? `You closed the connection after ${after}`
        : `Connection lost after ${after}`;
  return (
    <div className="smsg-end" role="status">
      <span className={closeOk(close) ? "ok" : "fail"}>{closeLabel(close)}</span>
      <span className="end-text" title={close.reason || undefined}>
        {text}
        {close.reason ? ` · “${close.reason}”` : ""}
      </span>
      {onReconnect && (
        <button type="button" className="link" onClick={onReconnect}>
          Reconnect
        </button>
      )}
    </div>
  );
}

/** The upgrade request and the server's answer, header by header. */
function Handshake({ w }: { w: WsResult }) {
  const hs = w.handshake!;
  const ok = hs.status === 101;
  const target = (() => {
    try {
      const u = new URL(w.url);
      return `${u.pathname}${u.search}`;
    } catch {
      return w.url;
    }
  })();
  const sio = w.sio;
  return (
    <div className="res-body">
      <div className="hs">
        {sio?.engine && (
          <div>
            <h4>Engine.IO open</h4>
            <dl>
              <Pair k="sid" v={sio.engine.sid} />
              <Pair k="upgrades" v={JSON.stringify(sio.engine.upgrades)} />
              <Pair k="pingInterval" v={String(sio.engine.pingInterval)} />
              <Pair k="pingTimeout" v={String(sio.engine.pingTimeout)} />
              {sio.engine.maxPayload !== undefined && <Pair k="maxPayload" v={String(sio.engine.maxPayload)} />}
            </dl>
          </div>
        )}
        {sio && !w.refused && (
          <div>
            <h4>
              Namespace {sio.namespace}{" "}
              {sio.error ? <span className="fail">refused</span> : sio.joinedMs !== undefined ? <span className="ok">joined</span> : null}
            </h4>
            <dl>
              {sio.sid && <Pair k="sid" v={sio.sid} />}
              <Pair k="auth sent" v={sio.eio === 3 ? "none (Socket.IO 2)" : (sio.auth ?? "none")} />
              {sio.error && <Pair k="error" v={sio.error.message} />}
            </dl>
          </div>
        )}
        <div>
          <h4>{sio ? "Upgrade request" : "Request"}</h4>
          <dl>
            <dt>GET</dt>
            <dd>{target} HTTP/1.1</dd>
            {hs.requestHeaders.map((h, i) => (
              <Pair key={i} k={h.key} v={h.value} />
            ))}
          </dl>
        </div>
        <div>
          <h4>
            Response{" "}
            <span className={ok ? "ok" : "fail"}>
              {hs.status} {hs.statusText}
            </span>
          </h4>
          {hs.responseHeaders.length === 0 ? (
            <p className="muted">No headers</p>
          ) : (
            <dl>
              {hs.responseHeaders.map((h, i) => (
                <Pair key={i} k={h.key} v={h.value} />
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}

/** The server answered the upgrade with plain HTTP: its status and body stand in for the stream. */
function Refused({ tab, w, onHandshake }: { tab: Tab; w: WsResult; onHandshake: () => void }) {
  const hs = w.handshake!;
  const auth = hs.status === 401 || hs.status === 403;
  return (
    <div className="res-body">
      <div className="ws-fail" role="alert">
        <strong>
          <TriangleAlert {...ico} />
          {w.sio ? "The server refused the WebSocket upgrade" : "The server refused the upgrade"}
        </strong>
        <span className="msg">
          HTTP {hs.status} {hs.statusText} · expected 101 Switching Protocols
        </span>
        {hs.body && <span className="msg ws-fail-body">{hs.body}</span>}
        <div className="acts">
          {auth && !tab.example ? <span className="muted">Check the Auth tab.</span> : w.sio && <span className="muted">{refusedHint(hs.body)}</span>}
          <button type="button" className="link" onClick={onHandshake}>
            See handshake
          </button>
        </div>
      </div>
    </div>
  );
}

/** The namespace refused the join: the server's connect_error stands in for the stream. */
function NamespaceRefused({ sio, onHandshake }: { sio: SioSession; onHandshake: () => void }) {
  return (
    <div className="res-body">
      <div className="ws-fail" role="alert">
        <strong>
          <TriangleAlert {...ico} />
          The server refused namespace {sio.namespace}
        </strong>
        <span className="msg">connect_error: {sio.error!.message}</span>
        {sio.error!.data && <span className="msg ws-fail-body">{sio.error!.data}</span>}
        <div className="acts">
          <span className="muted">The socket opened; the namespace middleware said no.</span>
          <button type="button" className="link" onClick={onHandshake}>
            See handshake
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Socket.IO ----------

const parseArgs = (data: string): unknown => {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

type Row = { m: WsMessage; n: number; slot: "msg" | "ack" | "wait" | "late"; emitN?: number };

/** Events in order, each ack moved under the emit it answers, with a wait or a late line while it has none. */
function threadAcks(shown: { m: WsMessage; n: number }[], w: WsResult, live: boolean): Row[] {
  const emits = new Set<number>();
  for (const { m } of shown) if (m.dir === "out" && m.kind === "event" && m.ackId !== undefined) emits.add(m.ackId);
  const acks = new Map<number, { m: WsMessage; n: number }>();
  for (const x of shown) if (x.m.kind === "ack" && x.m.ackId !== undefined && emits.has(x.m.ackId)) acks.set(x.m.ackId, x);
  const late = new Set(w.sio?.late ?? []);
  const rows: Row[] = [];
  for (const x of shown) {
    if (x.m.kind === "ack" && x.m.ackId !== undefined && acks.get(x.m.ackId) === x) continue;
    rows.push({ ...x, slot: "msg" });
    if (x.m.dir !== "out" || x.m.ackId === undefined) continue;
    const a = acks.get(x.m.ackId);
    if (a) rows.push({ ...a, slot: "ack", emitN: x.n });
    else if (late.has(x.m.ackId)) rows.push({ ...x, slot: "late" });
    else if (live && !w.close) rows.push({ ...x, slot: "wait" });
  }
  return rows;
}

function AckWait({ m, w }: { m: WsMessage; w: WsResult }) {
  const openedAt = w.startedAt + (w.handshake?.elapsedMs ?? 0);
  const waited = Math.max(0, Date.now() - openedAt - m.atMs) / 1000;
  return (
    <div className="smsg-wait ack-wait" role="status">
      <span className="spinner" />
      Waiting for ack, {waited.toFixed(1)} s{m.ackMs ? ` of ${m.ackMs / 1000} s` : ""}
    </div>
  );
}

/** Which event names the list shows: a menu of the names seen so far, with counts. */
function EventFilter({ messages, only, onChange }: { messages: WsMessage[]; only: Set<string> | null; onChange: (s: Set<string> | null) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const names = useMemo(() => {
    const m = new Map<string, { in: number; out: number }>();
    for (const x of messages) {
      if (x.kind !== "event" || x.event === undefined) continue;
      const c = m.get(x.event) ?? { in: 0, out: 0 };
      c[x.dir]++;
      m.set(x.event, c);
    }
    return [...m.entries()];
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shownCount = only ? names.filter(([n]) => only.has(n)).length : names.length;
  const toggle = (name: string) => {
    const next = new Set(only ?? names.map(([n]) => n));
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(next.size === names.length && names.every(([n]) => next.has(n)) ? null : next);
  };

  return (
    <div className="ev-filter-wrap" ref={wrap}>
      <button type="button" className="ev-filter" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ListFilter {...ico} />
        {only ? <span className="on">Events: {shownCount} of {names.length}</span> : "Events: all"}
        <ChevronDown {...ico} />
      </button>
      {open && (
        <div className="menu ev-menu" role="menu" aria-label="Events to show">
          {names.map(([name, c]) => {
            const on = !only || only.has(name);
            return (
              <button key={name} type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => toggle(name)}>
                {on ? <Check {...ico} /> : <span className="tick-gap" />}
                <code>{name}</code>
                <span className="cnt">{c.in ? c.in : `${c.out} sent`}</span>
              </button>
            );
          })}
          {names.length > 0 && <hr />}
          <button type="button" role="menuitem" disabled={!only} onClick={() => onChange(null)}>
            <span className="tick-gap" />
            Show all events
          </button>
          <p className="menu-note">Names appear as events arrive.</p>
        </div>
      )}
    </div>
  );
}
