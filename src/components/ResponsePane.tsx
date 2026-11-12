import { useMemo, useState } from "react";
import type { Tab } from "../types";
import { formatBytes } from "../lib/model";
import { highlightJson } from "../lib/highlight";
import { useStore } from "../store";

/** Above this size we skip syntax highlighting to keep the UI snappy. */
const HIGHLIGHT_LIMIT = 512 * 1024;
/** Above this size we show only the head of the body unless asked. */
const RENDER_LIMIT = 4 * 1024 * 1024;

export function ResponsePane({ tab }: { tab: Tab }) {
  const [view, setView] = useState<"pretty" | "raw" | "headers">("pretty");
  const [showAll, setShowAll] = useState(false);
  const notify = useStore((s) => s.notify);
  const res = tab.response;

  const contentType = res?.headers.find((h) => h.key.toLowerCase() === "content-type")?.value ?? "";

  const rendered = useMemo(() => {
    if (!res || res.bodyEncoding !== "utf8") return null;
    let text = res.body;
    let isJson = false;
    if (/json/i.test(contentType) || /^\s*[[{]/.test(text)) {
      try {
        text = JSON.stringify(JSON.parse(text), null, 2);
        isJson = true;
      } catch {
        /* not JSON after all */
      }
    }
    const truncated = !showAll && text.length > RENDER_LIMIT;
    if (truncated) text = text.slice(0, RENDER_LIMIT);
    const html = isJson && text.length <= HIGHLIGHT_LIMIT ? highlightJson(text) : null;
    return { text, html, truncated };
  }, [res, contentType, showAll]);

  if (tab.inflightId) return <div className="response-pane center"><div className="spinner" /> Sending…</div>;
  if (tab.error) return <div className="response-pane center error-box">{tab.error}</div>;
  if (!res) return <div className="response-pane center muted">Hit <kbd>⌘</kbd> <kbd>Enter</kbd> to send</div>;

  const statusClass = res.status < 300 ? "ok" : res.status < 400 ? "redir" : "fail";
  const isImage = /^image\//i.test(contentType);

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(rendered?.text ?? res.body);
      notify("Response copied");
    } catch (e) {
      notify(`Copy failed: ${e}`);
    }
  };

  return (
    <div className="response-pane">
      <div className="response-meta">
        <span className={`status ${statusClass}`}>
          {res.status} {res.statusText}
        </span>
        <span>{res.elapsedMs} ms</span>
        <span>{formatBytes(res.size)}</span>
        <span className="muted">{res.httpVersion}</span>
        <nav className="subtabs inline">
          {(["pretty", "raw", "headers"] as const).map((v) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
              {v === "headers" ? `Headers (${res.headers.length})` : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </nav>
        <button className="ghost small" onClick={copyBody}>
          Copy
        </button>
      </div>

      <div className="response-body">
        {view === "headers" ? (
          <table className="headers-table">
            <tbody>
              {res.headers.map((h, i) => (
                <tr key={i}>
                  <td>{h.key}</td>
                  <td>{h.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : isImage && res.bodyEncoding === "base64" ? (
          <img className="preview-img" src={`data:${contentType};base64,${res.body}`} alt="response" />
        ) : res.bodyEncoding === "base64" ? (
          <p className="empty">Binary response ({formatBytes(res.size)}, {contentType || "unknown type"}). Not displayed.</p>
        ) : view === "pretty" && rendered?.html ? (
          <pre className="code-view" dangerouslySetInnerHTML={{ __html: rendered.html }} />
        ) : (
          <pre className="code-view">{view === "raw" ? res.body.slice(0, showAll ? undefined : RENDER_LIMIT) : rendered?.text}</pre>
        )}
        {rendered?.truncated && view !== "headers" && (
          <button className="ghost small show-all" onClick={() => setShowAll(true)}>
            Body truncated at {formatBytes(RENDER_LIMIT)} — show all
          </button>
        )}
      </div>
    </div>
  );
}
