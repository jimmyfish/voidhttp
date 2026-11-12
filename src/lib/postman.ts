/**
 * Postman Collection v2.0/v2.1 and Environment importer.
 * Scripts (pre-request/tests) are not executed by voidHTTP and are dropped.
 */
import type { Auth, Collection, Environment, KV, RequestBody, TreeNode } from "../types";
import { kv, newRequest, paramsFromUrl, uid } from "./model";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const toKV = (list: Any[] | undefined): KV[] =>
  (list ?? []).map((x) => kv(String(x.key ?? ""), String(x.value ?? ""), !x.disabled && x.enabled !== false));

function pick(list: Any[] | undefined, key: string): string {
  return String((list ?? []).find((x) => x.key === key)?.value ?? "");
}

function convertAuth(a: Any): Auth | undefined {
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
    default:
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

function convertItems(items: Any[], parentAuth: Auth): TreeNode[] {
  return (items ?? []).map((it: Any): TreeNode => {
    if (Array.isArray(it.item)) {
      const auth = convertAuth(it.auth) ?? parentAuth;
      return { type: "folder", id: uid(), name: String(it.name ?? "Folder"), children: convertItems(it.item, auth) };
    }
    const r = it.request ?? {};
    const url = typeof r === "string" ? r : typeof r.url === "string" ? r.url : String(r.url?.raw ?? "");
    const req = newRequest({
      name: String(it.name ?? "Request"),
      method: String(r.method ?? "GET").toUpperCase(),
      url,
      headers: typeof r === "string" ? [] : toKV(r.header),
      body: convertBody(r.body),
      auth: convertAuth(r.auth) ?? parentAuth,
    });
    req.params = paramsFromUrl(url, []);
    // carry over disabled query params from the structured url
    for (const qp of r.url?.query ?? []) if (qp.disabled) req.params.push(kv(qp.key ?? "", qp.value ?? "", false));
    return { type: "request", ...req };
  });
}

export type ImportResult =
  | { kind: "collection"; collection: Collection }
  | { kind: "environment"; environment: Environment };

export function importPostman(text: string): ImportResult {
  let data: Any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON");
  }
  if (Array.isArray(data.item)) {
    const rootAuth = convertAuth(data.auth) ?? { type: "none" };
    return {
      kind: "collection",
      collection: {
        id: uid(),
        name: String(data.info?.name ?? "Imported collection"),
        children: convertItems(data.item, rootAuth),
        variables: toKV(data.variable),
      },
    };
  }
  if (Array.isArray(data.values)) {
    return {
      kind: "environment",
      environment: { id: uid(), name: String(data.name ?? "Imported environment"), variables: toKV(data.values) },
    };
  }
  throw new Error("Not a Postman collection (v2.x) or environment export");
}
