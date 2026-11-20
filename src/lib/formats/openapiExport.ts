/**
 * OpenAPI 3.0 export: one spec from one collection, written as YAML or JSON in the app (no Node, no converter).
 * Folders become tags, `:name` and `{{name}}` in a path become `{name}` parameters, bodies get a schema read from
 * their JSON, auth becomes a security scheme (never its values), saved examples become responses by status code,
 * and the address in front of the path becomes a server, one per chosen environment.
 */
import { stringify as stringifyYaml } from "yaml";
import type { Auth, Collection, Environment, KV, RequestNode, TreeNode } from "../../types";
import { isGql } from "../graphql";
import { stripJsonComments } from "../jsonc";
import { parseQuery } from "../model";
import { buildScope, resolve, type VarScope } from "../vars";
import type { Any } from "./common";

export interface OpenApiExportOptions {
  as: "yaml" | "json";
}

export interface OpenApiExport {
  text: string;
  /** requests written as extra examples of an earlier one with the same method and path */
  merged: number;
  /** requests OpenAPI has no operation for: gRPC, WebSocket, Socket.IO, Kafka, MQTT, Pub/Sub, a non-standard method */
  skipped: number;
}

const METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
/** header parameters OpenAPI ignores: they are described by `requestBody`, `responses` and `security` */
const RESERVED_HEADER = /^(accept|content-type|authorization)$/i;

const NON_HTTP = new Set(["GRPC", "WS", "SIO", "KAFKA", "MQTT", "PUBSUB"]);

// ---------- values ----------

/** A value for `example`: variables filled in from the exported scope; nothing when one is missing or generated. */
function exampleOf(value: string, scope: VarScope): string | undefined {
  if (/\{\{\s*\$/.test(value)) return undefined; // {{$guid}} and friends: a new value every send
  const v = value.includes("{{") ? resolve(value, scope) : value;
  return v === "" || v.includes("{{") ? undefined : v;
}

/** JSON as written in the editor: comments allowed, `{{var}}` left bare where a number or object would go. */
function parseJsonBody(raw: string): { ok: true; value: unknown } | { ok: false } {
  const src = stripJsonComments(raw);
  const quoted = src.replace(/\{\{[^{}]*\}\}/g, (m, at: number) => (src[at - 1] === '"' && src[at + m.length] === '"' ? m : JSON.stringify(m)));
  for (const text of [src, quoted]) {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      // try the next form
    }
  }
  return { ok: false };
}

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A schema read from one JSON value: types and properties, arrays from their first item. */
function schemaOf(v: unknown, depth = 0): Any {
  if (depth > 32) return {};
  if (v === null) return { nullable: true };
  if (Array.isArray(v)) return { type: "array", items: v.length ? schemaOf(v[0], depth + 1) : {} };
  switch (typeof v) {
    case "string":
      return ISO_DATE_TIME.test(v) ? { type: "string", format: "date-time" } : UUID.test(v) ? { type: "string", format: "uuid" } : { type: "string" };
    case "number":
      return { type: Number.isInteger(v) ? "integer" : "number" };
    case "boolean":
      return { type: "boolean" };
    case "object": {
      const properties: Record<string, Any> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) properties[k] = schemaOf(x, depth + 1);
      return { type: "object", properties };
    }
    default:
      return {};
  }
}

const mediaOf = (headers: { key: string; value: string }[]) =>
  headers
    .find((h) => h.key.toLowerCase() === "content-type")
    ?.value.split(";")[0]
    .trim()
    .toLowerCase() || undefined;

// ---------- URL ----------

/** `{{baseUrl}}/customers/:id?x=1` → prefix `{{baseUrl}}`, path `/customers/{id}`, and the path's parameter names. */
function splitUrl(url: string): { prefix: string; path: string; names: string[] } {
  const end = url.search(/[?#]/);
  const noQuery = end === -1 ? url : url.slice(0, end);
  const prefix = /^(?:[a-z][a-z0-9+.-]*:\/\/)?[^/]*/i.exec(noQuery)?.[0] ?? "";
  let rest = noQuery.slice(prefix.length) || "/";
  const names: string[] = [];
  const add = (n: string) => {
    if (!names.includes(n)) names.push(n);
    return `{${n}}`;
  };
  rest = rest.replace(/\/:([A-Za-z_][\w-]*)/g, (_, n: string) => `/${add(n)}`).replace(/\{\{([^{}]*)\}\}/g, (m, n: string) => (n.trim() ? add(n.trim()) : m));
  return { prefix, path: rest, names };
}

// ---------- auth ----------

interface Schemes {
  defs: Record<string, Any>;
  byKey: Map<string, string>;
}

/** The security scheme for one request's auth, added on first use; undefined for none. */
function schemeFor(s: Schemes, a: Auth): string | undefined {
  if (a.type === "none") return undefined;
  const key = a.type === "apikey" ? `apikey:${a.in}:${a.key.toLowerCase()}` : a.type;
  const known = s.byKey.get(key);
  if (known) return known;
  let name: string;
  let def: Any;
  if (a.type === "bearer") [name, def] = ["bearerAuth", { type: "http", scheme: "bearer" }];
  else if (a.type === "basic") [name, def] = ["basicAuth", { type: "http", scheme: "basic" }];
  else [name, def] = ["apiKey", { type: "apiKey", in: a.in, name: a.key }];
  for (let i = 2; s.defs[name]; i++) name = `${name.replace(/\d+$/, "")}${i}`;
  s.defs[name] = def;
  s.byKey.set(key, name);
  return name;
}

// ---------- examples collected per media type, written as `example` or `examples` ----------

type Media = { schema?: Any; examples: { name: string; value: unknown }[] };

function addExample(content: Map<string, Media>, media: string, schema: Any | undefined, name: string, value: unknown) {
  const m = content.get(media) ?? { examples: [] };
  if (!m.schema && schema) m.schema = schema;
  if (value !== undefined) m.examples.push({ name, value });
  content.set(media, m);
}

function writeContent(content: Map<string, Media>): Any {
  const out: Record<string, Any> = {};
  for (const [media, m] of content) {
    const obj: Any = { schema: m.schema ?? {} };
    if (m.examples.length === 1) obj.example = m.examples[0].value;
    else if (m.examples.length > 1) {
      obj.examples = {};
      const used = new Set<string>();
      for (const e of m.examples) {
        let k = e.name.trim() || "example";
        for (let i = 2; used.has(k); i++) k = `${e.name.trim() || "example"} ${i}`;
        used.add(k);
        obj.examples[k] = { value: e.value };
      }
    }
    out[media] = obj;
  }
  return out;
}

// ---------- operations ----------

interface Op {
  method: string;
  path: string;
  prefix: string;
  summary: string;
  operationId: string;
  tag?: string;
  params: Map<string, Any>;
  body: Map<string, Media>;
  bodyRequired: boolean;
  security?: string;
  responses: Map<string, { description: string; content: Map<string, Media> }>;
}

function addBody(op: Op, r: RequestNode) {
  const name = r.name;
  if (isGql(r)) {
    const vars = parseJsonBody(r.gql?.variables || "{}");
    const value: Any = { query: r.gql?.query ?? "" };
    if (vars.ok && vars.value && typeof vars.value === "object" && Object.keys(vars.value).length) value.variables = vars.value;
    if (r.gql?.operation) value.operationName = r.gql.operation;
    const schema = {
      type: "object",
      required: ["query"],
      properties: { query: { type: "string" }, variables: { type: "object" }, operationName: { type: "string" } },
    };
    addExample(op.body, "application/json", schema, name, value);
    op.bodyRequired = true;
    return;
  }
  const b = r.body;
  const declared = mediaOf(r.headers);
  switch (b.mode) {
    case "none":
      return;
    case "json": {
      const p = parseJsonBody(b.raw);
      const media = declared ?? "application/json";
      if (p.ok) addExample(op.body, media, schemaOf(p.value), name, p.value);
      else addExample(op.body, media, {}, name, b.raw || undefined);
      break;
    }
    case "xml":
    case "text":
      addExample(op.body, declared ?? (b.mode === "xml" ? "application/xml" : "text/plain"), { type: "string" }, name, b.raw || undefined);
      break;
    case "form": {
      const rows = b.form.filter((f) => f.key);
      const value = Object.fromEntries(rows.filter((f) => f.enabled).map((f) => [f.key, f.value]));
      const schema = { type: "object", properties: Object.fromEntries(rows.map((f) => [f.key, { type: "string" }])) };
      addExample(op.body, "application/x-www-form-urlencoded", schema, name, Object.keys(value).length ? value : undefined);
      break;
    }
    case "multipart": {
      const rows = b.multipart.filter((f) => f.key);
      const schema = {
        type: "object",
        properties: Object.fromEntries(rows.map((f) => [f.key, f.kind === "file" ? { type: "string", format: "binary" } : { type: "string" }])),
      };
      // a file's value is a path on this Mac: never an example
      const value = Object.fromEntries(rows.filter((f) => f.enabled && f.kind === "text").map((f) => [f.key, f.value]));
      addExample(op.body, "multipart/form-data", schema, name, Object.keys(value).length ? value : undefined);
      break;
    }
  }
  op.bodyRequired = true;
}

function addParams(op: Op, r: RequestNode, names: string[], scope: VarScope) {
  const put = (inn: string, name: string, required: boolean, value: string | undefined) => {
    const id = `${inn}:${name}`;
    const known = op.params.get(id);
    if (known) {
      if (known.example === undefined && value !== undefined) known.example = value;
      return;
    }
    op.params.set(id, { name, in: inn, required, schema: { type: "string" }, ...(value !== undefined && { example: value }) });
  };
  for (const n of names) {
    const row = r.pathVars?.find((p) => p.key === n);
    put("path", n, true, exampleOf(row ? row.value : `{{${n}}}`, scope));
  }
  // the params table, plus anything only the URL's own query holds
  const rows: KV[] = [...r.params];
  for (const q of parseQuery(r.url)) if (!rows.some((p) => p.key === q.key)) rows.push({ id: "", key: q.key, value: q.value, enabled: true });
  for (const p of rows) if (p.key) put("query", p.key, p.enabled, exampleOf(p.value, scope));
  const apiKeyHeader = r.auth.type === "apikey" && r.auth.in === "header" ? r.auth.key.toLowerCase() : "";
  for (const h of r.headers) {
    if (!h.key || RESERVED_HEADER.test(h.key) || h.key.toLowerCase() === apiKeyHeader) continue;
    if (h.key.toLowerCase() === "cookie") {
      for (const part of h.value.split(";")) {
        const eq = part.indexOf("=");
        const k = (eq === -1 ? part : part.slice(0, eq)).trim();
        if (k) put("cookie", k, h.enabled, eq === -1 ? undefined : exampleOf(part.slice(eq + 1).trim(), scope));
      }
      continue;
    }
    put("header", h.key, h.enabled, exampleOf(h.value, scope));
  }
}

function addResponses(op: Op, r: RequestNode) {
  for (const ex of r.examples ?? []) {
    const res = ex.response;
    if (!res) continue;
    const code = String(res.status);
    const entry = op.responses.get(code) ?? { description: res.statusText || ex.name || "Response", content: new Map() };
    op.responses.set(code, entry);
    const media = mediaOf(res.headers) ?? (res.bodyEncoding === "base64" ? "application/octet-stream" : "text/plain");
    if (res.bodyEncoding === "base64") {
      addExample(entry.content, media, { type: "string", format: "binary" }, ex.name, undefined);
      continue;
    }
    if (!res.body) {
      // a 204: no body, no content
      continue;
    }
    const p = /json/.test(media) ? parseJsonBody(res.body) : ({ ok: false } as const);
    if (p.ok) addExample(entry.content, media, schemaOf(p.value), ex.name, p.value);
    else addExample(entry.content, media, { type: "string" }, ex.name, res.body);
  }
}

const camel = (s: string) => {
  const words = s.replace(/[^A-Za-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  return words.map((w, i) => (i === 0 ? w[0].toLowerCase() + w.slice(1) : w[0].toUpperCase() + w.slice(1))).join("");
};

// ---------- servers ----------

/** Servers for one address prefix: one per environment it resolves in, else the collection's own value. */
function serversFor(prefix: string, collectionScope: VarScope, envs: Environment[]): Any[] {
  const out: Any[] = [];
  const seen = new Set<string>();
  const push = (url: string, description?: string) => {
    const u = url.replace(/\/+$/, "");
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ url: u, ...(description && { description }) });
  };
  if (!prefix.includes("{{")) {
    push(prefix);
    return out;
  }
  for (const e of envs) {
    const u = resolve(prefix, buildScope([...collectionScope].map(([key, value]) => ({ id: "", key, value, enabled: true })), e.variables));
    if (!u.includes("{{")) push(u, e.name);
  }
  if (!out.length) {
    const u = resolve(prefix, collectionScope);
    if (u && !u.includes("{{")) push(u);
    else {
      // still a variable: an OpenAPI server variable, left for the reader to fill in
      const variables: Record<string, Any> = {};
      const url = u.replace(/\{\{([^{}]*)\}\}/g, (_, n: string) => {
        const name = n.trim();
        variables[name] = { default: "" };
        return `{${name}}`;
      });
      out.push({ url, variables });
    }
  }
  return out;
}

// ---------- export ----------

export function exportOpenApi(c: Collection, envs: Environment[], opts: OpenApiExportOptions): OpenApiExport {
  // examples: collection values under the first chosen environment, the same precedence as a send
  const scope = buildScope(c.variables, envs[0]?.variables);
  const collectionScope = buildScope(c.variables);
  const schemes: Schemes = { defs: {}, byKey: new Map() };
  const ops = new Map<string, Op>();
  const ids = new Set<string>();
  const tags: string[] = [];
  const prefixUse = new Map<string, number>();
  let merged = 0;
  let skipped = 0;

  const walk = (nodes: TreeNode[], folders: string[]) => {
    for (const n of nodes) {
      if (n.type === "folder") {
        walk(n.children, [...folders, n.name]);
        continue;
      }
      if (NON_HTTP.has(n.method)) {
        skipped++;
        continue;
      }
      const method = isGql(n) ? "post" : n.method.toLowerCase();
      if (!METHODS.has(method)) {
        skipped++;
        continue;
      }
      const { prefix, path, names } = splitUrl(n.url);
      const key = `${method} ${path}`;
      let op = ops.get(key);
      if (op) merged++;
      else {
        const tag = folders.length ? folders.join(" / ") : undefined;
        if (tag && !tags.includes(tag)) tags.push(tag);
        const base = camel(n.name) || camel(`${method} ${path}`) || method;
        let id = base;
        for (let i = 2; ids.has(id); i++) id = `${base}${i}`;
        ids.add(id);
        op = {
          method,
          path,
          prefix,
          summary: n.name,
          operationId: id,
          tag,
          params: new Map(),
          body: new Map(),
          bodyRequired: false,
          security: schemeFor(schemes, n.auth),
          responses: new Map(),
        };
        ops.set(key, op);
        prefixUse.set(prefix, (prefixUse.get(prefix) ?? 0) + 1);
      }
      addParams(op, n, names, scope);
      addBody(op, n);
      addResponses(op, n);
    }
  };
  walk(c.children, []);

  // the address most requests share is the spec's server; the others go on their operations
  const main = [...prefixUse].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const paths: Record<string, Any> = {};
  for (const op of ops.values()) {
    const responses: Record<string, Any> = {};
    for (const [code, r] of [...op.responses].sort((a, b) => Number(a[0]) - Number(b[0]))) {
      responses[code] = { description: r.description, ...(r.content.size && { content: writeContent(r.content) }) };
    }
    if (!Object.keys(responses).length) responses.default = { description: "No saved example" };
    const operation: Any = {
      ...(op.tag && { tags: [op.tag] }),
      summary: op.summary,
      operationId: op.operationId,
      ...(op.params.size && { parameters: [...op.params.values()] }),
      ...(op.body.size && { requestBody: { required: op.bodyRequired, content: writeContent(op.body) } }),
      responses,
      ...(op.security && { security: [{ [op.security]: [] }] }),
      ...(op.prefix !== main && { servers: serversFor(op.prefix, collectionScope, envs) }),
    };
    (paths[op.path] ??= {})[op.method] = operation;
  }

  const doc: Any = {
    openapi: "3.0.3",
    info: { title: c.name, version: "1.0.0" },
    ...(main && { servers: serversFor(main, collectionScope, envs) }),
    ...(tags.length && { tags: tags.map((name) => ({ name })) }),
    paths,
    ...(Object.keys(schemes.defs).length && { components: { securitySchemes: schemes.defs } }),
  };
  const text = opts.as === "json" ? JSON.stringify(doc, null, 2) + "\n" : stringifyYaml(doc, { lineWidth: 0, aliasDuplicateObjects: false });
  return { text, merged, skipped };
}
