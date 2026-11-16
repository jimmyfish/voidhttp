import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";
import type { GqlDef, Tab } from "../types";
import { CodeArea } from "./CodeArea";
import { Check, ChevronDown, ChevronRight, Network, RefreshCw, Search, ShieldOff, WandSparkles, WrapText, ico, icoLg } from "./Icon";
import {
  defaultGql,
  formatGraphql,
  gqlErrors,
  gqlOperations,
  isBuiltinType,
  namedType,
  pickedOperation,
  typeParts,
  type GqlField,
  type GqlInputValue,
  type GqlSchema,
  type GqlType,
  type GqlTypeRef,
} from "../lib/graphql";
import { fetchGqlSchema, gqlSchemaKey, loadGqlSchemaFile, useGqlSchema, type GqlSchemaState } from "../lib/gqlSchema";
import { formatJsonc, stripJsonComments } from "../lib/jsonc";
import { resolve } from "../lib/vars";
import { baseName, readTextFile } from "../lib/files";
import { ago } from "../lib/time";

/** Fired by a GraphQL error's "Line n" link: the request pane opens Query and puts the caret on that line. */
export const OPEN_GQL_LINE = "voidhttp:gql-line";
export type OpenGqlLine = { tabId: string; line: number };

/**
 * The Query tab of a GraphQL request: the document on the left with its operation picker and Beautify,
 * Variables or the schema's Docs on the right.
 */
export function GqlQueryEditor({ tab }: { tab: Tab }) {
  const update = useStore((s) => s.updateRequest);
  const notify = useStore((s) => s.notify);
  const wrap = useStore((s) => s.settings.wrapRequestBody ?? false);
  const setSettings = useStore((s) => s.setSettings);
  const [side, setSide] = useState<"variables" | "docs">("variables");
  const queryCol = useRef<HTMLDivElement>(null);
  const def = tab.request.gql ?? defaultGql();
  const set = (patch: Partial<GqlDef>) => update(tab.id, { gql: { ...def, ...patch } });
  const ops = useMemo(() => gqlOperations(def.query), [def.query]);
  const picked = pickedOperation(def, ops);
  // the first error's line in the document, while its response is on screen
  const errLine = useMemo(() => (tab.response ? gqlErrors(tab.response.body).find((e) => e.line)?.line : undefined), [tab.response]);

  useEffect(() => {
    const go = (e: Event) => {
      const d = (e as CustomEvent<OpenGqlLine>).detail;
      if (d.tabId !== tab.id) return;
      // after the Query tab has rendered
      requestAnimationFrame(() => {
        const ta = queryCol.current?.querySelector<HTMLTextAreaElement>("textarea");
        if (!ta) return;
        const text = ta.value;
        let at = 0;
        for (let n = 1; n < d.line && at !== -1; n++) at = text.indexOf("\n", at) + 1 || -1;
        if (at < 0) at = text.length;
        ta.focus();
        ta.setSelectionRange(at, at);
        const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
        ta.closest(".code-edit")?.scrollTo({ top: Math.max(0, (d.line - 4) * lh) });
      });
    };
    window.addEventListener(OPEN_GQL_LINE, go);
    return () => window.removeEventListener(OPEN_GQL_LINE, go);
  }, [tab.id]);

  const beautify = () => set({ query: formatGraphql(def.query) });
  const beautifyVars = () => {
    try {
      JSON.parse(resolveForCheck(def.variables));
      set({ variables: formatJsonc(def.variables) });
    } catch (e) {
      notify(`Invalid JSON: ${(e as Error).message}`);
    }
  };
  const wrapBtn = (
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
  );

  return (
    <div className="gql-split">
      <div className="gql-col" ref={queryCol}>
        <div className="gql-head">
          <span className="lbl">Operation</span>
          <OperationPicker ops={ops} picked={picked} onPick={(operation) => set({ operation })} />
        </div>
        <CodeArea
          value={def.query}
          graphql
          label="Query"
          mark={errLine}
          wrap={wrap}
          onChange={(query) => set({ query })}
          placeholder={"query {\n  viewer { id }\n}"}
          tools={
            <>
              {wrapBtn}
              <button type="button" className="btn btn--quiet" onClick={beautify}>
                <WandSparkles {...ico} />
                Beautify
              </button>
            </>
          }
        />
      </div>

      <div className="gql-col">
        <div className="gql-head">
          <div className="seg" role="group" aria-label="Side panel">
            <button type="button" aria-pressed={side === "variables"} onClick={() => setSide("variables")}>
              Variables
            </button>
            <button type="button" aria-pressed={side === "docs"} onClick={() => setSide("docs")}>
              Docs
            </button>
          </div>
          <SchemaState tab={tab} />
        </div>
        {side === "variables" ? (
          <CodeArea
            value={def.variables}
            json
            label="Variables"
            wrap={wrap}
            onChange={(variables) => set({ variables })}
            placeholder={'{\n  "id": "{{customerId}}"\n}'}
            tools={
              <button type="button" className="btn btn--quiet" onClick={beautifyVars}>
                <WandSparkles {...ico} />
                Beautify
              </button>
            }
          />
        ) : (
          <SchemaDocs tab={tab} />
        )}
      </div>
    </div>
  );
}

/** Variables may hold {{name}} outside strings: check the JSON with those as numbers, the way they would not break it. */
const resolveForCheck = (text: string) => stripJsonComments(text).replace(/\{\{[^{}]*\}\}/g, "0");

function OperationPicker({ ops, picked, onPick }: { ops: ReturnType<typeof gqlOperations>; picked?: ReturnType<typeof gqlOperations>[number]; onPick: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const named = ops.filter((o) => o.name);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const away = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  if (!picked)
    return (
      <div className="op-wrap">
        <button type="button" className="op-btn op-none" disabled>
          No operation
        </button>
      </div>
    );
  const face = (
    <>
      <span className="kind">{picked.kind}</span>
      {picked.name || <span className="anon">anonymous</span>}
    </>
  );
  if (ops.length < 2)
    return (
      <div className="op-wrap">
        <button type="button" className="op-btn" disabled title="The document holds one operation">
          {face}
        </button>
      </div>
    );

  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const all = [...(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
      const i = all.indexOf(document.activeElement as HTMLButtonElement);
      all[(i + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]?.focus();
    }
  };
  return (
    <div className="op-wrap" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="op-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        title="The operation Send runs"
        onClick={() => setOpen(!open)}
      >
        {face}
        <ChevronDown {...ico} />
      </button>
      {open && (
        <div className="menu op-menu" role="menu" aria-label="Operation to send" ref={menu} onKeyDown={onKey}>
          {named.map((o) => (
            <button
              key={`${o.name}:${o.line}`}
              type="button"
              role="menuitemradio"
              aria-checked={o === picked}
              onClick={() => {
                onPick(o.name);
                close();
              }}
            >
              {o === picked ? <Check {...ico} /> : <span className="tick-gap" />}
              <span className="kind">{o.kind}</span>
              <span className="name">{o.name}</span>
            </button>
          ))}
          {named.length < ops.length && <div className="op-note">Anonymous operations can’t be picked: name them to send one.</div>}
        </div>
      )}
    </div>
  );
}

// ---------- schema ----------

/** The schema key and fetch for this tab: the endpoint with variables resolved, the request's own headers and auth. */
function useTabSchema(tab: Tab) {
  const scopeFor = useStore((s) => s.scopeFor);
  // re-render when the environment changes: the endpoint may be a variable
  useStore((s) => s.activeEnvironmentId);
  useStore((s) => s.environments);
  const settings = useStore((s) => s.settings);
  const scope = scopeFor(tab.id);
  const key = gqlSchemaKey(resolve(tab.request.url, scope));
  const state = useGqlSchema(key);
  const fetchNow = () => (tab.request.url.trim() ? fetchGqlSchema(tab.request, scopeFor(tab.id), settings) : undefined);
  const loadFile = async () => {
    const picked = await open({ multiple: false, filters: [{ name: "Introspection JSON", extensions: ["json"] }] });
    if (typeof picked !== "string") return;
    try {
      loadGqlSchemaFile(key, baseName(picked), await readTextFile(picked));
    } catch (e) {
      useStore.getState().notify(String(e));
    }
  };
  return { key, state, fetchNow, loadFile };
}

function SchemaState({ tab }: { tab: Tab }) {
  const { state, fetchNow } = useTabSchema(tab);
  const refresh = (
    <button type="button" className="icon-btn" title="Fetch the schema again" aria-label="Fetch the schema again" onClick={fetchNow} disabled={state?.loading}>
      <RefreshCw {...ico} />
    </button>
  );
  if (state?.loading)
    return (
      <span className="schema-state push" role="status">
        <span className="dot" aria-hidden="true" />
        Fetching schema…
      </span>
    );
  if (state?.schema)
    return (
      <span className="schema-state push">
        <span className="dot" aria-hidden="true" />
        {typeof state.from === "object" ? `Schema · ${state.from.file}` : `Schema · ${ago(state.loadedAt ?? Date.now())}`}
        {refresh}
      </span>
    );
  if (state?.error)
    return (
      <span className="schema-state fail push" title={state.error}>
        <span className="dot" aria-hidden="true" />
        {state.refused ? "Introspection refused" : "Schema failed"}
        {refresh}
      </span>
    );
  return (
    <span className="schema-state none push">
      <span className="dot" aria-hidden="true" />
      No schema
    </span>
  );
}

function SchemaDocs({ tab }: { tab: Tab }) {
  const { state, fetchNow, loadFile } = useTabSchema(tab);
  if (state?.schema) return <DocsBrowser schema={state.schema} />;
  return <SchemaEmpty state={state} url={tab.request.url} onFetch={fetchNow} onFile={loadFile} />;
}

function SchemaEmpty({ state, url, onFetch, onFile }: { state?: GqlSchemaState; url: string; onFetch: () => void; onFile: () => void }) {
  const fileLink = (
    <button type="button" className="link" onClick={onFile}>
      Load an introspection JSON file
    </button>
  );
  if (state?.loading)
    return (
      <div className="gdoc">
        <div className="empty" role="status">
          <div className="spinner" />
          <span>Fetching the schema…</span>
        </div>
      </div>
    );
  if (state?.error)
    return (
      <div className="gdoc">
        <div className="empty fail" role="alert">
          <ShieldOff {...icoLg} />
          <strong>{state.refused ? "The server refused introspection" : "Couldn’t fetch the schema"}</strong>
          <span>
            <code>{state.error}</code>
            {state.refused && ". Production servers often turn it off; queries still send."}
          </span>
          <button type="button" className="btn" onClick={onFetch}>
            <RefreshCw {...ico} />
            Try again
          </button>
          {fileLink}
        </div>
      </div>
    );
  return (
    <div className="gdoc">
      <div className="empty">
        <Network {...icoLg} />
        <strong>No schema yet</strong>
        <span>
          {url.trim() ? (
            <>
              Ask <code>{url}</code> for its schema with an introspection query. Headers and Auth from this request go along.
            </>
          ) : (
            "Enter the endpoint’s URL, then fetch its schema with an introspection query."
          )}
        </span>
        <button type="button" className="btn btn--primary" onClick={onFetch} disabled={!url.trim()}>
          <RefreshCw {...ico} />
          Fetch schema
        </button>
        {fileLink}
      </div>
    </div>
  );
}

/** At most this many search hits and "used by" chips: a big schema has thousands of fields. */
const MAX_HITS = 100;
const MAX_USED_BY = 12;

function DocsBrowser({ schema }: { schema: GqlSchema }) {
  // the types opened, root first; empty is the schema's front page
  const [trail, setTrail] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const body = useRef<HTMLDivElement>(null);
  const openType = (name: string) => {
    if (!schema.types.has(name)) return;
    setQ("");
    setTrail((t) => (t[t.length - 1] === name ? t : [...t, name]));
    body.current?.scrollTo({ top: 0 });
  };
  // a schema fetched again may no longer have a type on the trail
  const here = trail.length ? schema.types.get(trail[trail.length - 1]) : undefined;

  return (
    <div className="gdoc">
      <div className="search">
        <Search {...ico} />
        <input className="field" placeholder="Search types and fields" aria-label="Search the schema" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {trail.length > 0 && !q && (
        <nav className="gdoc-crumbs" aria-label="Schema path">
          <button type="button" onClick={() => setTrail([])}>
            Schema
          </button>
          {trail.map((name, i) => (
            <span key={`${name}:${i}`} className="crumb">
              <ChevronRight {...ico} />
              {i === trail.length - 1 ? (
                <span className="here">{name}</span>
              ) : (
                <button type="button" onClick={() => setTrail(trail.slice(0, i + 1))}>
                  {name}
                </button>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="gdoc-body" ref={body}>
        {q.trim() ? <SearchHits schema={schema} q={q.trim()} onOpen={openType} /> : here ? <TypeDoc schema={schema} type={here} onOpen={openType} /> : <RootDoc schema={schema} onOpen={openType} />}
      </div>
    </div>
  );
}

function RootDoc({ schema, onOpen }: { schema: GqlSchema; onOpen: (name: string) => void }) {
  const roots = (
    [
      ["query", schema.queryType],
      ["mutation", schema.mutationType],
      ["subscription", schema.subscriptionType],
    ] as const
  ).filter((r): r is readonly ["query" | "mutation" | "subscription", string] => !!r[1]);
  const query = schema.queryType ? schema.types.get(schema.queryType) : undefined;
  const others = [...schema.types.values()]
    .filter((t) => !isBuiltinType(t.name) && !roots.some((r) => r[1] === t.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <div className="gdoc-grp">Root types</div>
      {roots.map(([kind, name]) => (
        <button key={kind} type="button" className="gdoc-row" onClick={() => onOpen(name)}>
          <span className="f">{kind}</span>
          <span className="p">: </span>
          <span className="t">{name}</span>
          <span className="d">{fieldCount(schema.types.get(name))}</span>
        </button>
      ))}
      {query?.fields?.length ? (
        <>
          <div className="gdoc-grp">{query.name}</div>
          {query.fields.map((f) => (
            <FieldRow key={f.name} field={f} onOpen={onOpen} />
          ))}
        </>
      ) : null}
      {others.length > 0 && (
        <>
          <div className="gdoc-grp">All types</div>
          {others.map((t) => (
            <button key={t.name} type="button" className="gdoc-row" onClick={() => onOpen(t.name)}>
              <span className="t">{t.name}</span>
              <span className="gdoc-kind">{kindLabel(t.kind)}</span>
            </button>
          ))}
        </>
      )}
    </>
  );
}

const fieldCount = (t?: GqlType) => {
  const n = t?.fields?.length ?? 0;
  return `${n} ${n === 1 ? "field" : "fields"}`;
};

const KIND_LABEL: Record<string, string> = {
  OBJECT: "type",
  INTERFACE: "interface",
  UNION: "union",
  ENUM: "enum",
  INPUT_OBJECT: "input",
  SCALAR: "scalar",
};
const kindLabel = (k: string) => KIND_LABEL[k] ?? k.toLowerCase();

/** `[Account!]!` with the name as the part a click opens. */
function TypeName({ type }: { type: GqlTypeRef }) {
  const [a, name, b] = typeParts(type);
  return (
    <>
      {a && <span className="p">{a}</span>}
      <span className="t">{name}</span>
      {b && <span className="p">{b}</span>}
    </>
  );
}

function Args({ args }: { args: GqlInputValue[] }) {
  if (!args.length) return null;
  return (
    <>
      <span className="p">(</span>
      {args.map((a, i) => (
        <span key={a.name}>
          {i > 0 && <span className="p">, </span>}
          <span className="a">{a.name}</span>
          <span className="p">: </span>
          <TypeName type={a.type} />
          {a.defaultValue != null && <span className="p"> = {a.defaultValue}</span>}
        </span>
      ))}
      <span className="p">)</span>
    </>
  );
}

function FieldRow({ field, onOpen, owner }: { field: GqlField | GqlInputValue; onOpen: (name: string) => void; owner?: string }) {
  const f = field as GqlField;
  const dep = !!f.isDeprecated;
  const desc = dep ? f.deprecationReason || field.description : field.description;
  return (
    <button type="button" className={`gdoc-row${dep ? " dep" : ""}`} onClick={() => onOpen(namedType(field.type))} title={`Open ${namedType(field.type)}`}>
      {owner && <span className="t">{owner}.</span>}
      <span className="f">{field.name}</span>
      {"args" in field && <Args args={field.args ?? []} />}
      <span className="p">: </span>
      <TypeName type={field.type} />
      {"defaultValue" in field && field.defaultValue != null && <span className="p"> = {field.defaultValue}</span>}
      {dep && <span className="dep-tag">deprecated</span>}
      {desc && <span className="d">{desc}</span>}
    </button>
  );
}

function TypeDoc({ schema, type, onOpen }: { schema: GqlSchema; type: GqlType; onOpen: (name: string) => void }) {
  const usedBy = useMemo(() => {
    const out: string[] = [];
    for (const t of schema.types.values()) {
      if (isBuiltinType(t.name)) continue;
      for (const f of [...(t.fields ?? []), ...(t.inputFields ?? [])]) {
        if (namedType(f.type) === type.name) out.push(`${t.name}.${f.name}`);
        if (out.length > MAX_USED_BY) return out;
      }
    }
    return out;
  }, [schema, type.name]);
  const impl = type.interfaces ?? [];
  const possible = type.possibleTypes ?? [];
  return (
    <>
      <div className="gdoc-title">
        <strong>{type.name}</strong>
        <span className="gdoc-kind">{kindLabel(type.kind)}</span>
      </div>
      {type.description && <p className="gdoc-desc">{type.description}</p>}
      {impl.length > 0 && (
        <>
          <div className="gdoc-grp">Implements</div>
          <div className="gdoc-chips">
            {impl.map((i) => (
              <button key={i.name} type="button" className="chip-link" onClick={() => onOpen(i.name)}>
                {i.name}
              </button>
            ))}
          </div>
        </>
      )}
      {!!type.fields?.length && (
        <>
          <div className="gdoc-grp">Fields</div>
          {type.fields.map((f) => (
            <FieldRow key={f.name} field={f} onOpen={onOpen} />
          ))}
        </>
      )}
      {!!type.inputFields?.length && (
        <>
          <div className="gdoc-grp">Input fields</div>
          {type.inputFields.map((f) => (
            <FieldRow key={f.name} field={f} onOpen={onOpen} />
          ))}
        </>
      )}
      {!!type.enumValues?.length && (
        <>
          <div className="gdoc-grp">Values</div>
          {type.enumValues.map((v) => (
            <div key={v.name} className={`gdoc-row static${v.isDeprecated ? " dep" : ""}`}>
              <span className="f e">{v.name}</span>
              {v.isDeprecated && <span className="dep-tag">deprecated</span>}
              {(v.isDeprecated ? v.deprecationReason || v.description : v.description) && <span className="d">{v.isDeprecated ? v.deprecationReason || v.description : v.description}</span>}
            </div>
          ))}
        </>
      )}
      {possible.length > 0 && (
        <>
          <div className="gdoc-grp">{type.kind === "UNION" ? "Members" : "Implemented by"}</div>
          <div className="gdoc-chips">
            {possible.map((p) => (
              <button key={p.name} type="button" className="chip-link" onClick={() => onOpen(p.name)}>
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}
      {type.kind === "SCALAR" && !type.description && <p className="gdoc-desc">A scalar: a single value, sent and received as JSON.</p>}
      {usedBy.length > 0 && (
        <>
          <div className="gdoc-grp">Used by</div>
          <div className="gdoc-chips">
            {usedBy.slice(0, MAX_USED_BY).map((u) => (
              <button key={u} type="button" className="chip-link" onClick={() => onOpen(u.slice(0, u.indexOf(".")))}>
                {u}
              </button>
            ))}
            {usedBy.length > MAX_USED_BY && <span className="more">and more</span>}
          </div>
        </>
      )}
    </>
  );
}

function SearchHits({ schema, q, onOpen }: { schema: GqlSchema; q: string; onOpen: (name: string) => void }) {
  const hits = useMemo(() => {
    const needle = q.toLowerCase();
    const types: GqlType[] = [];
    const fields: { owner: string; field: GqlField | GqlInputValue }[] = [];
    for (const t of schema.types.values()) {
      if (t.name.startsWith("__")) continue;
      if (t.name.toLowerCase().includes(needle)) types.push(t);
      for (const f of [...(t.fields ?? []), ...(t.inputFields ?? [])]) if (f.name.toLowerCase().includes(needle)) fields.push({ owner: t.name, field: f });
      if (types.length + fields.length > MAX_HITS) break;
    }
    return { types, fields };
  }, [schema, q]);
  if (!hits.types.length && !hits.fields.length)
    return (
      <p className="gdoc-desc">
        Nothing in the schema matches “{q}”.
      </p>
    );
  return (
    <>
      {hits.types.length > 0 && (
        <>
          <div className="gdoc-grp">Types</div>
          {hits.types.map((t) => (
            <button key={t.name} type="button" className="gdoc-row" onClick={() => onOpen(t.name)}>
              <span className="t">{t.name}</span>
              <span className="gdoc-kind">{kindLabel(t.kind)}</span>
            </button>
          ))}
        </>
      )}
      {hits.fields.length > 0 && (
        <>
          <div className="gdoc-grp">Fields</div>
          {hits.fields.map(({ owner, field }) => (
            <FieldRow key={`${owner}.${field.name}`} field={field} owner={owner} onOpen={onOpen} />
          ))}
        </>
      )}
    </>
  );
}
