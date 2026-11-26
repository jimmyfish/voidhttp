import "./ImportModal.css";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useStore } from "../store";
import type { Collection, Environment, TreeNode } from "../types";
import { Select } from "./Select";
import { Braces, Check, ChevronDown, ChevronRight, FileJson, FileUp, Folder, Info, Search, TriangleAlert, X, ico } from "./Icon";
import { analyze, type Analysis } from "../lib/formats";
import type { ImportPlan, Note, Source } from "../lib/formats/common";
import { requestsOf } from "../lib/formats/common";
import { buildOpenApi } from "../lib/formats/openapi";
import { defaultPick, harPlan, type HarFile, type HarOptions } from "../lib/formats/har";
import { commandsSummary } from "../lib/formats/commands";
import { pickImportFile, readRefFile } from "../lib/files";
import { cancel, prepare, send } from "../lib/http";
import { buildScope, resolve } from "../lib/vars";
import { envStyle } from "../lib/tags";
import { formatBytes, methodLabel, newRequest, uid } from "../lib/model";

type Tab = "file" | "url" | "paste";

const isUrl = (s: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(s);

/** GET a URL through the app's own HTTP engine (no browser CORS), as text. */
async function fetchText(url: string): Promise<string> {
  const s = useStore.getState();
  const id = uid();
  try {
    const res = await send(prepare(newRequest({ url }), new Map()), s.settings, id);
    if (res.status >= 400) throw new Error(`${res.status} ${res.statusText} from ${url}`);
    if (res.bodyEncoding === "base64") return new TextDecoder().decode(Uint8Array.from(atob(res.body), (c) => c.charCodeAt(0)));
    return res.body;
  } catch (e) {
    cancel(id).catch(() => {});
    throw e instanceof Error ? e : new Error(String(e));
  }
}

/** `$ref` files: beside a local file, or fetched beside a URL. */
const loadRef =
  (spec: string | undefined) =>
  (key: string): Promise<string> =>
    isUrl(key) ? fetchText(key) : spec ? readRefFile(spec, key) : Promise.reject(new Error(`${key} is not beside a local file`));

/** Note text with `code` spans. */
function NoteText({ text }: { text: string }) {
  return <>{text.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>;
}

function Report({ notes }: { notes: Note[] }) {
  if (!notes.length) return null;
  return (
    <div className="xf-report">
      <h4>Changed on the way in</h4>
      <ul>
        {notes.map((n, i) => (
          <li key={i} className={n.level === "info" ? "info" : undefined}>
            {n.level === "info" ? <Info {...ico} /> : <TriangleAlert {...ico} />}
            <span>
              <NoteText text={n.text} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A checkbox that can show "some" (indeterminate), which React has no attribute for. */
function Check3({ state, onChange, label }: { state: "on" | "off" | "some"; onChange: () => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "some";
  }, [state]);
  return <input ref={ref} type="checkbox" className="xf-check" checked={state === "on"} onChange={onChange} aria-label={label} />;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The plan minus what was unticked; folders left empty go too. */
function prune(nodes: TreeNode[], off: Set<string>): TreeNode[] {
  return nodes.flatMap((n): TreeNode[] => {
    if (n.type === "request") return off.has(n.id) ? [] : [n];
    const children = prune(n.children, off);
    return children.length || !n.children.length ? [{ ...n, children }] : [];
  });
}

const withoutExamples = (nodes: TreeNode[]): TreeNode[] =>
  nodes.map((n) => (n.type === "folder" ? { ...n, children: withoutExamples(n.children) } : { ...n, examples: undefined }));

// ---------- where it goes: project and name ----------

function useTarget() {
  const s = useStore.getState();
  const byRecent = useMemo(() => [...s.projects].sort((a, b) => b.openedAt - a.openedAt), [s.projects]);
  const here = s.view === "project" ? s.currentProjectId : null;
  const [target, setTarget] = useState(here ?? byRecent[0]?.id ?? "");
  const [newName, setNewName] = useState("Imported");
  const projectName = target ? (s.projects.find((p) => p.id === target)?.name ?? "") : newName || "a new project";
  const resolveTarget = () => target || s.createProject({ name: newName.trim() || "Imported", icon: "package", color: 1 });
  const rows = (
    <>
      <div className="set-item stack">
        <label className="set-label" htmlFor="xf-into">
          Import into
        </label>
        <Select id="xf-into" className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
          {byRecent.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.id === here ? " (this project)" : ""}
            </option>
          ))}
          <option value="">New project…</option>
        </Select>
        {target === "" && <input className="field" aria-label="New project name" value={newName} onChange={(e) => setNewName(e.target.value)} />}
      </div>
    </>
  );
  return { rows, projectName, resolveTarget };
}

// ---------- the dialog ----------

export function ImportModal({ source, onClose }: { source?: Source; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("file");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [src, setSrc] = useState<Source | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const start = async (s: Source) => {
    setBusy(true);
    setError("");
    try {
      const a = await analyze(s, s.path || s.url ? loadRef(s.path) : undefined);
      setSrc(s);
      setAnalysis(a);
    } catch (e) {
      setError(`${s.name}: ${(e as Error).message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  // a file dropped on the window or picked elsewhere arrives as a new source
  useEffect(() => {
    if (source) start(source);
  }, [source]);

  const back = () => {
    setAnalysis(null);
    setSrc(null);
  };

  if (analysis && src) {
    const head = (
      <Head step="review" onClose={onClose} />
    );
    if (analysis.kind === "har") return <HarReview head={head} src={src} har={analysis.har} onBack={back} onClose={onClose} />;
    return <TreeReview head={head} src={src} analysis={analysis} onBack={back} onClose={onClose} />;
  }
  return (
    <Frame>
      <Head step="source" onClose={onClose} />
      <div className="xf-body">
        <div className="seg seg--lg xf-src" role="group" aria-label="Source">
          {(["file", "url", "paste"] as Tab[]).map((t) => (
            <button key={t} type="button" aria-pressed={tab === t} onClick={() => (setTab(t), setError(""))}>
              {t === "file" ? "File" : t === "url" ? "URL" : "Paste"}
            </button>
          ))}
        </div>
        {tab === "file" && <FileTab busy={busy} onPick={async () => {
          try {
            const s = await pickImportFile();
            if (s) start(s);
          } catch (e) {
            setError(String(e));
          }
        }} />}
        {tab === "url" && <UrlTab busy={busy} onFetch={async (url) => {
          setBusy(true);
          setError("");
          try {
            const text = await fetchText(url);
            await start({ name: url.split("/").pop() || url, text, url });
          } catch (e) {
            setError((e as Error).message ?? String(e));
            setBusy(false);
          }
        }} />}
        {tab === "paste" && <PasteTab busy={busy} onContinue={(text) => start({ name: "Pasted text", text })} footer={onClose} error={error} />}
        {error && tab !== "paste" && <p className="xf-error" role="alert">{error}</p>}
      </div>
      {tab !== "paste" && (
        <div className="xf-foot">
          <span className="note">{tab === "file" ? "The format is detected from the file." : "Fetched once. Nothing stays linked to the URL."}</span>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      )}
    </Frame>
  );
}

function Frame({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const close = () => useStore.getState().openModal(null);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={`dialog xf${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="xf-title">
        {children}
      </div>
    </div>
  );
}

function Head({ step, onClose }: { step: "source" | "review"; onClose: () => void }) {
  return (
    <div className="xf-head">
      <h3 id="xf-title">Import</h3>
      <ol className="xf-steps">
        <li aria-current={step === "source" ? "step" : undefined}>Source</li>
        <li aria-current={step === "review" ? "step" : undefined}>Review</li>
      </ol>
      <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
        <X {...ico} />
      </button>
    </div>
  );
}

function FileTab({ busy, onPick }: { busy: boolean; onPick: () => void }) {
  return (
    <>
      <button type="button" className="xf-drop" onClick={onPick} disabled={busy} aria-busy={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <FileUp size={28} strokeWidth={1.5} className="ico" aria-hidden />}
        <strong>{busy ? "Reading…" : "Drop a file here"}</strong>
        <span>
          or <span className="link">choose a file</span> · you can also drop it anywhere in the window
        </span>
      </button>
      <span className="xf-label">Reads</span>
      <ul className="xf-formats">
        <li>
          <b>Postman</b>
          <span>Collection v2.0 / v2.1 and environment exports</span>
          <code>.json</code>
        </li>
        <li>
          <b>OpenAPI 3 · Swagger 2</b>
          <span>Stoplight, SwaggerHub, Redocly, springdoc, FastAPI</span>
          <code>.json .yaml</code>
        </li>
        <li>
          <b>HAR</b>
          <span>Network capture from Chrome, Safari or Firefox devtools</span>
          <code>.har</code>
        </li>
        <li>
          <b>voidHTTP</b>
          <span>Export from another voidHTTP: gRPC calls, examples, environments</span>
          <code>.json</code>
        </li>
      </ul>
    </>
  );
}

function UrlTab({ busy, onFetch }: { busy: boolean; onFetch: (url: string) => void }) {
  const s = useStore.getState();
  const env = s.environments.find((e) => e.id === s.activeEnvironmentId);
  const [url, setUrl] = useState("");
  const resolved = resolve(url.trim(), buildScope(env?.variables));
  const go = () => resolved && !busy && onFetch(resolved);
  return (
    <>
      <label htmlFor="xf-spec-url" className="xf-label xf-label--first">
        OpenAPI or Swagger spec
      </label>
      <div className="xf-url">
        <input
          id="xf-spec-url"
          className="field"
          autoFocus
          placeholder="{{baseUrl}}/v3/api-docs"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
        />
        <button type="button" className="btn" disabled={!resolved || busy} aria-busy={busy} onClick={go}>
          {busy ? "Fetching…" : "Fetch"}
        </button>
      </div>
      {env && url.includes("{{") && (
        <div className="xf-resolve">
          <span className="env-dot" style={envStyle(env.color)} aria-hidden="true" />
          <span>{env.name}:</span>
          <code>{resolved}</code>
        </div>
      )}
      <p className="xf-hint">
        JSON or YAML. Spring (springdoc) serves it at <code>/v3/api-docs</code>, FastAPI at <code>/openapi.json</code>. Any <code>$ref</code> to another file is fetched next to it.
      </p>
    </>
  );
}

function PasteTab({ busy, onContinue, footer, error }: { busy: boolean; onContinue: (text: string) => void; footer: () => void; error: string }) {
  const [text, setText] = useState("");
  const sum = useMemo(() => commandsSummary(text), [text]);
  const commands = sum.curl + sum.grpcurl;
  const note = !text.trim()
    ? "Nothing pasted yet."
    : commands
      ? `Found ${plural(commands, "request")}: ${[sum.curl && `${sum.curl} cURL`, sum.grpcurl && `${sum.grpcurl} grpcurl`].filter(Boolean).join(", ")}.`
      : "Read as a file.";
  return (
    <>
      <textarea
        className="field xf-paste"
        aria-label="Pasted text"
        autoFocus
        spellCheck={false}
        placeholder={"curl -X POST https://api.example.com/v1/customers \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"name\":\"Ada\"}'"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="xf-hint">One or many cURL / grpcurl commands, or the text of any file above.</p>
      {error && <p className="xf-error" role="alert">{error}</p>}
      <div className="xf-foot xf-foot--inset">
        <span className="note">{note}</span>
        <button type="button" className="btn" onClick={footer}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" disabled={!text.trim() || busy} aria-busy={busy} onClick={() => onContinue(text)}>
          Continue
        </button>
      </div>
    </>
  );
}

function FileCard({ src, label, detail, onBack }: { src: Source; label: string; detail: string; onBack: () => void }) {
  return (
    <div className="xf-file">
      <FileJson size={20} strokeWidth={1.75} className="ico" aria-hidden />
      <div>
        <strong>{src.name}</strong>
        <span>
          <b>{label}</b>
          {detail && ` · ${detail}`}
        </span>
      </div>
      <button type="button" className="link" onClick={onBack}>
        Choose another
      </button>
    </div>
  );
}

// ---------- review: a tree to tick (Postman, OpenAPI, voidHTTP, pasted commands) ----------

function TreeReview({ head, src, analysis, onBack, onClose }: { head: ReactNode; src: Source; analysis: Exclude<Analysis, { kind: "har" }>; onBack: () => void; onClose: () => void }) {
  const s = useStore.getState();
  const [folders, setFolders] = useState<"tags" | "paths">("tags");
  const [examples, setExamples] = useState(true);
  const plan: ImportPlan = useMemo(
    () => (analysis.kind === "openapi" ? buildOpenApi(analysis.spec, { folders, examples: true }) : analysis.plan),
    [analysis, folders],
  );
  const [off, setOff] = useState<Set<string>>(new Set());
  const [closed, setClosed] = useState<Set<string>>(new Set());
  useEffect(() => setOff(new Set()), [plan]);
  const single = plan.collections.length === 1 ? plan.collections[0] : null;
  const [name, setName] = useState(single?.name ?? "");
  useEffect(() => setName(single?.name ?? ""), [single?.name]);
  const { rows: targetRows, resolveTarget } = useTarget();

  const all = plan.collections.flatMap((c) => requestsOf(c.children));
  const picked = all.filter((r) => !off.has(r.id)).length;
  const envsPicked = plan.environments.filter((e) => !off.has(e.id));
  const exampleCount = all.reduce((n, r) => n + (r.examples?.length ?? 0), 0);
  const baseUrl = single?.variables.find((v) => v.key === "baseUrl")?.value;

  const stateOf = (nodes: TreeNode[]): "on" | "off" | "some" => {
    const reqs = requestsOf(nodes);
    const n = reqs.filter((r) => !off.has(r.id)).length;
    return n === 0 ? "off" : n === reqs.length ? "on" : "some";
  };
  const toggle = (ids: string[], on: boolean) =>
    setOff((prev) => {
      const next = new Set(prev);
      for (const id of ids) on ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleNodes = (nodes: TreeNode[]) => {
    const ids = requestsOf(nodes).map((r) => r.id);
    toggle(ids, stateOf(nodes) !== "on");
  };
  const flip = (id: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const renderNodes = (nodes: TreeNode[], depth: number): ReactNode[] =>
    nodes.flatMap((n) => {
      const indent = { "--indent": `${depth * 24}px` } as React.CSSProperties;
      if (n.type === "folder") {
        const open = !closed.has(n.id);
        const st = stateOf(n.children);
        return [
          <div key={n.id} className={`row${st === "off" ? " off" : ""}`} style={indent}>
            <Check3 state={st} onChange={() => toggleNodes(n.children)} label={`Include ${n.name}`} />
            <button type="button" className="row-main" aria-expanded={open} onClick={() => flip(n.id)}>
              {open ? <ChevronDown {...ico} className="ico caret" /> : <ChevronRight {...ico} className="ico caret" />}
              <Folder {...ico} className="ico folder" />
              <span className="name">{n.name}</span>
              <span className="count">({requestsOf(n.children).length})</span>
            </button>
          </div>,
          ...(open ? renderNodes(n.children, depth + 1) : []),
        ];
      }
      const on = !off.has(n.id);
      const from = n.examples?.length ? `${plural(n.examples.length, "example")}` : "";
      return [
        <label key={n.id} className={`row${on ? "" : " off"}`} style={{ "--indent": `${depth * 24 + 24}px` } as React.CSSProperties}>
          <input type="checkbox" className="xf-check" checked={on} onChange={() => toggle([n.id], !on)} />
          <span className={`m m-${n.method.toUpperCase()}`}>{methodLabel(n.method)}</span>
          <span className="name">{n.name}</span>
          {from && <span className="from">{from}</span>}
        </label>,
      ];
    });

  const submit = () => {
    const collections: Collection[] = plan.collections
      .map((c) => ({ ...c, name: single && name.trim() ? name.trim() : c.name, children: prune(examples ? c.children : withoutExamples(c.children), off) }))
      .filter((c) => c.children.length || !requestsOf(plan.collections.find((p) => p.id === c.id)!.children).length);
    const environments: Environment[] = envsPicked;
    if (!collections.length && !environments.length) return;
    const projectId = resolveTarget();
    const n = collections.reduce((m, c) => m + requestsOf(c.children).length, 0);
    const what = collections.length
      ? `${plural(n, "request")} into “${collections.length === 1 ? collections[0].name : `${collections.length} collections`}”`
      : environments.length === 1
        ? `environment “${environments[0].name}”`
        : `${environments.length} environments`;
    const changed = plan.notes.filter((x) => x.level === "warn").length;
    s.applyImport(projectId, collections, environments, `Imported ${what}${changed ? ` · ${changed} changed on the way in` : ""}`);
    onClose();
  };

  const nothing = picked === 0 && envsPicked.length === 0;
  return (
    <Frame wide>
      {head}
      <div className="xf-body">
        <FileCard src={src} label={plan.label} detail={plan.detail} onBack={onBack} />
        <div className="xf-cols">
          <div className="xf-pick">
            <div className="xf-pick-head">
              {all.length ? "Requests" : "Environments"}
              <span className="dim">
                {all.length ? `${picked} of ${all.length}` : `${envsPicked.length} of ${plan.environments.length}`}
              </span>
              <button
                type="button"
                className="link"
                onClick={() => setOff(off.size ? new Set() : new Set([...all.map((r) => r.id), ...plan.environments.map((e) => e.id)]))}
              >
                {off.size ? "Select all" : "Select none"}
              </button>
            </div>
            <div className="xf-tree">
              {plan.collections.map((c) =>
                plan.collections.length > 1 ? (
                  <div key={c.id}>
                    <div className={`row collection${stateOf(c.children) === "off" ? " off" : ""}`}>
                      <Check3 state={stateOf(c.children)} onChange={() => toggleNodes(c.children)} label={`Include ${c.name}`} />
                      <span className="name">{c.name}</span>
                      <span className="count">({requestsOf(c.children).length})</span>
                    </div>
                    {renderNodes(c.children, 1)}
                  </div>
                ) : (
                  <div key={c.id}>{renderNodes(c.children, 0)}</div>
                ),
              )}
              {plan.environments.map((e) => {
                const on = !off.has(e.id);
                return (
                  <label key={e.id} className={`row${on ? "" : " off"}`}>
                    <input type="checkbox" className="xf-check" checked={on} onChange={() => toggle([e.id], !on)} />
                    <Braces {...ico} className="ico folder" />
                    <span className="name">{e.name}</span>
                    <span className="from">{plural(e.variables.length, "variable")}</span>
                  </label>
                );
              })}
              {!all.length && !plan.environments.length && <p className="xf-hint xf-empty">Nothing to import in this file.</p>}
            </div>
          </div>
          <div>
            <div className="set-list xf-opts">
              {targetRows}
              {single && (
                <div className="set-item stack">
                  <label className="set-label" htmlFor="xf-name">
                    Collection name
                  </label>
                  <input id="xf-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              )}
              {analysis.kind === "openapi" && (
                <div className="set-item">
                  <div className="set-text">
                    <span className="set-label">Folders from</span>
                  </div>
                  <div className="seg" role="group" aria-label="Folders from">
                    <button type="button" aria-pressed={folders === "tags"} onClick={() => setFolders("tags")}>
                      Tags
                    </button>
                    <button type="button" aria-pressed={folders === "paths"} onClick={() => setFolders("paths")}>
                      Paths
                    </button>
                  </div>
                </div>
              )}
              {analysis.kind === "openapi" && baseUrl !== undefined && (
                <div className="set-item">
                  <div className="set-text">
                    <span className="set-label">Base URL</span>
                    <span className="desc">
                      <code>{"{{baseUrl}}"}</code> = <code>{baseUrl || "(empty)"}</code>
                    </span>
                  </div>
                </div>
              )}
              {exampleCount > 0 && (
                <div className="set-item">
                  <div className="set-text">
                    <label className="set-label" htmlFor="xf-ex">
                      Response examples
                    </label>
                    <span className="desc">{plural(exampleCount, "found")}, saved under their request</span>
                  </div>
                  <input id="xf-ex" type="checkbox" className="switch" checked={examples} onChange={(e) => setExamples(e.target.checked)} />
                </div>
              )}
            </div>
            <Report notes={plan.notes} />
          </div>
        </div>
      </div>
      <div className="xf-foot">
        <span className="note">Nothing is saved until you import.</span>
        <button type="button" className="btn" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn btn--primary" disabled={nothing} onClick={submit}>
          {all.length ? `Import ${plural(picked, "request")}` : "Import"}
        </button>
      </div>
    </Frame>
  );
}

// ---------- review: captured calls to pick (HAR) ----------

function HarReview({ head, src, har, onBack, onClose }: { head: ReactNode; src: Source; har: HarFile; onBack: () => void; onClose: () => void }) {
  const s = useStore.getState();
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState("");
  const [hosts, setHosts] = useState(() => new Set(har.defaultHosts));
  const [picked, setPicked] = useState(() => defaultPick(har));
  const [opts, setOpts] = useState<HarOptions>({ strip: true, hostVars: true, examples: true, folders: "host" });
  const { rows: targetRows, projectName, resolveTarget } = useTarget();
  const name = src.name.replace(/\.har$/i, "") || "Captured requests";

  const visible = har.rows.filter((r) => hosts.has(r.host) && (showAll || r.api) && (!filter || r.url.toLowerCase().includes(filter.toLowerCase())));
  const chosen = new Set(visible.filter((r) => picked.has(r.id)).map((r) => r.id));
  const allState = chosen.size === 0 ? "off" : chosen.size === visible.length ? "on" : "some";

  const setPick = (ids: string[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });
  const toggleHost = (h: string) => {
    const on = !hosts.has(h);
    setHosts((prev) => {
      const next = new Set(prev);
      on ? next.add(h) : next.delete(h);
      return next;
    });
    // switching a host on picks its API calls, the same way the first view does
    if (on) setPick(har.rows.filter((r) => r.host === h && r.api && !r.dupOf && !r.preflight).map((r) => r.id), true);
  };
  const opt = <K extends keyof HarOptions>(k: K, v: HarOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  const submit = () => {
    if (!chosen.size) return;
    const plan = harPlan(har, chosen, name, opts);
    const projectId = resolveTarget();
    s.applyImport(projectId, plan.collections, [], `Imported ${plural(chosen.size, "request")} into “${name}”`);
    onClose();
  };

  return (
    <Frame wide>
      {head}
      <div className="xf-body">
        <FileCard src={src} label={har.label} detail={har.detail} onBack={onBack} />
        <div className="xf-tools">
          <div className="seg" role="group" aria-label="Show">
            <button type="button" aria-pressed={!showAll} onClick={() => setShowAll(false)}>
              Fetch / XHR
            </button>
            <button type="button" aria-pressed={showAll} onClick={() => setShowAll(true)}>
              All
            </button>
          </div>
          <div className="search">
            <Search {...ico} />
            <input className="field" placeholder="Filter by URL" aria-label="Filter by URL" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        </div>
        <div className="xf-hosts" role="group" aria-label="Hosts">
          {har.hosts.map((h) => (
            <button key={h.host} type="button" className="xf-host" aria-pressed={hosts.has(h.host)} onClick={() => toggleHost(h.host)}>
              <Check {...ico} />
              {h.host || "(no host)"} <span className="n">{h.count}</span>
            </button>
          ))}
        </div>
        <div className="xf-scroll">
          <table className="xf-table">
            <thead>
              <tr>
                <th className="c-check">
                  <Check3 state={allState} label="Select all" onChange={() => setPick(visible.map((r) => r.id), allState !== "on")} />
                </th>
                <th className="c-m">Method</th>
                <th className="c-st">Status</th>
                <th>URL</th>
                <th className="c-num">Size</th>
                <th className="c-num">Time</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const on = picked.has(r.id);
                return (
                  <tr key={r.id} className={on ? undefined : "off"} onClick={(e) => (e.target as HTMLElement).tagName !== "INPUT" && setPick([r.id], !on)}>
                    <td className="c-check">
                      <input type="checkbox" className="xf-check" checked={on} aria-label={`Include ${r.method} ${r.url}`} onChange={() => setPick([r.id], !on)} />
                    </td>
                    <td>
                      <span className={`m m-${r.method}`}>{methodLabel(r.method)}</span>
                    </td>
                    <td>
                      <span className={`st st-${String(r.status)[0]}`}>{r.status || "—"}</span>
                    </td>
                    <td className="url" title={r.url}>
                      <span className="host">{r.host}</span>
                      {r.rest}
                      {r.dupOf && <span className="xf-tag">repeat</span>}
                      {r.preflight && <span className="xf-tag">CORS preflight</span>}
                    </td>
                    <td className="c-num">{formatBytes(r.size)}</td>
                    <td className="c-num">{r.time} ms</td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={6} className="xf-none">
                    No calls match. Switch on a host above, or show All.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="set-list xf-opts xf-har-opts">
          <div className="set-item">
            <div className="set-text">
              <label className="set-label" htmlFor="xf-strip">
                Strip cookies and tokens
              </label>
              <span className="desc">
                <code>Cookie</code>, <code>Authorization</code> and <code>Set-Cookie</code> are left out
              </span>
            </div>
            <input id="xf-strip" type="checkbox" className="switch" checked={opts.strip} onChange={(e) => opt("strip", e.target.checked)} />
          </div>
          <div className="set-item">
            <div className="set-text">
              <label className="set-label" htmlFor="xf-hv">
                Hosts as variables
              </label>
              <span className="desc">
                <code>{"{{baseUrl}}"}</code> for the most used host
              </span>
            </div>
            <input id="xf-hv" type="checkbox" className="switch" checked={opts.hostVars} onChange={(e) => opt("hostVars", e.target.checked)} />
          </div>
          <div className="set-item">
            <div className="set-text">
              <label className="set-label" htmlFor="xf-hex">
                Responses as examples
              </label>
              <span className="desc">Masked like a saved example</span>
            </div>
            <input id="xf-hex" type="checkbox" className="switch" checked={opts.examples} onChange={(e) => opt("examples", e.target.checked)} />
          </div>
          <div className="set-item">
            <div className="set-text">
              <span className="set-label">Folders</span>
            </div>
            <div className="seg" role="group" aria-label="Folders">
              {(["host", "path", "none"] as const).map((f) => (
                <button key={f} type="button" aria-pressed={opts.folders === f} onClick={() => opt("folders", f)}>
                  {f === "host" ? "By host" : f === "path" ? "By path" : "None"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="set-list xf-opts xf-opts-full">{targetRows}</div>
      </div>
      <div className="xf-foot">
        <span className="note">
          {chosen.size} of {har.rows.length} selected · into {projectName}, as “{name}”
        </span>
        <button type="button" className="btn" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn btn--primary" disabled={!chosen.size} onClick={submit}>
          Import {plural(chosen.size, "request")}
        </button>
      </div>
    </Frame>
  );
}
