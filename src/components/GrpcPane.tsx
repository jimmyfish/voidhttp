import { RENDER_GROWTH } from "../lib/vars";
import { TitleName } from "./InlineRename";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";
import type { GrpcDef, Tab } from "../types";
import {
  STREAM_LABEL,
  clientStreams,
  defaultGrpc,
  findMethod,
  loadSchema,
  looksLikeGrpcurl,
  parseGrpcurl,
  prepareGrpc,
  schemaKey,
  shortService,
  toGrpcurl,
  useSchema,
  type MethodInfo,
  type SchemaState,
} from "../lib/grpc";
import { formatJsonc, stripJsonComments } from "../lib/jsonc";
import { looksLikeCurl, parseCurl } from "../lib/curl";
import { MethodMenu } from "./MethodMenu";
import { UrlInput, type VarInfo } from "./UrlInput";
import { KVEditor } from "./KVEditor";
import { CodeArea } from "./CodeArea";
import {
  Braces,
  Check,
  ChevronDown,
  CircleCheck,
  CodeXml,
  FileCode,
  FileUp,
  Folder,
  FolderOpen,
  Lock,
  LockOpen,
  RefreshCw,
  ScanSearch,
  Search,
  Send,
  Server,
  SlidersHorizontal,
  TriangleAlert,
  WandSparkles,
  WrapText,
  X,
  ico,
} from "./Icon";

type Section = "message" | "metadata" | "auth" | "schema";

interface Props {
  tab: Tab;
  grow: number;
  lookup: (name: string) => VarInfo;
  /** {{vars}} in the address with no value */
  missing: string[];
  /** where the request lives, for the title row */
  path: string;
  /** Save and its state, shared with HTTP requests */
  saveControls: ReactNode;
  authEditor: ReactNode;
}

const time = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** The request side of a gRPC tab: server, method, message, metadata, schema. */
export function GrpcRequestPane({ tab, grow, lookup, missing, path, saveControls, authEditor }: Props) {
  const [section, setSection] = useState<Section>("message");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const update = useStore((s) => s.updateRequest);
  const settings = useStore((s) => s.settings);
  const scopeFor = useStore((s) => s.scopeFor);
  // re-render when variables change, so a {{var}} in the address resolves to the right schema
  useStore((s) => s.activeEnvironmentId);
  useStore((s) => s.environments);
  const st = useStore.getState(); // actions only

  const req = tab.request;
  const def: GrpcDef = req.grpc ?? defaultGrpc(req.url);
  const setDef = (patch: Partial<GrpcDef>) => update(tab.id, { grpc: { ...def, ...patch } });
  const ex = tab.example;
  const loading = !!tab.inflightId;
  const streamsOut = clientStreams(def.stream);

  // on every render: variables fill in within the render budget; a send prepares again with the full one
  const call = prepareGrpc(req, scopeFor(tab.id), settings, RENDER_GROWTH);
  const key = schemaKey(call);
  const schema = useSchema(key);
  const load = () => loadSchema(call);
  const info = findMethod(schema?.info, def.service, def.method);

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

  const copyGrpcurl = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(toGrpcurl(call));
      st.notify("grpcurl command copied to clipboard");
    } catch (e) {
      st.notify(`Copy failed: ${e}`);
    }
  };

  /** Picking a method fills an empty message with an example of its input. */
  const pick = (service: string, m: MethodInfo) => {
    const prev = findMethod(schema?.info, def.service, def.method);
    const raw = req.body.raw.trim();
    const replace = !raw || raw === "{}" || (prev && raw === prev.example.trim());
    update(tab.id, {
      grpc: { ...def, service, method: m.name, stream: m.stream, inputType: m.inputType },
      ...(replace && { body: { ...req.body, mode: "json", raw: m.example } }),
    });
  };

  const fillExample = async () => {
    let m = info;
    if (!m) m = findMethod((await load()).info, def.service, def.method);
    if (!m) return st.notify("Load the schema to see this method's message");
    update(tab.id, { body: { ...req.body, mode: "json", raw: m.example } });
  };

  const switchKind = (method: string) => {
    if (method === "WS") update(tab.id, { method, ws: req.ws ?? { subprotocols: [], pingSec: 0 } });
    else if (method !== "GRPC") update(tab.id, { method });
  };

  const n = (count: number) => (count ? <span className="n">{count}</span> : null);
  const enabledMeta = req.headers.filter((h) => h.enabled && h.key).length;

  return (
    <div className="req-pane" style={{ flexGrow: grow }}>
      <form
        className="request-line"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ex) loading ? st.cancelTab(tab.id) : st.callGrpc(tab.id);
        }}
      >
        <div className="url-field grpc-field">
          <MethodMenu value="GRPC" disabled={!!ex} className="kind-btn" title="Request kind" onPick={switchKind}>
            gRPC
            <ChevronDown {...ico} />
          </MethodMenu>
          <button
            type="button"
            className="icon-btn tls-btn"
            aria-pressed={def.tls}
            aria-label={def.tls ? "TLS on" : "TLS off"}
            title={def.tls ? "TLS on · click for plaintext" : "Plaintext · click to use TLS"}
            disabled={!!ex}
            onClick={() => setDef({ tls: !def.tls })}
          >
            {def.tls ? <Lock {...ico} /> : <LockOpen {...ico} />}
          </button>
          <UrlInput
            lookup={lookup}
            aria-label="Server"
            spellCheck={false}
            autoFocus={!ex}
            readOnly={!!ex}
            placeholder="host:port or {{grpcHost}}"
            value={req.url}
            onChange={(e) => update(tab.id, { url: e.target.value })}
            onPaste={(e) => {
              if (ex) return;
              const text = e.clipboardData.getData("text");
              if (looksLikeGrpcurl(text)) {
                e.preventDefault();
                const parsed = parseGrpcurl(text);
                if (!parsed) return st.notify("Couldn’t find a server address in that grpcurl command");
                update(tab.id, parsed.request);
                if (parsed.request.grpc?.method) setSection("message");
                st.notify(["Imported from grpcurl", ...parsed.notes].join(" · "));
              } else if (looksLikeCurl(text)) {
                // a cURL command turns this tab back into an HTTP request
                e.preventDefault();
                const parsed = parseCurl(text);
                if (!parsed) return st.notify("Couldn’t find a URL in that cURL command");
                update(tab.id, parsed);
                st.notify("Imported from cURL");
              }
            }}
          />
          <span className="gf-sep" aria-hidden="true" />
          <MethodPicker def={def} schema={schema} disabled={!!ex} onLoad={load} onPick={pick} onSchema={() => setSection("schema")} />
        </div>

        {ex ? null : loading ? (
          <button type="submit" className="btn btn--danger" aria-busy="true">
            Cancel
          </button>
        ) : (
          <div className="joined send-group" ref={menuRef}>
            <button type="submit" className="btn btn--primary">
              Invoke
            </button>
            <button
              type="button"
              className="btn btn--primary joined-tail"
              aria-label="More invoke options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <ChevronDown {...ico} />
            </button>
            {menuOpen && (
              <div className="menu" role="menu" aria-label="Invoke options">
                <button type="button" role="menuitem" onClick={copyGrpcurl}>
                  <CodeXml {...ico} />
                  Copy as grpcurl
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
        <span className="path">{path}</span>
        {missing.length > 0 && <span className="hint">Unresolved: {missing.map((m) => `{{${m}}}`).join(", ")}</span>}
        {def.service && def.method && (
          <span className="rpc-full">
            {def.service}/{def.method}
          </span>
        )}
      </div>

      <nav className="subtabs" aria-label="Request">
        {(["message", "metadata", "auth", "schema"] as Section[]).map((s) => (
          <button key={s} type="button" className="subtab" aria-pressed={section === s} onClick={() => setSection(s)}>
            {s[0].toUpperCase() + s.slice(1)}
            {s === "metadata" && n(enabledMeta)}
            {s === "auth" && n(req.auth.type !== "none" ? 1 : 0)}
          </button>
        ))}
        <button type="button" className="icon-btn push" title="Copy as grpcurl" aria-label="Copy as grpcurl" onClick={copyGrpcurl}>
          <CodeXml {...ico} />
        </button>
      </nav>

      <div className="section">
        <fieldset className="ro" disabled={!!ex}>
          {section === "message" && (
            <MessageEditor tab={tab} def={def} streamsOut={streamsOut} canFill={!!def.method} onFill={fillExample} />
          )}
          {section === "metadata" && (
            <>
              <KVEditor rows={req.headers} nameLabel="Key" addLabel="Add a key" onChange={(headers) => update(tab.id, { headers })} />
              <p className="kv-note">
                Keys are sent in lowercase. A key ending in <code>-bin</code> takes a base64 value. Unary calls use the timeout in Request
                settings as their deadline; streams stay open until they end or you cancel.
              </p>
            </>
          )}
          {section === "auth" && authEditor}
          {section === "schema" && <SchemaEditor def={def} schema={schema} onChange={setDef} onLoad={load} />}
        </fieldset>
      </div>
    </div>
  );
}

// ---------- method picker ----------

function MethodPicker({
  def,
  schema,
  disabled,
  onLoad,
  onPick,
  onSchema,
}: {
  def: GrpcDef;
  schema: SchemaState | undefined;
  disabled: boolean;
  onLoad: () => void;
  onPick: (service: string, m: MethodInfo) => void;
  onSchema: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (!schema?.info && !schema?.loading && !schema?.error) onLoad();
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
    // load once per opening; the schema changing while open must not reload it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (schema?.info?.services ?? [])
      .map((s) => ({ ...s, methods: s.methods.filter((m) => !needle || `${s.name}/${m.name}`.toLowerCase().includes(needle)) }))
      .filter((s) => s.methods.length);
  }, [schema?.info, q]);

  const stream = def.stream ?? "unary";
  return (
    <div className="rpc-anchor" ref={ref}>
      <button
        type="button"
        className="rpc-picker"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Method"
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {def.method ? (
          <>
            <span className="rpc-path" title={`${def.service}/${def.method}`}>
              <span className="rpc-svc">{shortService(def.service)}</span>
              <span className="rpc-slash">/</span>
              <span className="rpc-name">{def.method}</span>
            </span>
            <span className={`rpc-tag${stream !== "unary" ? " rpc-tag--stream" : ""}`}>{STREAM_LABEL[stream]}</span>
          </>
        ) : (
          <span className="rpc-path rpc-none">Pick a method</span>
        )}
        <ChevronDown {...ico} />
      </button>
      {open && (
        <div className="menu rpc-menu" role="dialog" aria-label="Pick a method">
          <div className="search">
            <Search {...ico} />
            <input
              className="field"
              placeholder="Search methods"
              aria-label="Search methods"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                // the picker sits in the request form: Enter picks the first match instead of invoking
                if (e.key !== "Enter") return;
                e.preventDefault();
                const first = groups[0];
                if (first) {
                  onPick(first.name, first.methods[0]);
                  setOpen(false);
                }
              }}
            />
          </div>
          <div className="rpc-list" role="listbox" aria-label="Methods">
            {schema?.error ? (
              <div className="rpc-msg err">
                <span>{schema.error}</span>
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setOpen(false);
                    onSchema();
                  }}
                >
                  Open Schema
                </button>
              </div>
            ) : !schema?.info ? (
              <div className="rpc-msg">
                <span className="spinner" />
                Loading methods…
              </div>
            ) : groups.length === 0 ? (
              <div className="rpc-msg">{q ? "No method matches" : "The schema has no services"}</div>
            ) : (
              groups.map((s) => (
                <div key={s.name} role="group" aria-label={s.name}>
                  <div className="rpc-group">{s.name}</div>
                  {s.methods.map((m) => {
                    const cur = s.name === def.service && m.name === def.method;
                    return (
                      <button
                        key={m.name}
                        type="button"
                        role="option"
                        aria-selected={cur}
                        aria-current={cur || undefined}
                        onClick={() => {
                          onPick(s.name, m);
                          setOpen(false);
                        }}
                      >
                        {cur ? <Check {...ico} /> : <span className="tick-gap" />}
                        <span className="name">{m.name}</span>
                        <span className={`rpc-tag${m.stream !== "unary" ? " rpc-tag--stream" : ""}`}>{STREAM_LABEL[m.stream]}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="rpc-foot">
            {def.source === "protos" ? <FileCode {...ico} /> : <ScanSearch {...ico} />}
            {schema?.loading
              ? "Loading…"
              : schema?.loadedAt
                ? `From ${def.source === "protos" ? ".proto files" : "server reflection"} · ${time(schema.loadedAt)}`
                : def.source === "protos"
                  ? "From .proto files"
                  : "From server reflection"}
            <button type="button" className="icon-btn" aria-label="Reload methods" title="Reload methods" disabled={schema?.loading} onClick={onLoad}>
              <RefreshCw {...ico} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- message ----------

function MessageEditor({
  tab,
  def,
  streamsOut,
  canFill,
  onFill,
}: {
  tab: Tab;
  def: GrpcDef;
  streamsOut: boolean;
  canFill: boolean;
  onFill: () => void;
}) {
  const update = useStore((s) => s.updateRequest);
  const notify = useStore((s) => s.notify);
  const wrap = useStore((s) => s.settings.wrapRequestBody ?? false);
  const setSettings = useStore((s) => s.setSettings);
  const st = useStore.getState();
  const body = tab.request.body;
  const open = !!tab.inflightId && !!tab.grpc?.sendOpen;

  const beautify = () => {
    try {
      JSON.parse(stripJsonComments(body.raw));
      update(tab.id, { body: { ...body, raw: formatJsonc(body.raw) } });
    } catch (e) {
      notify(`Invalid JSON: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <div className="msg-head">
        <span className="lbl">{streamsOut ? "Next message" : "Request"}</span>
        {def.inputType && <span className="type">{def.inputType}</span>}
        <button type="button" className="btn btn--quiet push" title="Fill every field with a sample value" disabled={!canFill} onClick={onFill}>
          <Braces {...ico} />
          Fill example
        </button>
      </div>
      <CodeArea
        value={body.raw}
        json
        label={streamsOut ? "Next message" : "Request message"}
        onChange={(raw) => update(tab.id, { body: { ...body, mode: "json", raw } })}
        placeholder="{ }"
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
            <button type="button" className="btn btn--quiet" onClick={beautify}>
              <WandSparkles {...ico} />
              Beautify
            </button>
          </>
        }
      />
      {streamsOut && (
        <div className="composer-bar">
          {open ? (
            <>
              <button type="button" className="btn btn--primary" onClick={() => st.sendGrpcMessage(tab.id)}>
                <Send {...ico} />
                Send message
              </button>
              <span className="hint-text">
                <kbd>⌘</kbd> <kbd>Enter</kbd> sends the next message
              </span>
              <button
                type="button"
                className="btn push"
                title="Tell the server you are done sending; replies keep coming"
                onClick={() => st.endGrpcSending(tab.id)}
              >
                End sending
              </button>
            </>
          ) : (
            <span className="hint-text">
              {tab.inflightId ? "Sending has ended; replies keep coming until the server ends the call." : "Invoke opens the stream, then you send messages one by one."}
            </span>
          )}
        </div>
      )}
    </>
  );
}

// ---------- schema ----------

function SchemaEditor({
  def,
  schema,
  onChange,
  onLoad,
}: {
  def: GrpcDef;
  schema: SchemaState | undefined;
  onChange: (patch: Partial<GrpcDef>) => void;
  onLoad: () => void;
}) {
  const counts = schema?.info && {
    services: schema.info.services.length,
    methods: schema.info.services.reduce((n, s) => n + s.methods.length, 0),
  };
  const summary = counts
    ? `${counts.services} ${counts.services === 1 ? "service" : "services"}, ${counts.methods} ${counts.methods === 1 ? "method" : "methods"}`
    : "";

  const addFiles = async () => {
    const picked = await open({ multiple: true, filters: [{ name: "Protocol Buffers", extensions: ["proto"] }] });
    const list = (Array.isArray(picked) ? picked : picked ? [picked] : []).filter((f) => !def.protoFiles.includes(f));
    if (list.length) onChange({ protoFiles: [...def.protoFiles, ...list] });
  };
  const addFolder = async () => {
    const picked = await open({ directory: true });
    if (typeof picked === "string" && !def.importPaths.includes(picked)) onChange({ importPaths: [...def.importPaths, picked] });
  };
  // a changed file list compiles again by itself
  const filesKey = `${def.protoFiles.join(",")}|${def.importPaths.join(",")}`;
  useEffect(() => {
    if (def.source === "protos" && def.protoFiles.length) onLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.source, filesKey]);

  const status = (okLabel: string, idleLabel: string, extra: string) => (
    <div className="set-item compact">
      <div className="svc-row">
        {schema?.loading ? (
          <span className="spinner" />
        ) : schema?.info ? (
          <CircleCheck {...ico} className="ico ok-ico" />
        ) : (
          <ScanSearch {...ico} />
        )}
        <div className="set-text">
          <span className="set-label">{schema?.loading ? "Loading…" : schema?.info ? okLabel : idleLabel}</span>
          <span className="desc">{schema?.info ? `${summary} · ${time(schema.loadedAt!)} · ${extra}` : extra}</span>
        </div>
      </div>
      <div className="set-ctl">
        <button type="button" className="btn" disabled={schema?.loading} onClick={onLoad}>
          <RefreshCw {...ico} />
          {schema?.info ? "Reload" : "Load"}
        </button>
      </div>
    </div>
  );

  const error = schema?.error && (
    <div className="schema-err" role="alert">
      <strong>
        <TriangleAlert {...ico} />
        {def.source === "protos" ? "The .proto files did not compile" : "Could not load the schema from the server"}
      </strong>
      <span className="msg">{schema.error}</span>
      <span className="acts">
        {def.source === "reflection" && (
          <button type="button" className="link" onClick={() => onChange({ source: "protos" })}>
            Use .proto files instead
          </button>
        )}
        <button type="button" className="link" onClick={onLoad}>
          Try again
        </button>
      </span>
    </div>
  );

  return (
    <>
      <div className="modes" role="group" aria-label="Schema source">
        <button type="button" className="mode" aria-pressed={def.source === "reflection"} onClick={() => onChange({ source: "reflection" })}>
          Server reflection
        </button>
        <button type="button" className="mode" aria-pressed={def.source === "protos"} onClick={() => onChange({ source: "protos" })}>
          .proto files
        </button>
      </div>

      {def.source === "reflection" ? (
        <>
          {error}
          <div className="set-list">
            {status("Loaded from the server", "Not loaded yet", "uses the server, TLS and metadata above")}
            {schema?.info?.services.map((s) => (
              <div key={s.name} className="set-item compact">
                <div className="svc-row">
                  <Server {...ico} />
                  <code>{s.name}</code>
                  <span className="count">
                    {s.methods.length} {s.methods.length === 1 ? "method" : "methods"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="set-head">
            <h4>Files</h4>
            <button type="button" className="btn push" onClick={addFiles}>
              <FileUp {...ico} />
              Add files
            </button>
          </div>
          {def.protoFiles.length ? (
            <div className="set-list">
              {def.protoFiles.map((f) => (
                <div key={f} className="set-item compact">
                  <div className="file-row" title={f}>
                    <FileCode {...ico} />
                    <code>{f.slice(f.lastIndexOf("/") + 1)}</code>
                    <span className="dim">{f.slice(0, f.lastIndexOf("/")).replace(/^\/Users\/[^/]+/, "~")}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn row-del"
                    aria-label={`Remove ${f}`}
                    onClick={() => onChange({ protoFiles: def.protoFiles.filter((x) => x !== f) })}
                  >
                    <X {...ico} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No files yet. Add the .proto files that define the service.</p>
          )}
          <div className="set-head">
            <h4>Import paths</h4>
            <span className="desc">
              Where <code>import</code> lines are looked up
            </span>
            <button type="button" className="btn push" onClick={addFolder}>
              <FolderOpen {...ico} />
              Add folder
            </button>
          </div>
          {def.importPaths.length > 0 && (
            <div className="set-list">
              {def.importPaths.map((p) => (
                <div key={p} className="set-item compact">
                  <div className="file-row" title={p}>
                    <Folder {...ico} />
                    <code>{p.replace(/^\/Users\/[^/]+/, "~")}</code>
                  </div>
                  <button
                    type="button"
                    className="icon-btn row-del"
                    aria-label={`Remove ${p}`}
                    onClick={() => onChange({ importPaths: def.importPaths.filter((x) => x !== p) })}
                  >
                    <X {...ico} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {error}
          {def.protoFiles.length > 0 && <div className="set-list">{status("Compiled", "Not compiled yet", "google/protobuf types are built in")}</div>}
        </>
      )}
    </>
  );
}
