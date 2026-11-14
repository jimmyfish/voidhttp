import { useState } from "react";
import type { Tab } from "../types";
import { formatBytes } from "../lib/model";
import { useStore } from "../store";
import { isGrpc } from "../lib/grpc";
import { GrpcResponsePane } from "./GrpcResponse";
import { BodyViewer, ExampleBanner, PairsTable, useTabExample } from "./ResponseBody";
import { RunBanner, RunsButton } from "./Runs";
import { BookmarkPlus, Copy, ico } from "./Icon";

export function ResponsePane({ tab, grow }: { tab: Tab; grow: number }) {
  return isGrpc(tab.request) ? <GrpcResponsePane tab={tab} grow={grow} /> : <HttpResponsePane tab={tab} grow={grow} />;
}

function HttpResponsePane({ tab, grow }: { tab: Tab; grow: number }) {
  const [sub, setSub] = useState<"body" | "headers">("body");
  const notify = useStore((s) => s.notify);
  const openModal = useStore((s) => s.openModal);
  const maxMb = useStore((s) => s.settings.keepResponseMaxMb ?? 1);
  // an example tab reads when it was saved and what was masked from the example in its collection
  const example = useTabExample(tab);
  const res = tab.response;

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
      <>
        <div className="res-head">
          <RunsButton tab={tab} />
        </div>
        <div className="empty">
          <strong>No response yet</strong>
          <span>
            Press <kbd>⌘</kbd> <kbd>Enter</kbd> to send
          </span>
        </div>
      </>,
    );

  const contentType = res.headers.find((h) => h.key.toLowerCase() === "content-type")?.value ?? "";
  const statusClass = res.status < 300 ? "ok" : res.status < 400 ? "redir" : "fail";
  const isImage = /^image\//i.test(contentType);
  const dropped = !!tab.fromHistory?.bodyDropped;

  const copyRaw = async () => {
    try {
      await navigator.clipboard.writeText(res.body);
      notify("Response copied");
    } catch (e) {
      notify(`Copy failed: ${e}`);
    }
  };
  const saveExample = !tab.example && (
    <button
      type="button"
      className="icon-btn"
      title="Save as example"
      aria-label="Save as example"
      onClick={() => openModal({ kind: "example", request: tab.request, response: res, target: tab.savedRef })}
    >
      <BookmarkPlus {...ico} />
    </button>
  );

  return shell(
    <>
      {tab.fromHistory && <RunBanner tab={tab} hint="Send to get a fresh response" />}
      {tab.example && <ExampleBanner example={example} />}
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
        <RunsButton tab={tab} />
      </nav>

      {sub === "headers" ? (
        <PairsTable rows={res.headers} />
      ) : dropped ? (
        <div className="empty">
          <strong>Body not kept</strong>
          <span>
            {formatBytes(res.size)} is over the {maxMb} MB history limit. Status and headers were kept.
          </span>
        </div>
      ) : res.bodyEncoding === "base64" ? (
        <>
          <div className="res-tools">
            <span className="push" />
            {saveExample}
            <button type="button" className="icon-btn" title="Copy response" aria-label="Copy response" onClick={copyRaw}>
              <Copy {...ico} />
            </button>
          </div>
          {isImage ? (
            <img className="preview-img" src={`data:${contentType};base64,${res.body}`} alt="Response image" />
          ) : (
            <p className="binary">
              Binary response ({formatBytes(res.size)}, {contentType || "unknown type"}). Not displayed.
            </p>
          )}
        </>
      ) : (
        <BodyViewer tabId={tab.id} body={res.body} contentType={contentType} example={!!tab.example} tools={saveExample} />
      )}
    </>,
  );
}

