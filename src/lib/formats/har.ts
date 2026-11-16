/**
 * HAR (HTTP Archive) import and export. Import shows every captured call so the person picks which become requests;
 * export writes each request with its latest saved example as the response.
 */
import type { Collection, Example, HttpResponse, KV, MultipartField, RequestBody, RequestNode, TreeNode } from "../../types";
import { kv, newRequest, paramsFromUrl, toRequestDef, uid } from "../model";
import { applyMasks, findSensitive } from "../mask";
import { prepare } from "../http";
import type { VarScope } from "../vars";
import { requestsOf, type Any, type ImportPlan, type Note } from "./common";

export interface HarRow {
  id: string;
  method: string;
  url: string;
  host: string;
  /** path and query, shown after the host */
  rest: string;
  status: number;
  size: number;
  time: number;
  /** a call made by page code (fetch / XHR), not a page, script, style, image or font */
  api: boolean;
  /** an earlier row with the same method, URL and body */
  dupOf?: string;
  /** a CORS preflight */
  preflight: boolean;
  entry: Any;
}

export interface HarFile {
  label: string;
  detail: string;
  rows: HarRow[];
  /** hosts in order of first appearance, with their row counts */
  hosts: { host: string; count: number }[];
  /** hosts switched on at first: those of the site that was captured */
  defaultHosts: string[];
}

const ASSET = /^(image|font|text\/css|text\/html|application\/(x-)?javascript|text\/javascript|video|audio)/i;

/** "api.amarbank.co.id" → "amarbank.co.id"; good enough to tell a site's own hosts from third parties. */
function siteOf(host: string): string {
  const parts = host.split(".");
  if (parts.length <= 2 || /^\d+$/.test(parts[parts.length - 1])) return host;
  const two = parts.slice(-2);
  return two[1].length === 2 && two[0].length <= 3 ? parts.slice(-3).join(".") : two.join(".");
}

export function readHar(doc: Any): HarFile {
  const entries: Any[] = doc.log?.entries ?? [];
  const seen = new Map<string, string>();
  const rows: HarRow[] = entries.map((e, i) => {
    const req = e.request ?? {};
    const res = e.response ?? {};
    let host = "";
    let rest = String(req.url ?? "");
    try {
      const u = new URL(rest);
      host = u.host;
      rest = u.pathname + u.search;
    } catch {
      // keep the raw text
    }
    const method = String(req.method ?? "GET").toUpperCase();
    const mime = String(res.content?.mimeType ?? "");
    const type = String(e._resourceType ?? "").toLowerCase();
    const api = type ? type === "xhr" || type === "fetch" : !ASSET.test(mime) && !!mime;
    const preflight = method === "OPTIONS" && (req.headers ?? []).some((h: Any) => /^access-control-request-method$/i.test(h.name));
    const key = `${method} ${req.url} ${req.postData?.text ?? ""}`;
    const id = `r${i}`;
    const dupOf = seen.get(key);
    if (!dupOf) seen.set(key, id);
    return {
      id,
      method,
      url: String(req.url ?? ""),
      host,
      rest,
      status: Number(res.status ?? 0),
      size: Math.max(0, Number(res.content?.size ?? res.bodySize ?? 0)),
      time: Math.round(Number(e.time ?? 0)),
      api,
      dupOf,
      preflight,
      entry: e,
    };
  });

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.host, (counts.get(r.host) ?? 0) + 1);
  const hosts = [...counts].map(([host, count]) => ({ host, count }));

  // the captured site: the page's own host, else the host with the most API calls
  let page = "";
  try {
    page = new URL(String(doc.log?.pages?.[0]?.title ?? "")).host;
  } catch {
    const apiCounts = new Map<string, number>();
    for (const r of rows) if (r.api) apiCounts.set(r.host, (apiCounts.get(r.host) ?? 0) + 1);
    page = [...apiCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  }
  const site = page ? siteOf(page) : "";
  const defaultHosts = hosts.filter((h) => site && siteOf(h.host) === site && rows.some((r) => r.host === h.host && r.api)).map((h) => h.host);

  const creator = doc.log?.browser ?? doc.log?.creator;
  const times = entries.map((e) => Date.parse(e.startedDateTime)).filter((t) => !Number.isNaN(t));
  const mins = times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 60000) : 0;
  return {
    label: `HAR ${doc.log?.version ?? "1.2"}`,
    detail: [
      creator?.name && `${creator.name}${creator.version ? ` ${String(creator.version).split(".")[0]}` : ""}`,
      `${rows.length} entries${mins ? ` over ${mins} min` : ""}`,
    ]
      .filter(Boolean)
      .join(" · "),
    rows,
    hosts,
    defaultHosts: defaultHosts.length ? defaultHosts : hosts.slice(0, 1).map((h) => h.host),
  };
}

/** Rows ticked at first: API calls on the site's hosts, not repeats or preflights. */
export const defaultPick = (f: HarFile) => new Set(f.rows.filter((r) => r.api && !r.dupOf && !r.preflight && f.defaultHosts.includes(r.host)).map((r) => r.id));

export interface HarOptions {
  strip: boolean;
  hostVars: boolean;
  examples: boolean;
  folders: "host" | "path" | "none";
}

const DROP_HEADERS = /^(:|host$|content-length$|connection$|accept-encoding$)/i;
const STRIP_HEADERS = /^(cookie|authorization|proxy-authorization)$/i;
const STRIP_RES_HEADERS = /^set-cookie$/i;

/** "auth.amarbank.dev" → "authUrl"; the most used host is always `baseUrl`. */
function hostVar(host: string, used: Set<string>): string {
  const label = host.split(".")[0].replace(/[^a-zA-Z0-9]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : ""));
  let name = `${label || "host"}Url`;
  for (let i = 2; used.has(name); i++) name = `${label}Url${i}`;
  used.add(name);
  return name;
}

function harBody(post: Any): RequestBody {
  const body: RequestBody = { mode: "none", raw: "", form: [], multipart: [] };
  if (!post) return body;
  const mime = String(post.mimeType ?? "");
  const text = String(post.text ?? "");
  if (/x-www-form-urlencoded/i.test(mime)) {
    body.mode = "form";
    const params: Any[] = post.params?.length ? post.params : [...new URLSearchParams(text)].map(([name, value]) => ({ name, value }));
    body.form = params.map((p) => kv(String(p.name ?? ""), String(p.value ?? "")));
  } else if (/multipart\/form-data/i.test(mime)) {
    body.mode = "multipart";
    body.multipart = (post.params ?? []).map((p: Any): MultipartField => ({ ...kv(String(p.name ?? ""), p.fileName ? "" : String(p.value ?? "")), kind: p.fileName ? "file" : "text" }));
  } else if (/json/i.test(mime) || /^\s*[[{]/.test(text)) {
    body.mode = "json";
    try {
      body.raw = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      body.raw = text;
    }
  } else if (text) {
    body.mode = /xml/i.test(mime) ? "xml" : "text";
    body.raw = text;
  }
  return body;
}

function harResponse(e: Any, url: string, strip: boolean): HttpResponse | null {
  const res = e.response;
  const c = res?.content;
  if (!res || c?.text === undefined) return null;
  const base64 = c.encoding === "base64";
  const body = String(c.text);
  return {
    status: Number(res.status ?? 0),
    statusText: String(res.statusText ?? ""),
    httpVersion: String(res.httpVersion ?? "HTTP/1.1"),
    url,
    headers: (res.headers ?? []).filter((h: Any) => !String(h.name).startsWith(":") && !(strip && STRIP_RES_HEADERS.test(h.name))).map((h: Any) => ({ key: String(h.name), value: String(h.value) })),
    body,
    bodyEncoding: base64 ? "base64" : "utf8",
    size: Number(c.size ?? 0) || (base64 ? Math.floor((body.length * 3) / 4) : new TextEncoder().encode(body).length),
    elapsedMs: Math.round(Number(e.time ?? 0)),
  };
}

/** The chosen rows as one collection. */
export function harToCollection(file: HarFile, picked: Set<string>, name: string, opts: HarOptions): { collection: Collection; notes: Note[] } {
  const rows = file.rows.filter((r) => picked.has(r.id));
  const vars = new Map<string, string>(); // origin → variable name
  const variables: KV[] = [];
  if (opts.hostVars) {
    const byUse = new Map<string, number>();
    for (const r of rows) {
      try {
        const o = new URL(r.url).origin;
        byUse.set(o, (byUse.get(o) ?? 0) + 1);
      } catch {
        // not a URL
      }
    }
    const used = new Set<string>(["baseUrl"]);
    [...byUse].sort((a, b) => b[1] - a[1]).forEach(([origin], i) => {
      const v = i === 0 ? "baseUrl" : hostVar(new URL(origin).host, used);
      vars.set(origin, v);
      variables.push(kv(v, origin));
    });
  }

  let stripped = 0;
  const groups = new Map<string, TreeNode[]>();
  const root: TreeNode[] = [];
  for (const r of rows) {
    const e = r.entry;
    let url = r.url;
    try {
      const o = new URL(url).origin;
      const v = vars.get(o);
      if (v) url = `{{${v}}}${url.slice(o.length)}`;
    } catch {
      // keep as captured
    }
    const headers = (e.request?.headers ?? [])
      .filter((h: Any) => !DROP_HEADERS.test(h.name))
      .filter((h: Any) => {
        const drop = opts.strip && STRIP_HEADERS.test(h.name);
        if (drop) stripped++;
        return !drop;
      })
      .map((h: Any) => kv(String(h.name), String(h.value)));
    const pathName = r.rest.split("?")[0] || "/";
    const node: RequestNode = {
      type: "request",
      ...newRequest({ name: pathName, method: r.method, url, headers, body: harBody(e.request?.postData) }),
    };
    node.params = paramsFromUrl(url, []);
    if (opts.examples) {
      const res = harResponse(e, r.url, opts.strip);
      if (res) {
        const req = toRequestDef(node);
        const groupsFound = findSensitive(req, res);
        const masked = applyMasks(req, res, groupsFound, "partial");
        const ex: Example = {
          id: uid(),
          name: `${res.status} ${res.statusText}`.trim() || "Captured",
          savedAt: Date.parse(e.startedDateTime) || Date.now(),
          request: masked.request,
          response: masked.response,
          masked: groupsFound.map((g) => `${g.where} ${g.label}`),
        };
        node.examples = [ex];
      }
    }
    const folder = opts.folders === "host" ? r.host : opts.folders === "path" ? (pathName.split("/").find(Boolean) ?? "") : "";
    if (!folder) root.push(node);
    else {
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder)!.push(node);
    }
  }
  const children: TreeNode[] = [...[...groups].map(([n, kids]): TreeNode => ({ type: "folder", id: uid(), name: n, children: kids })), ...root];
  const notes: Note[] = [];
  if (stripped) notes.push({ level: "info", text: `${stripped} \`Cookie\` / \`Authorization\` header${stripped === 1 ? "" : "s"} left out.` });
  return { collection: { id: uid(), name, children, variables }, notes };
}

/** A plan for the confirm step, from the HAR review's choices. */
export function harPlan(file: HarFile, picked: Set<string>, name: string, opts: HarOptions): ImportPlan {
  const { collection, notes } = harToCollection(file, picked, name, opts);
  return { format: "har", label: file.label, detail: file.detail, collections: [collection], environments: [], notes };
}

// ---------- export ----------

const harHeaders = (rows: { key: string; value: string }[]) => rows.map((h) => ({ name: h.key, value: h.value }));

export function exportHar(c: Collection, scope: VarScope, version: string): { text: string; skipped: number } {
  let skipped = 0;
  const entries = requestsOf(c.children).flatMap((n) => {
    if (n.method === "GRPC" || n.method === "WS" || n.method === "SIO") {
      skipped++;
      return [];
    }
    const p = prepare(n, scope);
    const ex = n.examples?.slice().sort((a, b) => b.savedAt - a.savedAt)[0];
    let queryString: { name: string; value: string }[] = [];
    try {
      queryString = [...new URL(p.url).searchParams].map(([name, value]) => ({ name, value }));
    } catch {
      // unresolved address
    }
    const postData =
      p.body?.type === "text"
        ? { mimeType: p.headers.find((h) => /^content-type$/i.test(h.key))?.value ?? "text/plain", text: p.body.content }
        : p.body?.type === "formUrlEncoded"
          ? { mimeType: "application/x-www-form-urlencoded", params: p.body.fields.map((f) => ({ name: f.key, value: f.value })), text: new URLSearchParams(p.body.fields.map((f) => [f.key, f.value])).toString() }
          : p.body?.type === "multipart"
            ? { mimeType: "multipart/form-data", params: p.body.fields.map((f) => (f.kind === "file" ? { name: f.key, fileName: f.value } : { name: f.key, value: f.value })) }
            : undefined;
    const r = ex?.response;
    return [
      {
        startedDateTime: new Date(ex?.savedAt ?? Date.now()).toISOString(),
        time: r?.elapsedMs ?? 0,
        request: {
          method: p.method,
          url: p.url,
          httpVersion: "HTTP/1.1",
          headers: harHeaders(p.headers),
          queryString,
          cookies: [],
          headersSize: -1,
          bodySize: postData && "text" in postData ? new TextEncoder().encode(postData.text).length : -1,
          ...(postData && { postData }),
        },
        response: r
          ? {
              status: r.status,
              statusText: r.statusText,
              httpVersion: r.httpVersion,
              headers: harHeaders(r.headers),
              cookies: [],
              content: {
                size: r.size,
                mimeType: r.headers.find((h) => /^content-type$/i.test(h.key))?.value ?? "",
                text: r.body,
                ...(r.bodyEncoding === "base64" && { encoding: "base64" }),
              },
              redirectURL: "",
              headersSize: -1,
              bodySize: r.size,
            }
          : { status: 0, statusText: "", httpVersion: "", headers: [], cookies: [], content: { size: 0, mimeType: "" }, redirectURL: "", headersSize: -1, bodySize: -1 },
        cache: {},
        timings: { send: 0, wait: r?.elapsedMs ?? 0, receive: 0 },
        comment: n.name,
      },
    ];
  });
  return {
    text: JSON.stringify({ log: { version: "1.2", creator: { name: "voidHTTP", version }, entries } }, null, 2),
    skipped,
  };
}
