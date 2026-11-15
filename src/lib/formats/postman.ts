/**
 * Postman Collection v2.0/v2.1 and Environment: import and export.
 * Request scripts (pre-request and tests) come along as the request's Pre-request and Post-response scripts.
 * Folder and collection scripts have no place in voidHTTP yet: they are dropped on import and said so.
 */
import type { Auth, Collection, Environment, Example, KV, RequestBody, RequestNode, TreeNode } from "../../types";
import { kv, newRequest, paramsFromUrl, parseQuery, uid } from "../model";
import { dropFilePaths, requestsOf, str, type Any, type ImportPlan, type Note } from "./common";

const toKV = (list: Any[] | undefined): KV[] =>
  (Array.isArray(list) ? list : []).filter((x) => x && typeof x === "object").map((x) => kv(str(x.key), str(x.value), !x.disabled && x.enabled !== false));

function pick(list: Any[] | undefined, key: string): string {
  return String((Array.isArray(list) ? list : []).find((x) => x.key === key)?.value ?? "");
}

/** Postman auth types voidHTTP has no form for, counted for the report. */
/** `scripts`: folder and collection scripts left out; `kept`: request scripts brought in */
type Seen = { scripts: number; kept: number; auth: Map<string, number> };

function convertAuth(a: Any, seen: Seen): Auth | undefined {
  if (!a || !a.type) return undefined;
  switch (a.type) {
    case "noauth":
      return { type: "none" };
    case "bearer":
      return { type: "bearer", token: pick(a.bearer, "token") };
    case "basic":
      return { type: "basic", username: pick(a.basic, "username"), password: pick(a.basic, "password") };
    case "apikey":
      return {
        type: "apikey",
        key: pick(a.apikey, "key"),
        value: pick(a.apikey, "value"),
        in: pick(a.apikey, "in") === "query" ? "query" : "header",
      };
    case "oauth2":
      seen.auth.set("oauth2", (seen.auth.get("oauth2") ?? 0) + 1);
      return { type: "bearer", token: pick(a.oauth2, "accessToken") || "{{token}}" };
    default:
      seen.auth.set(a.type, (seen.auth.get(a.type) ?? 0) + 1);
      return undefined;
  }
}

function convertBody(b: Any): RequestBody {
  const body: RequestBody = { mode: "none", raw: "", form: [], multipart: [] };
  if (!b || b.disabled) return body;
  if (b.mode === "raw") {
    const lang = b.options?.raw?.language;
    body.raw = String(b.raw ?? "");
    body.mode = lang === "json" ? "json" : lang === "xml" ? "xml" : looksJson(body.raw) ? "json" : "text";
  } else if (b.mode === "urlencoded") {
    body.mode = "form";
    body.form = toKV(b.urlencoded);
  } else if (b.mode === "formdata") {
    body.mode = "multipart";
    body.multipart = (b.formdata ?? []).map((f: Any) => ({
      ...kv(String(f.key ?? ""), String(f.type === "file" ? (Array.isArray(f.src) ? f.src[0] ?? "" : f.src ?? "") : f.value ?? ""), !f.disabled),
      kind: f.type === "file" ? "file" : "text",
    }));
  } else if (b.mode === "graphql") {
    body.mode = "json";
    body.raw = JSON.stringify({ query: b.graphql?.query ?? "", variables: safeJson(b.graphql?.variables) }, null, 2);
  }
  return body;
}

const looksJson = (s: string) => /^\s*[[{]/.test(s);
const safeJson = (s: string | undefined) => {
  try {
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
};

/** The code of one event ("prerequest" or "test"), joined: Postman keeps it as an array of lines or one string. */
const scriptOf = (events: Any, listen: string): string =>
  (Array.isArray(events) ? events : [])
    .filter((e: Any) => e?.listen === listen && !e?.disabled)
    .map((e: Any) => [e?.script?.exec].flat().filter((l: Any) => typeof l === "string").join("\n"))
    .filter((code: string) => code.trim())
    .join("\n\n");
const hasScript = (events: Any) => !!(scriptOf(events, "prerequest") || scriptOf(events, "test"));

function convertExamples(responses: Any, req: RequestNode): Example[] {
  if (!Array.isArray(responses)) return [];
  return responses.map((r: Any) => {
    const body = String(r.body ?? "");
    return {
      id: uid(),
      name: String(r.name ?? `${r.code ?? ""} ${r.status ?? ""}`.trim()) || "Example",
      savedAt: Date.now(),
      request: { ...newRequest(), ...stripNode(req) },
      response: {
        status: Number(r.code ?? 0),
        statusText: String(r.status ?? ""),
        httpVersion: "HTTP/1.1",
        url: req.url,
        headers: (Array.isArray(r.header) ? r.header : []).map((h: Any) => ({ key: String(h.key ?? ""), value: String(h.value ?? "") })),
        body,
        bodyEncoding: "utf8",
        size: new TextEncoder().encode(body).length,
        elapsedMs: Number(r.responseTime ?? 0) || 0,
      },
      masked: [],
    };
  });
}

const stripNode = (n: RequestNode) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { type, examples, ...req } = n;
  return structuredClone(req);
};

function convertItems(items: Any[], parentAuth: Auth, seen: Seen): TreeNode[] {
  return (items ?? []).map((it: Any): TreeNode => {
    if (Array.isArray(it.item)) {
      if (hasScript(it.event)) seen.scripts++;
      const auth = convertAuth(it.auth, seen) ?? parentAuth;
      return { type: "folder", id: uid(), name: String(it.name ?? "Folder"), children: convertItems(it.item, auth, seen) };
    }
    const r = it.request ?? {};
    const url = typeof r === "string" ? r : typeof r.url === "string" ? r.url : String(r.url?.raw ?? "");
    const req = newRequest({
      name: String(it.name ?? "Request"),
      method: String(r.method ?? "GET").toUpperCase(),
      url,
      headers: typeof r === "string" ? [] : toKV(r.header),
      body: convertBody(r.body),
      auth: convertAuth(r.auth, seen) ?? parentAuth,
    });
    const pre = scriptOf(it.event, "prerequest");
    const post = scriptOf(it.event, "test");
    if (pre || post) {
      req.scripts = { ...(pre && { pre }), ...(post && { post }) };
      seen.kept += Number(!!pre) + Number(!!post);
    }
    req.params = paramsFromUrl(url, []);
    // carry over disabled query params from the structured url
    for (const qp of Array.isArray(r.url?.query) ? r.url.query : []) if (qp?.disabled) req.params.push(kv(str(qp.key), str(qp.value), false));
    const node: RequestNode = { type: "request", ...req };
    const examples = convertExamples(it.response, node);
    return examples.length ? { ...node, examples } : node;
  });
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function importPostman(doc: Any): ImportPlan {
  const seen: Seen = { scripts: hasScript(doc.event) ? 1 : 0, kept: 0, auth: new Map() };
  const rootAuth = convertAuth(doc.auth, seen) ?? { type: "none" };
  const files = dropFilePaths([
    {
      id: uid(),
      name: String(doc.info?.name ?? "Imported collection"),
      children: convertItems(doc.item, rootAuth, seen),
      variables: toKV(doc.variable),
    },
  ]);
  const collection: Collection = files.collections[0];
  const notes: Note[] = [...files.notes];
  if (seen.kept) notes.push({ level: "warn", text: `${count(seen.kept, "request script")} kept. They run on every send: read them first, or turn scripts off in Settings › Requests.` });
  if (seen.scripts)
    notes.push({ level: "warn", text: `Scripts on ${count(seen.scripts, "folder or the collection", "folders or the collection")} left out. voidHTTP runs request scripts only.` });
  const oauth = seen.auth.get("oauth2");
  if (oauth) notes.push({ level: "warn", text: `OAuth2 auth on ${count(oauth, "item")} becomes Bearer \`{{token}}\`. voidHTTP has no OAuth2 flow yet.` });
  for (const [type, n] of seen.auth) if (type !== "oauth2") notes.push({ level: "warn", text: `\`${type}\` auth on ${count(n, "item")} is left out.` });
  const schema = String(doc.info?.schema ?? "");
  const version = /v2\.1/.test(schema) ? "v2.1" : /v2\.0/.test(schema) ? "v2.0" : "v2";
  const n = requestsOf(collection.children).length;
  return {
    format: "postman",
    label: `Postman ${version}`,
    detail: `${collection.name} · ${count(n, "request")}`,
    collections: [collection],
    environments: [],
    notes,
  };
}

export function importPostmanEnv(doc: Any): ImportPlan {
  const environment: Environment = { id: uid(), name: String(doc.name ?? "Imported environment"), variables: toKV(doc.values) };
  return {
    format: "postman-env",
    label: "Postman environment",
    detail: `${environment.name} · ${count(environment.variables.length, "variable")}`,
    collections: [],
    environments: [environment],
    notes: [],
  };
}

// ---------- export: Collection v2.1 ----------

const pmKv = (rows: KV[]) => rows.map((r) => ({ key: r.key, value: r.value, ...(!r.enabled && { disabled: true }) }));

function pmAuth(a: Auth): Any {
  switch (a.type) {
    case "none":
      return undefined;
    case "bearer":
      return { type: "bearer", bearer: [{ key: "token", value: a.token, type: "string" }] };
    case "basic":
      return {
        type: "basic",
        basic: [
          { key: "username", value: a.username, type: "string" },
          { key: "password", value: a.password, type: "string" },
        ],
      };
    case "apikey":
      return {
        type: "apikey",
        apikey: [
          { key: "key", value: a.key, type: "string" },
          { key: "value", value: a.value, type: "string" },
          { key: "in", value: a.in, type: "string" },
        ],
      };
  }
}

function pmBody(b: RequestBody): Any {
  switch (b.mode) {
    case "none":
      return undefined;
    case "json":
    case "xml":
    case "text":
      return { mode: "raw", raw: b.raw, options: { raw: { language: b.mode } } };
    case "form":
      return { mode: "urlencoded", urlencoded: pmKv(b.form) };
    case "multipart":
      return {
        mode: "formdata",
        formdata: b.multipart.map((f) =>
          f.kind === "file"
            ? { key: f.key, type: "file", src: f.value, ...(!f.enabled && { disabled: true }) }
            : { key: f.key, type: "text", value: f.value, ...(!f.enabled && { disabled: true }) },
        ),
      };
  }
}

function pmRequest(r: Omit<RequestNode, "type" | "examples">): Any {
  const q = r.url.indexOf("?");
  const raw = r.url;
  return {
    method: r.method,
    header: pmKv(r.headers),
    ...(pmBody(r.body) && { body: pmBody(r.body) }),
    ...(pmAuth(r.auth) && { auth: pmAuth(r.auth) }),
    url: {
      raw,
      ...(q !== -1 || r.params.length ? { query: [...parseQuery(raw).map((p) => ({ key: p.key, value: p.value })), ...pmKv(r.params.filter((p) => !p.enabled))] } : {}),
    },
  };
}

function pmItems(nodes: TreeNode[]): Any[] {
  return nodes.flatMap((n): Any[] => {
    if (n.type === "folder") return [{ name: n.name, item: pmItems(n.children) }];
    if (n.method === "GRPC" || n.method === "WS" || n.method === "SIO") return []; // v2.1 has no gRPC, WebSocket or Socket.IO request
    const event = (["pre", "post"] as const)
      .filter((k) => n.scripts?.[k]?.trim())
      .map((k) => ({ listen: k === "pre" ? "prerequest" : "test", script: { type: "text/javascript", exec: n.scripts![k]!.split("\n") } }));
    return [
      {
        name: n.name,
        ...(event.length && { event }),
        request: pmRequest(n),
        // only HTTP examples have a Postman form
        response: (n.examples ?? []).flatMap(({ name, request, response: r }) =>
          r
            ? [
                {
                  name,
                  originalRequest: pmRequest(request),
                  status: r.statusText,
                  code: r.status,
                  header: r.headers.map((h) => ({ key: h.key, value: h.value })),
                  body: r.bodyEncoding === "utf8" ? r.body : "",
                  ...(/json/i.test(r.headers.find((h) => h.key.toLowerCase() === "content-type")?.value ?? "") && { _postman_previewlanguage: "json" }),
                },
              ]
            : [],
        ),
      },
    ];
  });
}

export function exportPostman(c: Collection, opts: { examples: boolean }): string {
  const strip = (nodes: TreeNode[]): TreeNode[] =>
    nodes.map((n) => (n.type === "folder" ? { ...n, children: strip(n.children) } : { ...n, examples: opts.examples ? n.examples : undefined }));
  return JSON.stringify(
    {
      info: { _postman_id: uid(), name: c.name, schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
      item: pmItems(strip(c.children)),
      variable: pmKv(c.variables),
    },
    null,
    2,
  );
}

export function exportPostmanEnv(e: Environment): string {
  return JSON.stringify(
    {
      id: uid(),
      name: e.name,
      values: e.variables.map((v) => ({ key: v.key, value: v.value, type: "default", enabled: v.enabled })),
      _postman_variable_scope: "environment",
    },
    null,
    2,
  );
}
