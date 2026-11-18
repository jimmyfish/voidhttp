import { TitleName } from "./InlineRename";
import { useEffect, useRef, useState } from "react";
import { Select } from "./Select";
import { useStore } from "../store";
import type { Auth, BodyMode, RequestDef, Tab } from "../types";
import { capRequest } from "../lib/formats/common";
import { findNode, paramsFromUrl, pathTo, urlWithParams } from "../lib/model";
import { DYNAMIC, resolve, unresolved } from "../lib/vars";
import { isSecretKey } from "../lib/mask";
import { MethodMenu } from "./MethodMenu";
import { UrlInput, type VarInfo } from "./UrlInput";
import { prepare } from "../lib/http";
import { looksLikeCurl, parseCurl, toCurl } from "../lib/curl";
import { KVEditor } from "./KVEditor";
import { CodeArea } from "./CodeArea";
import { formatJsonc, stripJsonComments } from "../lib/jsonc";
import { ChevronDown, CircleCheck, CircleDashed, CircleDot, CodeXml, FileCode, SendHorizontal, SlidersHorizontal, WandSparkles, WrapText, ico, icoLg } from "./Icon";
import { OPEN_SCRIPT, SNIPPETS, hasScript, type OpenScript } from "../lib/script";
import { defaultGrpc, isGrpc, looksLikeGrpcurl, parseGrpcurl } from "../lib/grpc";
import { GrpcRequestPane } from "./GrpcPane";
import { WsRequestPane } from "./WsPane";
import { defaultWs, isWs } from "../lib/ws";
import { SioRequestPane } from "./SioPane";
import { defaultSio, isSio } from "../lib/sio";
import { KafkaRequestPane } from "./KafkaPane";
import { defaultKafka, isKafka } from "../lib/kafka";
import { MqttRequestPane } from "./MqttPane";
import { defaultMqtt, isMqtt } from "../lib/mqtt";
import { defaultGql, gqlFromJson, gqlPayload, isGql } from "../lib/graphql";
import { GqlQueryEditor, OPEN_GQL_LINE, type OpenGqlLine } from "./GqlPane";

type Section = "params" | "headers" | "body" | "query" | "auth" | "scripts";

export function RequestPane({ tab, grow }: { tab: Tab; grow: number }) {
  const [picked, setSection] = useState<Section>(isGql(tab.request) ? "query" : tab.request.body.mode !== "none" ? "body" : "params");
  const [menuOpen, setMenuOpen] = useState(false);
  const [phase, setPhase] = useState<"pre" | "post">(hasScript(tab.request.scripts?.pre) || !hasScript(tab.request.scripts?.post) ? "pre" : "post");
  const menuRef = useRef<HTMLDivElement>(null);
  const update = useStore((s) => s.updateRequest);
  const scopeFor = useStore((s) => s.scopeFor);
  // re-render when variables change so the unresolved hint and the address bar stay correct
  const activeEnvId = useStore((s) => s.activeEnvironmentId);
  const environments = useStore((s) => s.environments);
  const collections = useStore((s) => s.collections);
  const st = useStore.getState(); // actions only

  const req = tab.request;
  const gql = isGql(req);
  // GraphQL's Query takes Body's place, both ways when the method changes
  const section: Section = gql ? (picked === "body" ? "query" : picked) : picked === "query" ? "body" : picked;
  const set = (patch: Parameters<typeof update>[1]) => update(tab.id, patch);
  const scope = scopeFor(tab.id);
  const missing = unresolved(req.url, scope);
  const loading = !!tab.inflightId;
  // an example is a saved record: shown read-only, never sent
  const ex = tab.example;

  // where the saved request lives, for the title row
  const col = tab.savedRef && collections.find((c) => c.id === tab.savedRef!.collectionId);
  const saved = !!(col && findNode(col.children, tab.savedRef!.nodeId));
  const folders = saved ? pathTo(col!.children, tab.savedRef!.nodeId) ?? [] : [];
  const exCol = ex && collections.find((c) => c.id === ex.collectionId);
  const exNode = exCol ? findNode(exCol.children, ex.nodeId) : undefined;
  const exPath = exCol && exNode ? [exCol.name, ...(pathTo(exCol.children, ex.nodeId) ?? []), exNode.name].join(" / ") : "Request deleted";

  // where a {{name}} in the address bar gets its value; the environment overrides the collection
  const env = environments.find((e) => e.id === activeEnvId);
  // an example tab has no savedRef: its variables come from the collection that holds the example
  const varCol = col || exCol || undefined;
  // once per name per render: the address bar asks for every {{token}}, and a URL may repeat one many times
  const looked = new Map<string, VarInfo>();
  const byName = (vars: { enabled: boolean; key: string; value: string }[] | undefined) => {
    const m = new Map<string, { enabled: boolean; key: string; value: string }>();
    for (const v of vars ?? []) if (v.enabled && !m.has(v.key)) m.set(v.key, v);
    return m;
  };
  let envVars: ReturnType<typeof byName> | undefined;
  let colVars: ReturnType<typeof byName> | undefined;
  const lookup = (name: string): VarInfo => {
    const known = looked.get(name);
    if (known) return known;
    const info = lookupOnce(name);
    looked.set(name, info);
    return info;
  };
  const lookupOnce = (name: string): VarInfo => {
    envVars ??= byName(env?.variables);
    colVars ??= byName(varCol?.variables);
    const hit = envVars.get(name);
    const colHit = colVars.get(name);
    const v = hit ?? colHit;
    // a tooltip shows the value: a small budget keeps a variable that grows on expansion cheap
    if (v) return { kind: "value", value: resolve(v.value, scope, 0, 1 << 12), source: hit ? env!.name : `Collection · ${varCol?.name}`, secret: isSecretKey(name) };
    if (DYNAMIC.includes(name)) return { kind: "dynamic" };
    const target = env ?? varCol;
    return {
      kind: "missing",
      addLabel: target ? `Add to ${target.name}` : "Open Variables",
      onAdd: () => st.openModal({ kind: "environments", ...(target && { select: target.id, addVar: name }) }),
    };
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  useEffect(() => {
    const open = (e: Event) => {
      const d = (e as CustomEvent<OpenScript>).detail;
      if (d.tabId !== tab.id) return;
      setSection("scripts");
      setPhase(d.src);
    };
    const openQuery = (e: Event) => (e as CustomEvent<OpenGqlLine>).detail.tabId === tab.id && setSection("query");
    window.addEventListener(OPEN_SCRIPT, open);
    window.addEventListener(OPEN_GQL_LINE, openQuery);
    return () => {
      window.removeEventListener(OPEN_SCRIPT, open);
      window.removeEventListener(OPEN_GQL_LINE, openQuery);
    };
  }, [tab.id]);

  const copyCurl = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(toCurl(prepare(req, scopeFor(tab.id))));
      st.notify("cURL copied to clipboard");
    } catch (e) {
      st.notify(`Copy failed: ${e}`);
    }
  };
  const removeExample = () =>
    ex &&
    st.openModal({
      kind: "confirm",
      title: `Delete example “${req.name}”?`,
      message: "This cannot be undone.",
      onConfirm: () => st.deleteExample(ex),
    });
  // Save and its state: the same for HTTP and gRPC requests. No Delete here (too easy to hit next to
  // Save); a saved request is deleted from its "…" menu in the sidebar.
  const saveControls = !ex && (
    <>
      <div className="joined">
        <button type="button" className="btn" onClick={() => st.saveTab(tab.id)}>
          Save
        </button>
        {!saved ? (
          <span className="btn joined-tail save-state" role="img" aria-label="Not saved yet" title="Not saved yet">
            <CircleDashed {...ico} />
          </span>
        ) : tab.dirty ? (
          <span className="btn joined-tail save-state dirty-state" role="img" aria-label="Unsaved changes" title="Unsaved changes">
            <CircleDot {...ico} />
          </span>
        ) : (
          <span className="btn joined-tail save-state ok" role="img" aria-label="Saved" title="Saved">
            <CircleCheck {...ico} />
          </span>
        )}
      </div>
    </>
  );
  const titlePath = ex ? `${exPath} · example` : saved ? [col!.name, ...folders].join(" / ") : "Not saved";
  // the method menu, whichever pane shows it: gRPC, WebSocket, Socket.IO, Kafka and MQTT bring their own settings and a message body;
  // GraphQL takes a JSON body that already is one ({ "query": … }), and leaving it keeps its payload as the JSON body
  const pickMethod = (m: string) =>
    m === "GQL"
      ? set({ method: "GQL", gql: req.gql ?? (req.body.mode === "json" ? gqlFromJson(req.body.raw) : null) ?? defaultGql() })
      : gql && !["GRPC", "WS", "SIO", "KAFKA", "MQTT"].includes(m) && req.body.mode === "none"
        ? set({ method: m, body: { ...req.body, mode: "json", raw: gqlPayload(req.gql ?? defaultGql()) } })
        : m === "GRPC"
      ? set({ method: "GRPC", grpc: req.grpc ?? defaultGrpc(req.url), body: { ...req.body, mode: "json" } })
      : m === "WS"
        ? set({ method: "WS", ws: req.ws ?? defaultWs(), body: { ...req.body, mode: req.body.mode === "text" ? "text" : "json" } })
        : m === "SIO"
          ? set({ method: "SIO", sio: req.sio ?? defaultSio(), body: { ...req.body, mode: req.body.mode === "text" ? "text" : "json" } })
          : m === "KAFKA"
            ? set({ method: "KAFKA", kafka: req.kafka ?? defaultKafka(), body: { ...req.body, mode: req.body.mode === "text" ? "text" : "json" } })
            : m === "MQTT"
              ? set({ method: "MQTT", mqtt: req.mqtt ?? defaultMqtt(), body: { ...req.body, mode: req.body.mode === "text" ? "text" : "json" } })
              : set({ method: m });

  if (isGrpc(req))
    return (
      <GrpcRequestPane
        tab={tab}
        grow={grow}
        lookup={lookup}
        missing={missing}
        path={titlePath}
        saveControls={saveControls}
        authEditor={<AuthEditor auth={req.auth} onChange={(auth) => set({ auth })} />}
      />
    );

  if (isWs(req))
    return (
      <WsRequestPane
        tab={tab}
        grow={grow}
        lookup={lookup}
        missing={missing}
        path={titlePath}
        saveControls={saveControls}
        authEditor={<AuthEditor auth={req.auth} onChange={(auth) => set({ auth })} />}
        onKind={pickMethod}
      />
    );

  if (isMqtt(req))
    return <MqttRequestPane tab={tab} grow={grow} lookup={lookup} missing={missing} path={titlePath} saveControls={saveControls} onKind={pickMethod} />;

  if (isKafka(req))
    return <KafkaRequestPane tab={tab} grow={grow} lookup={lookup} missing={missing} path={titlePath} saveControls={saveControls} onKind={pickMethod} />;

  if (isSio(req))
    return (
      <SioRequestPane
        tab={tab}
        grow={grow}
        lookup={lookup}
        missing={missing}
        path={titlePath}
        saveControls={saveControls}
        authEditor={<AuthEditor auth={req.auth} onChange={(auth) => set({ auth })} />}
        onKind={pickMethod}
      />
    );

  const n = (count: number) => (count ? <span className="n">{count}</span> : null);
  const enabledParams = req.params.filter((p) => p.enabled && p.key).length;
  const enabledHeaders = req.headers.filter((h) => h.enabled && h.key).length;

  return (
    <div className="req-pane" style={{ flexGrow: grow }}>
      <form
        className="request-line"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ex) loading ? st.cancelTab(tab.id) : st.sendTab(tab.id);
        }}
      >
        <div className="url-field">
          <MethodMenu
            value={req.method}
            disabled={!!ex}
            className={`method-pick m-${req.method}`}
            onPick={pickMethod}
          >
            {req.method}
          </MethodMenu>
          <UrlInput
            lookup={lookup}
            aria-label="URL"
            spellCheck={false}
            autoFocus={!ex}
            readOnly={!!ex}
            placeholder="https://api.example.com/users or {{baseUrl}}/users"
            value={req.url}
            onChange={(e) => set({ url: e.target.value, params: paramsFromUrl(e.target.value, req.params) })}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (!ex && looksLikeGrpcurl(text)) {
                // a grpcurl command turns this tab into a gRPC request
                e.preventDefault();
                const parsed = parseGrpcurl(text);
                if (!parsed) return st.notify("Couldn’t find a server address in that grpcurl command");
                set({ ...parsed.request, params: [] });
                return st.notify(["Imported from grpcurl", ...parsed.notes].join(" · "));
              }
              if (ex || !looksLikeCurl(text)) return;
              e.preventDefault();
              const parsed = parseCurl(text);
              if (!parsed) return st.notify("Couldn’t find a URL in that cURL command");
              set(capRequest(parsed as RequestDef));
              if (parsed.body.mode !== "none") setSection("body");
              st.notify("Imported from cURL");
            }}
          />
        </div>

        {ex ? (
          <button type="button" className="btn" onClick={removeExample}>
            Delete
          </button>
        ) : loading ? (
          <button type="submit" className="btn btn--danger" aria-busy="true">
            Cancel
          </button>
        ) : (
          <div className="joined send-group" ref={menuRef}>
            <button type="submit" className="btn btn--primary">
              Send
            </button>
            <button
              type="button"
              className="btn btn--primary joined-tail"
              aria-label="More send options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <ChevronDown {...ico} />
            </button>
            {menuOpen && (
              <div className="menu" role="menu" aria-label="Send options">
                {(hasScript(req.scripts?.pre) || hasScript(req.scripts?.post)) && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      st.sendTab(tab.id, { skipScripts: true });
                    }}
                  >
                    <SendHorizontal {...ico} />
                    Send without scripts
                  </button>
                )}
                <button type="button" role="menuitem" onClick={copyCurl}>
                  <CodeXml {...ico} />
                  Copy as cURL
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    st.openModal({ kind: "settings", section: "requests" });
                  }}
                >
                  <SlidersHorizontal {...ico} />
                  Request settings
                </button>
              </div>
            )}
          </div>
        )}

        {saveControls}
      </form>

      <div className="req-title">
        <TitleName tab={tab} />
        <span className="path">{titlePath}</span>
        {missing.length > 0 && <span className="hint">Unresolved: {missing.map((m) => `{{${m}}}`).join(", ")}</span>}
      </div>

      <nav className="subtabs" aria-label="Request">
        {((gql ? ["query", "params", "headers", "auth", "scripts"] : ["params", "body", "headers", "auth", "scripts"]) as Section[]).map((s) => (
          <button key={s} type="button" className="subtab" aria-pressed={section === s} onClick={() => setSection(s)}>
            {s[0].toUpperCase() + s.slice(1)}
            {s === "params" && n(enabledParams)}
            {s === "body" && n(req.body.mode !== "none" ? 1 : 0)}
            {s === "headers" && n(enabledHeaders)}
            {s === "auth" && n(req.auth.type !== "none" ? 1 : 0)}
            {s === "scripts" && n(Number(hasScript(req.scripts?.pre)) + Number(hasScript(req.scripts?.post)))}
          </button>
        ))}
        <button type="button" className="icon-btn push" title="Copy as cURL" aria-label="Copy as cURL" onClick={copyCurl}>
          <CodeXml {...ico} />
        </button>
      </nav>

      <div className="section">
        <fieldset className="ro" disabled={!!ex}>
          {section === "params" && (
            <KVEditor
              rows={req.params}
              addLabel="Add a param"
              onChange={(params) => set({ params, url: urlWithParams(req.url, params) })}
            />
          )}
          {section === "headers" && <KVEditor rows={req.headers} nameLabel="Header" addLabel="Add a header" onChange={(headers) => set({ headers })} />}
          {section === "body" && <BodyEditor tab={tab} />}
          {section === "query" && <GqlQueryEditor tab={tab} />}
          {section === "auth" && <AuthEditor auth={req.auth} onChange={(auth) => set({ auth })} />}
          {section === "scripts" && <ScriptsEditor tab={tab} phase={phase} setPhase={setPhase} />}
        </fieldset>
      </div>
    </div>
  );
}

const BODY_MODES: { mode: BodyMode; label: string }[] = [
  { mode: "none", label: "none" },
  { mode: "json", label: "json" },
  { mode: "text", label: "text" },
  { mode: "xml", label: "xml" },
  { mode: "form", label: "x-www-form-urlencoded" },
  { mode: "multipart", label: "form-data" },
];

function BodyEditor({ tab }: { tab: Tab }) {
  const update = useStore((s) => s.updateRequest);
  const notify = useStore((s) => s.notify);
  const wrap = useStore((s) => s.settings.wrapRequestBody ?? false);
  const setSettings = useStore((s) => s.setSettings);
  const body = tab.request.body;
  const set = (patch: Partial<typeof body>) => update(tab.id, { body: { ...body, ...patch } });

  const beautify = () => {
    try {
      JSON.parse(stripJsonComments(body.raw)); // validate; formatting keeps comments
      set({ raw: formatJsonc(body.raw) });
    } catch (e) {
      notify(`Invalid JSON: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <div className="modes" role="group" aria-label="Body type">
        {BODY_MODES.map(({ mode, label }) => (
          <button key={mode} type="button" className="mode" aria-pressed={body.mode === mode} onClick={() => set({ mode })}>
            {label}
          </button>
        ))}
      </div>
      {(body.mode === "json" || body.mode === "text" || body.mode === "xml") && (
        <CodeArea
          value={body.raw}
          json={body.mode === "json"}
          onChange={(raw) => set({ raw })}
          placeholder={body.mode === "json" ? '{ "hello": "world" }' : ""}
          wrap={wrap}
          tools={
            <>
              <button
                type="button"
                className="icon-btn"
                title={wrap ? "Don't wrap lines" : "Wrap lines"}
                aria-label="Wrap lines"
                aria-pressed={wrap}
                onClick={() => setSettings({ wrapRequestBody: !wrap })}
              >
                <WrapText {...ico} />
              </button>
              {body.mode === "json" && (
                <button type="button" className="btn btn--quiet" onClick={beautify}>
                  <WandSparkles {...ico} />
                  Beautify
                </button>
              )}
            </>
          }
        />
      )}
      {body.mode === "form" && <KVEditor rows={body.form} addLabel="Add a field" onChange={(form) => set({ form })} />}
      {body.mode === "multipart" && <KVEditor files rows={body.multipart} addLabel="Add a field" onChange={(multipart) => set({ multipart })} />}
      {body.mode === "none" && <p className="muted">This request has no body.</p>}
    </>
  );
}

const SCRIPT_TEXT = {
  pre: {
    label: "Pre-request script",
    empty: "No pre-request script",
    what: (
      <>
        Runs before Send. Change the request with <code>pm.request</code>, or set values with <code>pm.environment.set</code>.
      </>
    ),
  },
  post: {
    label: "Post-response script",
    empty: "No post-response script",
    what: (
      <>
        Runs after the response arrives. Check it with <code>pm.test</code>, or save values with <code>pm.environment.set</code>.
      </>
    ),
  },
};

function ScriptsEditor({ tab, phase, setPhase }: { tab: Tab; phase: "pre" | "post"; setPhase: (p: "pre" | "post") => void }) {
  const update = useStore((s) => s.updateRequest);
  const runScripts = useStore((s) => s.settings.runScripts !== false);
  const envName = useStore((s) => s.environments.find((e) => e.id === s.activeEnvironmentId)?.name);
  const openModal = useStore((s) => s.openModal);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const scripts = tab.request.scripts ?? {};
  const code = scripts[phase] ?? "";
  const set = (v: string) => update(tab.id, { scripts: { ...scripts, [phase]: v } });
  // the line the last run failed on, while the script is the one that failed
  const failed = tab.scripts?.failed;
  const mark = failed?.src === phase ? failed.line : undefined;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const insert = (snippet: string) => {
    set(code.trim() ? `${code.replace(/\s*$/, "")}\n\n${snippet}\n` : `${snippet}\n`);
    setOpen(false);
  };
  const groups = SNIPPETS.map((g) => ({ ...g, items: g.items.filter((i) => !i.only || i.only === phase) })).filter((g) => g.items.length);
  const t = SCRIPT_TEXT[phase];

  return (
    <>
      <div className="script-head">
        <div className="seg" role="group" aria-label="When it runs">
          {(["pre", "post"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={phase === p} onClick={() => setPhase(p)}>
              {p === "pre" ? "Pre-request" : "Post-response"}
              {hasScript(scripts[p]) && <span className="has" role="img" aria-label="has a script" />}
            </button>
          ))}
        </div>
        <div className="snip-wrap push" ref={ref}>
          <button type="button" className="btn btn--quiet" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            Snippets
            <ChevronDown {...ico} />
          </button>
          {open && (
            <div className="menu snip-menu" role="menu" aria-label="Snippets">
              {groups.map((g, i) => (
                <div key={g.group} role="group" aria-label={g.group}>
                  {i > 0 && <hr />}
                  <div className="grp">{g.group}</div>
                  {g.items.map((s) => (
                    <button key={s.label} type="button" role="menuitem" onClick={() => insert(s.code)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <CodeArea
        value={code}
        js
        mark={mark}
        label={t.label}
        onChange={set}
        empty={
          <>
            <FileCode {...icoLg} />
            <strong>{t.empty}</strong>
            <span>{t.what}</span>
            <span>Start from Snippets, or type here.</span>
          </>
        }
      />
      {runScripts ? (
        <span className="script-hint">
          {phase === "pre" ? (
            <>
              Runs before Send. Changes to <code>pm.request</code> go on the wire; <code>pm.environment.set</code>{" "}
              {envName ? <>writes to {envName}.</> : <>needs an environment.</>}
            </>
          ) : (
            "Runs after the response arrives. Results show in the Tests and Console tabs."
          )}
        </span>
      ) : (
        <span className="script-hint">
          Scripts are off.{" "}
          <button type="button" className="link" onClick={() => openModal({ kind: "settings", section: "requests" })}>
            Turn them on in Settings
          </button>
        </span>
      )}
    </>
  );
}

function AuthEditor({ auth, onChange }: { auth: Auth; onChange: (a: Auth) => void }) {
  const switchType = (type: Auth["type"]) => {
    switch (type) {
      case "none":
        return onChange({ type });
      case "bearer":
        return onChange({ type, token: "" });
      case "basic":
        return onChange({ type, username: "", password: "" });
      case "apikey":
        return onChange({ type, key: "", value: "", in: "header" });
    }
  };
  return (
    <div>
      <label className="form-row">
        <span>Type</span>
        <Select className="field" value={auth.type} onChange={(e) => switchType(e.target.value as Auth["type"])}>
          <option value="none">No auth</option>
          <option value="bearer">Bearer token</option>
          <option value="basic">Basic auth</option>
          <option value="apikey">API key</option>
        </Select>
      </label>
      {auth.type === "bearer" && (
        <label className="form-row">
          <span>Token</span>
          <input className="field" spellCheck={false} value={auth.token} placeholder="{{token}}" onChange={(e) => onChange({ ...auth, token: e.target.value })} />
        </label>
      )}
      {auth.type === "basic" && (
        <>
          <label className="form-row">
            <span>Username</span>
            <input className="field" spellCheck={false} value={auth.username} onChange={(e) => onChange({ ...auth, username: e.target.value })} />
          </label>
          <label className="form-row">
            <span>Password</span>
            <input className="field" type="password" value={auth.password} onChange={(e) => onChange({ ...auth, password: e.target.value })} />
          </label>
        </>
      )}
      {auth.type === "apikey" && (
        <>
          <label className="form-row">
            <span>Key</span>
            <input className="field" spellCheck={false} value={auth.key} placeholder="X-API-Key" onChange={(e) => onChange({ ...auth, key: e.target.value })} />
          </label>
          <label className="form-row">
            <span>Value</span>
            <input className="field" spellCheck={false} value={auth.value} onChange={(e) => onChange({ ...auth, value: e.target.value })} />
          </label>
          <label className="form-row">
            <span>Add to</span>
            <Select className="field" value={auth.in} onChange={(e) => onChange({ ...auth, in: e.target.value as "header" | "query" })}>
              <option value="header">Header</option>
              <option value="query">Query params</option>
            </Select>
          </label>
        </>
      )}
    </div>
  );
}
