import "./Runs.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { HistoryEntry, Tab } from "../types";
import { runsOf } from "../lib/model";
import { useStore } from "../store";
import { when } from "./ResponseBody";
import { ChevronDown, ChevronLeft, ChevronRight, HistoryIcon, ico } from "./Icon";

/** gRPC status names by code, for runs (history keeps the code only). */
const GRPC_CODES = [
  "OK", "CANCELLED", "UNKNOWN", "INVALID_ARGUMENT", "DEADLINE_EXCEEDED", "NOT_FOUND", "ALREADY_EXISTS", "PERMISSION_DENIED",
  "RESOURCE_EXHAUSTED", "FAILED_PRECONDITION", "ABORTED", "OUT_OF_RANGE", "UNIMPLEMENTED", "INTERNAL", "UNAVAILABLE", "DATA_LOSS",
  "UNAUTHENTICATED",
];

/** The earlier runs of this tab's request, newest first, and which one the pane shows. */
export function useRuns(tab: Tab) {
  const history = useStore((s) => s.history);
  const runs = useMemo(() => runsOf(history, tab), [history, tab.request, tab.savedRef, tab.example]);
  // a response sent from this tab is the newest run; one picked from history names its entry
  const current = tab.fromHistory ? tab.fromHistory.entryId : tab.response || tab.grpc?.end || tab.ws?.close || tab.ws?.refused ? runs[0]?.id : undefined;
  return { runs, current };
}

/** One run: when it was sent, then its status. */
function RunCells({ h }: { h: HistoryEntry }) {
  const grpc = h.request.method === "GRPC";
  const ok = h.status !== undefined && (grpc ? h.status === 0 : h.status < 400);
  return (
    <>
      <span className="rw">{when(h.at)}</span>
      <span className={`rs ${ok ? "ok" : "fail"}`}>
        {h.status ?? "ERR"}
        {grpc && h.status !== undefined && ` ${GRPC_CODES[h.status] ?? ""}`}
      </span>
    </>
  );
}

/** The History pill at the top right of the response: a menu of this request's runs, or how to get some. */
export function RunsButton({ tab }: { tab: Tab }) {
  const { runs, current } = useRuns(tab);
  const showRun = useStore((s) => s.showRun);
  const [open, setOpen] = useState(false);
  const grpc = tab.request.method === "GRPC";
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return setPos(null);
    const a = btn.current!.getBoundingClientRect();
    const m = menu.current!.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - a.right);
    const room = window.innerHeight - a.bottom - 12;
    // flip above the button when there is more room there
    if (room < Math.min(m.height, 240) && a.top > room) {
      const maxHeight = a.top - 12;
      setPos({ top: Math.max(8, a.top - 4 - Math.min(m.height, maxHeight)), right, maxHeight });
    } else setPos({ top: a.bottom + 4, right, maxHeight: room });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    (items().find((b) => b.getAttribute("aria-checked") === "true") ?? items()[0])?.focus();
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        btn.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        list[(i + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length]?.focus();
      } else if (e.key === "Tab") close();
    };
    const onScroll = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const pick = (id: string) => {
    setOpen(false);
    if (id !== current) showRun(tab.id, id);
  };
  return (
    <span className="runs-wrap">
      <button
        ref={btn}
        type="button"
        className="runs-btn"
        title="Earlier runs of this request"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <HistoryIcon {...ico} />
        History
        <ChevronDown {...ico} className="ico chev" />
      </button>
      {open && (
        <div
          ref={menu}
          className="menu runs-menu"
          role="menu"
          aria-label="Runs of this request"
          style={{ position: "fixed", top: pos?.top ?? 0, right: pos?.right ?? 0, maxHeight: pos?.maxHeight, visibility: pos ? "visible" : "hidden" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {runs.length === 0 ? (
            <div className="runs-none">
              <span className="runs-none-ico">
                <HistoryIcon {...ico} />
              </span>
              <strong>No request history</strong>
              <span>{grpc ? "Invoke the method and browse through its history." : "Send the request and browse through its history."}</span>
            </div>
          ) : (
            runs.map((h) => (
              <button key={h.id} type="button" role="menuitemradio" aria-checked={h.id === current} onClick={() => pick(h.id)}>
                <RunCells h={h} />
              </button>
            ))
          )}
        </div>
      )}
    </span>
  );
}

/** The strip above a response that came from history: which run it is, step through runs, back to the newest. */
export function RunBanner({ tab, hint }: { tab: Tab; hint: string }) {
  const { runs, current } = useRuns(tab);
  const showRun = useStore((s) => s.showRun);
  const at = tab.fromHistory!.at;
  const i = runs.findIndex((h) => h.id === current);
  if (i < 0)
    return (
      <div className="res-banner">
        <HistoryIcon {...ico} />
        <span>From history</span>
        <span className="dim">{when(at)}</span>
        <span className="push dim">{hint}</span>
      </div>
    );
  return (
    <div className="res-banner">
      <HistoryIcon {...ico} />
      <span>Run from {when(at)}</span>
      <span className="dim">
        {i + 1} of {runs.length}
      </span>
      <span className="push run-step">
        <button type="button" className="icon-btn" title="Newer run" aria-label="Newer run" disabled={i === 0} onClick={() => showRun(tab.id, runs[i - 1].id)}>
          <ChevronLeft {...ico} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="Older run"
          aria-label="Older run"
          disabled={i === runs.length - 1}
          onClick={() => showRun(tab.id, runs[i + 1].id)}
        >
          <ChevronRight {...ico} />
        </button>
      </span>
      {i > 0 && (
        <button type="button" className="link" onClick={() => showRun(tab.id, runs[0].id)}>
          Back to latest
        </button>
      )}
    </div>
  );
}
