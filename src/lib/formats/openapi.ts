/**
 * OpenAPI 3.x and Swagger 2 import. One collection: folders from tags (or the first path segment),
 * `{{baseUrl}}` from the first server, `{{name}}` for path parameters, bodies from examples or built from the schema,
 * and response examples saved under their request. `$ref` is followed inside the file and into files beside it.
 */
import type { Auth, Collection, Example, KV, MultipartField, RequestBody, RequestNode, TreeNode } from "../../types";
import { kv, newRequest, toRequestDef, uid, urlWithParams } from "../model";
import { parseDoc, requestsOf, type Any, type ImportPlan, type Note, type Source } from "./common";

export interface OpenApiOptions {
  folders: "tags" | "paths";
  examples: boolean;
}

/** Reads a file or URL named by a `$ref`, already resolved to an absolute key. */
export type RefLoader = (key: string) => Promise<string>;

// ---------- $ref: documents by key, pointers into them ----------

const isUrl = (s: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(s);

/**
 * Resolves `rel` against the document key `base` (a file path or URL). A spec may point at files beside it
 * or at URLs, but not at an absolute path on this Mac: null refuses it.
 */
function joinKey(base: string, rel: string): string | null {
  if (isUrl(rel)) return rel;
  if (isUrl(base)) return new URL(rel, base).toString();
  if (rel.startsWith("/") || rel.startsWith("~") || /^[a-z]:[\\/]/i.test(rel)) return null;
  const parts = base.split("/").slice(0, -1);
  for (const seg of rel.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  return parts.join("/");
}

/**
 * A local `$ref` file must sit in the root spec's folder or below it. Without this, `../` walks to any file
 * on this Mac (the voidHTTP vault included), and its values land in requests sent to the spec's server.
 */
function insideRoot(rootKey: string, target: string): boolean {
  if (target === rootKey || isUrl(target)) return true;
  if (isUrl(rootKey)) return false;
  const dir = rootKey.slice(0, rootKey.lastIndexOf("/") + 1);
  return dir !== "" && target.startsWith(dir);
}

const unescapePtr = (s: string) => decodeURIComponent(s).replace(/~1/g, "/").replace(/~0/g, "~");

export class Refs {
  readonly docs = new Map<string, Any>();
  readonly missing = new Set<string>();
  /** `$ref` files refused because they are outside the root spec's folder. */
  readonly outside = new Set<string>();
  constructor(
    root: Any,
    readonly rootKey: string,
  ) {
    this.docs.set(rootKey, root);
  }

  /** Loads every file reachable through `$ref`, breadth first. */
  async preload(load: RefLoader | undefined) {
    const queue = [this.rootKey];
    while (queue.length) {
      const key = queue.shift()!;
      for (const ref of collectRefs(this.docs.get(key))) {
        const file = ref.split("#")[0];
        if (!file) continue;
        const target = joinKey(key, file);
        if (target === null) {
          this.missing.add(file);
          continue;
        }
        if (!insideRoot(this.rootKey, target)) {
          this.outside.add(file);
          continue;
        }
        if (this.docs.has(target) || this.missing.has(target)) continue;
        if (!load || !this.rootKey) {
          this.missing.add(target);
          continue;
        }
        try {
          const doc = parseDoc(await load(target));
          if (doc === undefined) throw new Error("unreadable");
          this.docs.set(target, doc);
          queue.push(target);
        } catch {
          this.missing.add(target);
        }
      }
    }
  }

  /** Follows `$ref` chains from `node`, which sits in document `file`. Returns the value and the document it came from. */
  deref(node: Any, file: string): [Any, string] {
    for (let hops = 0; node && typeof node === "object" && typeof node.$ref === "string" && hops < 32; hops++) {
      const [path, frag = ""] = node.$ref.split("#");
      const target = path ? joinKey(file, path) : file;
      if (target === null || !insideRoot(this.rootKey, target)) return [undefined, file];
      let v = this.docs.get(target);
      if (v === undefined) return [undefined, target];
      for (const seg of frag.split("/").filter(Boolean)) v = v?.[unescapePtr(seg)];
      node = v;
      file = target;
    }
    return [node, file];
  }
}

function collectRefs(v: Any, out = new Set<string>(), depth = 0): Set<string> {
  if (!v || typeof v !== "object" || depth > 200) return out;
  if (Array.isArray(v)) v.forEach((x) => collectRefs(x, out, depth + 1));
  else
    for (const [k, x] of Object.entries(v)) {
      if (k === "$ref" && typeof x === "string") out.add(x);
      else collectRefs(x, out, depth + 1);
    }
  return out;
}

/** Parses and loads everything the importer needs; the result is turned into a plan by `buildOpenApi`. */
export interface LoadedSpec {
  refs: Refs;
  doc: Any;
  v2: boolean;
  source: Source;
}

export async function loadOpenApi(doc: Any, source: Source, load?: RefLoader): Promise<LoadedSpec> {
  const key = source.path ?? source.url ?? "";
  const refs = new Refs(doc, key);
  await refs.preload(load);
  return { refs, doc, v2: !!doc.swagger, source };
}

// ---------- values: examples first, then built from the schema ----------

const SAMPLE_STRING: Record<string, string> = {
  "date-time": "2026-01-01T00:00:00Z",
  date: "2026-01-01",
  time: "00:00:00",
  uuid: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  email: "user@example.com",
  uri: "https://example.com",
  url: "https://example.com",
  hostname: "example.com",
  ipv4: "192.0.2.1",
  ipv6: "2001:db8::1",
  byte: "",
  binary: "",
  password: "",
};

type Ctx = { refs: Refs; dir: "request" | "response" };

function sample(ctx: Ctx, schema: Any, file: string, depth = 0, seen = new Set<string>()): unknown {
  if (!schema || typeof schema !== "object") return undefined;
  const ref = typeof schema.$ref === "string" ? `${file}#${schema.$ref}` : null;
  if (ref) {
    if (seen.has(ref) || depth > 12) return undefined;
    seen = new Set(seen).add(ref);
  }
  const [s, f] = ctx.refs.deref(schema, file);
  if (!s || typeof s !== "object") return undefined;
  if (s.example !== undefined) return s.example;
  if (Array.isArray(s.examples) && s.examples.length) return s.examples[0];
  if (s.default !== undefined) return s.default;
  if (s.const !== undefined) return s.const;
  if (Array.isArray(s.enum) && s.enum.length) return s.enum[0];
  if (Array.isArray(s.allOf)) {
    const parts = s.allOf.map((x: Any) => sample(ctx, x, f, depth + 1, seen));
    if (parts.every((p: unknown) => p && typeof p === "object" && !Array.isArray(p))) return Object.assign({}, ...parts);
    return parts.find((p: unknown) => p !== undefined);
  }
  const alt = s.oneOf ?? s.anyOf;
  if (Array.isArray(alt) && alt.length) return sample(ctx, alt.find((x: Any) => x?.type !== "null") ?? alt[0], f, depth + 1, seen);
  const type = Array.isArray(s.type) ? s.type.find((t: string) => t !== "null") : s.type;
  if (type === "object" || (!type && s.properties)) {
    const out: Record<string, unknown> = {};
    for (const [k, p] of Object.entries<Any>(s.properties ?? {})) {
      const [prop] = ctx.refs.deref(p, f);
      if (ctx.dir === "request" && prop?.readOnly) continue;
      if (ctx.dir === "response" && prop?.writeOnly) continue;
      const v = sample(ctx, p, f, depth + 1, seen);
      out[k] = v === undefined ? null : v;
    }
    return out;
  }
  if (type === "array") {
    const v = sample(ctx, s.items, f, depth + 1, seen);
    return v === undefined ? [] : [v];
  }
  if (type === "string") return SAMPLE_STRING[s.format] ?? "string";
  if (type === "integer" || type === "number") return typeof s.minimum === "number" ? s.minimum : 0;
  if (type === "boolean") return false;
  if (type === "null") return null;
  return undefined;
}

/** A parameter's value as text: its example, default or enum, else empty. */
function paramValue(ctx: Ctx, p: Any, file: string): string {
  const firstExample = p.examples && typeof p.examples === "object" ? Object.values<Any>(p.examples)[0] : undefined;
  const v =
    p.example ??
    (firstExample ? ctx.refs.deref(firstExample, file)[0]?.value : undefined) ??
    p["x-example"] ??
    (() => {
      const [s] = ctx.refs.deref(p.schema ?? p, file);
      return s?.example ?? s?.default ?? (Array.isArray(s?.enum) ? s.enum[0] : undefined);
    })();
  if (v === undefined || v === null) return "";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

// ---------- Swagger 2 → the OpenAPI 3 shapes the importer reads ----------

function fromSwagger(doc: Any): Any {
  const scheme = (doc.schemes ?? ["https"])[0];
  const servers = doc.host ? [{ url: `${scheme}://${doc.host}${doc.basePath ?? ""}` }] : doc.basePath ? [{ url: doc.basePath }] : [];
  const securitySchemes: Record<string, Any> = {};
  for (const [name, d] of Object.entries<Any>(doc.securityDefinitions ?? {})) {
    if (d.type === "basic") securitySchemes[name] = { type: "http", scheme: "basic" };
    else if (d.type === "apiKey") securitySchemes[name] = { type: "apiKey", name: d.name, in: d.in };
    else securitySchemes[name] = { type: d.type };
  }
  const paths: Record<string, Any> = {};
  for (const [path, item] of Object.entries<Any>(doc.paths ?? {})) {
    const out: Any = { parameters: item.parameters };
    for (const m of METHODS) {
      const op = item[m];
      if (!op) continue;
      const consumes: string[] = op.consumes ?? doc.consumes ?? ["application/json"];
      const params: Any[] = op.parameters ?? [];
      const body = params.find((p) => p?.in === "body");
      const form = params.filter((p) => p?.in === "formData");
      let requestBody: Any;
      if (body) requestBody = { content: { [consumes.find((c) => /json/.test(c)) ?? consumes[0]]: { schema: body.schema, example: body["x-example"] } } };
      else if (form.length) {
        const multipart = form.some((p) => p.type === "file") || consumes.includes("multipart/form-data");
        const properties: Record<string, Any> = {};
        for (const p of form) properties[p.name] = { type: p.type === "file" ? "string" : p.type, format: p.type === "file" ? "binary" : p.format, example: p["x-example"] ?? p.default };
        requestBody = { content: { [multipart ? "multipart/form-data" : "application/x-www-form-urlencoded"]: { schema: { type: "object", properties } } } };
      }
      const responses: Record<string, Any> = {};
      for (const [code, r] of Object.entries<Any>(op.responses ?? {})) {
        const content: Record<string, Any> = {};
        for (const [ct, ex] of Object.entries<Any>(r?.examples ?? {})) content[ct] = { example: ex };
        responses[code] = { ...r, content };
      }
      out[m] = { ...op, parameters: params.filter((p) => p?.in !== "body" && p?.in !== "formData"), requestBody, responses };
    }
    paths[path] = out;
  }
  return { ...doc, servers, paths, components: { securitySchemes } };
}

// ---------- operations → requests ----------

const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;

const pathToUrl = (path: string) => path.replace(/\{([^}]+)\}/g, "{{$1}}");

interface Build {
  ctx: Ctx;
  vars: Map<string, string>;
  notes: { oauth: Set<string>; cookieKeys: Set<string>; schemaBodies: number; examples: number; missingSchemes: Set<string> };
}

function chooseMedia(content: Any): [string, Any] | undefined {
  const entries = Object.entries<Any>(content ?? {});
  if (!entries.length) return undefined;
  const pref = [/^application\/(.+\+)?json/i, /x-www-form-urlencoded/i, /multipart\/form-data/i, /xml/i, /^text\//i];
  for (const re of pref) {
    const hit = entries.find(([ct]) => re.test(ct));
    if (hit) return hit;
  }
  return entries[0];
}

function mediaValue(b: Build, media: Any, file: string): { value: unknown; fromSchema: boolean } {
  if (media?.example !== undefined) return { value: media.example, fromSchema: false };
  const first = media?.examples && typeof media.examples === "object" ? Object.values<Any>(media.examples)[0] : undefined;
  if (first) return { value: b.ctx.refs.deref(first, file)[0]?.value, fromSchema: false };
  return { value: sample(b.ctx, media?.schema, file), fromSchema: true };
}

function buildBody(b: Build, rb: Any, file: string, headers: KV[]): RequestBody {
  const body: RequestBody = { mode: "none", raw: "", form: [], multipart: [] };
  const [req, f] = b.ctx.refs.deref(rb, file);
  const hit = chooseMedia(req?.content);
  if (!hit) return body;
  const [ct, media] = hit;
  const { value, fromSchema } = mediaValue(b, media, f);
  if (fromSchema && value !== undefined) b.notes.schemaBodies++;
  const obj = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const text = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
  if (/json/i.test(ct)) {
    body.mode = "json";
    body.raw = value === undefined ? "" : JSON.stringify(value, null, 2);
    if (!/^application\/json$/i.test(ct)) headers.push(kv("Content-Type", ct));
  } else if (/x-www-form-urlencoded/i.test(ct)) {
    body.mode = "form";
    body.form = Object.entries(obj).map(([k, v]) => kv(k, text(v)));
  } else if (/multipart\/form-data/i.test(ct)) {
    body.mode = "multipart";
    const [schema, sf] = b.ctx.refs.deref(media?.schema, f);
    const props = schema?.properties ?? {};
    const keys = Object.keys(props).length ? Object.keys(props) : Object.keys(obj);
    body.multipart = keys.map((k): MultipartField => {
      const [p] = b.ctx.refs.deref(props[k], sf);
      const file = p?.format === "binary" || p?.format === "base64" || p?.type === "file";
      return { ...kv(k, file ? "" : text(obj[k])), kind: file ? "file" : "text" };
    });
  } else {
    body.mode = /xml/i.test(ct) ? "xml" : "text";
    body.raw = typeof value === "string" ? value : "";
    if (body.mode === "text" && !/^text\/plain/i.test(ct)) headers.push(kv("Content-Type", ct));
  }
  return body;
}

function buildAuth(b: Build, doc: Any, op: Any): Auth {
  const reqs: Any[] = op.security ?? doc.security ?? [];
  if (!Array.isArray(reqs) || !reqs.length) return { type: "none" };
  const name = Object.keys(reqs[0] ?? {})[0];
  if (!name) return { type: "none" };
  const [scheme] = b.ctx.refs.deref(doc.components?.securitySchemes?.[name], b.ctx.refs.rootKey);
  if (!scheme) {
    b.notes.missingSchemes.add(name);
    return { type: "none" };
  }
  const need = (v: string) => (b.vars.has(v) ? undefined : b.vars.set(v, ""));
  if (scheme.type === "http" && /^basic$/i.test(scheme.scheme ?? "")) {
    need("username");
    need("password");
    return { type: "basic", username: "{{username}}", password: "{{password}}" };
  }
  if (scheme.type === "apiKey" && (scheme.in === "header" || scheme.in === "query")) {
    need("apiKey");
    return { type: "apikey", key: String(scheme.name ?? "X-API-Key"), value: "{{apiKey}}", in: scheme.in };
  }
  if (scheme.type === "apiKey" && scheme.in === "cookie") {
    b.notes.cookieKeys.add(String(scheme.name));
    return { type: "none" };
  }
  if (scheme.type !== "http") b.notes.oauth.add(name);
  need("token");
  return { type: "bearer", token: "{{token}}" };
}

function buildExamples(b: Build, op: Any, file: string, node: RequestNode): Example[] {
  const out: Example[] = [];
  for (const [code, r0] of Object.entries<Any>(op.responses ?? {})) {
    const [r, rf] = b.ctx.refs.deref(r0, file);
    for (const [ct, media0] of Object.entries<Any>(r?.content ?? {})) {
      const [media, mf] = b.ctx.refs.deref(media0, rf);
      const found: [string, unknown][] = [];
      if (media?.example !== undefined) found.push(["", media.example]);
      for (const [name, ex] of Object.entries<Any>(media?.examples ?? {})) found.push([name, b.ctx.refs.deref(ex, mf)[0]?.value]);
      for (const [name, value] of found) {
        if (value === undefined) continue;
        const body = typeof value === "string" ? value : JSON.stringify(value, null, 2);
        const status = /^\d{3}$/.test(code) ? Number(code) : 200;
        out.push({
          id: uid(),
          name: [code, name || r?.description].filter(Boolean).join(" · ").slice(0, 80) || "Example",
          savedAt: Date.now(),
          request: toRequestDef(node),
          response: {
            status,
            statusText: String(r?.description ?? ""),
            httpVersion: "HTTP/1.1",
            url: "",
            headers: [{ key: "Content-Type", value: ct }],
            body,
            bodyEncoding: "utf8",
            size: new TextEncoder().encode(body).length,
            elapsedMs: 0,
          },
          masked: [],
        });
      }
    }
  }
  b.notes.examples += out.length;
  return out;
}

/** Folder name for an operation that has no tag, from its first literal path segment. */
const firstSegment = (path: string) => path.split("/").find((s) => s && !s.startsWith("{")) ?? "";

/** The plan for a loaded spec, built again whenever the options change. */
export function buildOpenApi(spec: LoadedSpec, opts: OpenApiOptions): ImportPlan {
  const doc = spec.v2 ? fromSwagger(spec.doc) : spec.doc;
  const file = spec.refs.rootKey;
  const b: Build = {
    ctx: { refs: spec.refs, dir: "request" },
    vars: new Map(),
    notes: { oauth: new Set(), cookieKeys: new Set(), schemaBodies: 0, examples: 0, missingSchemes: new Set() },
  };
  const notes: Note[] = [];

  // base URL: the first server, its {variables} as collection variables
  const server = doc.servers?.[0];
  let base = String(server?.url ?? "");
  for (const [name, v] of Object.entries<Any>(server?.variables ?? {})) {
    base = base.split(`{${name}}`).join(`{{${name}}}`);
    b.vars.set(name, String(v?.default ?? ""));
  }
  if (base && !/^[a-z]+:\/\//i.test(base) && !base.startsWith("{{")) {
    const from = spec.source.url;
    if (from) base = new URL(base, from).toString().replace(/\/$/, "");
    else notes.push({ level: "warn", text: `The server URL \`${base}\` is relative. Set \`{{baseUrl}}\` to the full address.` });
  }
  b.vars.set("baseUrl", base.replace(/\/$/, ""));

  // folders in the order the spec lists its tags, then as they appear
  const folders = new Map<string, TreeNode[]>();
  for (const t of doc.tags ?? []) if (t?.name) folders.set(String(t.name), []);
  const root: TreeNode[] = [];
  let callbacks = 0;

  for (const [path, item0] of Object.entries<Any>(doc.paths ?? {})) {
    const [item, itemFile] = spec.refs.deref(item0, file);
    if (!item) continue;
    for (const m of METHODS) {
      const op = item[m];
      if (!op) continue;
      if (op.callbacks) callbacks += Object.keys(op.callbacks).length;

      // path-level parameters, overridden by the operation's own (same name and place)
      const params = new Map<string, Any>();
      for (const p0 of [...(item.parameters ?? []), ...(op.parameters ?? [])]) {
        const [p] = spec.refs.deref(p0, itemFile);
        if (p?.name && p.in) params.set(`${p.in}:${p.name}`, p);
      }
      const query: KV[] = [];
      const headers: KV[] = [];
      const cookies: string[] = [];
      for (const p of params.values()) {
        const value = paramValue(b.ctx, p, itemFile);
        if (p.in === "query") query.push(kv(String(p.name), value, !!p.required));
        else if (p.in === "header" && !/^(accept|content-type|authorization)$/i.test(p.name)) headers.push(kv(String(p.name), value, !!p.required));
        else if (p.in === "path" && !b.vars.has(p.name)) b.vars.set(String(p.name), value);
        else if (p.in === "cookie") cookies.push(`${p.name}=${value}`);
      }
      if (cookies.length) headers.push(kv("Cookie", cookies.join("; ")));

      const body = op.requestBody ? buildBody(b, op.requestBody, itemFile, headers) : newRequest().body;
      const url = urlWithParams(`{{baseUrl}}${pathToUrl(path)}`, query);
      const node: RequestNode = {
        type: "request",
        ...newRequest({
          name: String(op.summary || op.operationId || path).trim(),
          method: m.toUpperCase(),
          url,
          params: query,
          headers,
          body,
          auth: buildAuth(b, doc, op),
        }),
      };
      if (opts.examples) {
        b.ctx.dir = "response";
        const ex = buildExamples(b, op, itemFile, node);
        b.ctx.dir = "request";
        if (ex.length) node.examples = ex;
      }
      const folder = opts.folders === "tags" ? op.tags?.[0] : firstSegment(path);
      if (!folder) root.push(node);
      else {
        if (!folders.has(String(folder))) folders.set(String(folder), []);
        folders.get(String(folder))!.push(node);
      }
    }
  }

  const children: TreeNode[] = [
    ...[...folders].filter(([, kids]) => kids.length).map(([name, kids]): TreeNode => ({ type: "folder", id: uid(), name, children: kids })),
    ...root,
  ];
  const collection: Collection = {
    id: uid(),
    name: String(doc.info?.title ?? spec.source.name ?? "Imported API"),
    children,
    variables: [...b.vars].map(([k, v]) => kv(k, v)),
  };

  for (const name of b.notes.oauth)
    notes.push({ level: "warn", text: `Security scheme \`${name}\` (OAuth2 / OpenID) becomes Bearer \`{{token}}\`. voidHTTP has no OAuth2 flow yet.` });
  for (const name of b.notes.cookieKeys) notes.push({ level: "warn", text: `Cookie API key \`${name}\` is left out. Add it as a \`Cookie\` header.` });
  for (const name of b.notes.missingSchemes) notes.push({ level: "warn", text: `Security scheme \`${name}\` is not defined in the spec; those requests have no auth.` });
  if (callbacks) notes.push({ level: "warn", text: `${callbacks} callback${callbacks === 1 ? "" : "s"} (webhooks the API calls) left out.` });
  const webhooks = Object.keys(doc.webhooks ?? {}).length;
  if (webhooks) notes.push({ level: "warn", text: `${webhooks} webhook${webhooks === 1 ? "" : "s"} left out.` });
  // every local file a `$ref` read is named, so a spec cannot quietly pull values out of files beside it
  const read = [...spec.refs.docs.keys()].filter((k) => k !== spec.refs.rootKey && !isUrl(k));
  if (read.length) notes.push({ level: "warn", text: `Values were read from ${read.map((k) => `\`${k}\``).join(", ")} through \`$ref\`. Check them before sending.` });
  for (const m of spec.refs.outside) notes.push({ level: "warn", text: `\`$ref\` file \`${m}\` is outside the spec's folder and was not read; parts that use it are empty.` });
  for (const m of spec.refs.missing) notes.push({ level: "warn", text: `\`$ref\` file \`${m.split("/").pop()}\` could not be read; parts that use it are empty.` });
  if (b.notes.schemaBodies)
    notes.push({ level: "info", text: `${b.notes.schemaBodies} request bod${b.notes.schemaBodies === 1 ? "y is" : "ies are"} built from the schema, because the spec has no example.` });

  const version = spec.v2 ? `Swagger ${spec.doc.swagger}` : `OpenAPI ${spec.doc.openapi}`;
  const title = [doc.info?.title, doc.info?.version && `v${doc.info.version}`].filter(Boolean).join(" ");
  const files = spec.refs.docs.size;
  return {
    format: spec.v2 ? "swagger" : "openapi",
    label: version,
    detail: [title, files > 1 && `${files} files joined by $ref`].filter(Boolean).join(" · "),
    collections: [collection],
    environments: [],
    notes,
  };
}

/** How many response examples a build found (for the option row). */
export const exampleCount = (plan: ImportPlan) => plan.collections.reduce((n, c) => n + requestsOf(c.children).reduce((m, r) => m + (r.examples?.length ?? 0), 0), 0);
