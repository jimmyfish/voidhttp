import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatBytes } from "../lib/model";
import { highlightLines } from "../lib/highlight";
import { compile, query } from "../lib/jsonpath";
import { useStore } from "../store";
import { ChevronDown, ChevronUp, CircleHelp, Copy, Filter, Search, WrapText, X, ico } from "./Icon";

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

export const when = (ts: number) =>
  `${new Date(ts).toDateString() === new Date().toDateString() ? "Today" : new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" })}, ${new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

/** Headers, metadata, trailers: a read-only two-column table. */
export function PairsTable({ rows, empty = "None" }: { rows: { key: string; value: string }[]; empty?: string }) {
  return (
    <div className="section">
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <table className="kv">
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h, i) => (
              <tr key={i}>
                <td className="muted" style={{ fontFamily: "var(--font-mono)" }}>
                  {h.key}
                </td>
                <td style={{ fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{h.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * A text body with Pretty/Raw, wrap, copy, and the search / JSONPath filter bar.
 * `tools` sit before Copy (Save as example).
 */
export function BodyViewer({
  tabId,
  body,
  contentType = "",
  example = false,
  tools,
}: {
  tabId: string;
  body: string;
  contentType?: string;
  /** tint the values that were masked when an example was saved */
  example?: boolean;
  tools?: React.ReactNode;
}) {
  const [view, setView] = useState<"pretty" | "raw">("pretty");
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilterState] = useState(() => filters.get(tabId) ?? "");
  const [help, setHelp] = useState(false);
  const [hits, setHits] = useState(0);
  const [cur, setCur] = useState(0);
  const notify = useStore((s) => s.notify);
  const wrap = useStore((s) => s.settings.wrapResponseBody ?? true);
  const setSettings = useStore((s) => s.setSettings);
  const codeRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const helpRef = useRef<HTMLSpanElement>(null);
  const marks = useRef<HTMLElement[][]>([]);

  const setFilter = (v: string) => {
    filters.set(tabId, v);
    setFilterState(v);
  };
  const q = useDeferredValue(filter);
  const isPath = q.trimStart().startsWith("$");
  const search = !isPath && q.trim() ? q : "";

  const filtered = useMemo((): Filtered | null => {
    if (!isPath) return null;
    let path;
    try {
      path = compile(q);
    } catch (e) {
      return { status: (e as Error).message, error: true };
    }
    let root: unknown;
    try {
      root = JSON.parse(body);
    } catch {
      return { status: "Response is not JSON", error: true };
    }
    const found = query(root, path);
    const status = found.length === 0 ? "No match" : found.length === 1 ? "1 result" : `${found.length} results`;
    if (path.singular && found.length === 0) return { status, text: "" };
    const value = path.singular ? found[0] : found;
    return { status, text: view === "pretty" ? JSON.stringify(value, null, 2) : JSON.stringify(value) };
  }, [body, isPath, q, view]);

  const rendered = useMemo(() => {
    let text = body;
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
  }, [body, contentType, showAll, view, filtered]);

  // The body is written here, not by React, so search marks can be laid into it.
  useLayoutEffect(() => {
    const pre = codeRef.current;
    if (!pre) return;
    if (rendered.html !== null) pre.innerHTML = rendered.html;
    else pre.textContent = rendered.text;
    // in an example, tint the values that were masked when it was saved
    if (example) pre.querySelectorAll(".j-str").forEach((el) => el.textContent?.includes("•") && el.classList.add("masked"));
    marks.current = search ? markMatches(pre, search) : [];
    setHits(marks.current.length);
    setCur(0);
  }, [rendered, search, example]);

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

  const typedPath = filter.trimStart().startsWith("$");

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(rendered.text);
      notify(filtered?.text !== undefined ? "Filtered result copied" : "Response copied");
    } catch (e) {
      notify(`Copy failed: ${e}`);
    }
  };

  const step = (by: number) => hits && setCur((c) => (c + by + hits) % hits);

  const pick = (ex: string) => {
    setFilter(ex);
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

  return (
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
        {tools}
        <button type="button" className="icon-btn" title="Copy response" aria-label="Copy response" onClick={copyBody}>
          <Copy {...ico} />
        </button>
      </div>
      <div className="res-body">
        <pre
          ref={codeRef}
          className={`code${rendered.html === null ? " plain" : ""}${wrap ? "" : " nowrap"}`}
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
      {rendered.truncated && (
        <p className="truncated">
          Showing the first {formatBytes(RENDER_LIMIT)}.
          <button type="button" className="btn btn--quiet" onClick={() => setShowAll(true)}>
            Show all
          </button>
        </p>
      )}
    </>
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
