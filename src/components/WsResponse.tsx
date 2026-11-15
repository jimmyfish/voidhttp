import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Tab, WsClose, WsMessage, WsResult } from "../types";
import { formatBytes } from "../lib/model";
import { highlightLines } from "../lib/highlight";
import { CLOSE_NAMES, closeOk, hexDump, hexPreview } from "../lib/ws";
import { useStore } from "../store";
import { RunBanner, RunsButton } from "./Runs";
import { ArrowDown, ArrowUp, Copy, Plug, Trash2, TriangleAlert, ico, icoLg } from "./Icon";

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
          <span>Connect opens the socket. Messages show up here as they come and go.</span>
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
          Messages {count > 0 && <span className="n">{count}</span>}
        </button>
        <button type="button" className="subtab" aria-pressed={sub === "handshake"} onClick={() => setSub("handshake")}>
          Handshake
        </button>
        <StatusLine w={w} live={live} />
        {!live && <RunsButton tab={tab} />}
      </nav>
      {sub === "handshake" ? <Handshake w={w} /> : w.refused ? <Refused tab={tab} w={w} onHandshake={() => setSub("handshake")} /> : <MessageList tab={tab} w={w} live={live} />}
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

  const shown = w.messages.map((m, i) => ({ m, n: base + i + 1 })).filter(({ m }) => show === "all" || m.dir === show);

  const copyAll = async () => {
    try {
      const all = shown.map(({ m }) => ({
        dir: m.dir === "in" ? "received" : "sent",
        atMs: m.atMs,
        ...(m.kind === "binary" ? { binary: m.data } : { data: m.data }),
      }));
      await navigator.clipboard.writeText(JSON.stringify(all, null, 2));
      notify(all.length === 1 ? "1 message copied" : `${all.length} messages copied`);
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
        <span style={{ marginLeft: "auto" }} />
        <button type="button" className="icon-btn" title="Copy messages as JSON" aria-label="Copy messages" disabled={!shown.length} onClick={copyAll}>
          <Copy {...ico} />
        </button>
        <button type="button" className="icon-btn" title="Clear messages" aria-label="Clear messages" disabled={!w.messages.length} onClick={() => clear(tab.id)}>
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
              Connected to <b>{w.url}</b> · {hs.status} {hs.statusText}
              {hs.protocol ? ` · ${hs.protocol}` : ""} · {hs.elapsedMs} ms
            </span>
          </div>
          {base > 0 && <div className="smsg-wait">{base} earlier messages not kept</div>}
          {shown.map(({ m, n }) => (
            <MessageRow key={n} n={n} m={m} open={open.has(n)} onToggle={() => toggle(n)} />
          ))}
          {live && (
            <div className="smsg-wait">
              <span className="spinner" />
              Connected · waiting for messages
            </div>
          )}
          {w.close && <CloseRow close={w.close} onReconnect={tab.example || live ? undefined : () => reconnect(tab.id)} />}
          {!live && !w.close && w.messages.length === 0 && <div className="smsg-wait">No messages</div>}
        </div>
      </div>
    </>
  );
}

function MessageRow({ n, m, open, onToggle }: { n: number; m: WsMessage; open: boolean; onToggle: () => void }) {
  const binary = m.kind === "binary";
  const body = useMemo(() => {
    if (!open) return null;
    if (binary) return { hex: hexDump(m.data) };
    const p = pretty(m.data);
    return p ? { html: highlightLines(p, true) } : { text: m.data };
  }, [open, binary, m.data]);
  return (
    <>
      <button
        type="button"
        className={`smsg ${m.dir}`}
        aria-expanded={open}
        aria-label={`${m.dir === "in" ? "Received" : "Sent"} message ${n}`}
        onClick={onToggle}
      >
        {m.dir === "in" ? <ArrowDown {...ico} /> : <ArrowUp {...ico} />}
        <span className="n">{n}</span>
        <span className="t">{seconds(m.atMs)}</span>
        <span className="p">
          {binary ? (
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

function CloseRow({ close, onReconnect }: { close: WsClose; onReconnect?: () => void }) {
  const after = duration(close.elapsedMs);
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
  return (
    <div className="res-body">
      <div className="hs">
        <div>
          <h4>Request</h4>
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
          The server refused the upgrade
        </strong>
        <span className="msg">
          HTTP {hs.status} {hs.statusText} · expected 101 Switching Protocols
        </span>
        {hs.body && <span className="msg ws-fail-body">{hs.body}</span>}
        <div className="acts">
          {auth && !tab.example && <span className="muted">Check the Auth tab.</span>}
          <button type="button" className="link" onClick={onHandshake}>
            See handshake
          </button>
        </div>
      </div>
    </div>
  );
}
