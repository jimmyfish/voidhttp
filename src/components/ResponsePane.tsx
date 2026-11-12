import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Tab } from "../types";
import { findNode, formatBytes } from "../lib/model";
import { highlightLines } from "../lib/highlight";
import { compile, query } from "../lib/jsonpath";
import { useStore } from "../store";
import { Bookmark, BookmarkPlus, ChevronDown, ChevronUp, CircleHelp, Clock, Copy, EyeOff, Filter, Search, WrapText, X, ico } from "./Icon";

/** Above this size lines are not split or highlighted, to keep the UI snappy. */
const LINES_LIMIT = 512 * 1024;
/** Above this size only the head of the body is rendered unless asked. */
const RENDER_LIMIT = 4 * 1024 * 1024;
/** Search highlights stop here; the count says "+" past it. */
const MAX_MARKS = 5000;

const EXAMPLES: [string, string][] = [
  ["$.data[*].name", "name of every item"],
  ["$.data[0]", "first item"],
  ["$.data[(@.length-1)]", "last item"],
  ["$..id", "every id, at any depth"],
  ["$.data[?(@.balance > 0)]", "items that match a condition"],
  ["$.data[0:2]", "first two items"],
];

/** Filter text per tab, kept while the app runs (the pane remounts on every tab switch). */
const filters = new Map<string, string>();

interface Filtered {
  status: string;
  error?: boolean;
  /** undefined when the filter could not run: the full body stays on screen */
  text?: string;
}

export function ResponsePane({ tab, grow }: { tab: Tab; grow: number }) {
  const [sub, setSub] = useState<"body" | "headers">("body");
  const [view, setView] = useState<"pretty" | "raw">("pretty");
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilterState] = useState(() => filters.get(tab.id) ?? "");
  const [help, setHelp] = useState(false);
  const [hits, setHits] = useState(0);
  const [cur, setCur] = useState(0);
  const notify = useStore((s) => s.notify);
  const openModal = useStore((s) => s.openModal);
  const maxMb = useStore((s) => s.settings.keepResponseMaxMb ?? 1);
  const wrap = useStore((s) => s.settings.wrapResponseBody ?? true);
  const setSettings = useStore((s) => s.setSettings);
  // an example tab reads when it was saved and what was masked from the example in its collection
  const example = useStore((s) => {
    const ref = tab.example;
    const col = ref && s.collections.find((c) => c.id === ref.collectionId);
    const node = col && findNode(col.children, ref.nodeId);
    return node?.type === "request" ? node.examples?.find((e) => e.id === ref!.exampleId) : undefined;
  });
  const masked = example?.masked;
  const savedAt = example?.savedAt;
  const res = tab.response;
  const codeRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const helpRef = useRef<HTMLSpanElement>(null);
  const marks = useRef<HTMLElement[][]>([]);

  const setFilter = (v: string) => {
    filters.set(tab.id, v);
    setFilterState(v);
  };
  const q = useDeferredValue(filter);
  const isPath = q.trimStart().startsWith("$");
  const search = !isPath && q.trim() ? q : "";

  const contentType = res?.headers.find((h) => h.key.toLowerCase() === "content-type")?.value ?? "";
  const isText = res?.bodyEncoding === "utf8";

  const filtered = useMemo((): Filtered | null => {
    if (!res || !isText || !isPath) return null;
    let path;
    try {
      path = compile(q);
    } catch (e) {
      return { status: (e as Error).message, error: true };
    }
    let root: unknown;
    try {
      root = JSON.parse(res.body);
    } catch {
      return { status: "Response is not JSON", error: true };
    }
    const found = query(root, path);
    const status = found.length === 0 ? "No match" : found.length === 1 ? "1 result" : `${found.length} results`;
    if (path.singular && found.length === 0) return { status, text: "" };
    const value = path.singular ? found[0] : found;
    return { status, text: view === "pretty" ? JSON.stringify(value, null, 2) : JSON.stringify(value) };
  }, [res, isText, isPath, q, view]);

  const rendered = useMemo(() => {
    if (!res || !isText) return null;
    let text = res.body;
    let isJson = false;
    if (filtered?.text !== undefined) {
      text = filtered.text;
      isJson = true;
    } else if (view === "pretty" && (/json/i.test(contentType) || /^\s*[[{]/.test(text))) {
      try {
        text = JSON.stringify(JSON.parse(text), null, 2);
        isJson = true;
      } catch {
        /* not JSON after all */
      }
    }
    const truncated = !showAll && text.length > RENDER_LIMIT;
    if (truncated) text = text.slice(0, RENDER_LIMIT);
    const html = text.length <= LINES_LIMIT ? highlightLines(text, isJson) : null;
    return { text, html, truncated };
  }, [res, isText, contentType, showAll, view, filtered]);

  // The body is written here, not by React, so search marks can be laid into it.
  useLayoutEffect(() => {
    const pre = codeRef.current;
    if (!pre || !rendered) return;
    if (rendered.html !== null) pre.innerHTML = rendered.html;
    else pre.textContent = rendered.text;
    // in an example, tint the values that were masked when it was saved
    if (tab.example) pre.querySelectorAll(".j-str").forEach((el) => el.textContent?.includes("•") && el.classList.add("masked"));
    marks.current = search ? markMatches(pre, search) : [];
    setHits(marks.current.length);
    setCur(0);
  }, [rendered, search, sub, tab.inflightId, tab.error]);

  useEffect(() => {
    const pre = codeRef.current;
    marks.current.forEach((m) => m.forEach((x) => x.classList.remove("cur")));
    const m = marks.current[cur];
    if (!pre || !m?.length) return;
    m.forEach((x) => x.classList.add("cur"));
    // scroll the body only; scrollIntoView would also shift the app's own panes
    const r = m[0].getBoundingClientRect();
    const p = pre.getBoundingClientRect();
    if (r.top < p.top || r.bottom > p.bottom) pre.scrollTop += r.top - p.top - p.height / 2;
  }, [cur, hits, rendered, search]);

  useEffect(() => {
    if (!help) return;
    const away = (e: MouseEvent) => {
      if (!helpRef.current?.contains(e.target as Node)) setHelp(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setHelp(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [help]);

  const shell = (children: React.ReactNode, role?: string) => (
    <section className="response" style={{ flexGrow: grow }} aria-label="Response" role={role}>
      {children}
    </section>
  );

  if (tab.inflightId)
    return shell(
      <div className="empty" role="status">
        <div className="spinner" />
        <span>Sending…</span>
      </div>,
    );
  if (tab.error)
    return shell(
      <div className="error-box" role="alert">
        <strong>Could not get a response</strong>
        <span className="msg">{tab.error}</span>
      </div>,
    );
  if (!res)
    return shell(
      <div className="empty">
        <strong>No response yet</strong>
        <span>
          Press <kbd>⌘</kbd> <kbd>Enter</kbd> to send
        </span>
      </div>,
    );

  const statusClass = res.status < 300 ? "ok" : res.status < 400 ? "redir" : "fail";
  const isImage = /^image\//i.test(contentType);
  const typedPath = filter.trimStart().startsWith("$");

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(rendered?.text ?? res.body);
      notify(filtered?.text !== undefined ? "Filtered result copied" : "Response copied");
    } catch (e) {
      notify(`Copy failed: ${e}`);
    }
  };

  const step = (by: number) => hits && setCur((c) => (c + by + hits) % hits);

  const pick = (example: string) => {
    setFilter(example);
    setHelp(false);
    inputRef.current?.focus();
  };

  let status: React.ReactNode = null;
  if (filtered)
    status = (
      <span className={`rf-status${filtered.error ? " err" : ""}`} role="status">
        {filtered.status}
      </span>
    );
  else if (search)
    status = (
      <span className="rf-status" role="status">
        {hits ? `${cur + 1} of ${hits}${hits >= MAX_MARKS ? "+" : ""}` : "No matches"}
      </span>
    );

  const when = (ts: number) =>
    `${new Date(ts).toDateString() === new Date().toDateString() ? "Today" : new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" })}, ${new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  const dropped = !!tab.fromHistory?.bodyDropped;

  return shell(
    <>
      {tab.fromHistory && (
        <div className="res-banner">
          <Clock {...ico} />
          <span>From history</span>
          <span className="dim">{when(tab.fromHistory.at)}</span>
          <span className="push dim">Send to get a fresh response</span>
        </div>
      )}
      {tab.example && (
        <div className="res-banner">
          <Bookmark {...ico} />
          <span>Example</span>
          {savedAt && <span className="dim">Saved {when(savedAt)}</span>}
          {!!masked?.length && (
            <span className="push masked-note" title={masked.join("\n")}>
              <EyeOff {...ico} />
              {masked.length === 1 ? "1 field masked" : `${masked.length} fields masked`}
            </span>
          )}
        </div>
      )}
      <nav className="subtabs" aria-label="Response">
        <button type="button" className="subtab" aria-pressed={sub === "body"} onClick={() => setSub("body")}>
          Body
        </button>
        <button type="button" className="subtab" aria-pressed={sub === "headers"} onClick={() => setSub("headers")}>
          Headers <span className="n">{res.headers.length}</span>
        </button>
        <span className="meta">
          <span className={statusClass}>
            {res.status} {res.statusText}
          </span>
          <span className="dim">{res.elapsedMs} ms</span>
          <span className="dim">{formatBytes(res.size)}</span>
          <span className="dim">{res.httpVersion.replace(/^HTTP\/([23])\.0$/, "HTTP/$1")}</span>
        </span>
      </nav>

      {sub === "headers" ? (
        <div className="section">
          <table className="kv">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {res.headers.map((h, i) => (
                <tr key={i}>
                  <td className="muted" style={{ fontFamily: "var(--font-mono)" }}>
                    {h.key}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{h.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : dropped ? (
        <div className="empty">
          <strong>Body not kept</strong>
          <span>
            {formatBytes(res.size)} is over the {maxMb} MB history limit. Status and headers were kept.
          </span>
        </div>
      ) : (
        <>
          <div className="res-tools">
            <div className="seg" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "pretty"} onClick={() => setView("pretty")}>
                Pretty
              </button>
              <button type="button" aria-pressed={view === "raw"} onClick={() => setView("raw")}>
                Raw
              </button>
            </div>
            <button
              type="button"
              className="icon-btn"
              title={wrap ? "Don't wrap lines" : "Wrap lines"}
              aria-label="Wrap lines"
              aria-pressed={wrap}
              onClick={() => setSettings({ wrapResponseBody: !wrap })}
            >
              <WrapText {...ico} />
            </button>
            {!tab.example && (
              <button
                type="button"
                className="icon-btn"
                title="Save as example"
                aria-label="Save as example"
                onClick={() => openModal({ kind: "example", request: tab.request, response: res, target: tab.savedRef })}
              >
                <BookmarkPlus {...ico} />
              </button>
            )}
            <button type="button" className="icon-btn" title="Copy response" aria-label="Copy response" onClick={copyBody}>
              <Copy {...ico} />
            </button>
          </div>
          {isImage && res.bodyEncoding === "base64" ? (
            <img className="preview-img" src={`data:${contentType};base64,${res.body}`} alt="Response image" />
          ) : res.bodyEncoding === "base64" ? (
            <p className="binary">
              Binary response ({formatBytes(res.size)}, {contentType || "unknown type"}). Not displayed.
            </p>
          ) : (
            <div className="res-body">
              <pre
                ref={codeRef}
                className={`code${rendered?.html === null ? " plain" : ""}${wrap ? "" : " nowrap"}`}
                aria-label={filtered?.text !== undefined ? "Filtered response body" : "Response body"}
              />
              <div className="res-filter">
                <span className="rf-icon">{typedPath ? <Filter {...ico} size={14} /> : <Search {...ico} size={14} />}</span>
                <input
                  ref={inputRef}
                  type="text"
                  className={`rf-input${typedPath ? " is-path" : ""}`}
                  aria-label="Filter response"
                  placeholder="Search, or filter with $.path"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      if (filter) setFilter("");
                      else e.currentTarget.blur();
                    } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && search) {
                      e.preventDefault();
                      step(e.shiftKey ? -1 : 1);
                    }
                  }}
                />
                {!filter && <kbd>⌘F</kbd>}
                {status}
                {search && (
                  <>
                    <button type="button" className="icon-btn" title="Previous match (⇧Enter)" aria-label="Previous match" disabled={!hits} onClick={() => step(-1)}>
                      <ChevronUp {...ico} />
                    </button>
                    <button type="button" className="icon-btn" title="Next match (Enter)" aria-label="Next match" disabled={!hits} onClick={() => step(1)}>
                      <ChevronDown {...ico} />
                    </button>
                  </>
                )}
                {filter && (
                  <button
                    type="button"
                    className="icon-btn"
                    title="Clear (Esc)"
                    aria-label="Clear filter"
                    onClick={() => {
                      setFilter("");
                      inputRef.current?.focus();
                    }}
                  >
                    <X {...ico} />
                  </button>
                )}
                <span ref={helpRef} className="rf-help-anchor">
                  <button
                    type="button"
                    className={`icon-btn${help ? " open" : ""}`}
                    title="Filter syntax"
                    aria-label="Filter syntax"
                    aria-expanded={help}
                    onClick={() => setHelp((h) => !h)}
                  >
                    <CircleHelp {...ico} />
                  </button>
                  {help && (
                    <div className="menu rf-help" role="menu" aria-label="Filter examples">
                      <p className="rf-help-head">
                        Start with <code>$</code> to filter with JSONPath. Anything else searches the text.
                      </p>
                      {EXAMPLES.map(([ex, what]) => (
                        <button key={ex} type="button" role="menuitem" onClick={() => pick(ex)}>
                          <code>{ex}</code>
                          <span>{what}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </span>
              </div>
            </div>
          )}
          {rendered?.truncated && (
            <p className="truncated">
              Showing the first {formatBytes(RENDER_LIMIT)}.
              <button type="button" className="btn btn--quiet" onClick={() => setShowAll(true)}>
                Show all
              </button>
            </p>
          )}
        </>
      )}
    </>,
  );
}

/**
 * Wraps every case-insensitive match of `needle` in <mark class="hit">, across token spans.
 * Returns the marks per match (a match split by a token boundary has several).
 */
function markMatches(root: HTMLElement, needle: string): HTMLElement[][] {
  const texts: Text[] = [];
  const starts: number[] = [];
  let hay = "";
  let line: Element | null = null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    // highlighted bodies have one .l block per line and no newline characters: put them back
    const l = n.parentElement?.closest(".l") ?? null;
    if (l !== line) {
      if (line) hay += "\n";
      line = l;
    }
    texts.push(n);
    starts.push(hay.length);
    hay += n.data;
  }

  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const ranges: [number, number][] = [];
  for (let m = re.exec(hay); m && ranges.length < MAX_MARKS; m = re.exec(hay)) ranges.push([m.index, m.index + m[0].length]);

  const out: HTMLElement[][] = ranges.map(() => []);
  let r = 0;
  texts.forEach((node, k) => {
    const s0 = starts[k];
    const s1 = s0 + node.data.length;
    while (r < ranges.length && ranges[r][1] <= s0) r++;
    const frag = document.createDocumentFragment();
    let at = 0;
    for (let j = r; j < ranges.length && ranges[j][0] < s1; j++) {
      const a = Math.max(ranges[j][0], s0) - s0;
      const b = Math.min(ranges[j][1], s1) - s0;
      if (a > at) frag.append(node.data.slice(at, a));
      const mark = document.createElement("mark");
      mark.className = "hit";
      mark.textContent = node.data.slice(a, b);
      frag.append(mark);
      out[j].push(mark);
      at = b;
    }
    if (at === 0) return;
    if (at < node.data.length) frag.append(node.data.slice(at));
    node.replaceWith(frag);
  });
  return out;
}
