import { useMemo, useState } from "react";
import type { ScriptRun, Tab } from "../types";
import { formatBytes } from "../lib/model";
import { useStore } from "../store";
import { isGrpc } from "../lib/grpc";
import { GrpcResponsePane } from "./GrpcResponse";
import { WsResponsePane } from "./WsResponse";
import { isSocket } from "../lib/sio";
import { isKafka } from "../lib/kafka";
import { KafkaResponsePane } from "./KafkaResponse";
import { isMqtt } from "../lib/mqtt";
import { MqttResponsePane } from "./MqttResponse";
import { isPubsub } from "../lib/pubsub";
import { PubsubResponsePane } from "./PubsubResponse";
import { BodyViewer, ExampleBanner, PairsTable, useTabExample } from "./ResponseBody";
import { RunBanner, RunsButton } from "./Runs";
import { BookmarkPlus, CircleCheck, CircleX, Copy, Trash2, TriangleAlert, ico } from "./Icon";
import { OPEN_SCRIPT, hasScript, type OpenScript } from "../lib/script";
import { gqlErrors, isGql, type GqlError } from "../lib/graphql";
import { OPEN_GQL_LINE, type OpenGqlLine } from "./GqlPane";

export function ResponsePane({ tab, grow }: { tab: Tab; grow: number }) {
  if (isKafka(tab.request)) return <KafkaResponsePane tab={tab} grow={grow} />;
  if (isMqtt(tab.request)) return <MqttResponsePane tab={tab} grow={grow} />;
  if (isPubsub(tab.request)) return <PubsubResponsePane tab={tab} grow={grow} />;
  if (isSocket(tab.request)) return <WsResponsePane tab={tab} grow={grow} />;
  return isGrpc(tab.request) ? <GrpcResponsePane tab={tab} grow={grow} /> : <HttpResponsePane tab={tab} grow={grow} />;
}

function HttpResponsePane({ tab, grow }: { tab: Tab; grow: number }) {
  const [sub, setSub] = useState<"body" | "headers" | "tests" | "console">("body");
  const notify = useStore((s) => s.notify);
  const openModal = useStore((s) => s.openModal);
  const maxMb = useStore((s) => s.settings.keepResponseMaxMb ?? 1);
  // an example tab reads when it was saved and what was masked from the example in its collection
  const example = useTabExample(tab);
  const res = tab.response;
  const run = tab.scripts;
  // GraphQL errors ride on 200 OK: counted beside the status, listed above the body
  const gql = isGql(tab.request);
  const errors = useMemo(() => (gql && res && res.bodyEncoding === "utf8" ? gqlErrors(res.body) : []), [gql, res]);
  // Tests and Console show for a request with scripts, or after a send that ran some
  const scripted = !!run || hasScript(tab.request.scripts?.pre) || hasScript(tab.request.scripts?.post);

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
  if (!res && run?.failed?.src === "pre")
    return shell(
      <>
        <nav className="subtabs" aria-label="Response">
          <span className="meta">
            <span className="fail">Not sent</span>
            <span className="dim">pre-request script failed</span>
          </span>
        </nav>
        <div className="res-body">
          <ScriptFail run={run} tabId={tab.id} />
          <ConsoleList run={run} />
        </div>
      </>,
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
        {scripted && (
          <button type="button" className="subtab" aria-pressed={sub === "tests"} onClick={() => setSub("tests")}>
            Tests
            {!!run?.tests.length && (
              <span className={`n${run.tests.some((t) => !t.passed) ? " fail" : ""}`}>
                {run.tests.filter((t) => t.passed).length}/{run.tests.length}
              </span>
            )}
          </button>
        )}
        {scripted && (
          <button type="button" className="subtab" aria-pressed={sub === "console"} onClick={() => setSub("console")}>
            Console
            {!!run?.logs.length && <span className={`n${run.logs.some((l) => l.level === "error") ? " fail" : ""}`}>{run.logs.length}</span>}
          </button>
        )}
        <span className="meta">
          <span className={statusClass}>
            {res.status} {res.statusText}
          </span>
          {errors.length > 0 && (
            <span className="gql-err">
              {errors.length} {errors.length === 1 ? "error" : "errors"}
            </span>
          )}
          <span className="dim">{res.elapsedMs} ms</span>
          <span className="dim">{formatBytes(res.size)}</span>
          <span className="dim">{res.httpVersion.replace(/^HTTP\/([23])\.0$/, "HTTP/$1")}</span>
        </span>
        <RunsButton tab={tab} />
      </nav>

      {sub === "tests" && scripted ? (
        <TestsView run={run} tabId={tab.id} />
      ) : sub === "console" && scripted ? (
        <ConsoleView run={run} tabId={tab.id} />
      ) : sub === "headers" ? (
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
        <>
          {errors.length > 0 && <GqlErrorList errors={errors} tabId={tab.id} canJump={!tab.example} />}
          <BodyViewer tabId={tab.id} body={res.body} contentType={contentType} example={!!tab.example} tools={saveExample} />
        </>
      )}
    </>,
  );
}

/** At most this many GraphQL errors listed above the body; the body has them all. */
const MAX_GQL_ERRORS = 5;

function GqlErrorList({ errors, tabId, canJump }: { errors: GqlError[]; tabId: string; canJump: boolean }) {
  const jump = (line: number) => window.dispatchEvent(new CustomEvent<OpenGqlLine>(OPEN_GQL_LINE, { detail: { tabId, line } }));
  return (
    <div className="gql-errors" role="list" aria-label="GraphQL errors">
      {errors.slice(0, MAX_GQL_ERRORS).map((e, i) => (
        <div key={i} className="gql-erow" role="listitem">
          <CircleX {...ico} />
          <span>
            <span className="msg">{e.message}</span>
            {e.path && <span className="path">{e.path}</span>}
            {e.code && <span className="code-tag">{e.code}</span>}
          </span>
          {e.line && canJump ? (
            <button type="button" className="link" onClick={() => jump(e.line!)}>
              Line {e.line}
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}
      {errors.length > MAX_GQL_ERRORS && <span className="gql-more">and {errors.length - MAX_GQL_ERRORS} more in the body</span>}
    </div>
  );
}


const openScript = (detail: OpenScript) => window.dispatchEvent(new CustomEvent(OPEN_SCRIPT, { detail }));

/** The error that stopped a script, with a way back to it. */
function ScriptFail({ run, tabId }: { run: ScriptRun; tabId: string }) {
  const sendTab = useStore((s) => s.sendTab);
  const f = run.failed;
  if (!f) return null;
  return (
    <div className="script-fail" role="alert">
      <strong>
        <TriangleAlert {...ico} />
        {f.src === "pre" ? "Pre-request script failed. The request was not sent." : "Post-response script failed."}
      </strong>
      <span className="msg">
        {f.name}: {f.message}
        {f.line ? ` · line ${f.line}` : ""}
      </span>
      <div className="acts">
        <button type="button" className="link" onClick={() => openScript({ tabId, src: f.src })}>
          {f.line ? `Go to line ${f.line}` : "Open script"}
        </button>
        {f.src === "pre" && (
          <button type="button" className="link" onClick={() => sendTab(tabId, { skipScripts: true })}>
            Send without scripts
          </button>
        )}
      </div>
    </div>
  );
}

function TestsView({ run, tabId }: { run?: ScriptRun; tabId: string }) {
  const [show, setShow] = useState<"all" | "passed" | "failed">("all");
  const tests = run?.tests ?? [];
  const passed = tests.filter((t) => t.passed).length;
  const rows = tests.filter((t) => show === "all" || (show === "passed") === t.passed);
  const fail = run?.failed?.src === "post" ? <ScriptFail run={run} tabId={tabId} /> : null;
  const off = useStore((s) => s.settings.runScripts === false);
  const openModal = useStore((s) => s.openModal);
  if (!tests.length && off)
    return (
      <div className="empty">
        <strong>Scripts are off</strong>
        <span>This request has scripts, but Settings › Requests keeps them from running.</span>
        <button type="button" className="link" onClick={() => openModal({ kind: "settings", section: "requests" })}>
          Open Settings
        </button>
      </div>
    );
  if (!tests.length)
    return (
      <>
        {fail}
        <div className="empty">
          <strong>No tests ran</strong>
          <span>
            Add <code>pm.test</code> to the post-response script to check the response on every send.
          </span>
          <button type="button" className="link" onClick={() => openScript({ tabId, src: "post" })}>
            Open the post-response script
          </button>
        </div>
      </>
    );
  return (
    <>
      <div className="res-tools">
        <div className="seg" role="group" aria-label="Show">
          {(
            [
              ["all", "All", tests.length],
              ["passed", "Passed", passed],
              ["failed", "Failed", tests.length - passed],
            ] as const
          ).map(([k, label, n]) => (
            <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)}>
              {label}
              <span className="c">{n}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="res-body">
        {fail}
        <div className="tests">
          {rows.map((t, i) => (
            <div key={i} className={`trow ${t.passed ? "pass" : "fail"}`}>
              {t.passed ? <CircleCheck {...ico} /> : <CircleX {...ico} />}
              <span className="name">{t.name}</span>
              <span className="where">{t.skipped ? "skipped" : !t.passed && t.line ? `line ${t.line}` : ""}</span>
              {!t.passed && t.error && <span className="why">{t.error}</span>}
            </div>
          ))}
          {!rows.length && <p className="tests-none">No {show} tests.</p>}
        </div>
      </div>
    </>
  );
}

function ConsoleList({ run }: { run?: ScriptRun }) {
  const logs = run?.logs ?? [];
  if (!logs.length) return <p className="tests-none">Nothing logged. <code>console.log</code> output and variable changes show here.</p>;
  return (
    <div className="console" role="log">
      {logs.map((l, i) => (
        <div key={i} className={`crow ${l.level}`}>
          <span className="src">{l.src === "pre" ? "Pre" : "Post"}</span>
          <span className="msg">{l.text}</span>
        </div>
      ))}
    </div>
  );
}

function ConsoleView({ run, tabId }: { run?: ScriptRun; tabId: string }) {
  const notify = useStore((s) => s.notify);
  const clear = useStore((s) => s.clearScriptLogs);
  const logs = run?.logs ?? [];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(logs.map((l) => `[${l.src}] ${l.text}`).join("\n"));
      notify("Console copied");
    } catch (e) {
      notify(`Copy failed: ${e}`);
    }
  };
  return (
    <>
      <div className="res-tools">
        <span className="push" />
        <button type="button" className="icon-btn" title="Copy console" aria-label="Copy console" disabled={!logs.length} onClick={copy}>
          <Copy {...ico} />
        </button>
        <button type="button" className="icon-btn" title="Clear console" aria-label="Clear console" disabled={!logs.length} onClick={() => clear(tabId)}>
          <Trash2 {...ico} />
        </button>
      </div>
      <div className="res-body">
        <ConsoleList run={run} />
      </div>
    </>
  );
}
