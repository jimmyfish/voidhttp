import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GrpcResult, Tab } from "../types";
import { formatBytes } from "../lib/model";
import { highlightLines } from "../lib/highlight";
import { useStore } from "../store";
import { BodyViewer, PairsTable } from "./ResponseBody";
import { RunBanner, RunsButton } from "./Runs";
import { ArrowDown, ArrowUp, Copy, Trash2, ico } from "./Icon";

type Sub = "body" | "metadata" | "trailers";

const pretty = (json: string) => {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
};
const seconds = (ms: number) => (ms < 10_000 ? `${(ms / 1000).toFixed(2)}s` : ms < 100_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`);
const duration = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

/** The response side of a gRPC tab: one reply (or error) for unary calls, a live message list for streams. */
export function GrpcResponsePane({ tab, grow }: { tab: Tab; grow: number }) {
  const [sub, setSub] = useState<Sub>("body");
  const g = tab.grpc;
  // a new call starts on its messages; trailers do not exist yet
  useEffect(() => setSub("body"), [g?.callId]);

  const shell = (children: React.ReactNode) => (
    <section className="response" style={{ flexGrow: grow }} aria-label="Response">
      {children}
    </section>
  );

  if (tab.error)
    return shell(
      <div className="error-box" role="alert">
        <strong>Could not call the method</strong>
        <span className="msg">{tab.error}</span>
      </div>,
    );
  if (!g)
    return shell(
      <>
        <div className="res-head">
          <RunsButton tab={tab} />
        </div>
        <div className="empty">
          <strong>No response yet</strong>
          <span>
            Press <kbd>⌘</kbd> <kbd>Enter</kbd> to invoke
          </span>
        </div>
      </>,
    );

  const streamed = g.stream !== "unary";
  if (!streamed && !g.end)
    return shell(
      <div className="empty" role="status">
        <div className="spinner" />
        <span>Calling…</span>
      </div>,
    );

  return shell(
    <>
      {tab.fromHistory && <RunBanner tab={tab} hint="Invoke to call it again" />}
      <nav className="subtabs" aria-label="Response">
        <button type="button" className="subtab" aria-pressed={sub === "body"} onClick={() => setSub("body")}>
          {streamed ? (
            <>
              Messages <span className="n">{(g.dropped ?? 0) + g.messages.length}</span>
            </>
          ) : g.end?.code === 0 ? (
            "Message"
          ) : (
            "Error"
          )}
        </button>
        <button type="button" className="subtab" aria-pressed={sub === "metadata"} onClick={() => setSub("metadata")}>
          Metadata {g.headers.length > 0 && <span className="n">{g.headers.length}</span>}
        </button>
        <button
          type="button"
          className="subtab"
          aria-pressed={sub === "trailers"}
          disabled={!g.end}
          title={g.end ? undefined : "Trailers arrive when the call ends"}
          onClick={() => setSub("trailers")}
        >
          Trailers {!!g.end?.trailers.length && <span className="n">{g.end.trailers.length}</span>}
        </button>
        <StatusLine g={g} live={!!tab.inflightId} />
        {!tab.inflightId && <RunsButton tab={tab} />}
      </nav>

      {sub === "metadata" ? (
        <PairsTable rows={g.headers} empty="The server sent no metadata." />
      ) : sub === "trailers" && g.end ? (
        <PairsTable rows={g.end.trailers} empty="The server sent no trailers." />
      ) : streamed ? (
        <MessageList tab={tab} g={g} />
      ) : (
        <UnaryBody tab={tab} g={g} />
      )}
    </>,
  );
}

function StatusLine({ g, live }: { g: GrpcResult; live: boolean }) {
  const [, tick] = useState(0);
  // the elapsed time counts up while a stream is open
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [live]);
  const received = g.messages.filter((m) => m.dir === "in");
  const sent = g.messages.length - received.length;
  const size = received.reduce((n, m) => n + m.size, 0);
  const count =
    g.stream === "unary"
      ? null
      : g.stream === "server"
        ? `${(g.dropped ?? 0) + received.length} received`
        : `${sent} sent · ${received.length} received`;
  return (
    <span className="meta">
      {g.end ? (
        <span className={g.end.code === 0 ? "ok" : "fail"}>
          {g.end.code} {g.end.status}
        </span>
      ) : (
        <span className="live">
          <span className="live-dot" aria-hidden="true" />
          Streaming
        </span>
      )}
      <span className="dim">{duration(g.end ? g.end.elapsedMs : Date.now() - g.startedAt)}</span>
      {count && <span className="dim">{count}</span>}
      {g.end && <span className="dim">{formatBytes(size)}</span>}
      <span className="dim">{g.tls ? "gRPC · TLS" : "gRPC"}</span>
    </span>
  );
}

/** A unary reply, or the error status with its details, in the same viewer as an HTTP body. */
function UnaryBody({ tab, g }: { tab: Tab; g: GrpcResult }) {
  const maxMb = useStore((s) => s.settings.keepResponseMaxMb ?? 1);
  const end = g.end!;
  const reply = [...g.messages].reverse().find((m) => m.dir === "in");
  if (end.code === 0 && !reply)
    return tab.fromHistory?.bodyDropped ? (
      <div className="empty">
        <strong>Message not kept</strong>
        <span>It was over the {maxMb} MB history limit. Status and metadata were kept.</span>
      </div>
    ) : (
      <div className="empty">
        <strong>No message</strong>
        <span>The call ended OK without a reply.</span>
      </div>
    );
  const body =
    end.code === 0
      ? reply!.json
      : JSON.stringify({
          code: end.code,
          status: end.status,
          message: end.message,
          ...(end.details && { details: JSON.parse(end.details) }),
        });
  return <BodyViewer key={`${g.callId}-${end.code}`} tabId={tab.id} body={body} contentType="application/json" />;
}

/** Stream messages, newest last; click one to read it in full. */
function MessageList({ tab, g }: { tab: Tab; g: GrpcResult }) {
  const notify = useStore((s) => s.notify);
  const clear = useStore((s) => s.clearGrpcMessages);
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const base = g.dropped ?? 0;

  // follow new messages while the list is scrolled to the bottom
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [g.messages.length, g.end]);

  const copyAll = async () => {
    try {
      const all = g.messages.map((m) => {
        try {
          return JSON.parse(m.json);
        } catch {
          return m.json;
        }
      });
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

  const end = g.end;
  const live = !!tab.inflightId && !end;
  return (
    <>
      <div className="res-tools">
        <span className="dir-legend">
          <span className="out">
            <ArrowUp {...ico} />
            Sent
          </span>
          <span className="in">
            <ArrowDown {...ico} />
            Received
          </span>
        </span>
        <button
          type="button"
          className="icon-btn"
          style={{ marginLeft: "auto" }}
          title="Copy all messages as JSON"
          aria-label="Copy all messages"
          disabled={!g.messages.length}
          onClick={copyAll}
        >
          <Copy {...ico} />
        </button>
        <button type="button" className="icon-btn" title="Clear messages" aria-label="Clear messages" disabled={!g.messages.length} onClick={() => clear(tab.id)}>
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
          {base > 0 && <div className="smsg-wait">{base} earlier messages not kept</div>}
          {g.messages.map((m, i) => {
            const n = base + i + 1;
            return (
              <MessageRow key={n} n={n} m={m} open={open.has(n)} onToggle={() => toggle(n)} />
            );
          })}
          {live && (
            <div className="smsg-wait">
              <span className="spinner" />
              {g.sendOpen ? "Stream open · waiting for the server" : "Waiting for the next message"}
            </div>
          )}
          {end && <EndRow end={end} />}
          {!live && !end && g.messages.length === 0 && <div className="smsg-wait">No messages</div>}
        </div>
      </div>
    </>
  );
}

function MessageRow({ n, m, open, onToggle }: { n: number; m: GrpcResult["messages"][number]; open: boolean; onToggle: () => void }) {
  const html = useMemo(() => (open ? highlightLines(pretty(m.json), true) : ""), [open, m.json]);
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
        <span className="p">{m.json}</span>
      </button>
      {open && (
        <div className="smsg-open">
          <pre className="code" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </>
  );
}

function EndRow({ end }: { end: NonNullable<GrpcResult["end"]> }) {
  const [showDetails, setShowDetails] = useState(false);
  const html = useMemo(() => (end.details && showDetails ? highlightLines(pretty(end.details), true) : ""), [end.details, showDetails]);
  const after = duration(end.elapsedMs);
  const text =
    end.code === 0
      ? `Server ended the stream after ${after}`
      : end.code === 1 && end.message === "Cancelled by you"
        ? `Cancelled by you after ${after}`
        : end.message || `Ended after ${after}`;
  return (
    <>
      <div className="smsg-end" role="status">
        <span className={end.code === 0 ? "ok" : "fail"}>
          {end.code} {end.status}
        </span>
        <span className="end-text">{text}</span>
        {end.details && (
          <button type="button" className="link" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? "Hide details" : "Details"}
          </button>
        )}
      </div>
      {showDetails && (
        <div className="smsg-open">
          <pre className="code" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </>
  );
}
