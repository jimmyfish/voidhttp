import { useMemo, useState } from "react";
import type { Tab } from "../types";
import { formatBytes } from "../lib/model";
import { highlightLines } from "../lib/highlight";
import { useStore } from "../store";
import { Copy, ico } from "./Icon";

/** Above this size lines are not split or highlighted, to keep the UI snappy. */
const LINES_LIMIT = 512 * 1024;
/** Above this size only the head of the body is rendered unless asked. */
const RENDER_LIMIT = 4 * 1024 * 1024;

export function ResponsePane({ tab, grow }: { tab: Tab; grow: number }) {
  const [sub, setSub] = useState<"body" | "headers">("body");
  const [view, setView] = useState<"pretty" | "raw">("pretty");
  const [showAll, setShowAll] = useState(false);
  const notify = useStore((s) => s.notify);
  const res = tab.response;

  const contentType = res?.headers.find((h) => h.key.toLowerCase() === "content-type")?.value ?? "";

  const rendered = useMemo(() => {
    if (!res || res.bodyEncoding !== "utf8") return null;
    let text = res.body;
    let isJson = false;
    if (view === "pretty" && (/json/i.test(contentType) || /^\s*[[{]/.test(text))) {
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
  }, [res, contentType, showAll, view]);

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

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(rendered?.text ?? res.body);
      notify("Response copied");
    } catch (e) {
      notify(`Copy failed: ${e}`);
    }
  };

  return shell(
    <>
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
          ) : rendered?.html !== null && rendered?.html !== undefined ? (
            <pre className="code" aria-label="Response body" dangerouslySetInnerHTML={{ __html: rendered.html }} />
          ) : (
            <pre className="code plain" aria-label="Response body">
              {rendered?.text}
            </pre>
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
