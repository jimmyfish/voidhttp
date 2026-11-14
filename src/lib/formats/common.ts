/**
 * Shared shapes for import and export. Every importer turns a file into an ImportPlan:
 * the collections and environments it would add, plus what changed on the way in.
 */
import { parse as parseYaml } from "yaml";
import type { Auth, Collection, Environment, KV, RequestDef, RequestNode, TreeNode } from "../../types";
import { isSecretKey, scrubEchoes, sentSecrets } from "../mask";
import { kv, parseQuery, urlWithParams } from "../model";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Any = any;

export type FormatId = "postman" | "postman-env" | "openapi" | "swagger" | "har" | "voidhttp" | "commands";

/** One line of "Changed on the way in". `code` spans are written between backticks. */
export interface Note {
  level: "warn" | "info";
  text: string;
}

/** Where the text came from: a file path lets OpenAPI read `$ref` files beside it, a URL lets it fetch them. */
export interface Source {
  name: string;
  text: string;
  path?: string;
  url?: string;
}

export interface ImportPlan {
  format: FormatId;
  /** e.g. "OpenAPI 3.0.3" */
  label: string;
  /** e.g. "trx-service API v1.4.0 · 3 files joined by $ref" */
  detail: string;
  collections: Collection[];
  environments: Environment[];
  notes: Note[];
}

/** JSON, or YAML when it is not JSON. A byte-order mark is dropped first. */
export function parseDoc(text: string): unknown {
  const t = text.replace(/^﻿/, "");
  try {
    return JSON.parse(t);
  } catch {
    // fall through to YAML
  }
  try {
    return parseYaml(t, { maxAliasCount: 1000 });
  } catch {
    return undefined;
  }
}

const COMMAND = /^\s*(curl|grpcurl)(\.exe)?\s/i;

/** What a file or pasted text is, by its content. */
export function detect(text: string): { format: FormatId; doc?: Any } | null {
  if (COMMAND.test(text)) return { format: "commands" };
  const doc = parseDoc(text) as Any;
  if (!doc || typeof doc !== "object") return null;
  if (doc.voidhttp) return { format: "voidhttp", doc };
  if (typeof doc.openapi === "string") return { format: "openapi", doc };
  if (doc.swagger) return { format: "swagger", doc };
  if (Array.isArray(doc.log?.entries)) return { format: "har", doc };
  if (Array.isArray(doc.item)) return { format: "postman", doc };
  if (Array.isArray(doc.values)) return { format: "postman-env", doc };
  return null;
}

/** A value that is only a variable reference carries no secret. */
export const isVarRef = (v: string) => /^\s*\{\{[^}]+\}\}\s*$/.test(v);

/** Requests below a set of nodes, depth first. */
export function requestsOf(nodes: TreeNode[]): RequestNode[] {
  return nodes.flatMap((n) => (n.type === "folder" ? requestsOf(n.children) : [n]));
}

// ---------- file fields on import ----------

/**
 * A multipart file row holds a path on this Mac, and Send uploads the file it names. A path that came
 * in with an imported file would let that file choose what leaves the machine (an SSH key, a token file),
 * so it is dropped and the person picks the file again. Returns the collections and a note naming the paths.
 */
export function dropFilePaths(collections: Collection[]): { collections: Collection[]; notes: Note[] } {
  const dropped = new Set<string>();
  const clear = <T extends RequestDef>(r: T): T => {
    const rows = r.body?.multipart;
    if (!Array.isArray(rows) || !rows.some((f) => f?.kind === "file" && f.value)) return r;
    const multipart = rows.map((f) => {
      if (f?.kind !== "file" || !f.value) return f;
      dropped.add(String(f.value));
      return { ...f, value: "" };
    });
    return { ...r, body: { ...r.body, multipart } };
  };
  const walk = (nodes: TreeNode[]): TreeNode[] =>
    nodes.map((n) => {
      if (n.type === "folder") return { ...n, children: walk(n.children) };
      const node = clear(n);
      return n.examples ? { ...node, examples: n.examples.map((e) => (e?.request ? { ...e, request: clear(e.request) } : e)) } : node;
    });
  const out = collections.map((c) => ({ ...c, children: walk(c.children) }));
  const paths = [...dropped];
  const notes: Note[] = paths.length
    ? [{ level: "warn", text: `File field${paths.length === 1 ? "" : "s"} left empty: ${paths.map((p) => `\`${p}\``).join(", ")}. Choose the file${paths.length === 1 ? "" : "s"} again before sending.` }]
    : [];
  return { collections: out, notes };
}

// ---------- secrets on export ----------

const blankKv = (rows: KV[]) => rows.map((r) => ({ ...r, value: "" }));
export const blankSecretKv = <T extends KV>(rows: T[]) => rows.map((r) => (isSecretKey(r.key) && !isVarRef(r.value) ? { ...r, value: "" } : r));

/** Rust's `str::trim`: Unicode white space at both ends, U+0085 included (JS `\s` leaves it). */
function rustTrim(s: string): string {
  const ws = (c: string) => /\s/.test(c) || c === "\u0085";
  let a = 0;
  let b = s.length;
  while (a < b && ws(s[a])) a++;
  while (b > a && ws(s[b - 1])) b--;
  return s.slice(a, b);
}

/**
 * The URL as the sender parses it (`normalize_url`: trim, `http://` when there is no "://", then WHATWG parsing),
 * with each `{{variable}}` held by a placeholder so templates parse too. Null when it does not parse.
 */
function parseTemplateUrl(url: string): { u: URL; back: (s: string) => string } | null {
  const vars: string[] = [];
  const tag = Math.random().toString(36).slice(2, 8); // a placeholder no real password will spell
  const held = url.replace(/\{\{[^{}]*\}\}/g, (m) => `zq${tag}v${vars.push(m) - 1}zq`);
  const t = rustTrim(held);
  try {
    const u = new URL(t.includes("://") ? t : `http://${t}`);
    return { u, back: (s: string) => s.replace(new RegExp(`zq${tag}v(\\d+)zq`, "g"), (_, i: string) => vars[Number(i)] ?? "") };
  } catch {
    return null;
  }
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/**
 * The user-info of a URL template the parser refuses until its variables are filled in (`{{host}}:{{port}}`,
 * `[{{ip}}]`): the authority after the first "//" runs to the next "/", "?", "#" or "\", and its user-info to the last "@".
 */
function userinfoByScan(url: string): { head: string; info: string; tail: string } | null {
  const t = rustTrim(url.replace(/[\t\n\r]/g, ""));
  // with no "://" the sender puts http:// in front, so the authority starts at the beginning
  const scheme = t.indexOf("://");
  let start = scheme === -1 ? 0 : scheme + 1;
  while (start < t.length && (t[start] === "/" || t[start] === "\\")) start++;
  let end = start;
  while (end < t.length && !"/?#\\".includes(t[end])) end++;
  const at = t.lastIndexOf("@", end - 1);
  return at < start ? null : { head: t.slice(0, start), info: t.slice(start, at), tail: t.slice(at + 1) };
}

/** The user name and password the sender would put in Basic auth for this URL, `{{variables}}` as written. */
function credentialsOf(url: string): { user: string; pass: string } | null {
  const p = parseTemplateUrl(url);
  if (p) return p.u.username || p.u.password ? { user: p.back(decode(p.u.username)), pass: p.back(decode(p.u.password)) } : null;
  const scan = userinfoByScan(url);
  if (!scan) return null;
  const colon = scan.info.indexOf(":");
  return colon === -1 ? { user: scan.info, pass: "" } : { user: scan.info.slice(0, colon), pass: scan.info.slice(colon + 1) };
}

/**
 * Whether a password leaves the user name as the credential itself: none, blank, a documented placeholder
 * (`x-oauth-basic`, `X`, `api_token`), or only `{{variables}}`, which may well be empty once filled in.
 */
const userIsKey = (pass: string) => !pass.trim() || onlyVars(pass) || DUMMY_PASSWORD.test(pass);

// placeholder passwords services document for "API key as the user name": GitHub x-oauth-basic, Freshdesk and
// BambooHR "X", Toggl api_token; any literal of three characters or fewer is read the same way
const DUMMY_PASSWORD = /^\s*(x-oauth-basic|api_token|\S{1,3})\s*$/i;

/** Only `{{variable}}` references (and white space): a template whose values are emptied instead. */
const onlyVars = (s: string) => /^\s*(\{\{[^{}]*\}\}\s*)+$/.test(s);

/** What stays of a user name and password: a literal password goes, and so does a user name that stands alone as a token. */
function keptCredentials(user: string, pass: string): { user: string; pass: string } | null {
  const passLiteral = !!pass.trim() && !onlyVars(pass);
  const userIsToken = !!user && !onlyVars(user) && userIsKey(pass);
  if (!passLiteral && !userIsToken) return null;
  return { user: userIsToken ? "" : user, pass: passLiteral ? "" : pass };
}

/**
 * The URL with literal credentials in its user-info emptied: the password of `user:pass@`, and a user name that
 * stands alone as a token (`token@`, `token:@`, `token:x-oauth-basic@`). `{{variables}}` stay; their values are emptied
 * instead. A URL without credentials comes back exactly as it was.
 */
export function stripUserinfo(url: string): string {
  const cred = credentialsOf(url);
  const kept = cred && keptCredentials(cred.user, cred.pass);
  if (!kept) return url;
  const p = url.includes("://") ? parseTemplateUrl(url) : null; // without a scheme the text is kept as written
  if (p) {
    p.u.username = kept.user ? p.u.username : "";
    p.u.password = kept.pass ? p.u.password : "";
    return p.back(p.u.href);
  }
  const scan = userinfoByScan(url);
  if (!scan) return url;
  const info = kept.user + (kept.pass ? `:${kept.pass}` : "");
  return scan.head + (info ? `${info}@` : "") + scan.tail;
}

/** A variable value is read as an address when it has a scheme or starts with `user:pass@`, so `alice@example.com` stays a value. */
const addressLike = (v: string) => v.includes("://") || SCHEMELESS_ADDRESS.test(v);

// `user:pass@host` with no scheme, where the host really is one (a dotted name, an IP or [IPv6], localhost, name:port,
// a {{variable}}, or a Go DSN tcp(...)), up to a path, a DSN separator (; ,) or the end: `acct:alice@example.com` or `nginx:1.25@sha256:…` are not
const SCHEMELESS_ADDRESS =
  /^\s*(?!(?:mailto|smtp|sips?|tel|xmpp|news|urn|data|acct|cid|mid|tag|im|pres):)[^\s/?#@:]+:[^\s/?#@]*@(?:\{\{|\w+\(|(?:localhost|[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+\.?|\[[0-9A-Fa-f:.]+\]|[\p{L}\p{N}_-]+(?=:\d))(?::\d+)?(?=[/?#;,]|\s*$))/iu;

/** A string from imported data that may be anything: numbers and booleans are written out, objects become "". */
export const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "");

/**
 * A variable value on "Blank": an address loses its user-info password and its secret query params (as a request
 * URL does), a JSON value loses its secret fields; anything else is kept.
 */
/** JSON text: an object or array, not a value that only starts with a {{variable}}. */
const jsonLike = (v: string) => /^\s*(\[|\{(?!\{))/.test(v);

function scrubVarValue(v: string): string {
  if (jsonLike(v)) return blankSecretJson(v);
  if (/^\s*</.test(v)) return blankSecretXml(v);
  // an address, whole or built from other variables ({{base}}/v1?api_key=…), with or without a scheme
  return scrubQuery(addressLike(v) ? stripUserinfo(v) : v);
}

/** The URL with the values of its secret-looking query params emptied; `{{variables}}` stay. Unchanged when there are none. */
function scrubQuery(url: string): string {
  const params = parseQuery(url);
  const hit = params.some((p) => isSecretKey(p.key) && p.value && !isVarRef(p.value));
  return hit ? urlWithParams(url, params.map((p) => kv(p.key, isSecretKey(p.key) && !isVarRef(p.value) ? "" : p.value))) : url;
}

/** At most this many rows in one table of an imported request; more is no real request, and the editor would hang. */
const MAX_ROWS = 1000;

/** Imported requests with each table cut to MAX_ROWS rows. The URL keeps its whole query, so what is sent does not change. */
/** One request with each table cut to MAX_ROWS rows (a pasted cURL command goes through this too). */
export function capRequest<T extends RequestDef>(r: T): T {
  const over = [r.params, r.headers, r.body.form, r.body.multipart].some((rows) => rows.length > MAX_ROWS);
  if (!over) return r;
  return {
    ...r,
    params: r.params.slice(0, MAX_ROWS),
    headers: r.headers.slice(0, MAX_ROWS),
    body: { ...r.body, form: r.body.form.slice(0, MAX_ROWS), multipart: r.body.multipart.slice(0, MAX_ROWS) },
  };
}

/** Imported collections with every table cut to MAX_ROWS rows: request tables, example response headers, variables. */
export function capRows(collections: Collection[]): Collection[] {
  // at most MAX_NODES requests and folders in one import: the sidebar lists every one, on every launch
  let left = MAX_NODES;
  const walk = (nodes: TreeNode[]): TreeNode[] =>
    nodes.flatMap((n): TreeNode[] => {
      if (left <= 0) return [];
      left--;
      if (n.type === "folder") return [{ ...n, children: walk(n.children) }];
      return [
        {
          ...capRequest(n),
          examples: n.examples?.slice(0, MAX_ROWS).map((e) => ({ ...e, request: capRequest(e.request), response: e.response && { ...e.response, headers: e.response.headers.slice(0, MAX_ROWS) } })),
        },
      ];
    });
  // each collection counts too: the sidebar lists every one
  return collections.flatMap((c) => (left-- > 0 ? [{ ...c, variables: c.variables.slice(0, MAX_ROWS), children: walk(c.children) }] : []));
}

/** More requests and folders than any real import holds. */
const MAX_NODES = 10000;

/** Imported environments: at most MAX_ROWS of them, with at most MAX_ROWS variables each. */
export const capEnvironments = (envs: Environment[]): Environment[] => envs.slice(0, MAX_ROWS).map((e) => ({ ...e, variables: e.variables.slice(0, MAX_ROWS) }));

/** Basic auth with what stays of it: a literal password goes, and a user name that stands alone as a token. */
function basicKept(a: Extract<Auth, { type: "basic" }>): Auth {
  const kept = keptCredentials(a.username, a.password);
  return kept ? { ...a, username: kept.user, password: kept.pass } : a;
}

/** Literal tokens and passwords in a request are emptied; `{{variables}}` stay. */
export function scrubRequest<T extends RequestDef>(r: T): T {
  const a = r.auth;
  const auth =
    a.type === "bearer" && !isVarRef(a.token)
      ? { ...a, token: "" }
      : a.type === "basic"
        ? basicKept(a) // same rule as user-info: `sk_live_…:` is the key itself
        : a.type === "apikey" && !isVarRef(a.value)
          ? { ...a, value: "" }
          : a;
  const params = blankSecretKv(r.params);
  // the URL carries its own query, which the table may not list in full: its secret params are emptied there
  const rebuilt = scrubQuery(r.url);
  // a password in the URL itself (https://user:pass@host) goes too
  const url = stripUserinfo(rebuilt);
  return {
    ...r,
    url,
    auth,
    headers: blankSecretKv(r.headers),
    params,
    body: {
      ...r.body,
      raw:
        r.body.mode === "json" || (r.body.mode === "text" && /^\s*[{[]/.test(r.body.raw))
          ? blankSecretJson(r.body.raw)
          : r.body.mode === "xml"
            ? blankSecretXml(r.body.raw)
            : r.body.mode === "text"
              ? r.body.raw
              : blankSecretXml(blankSecretJson(r.body.raw)), // text a form or no-body request keeps from an earlier mode
      form: blankSecretKv(r.body.form),
      multipart: blankSecretKv(r.body.multipart),
    },
  };
}

/**
 * A JSON body with the string values of secret-looking fields emptied, and every string inside an array or object
 * held by such a field. One pass over the text, so bodies the editor allows but JSON.parse refuses (comments,
 * unquoted `{{vars}}`) are covered, everything else keeps its exact text, and the time stays linear.
 */
// a {{variable}} starting exactly at lastIndex; it stops at the next brace, so each try is short
const VAR_AT = /\{\{[^{}]*\}\}/y;

function blankSecretJson(raw: string, onSecretRef?: (ref: string) => void): string {
  const n = raw.length;
  const stringEnd = (i: number) => {
    let j = i + 1;
    while (j < n && raw[j] !== '"') j += raw[j] === "\\" ? 2 : 1;
    return Math.min(j + 1, n);
  };
  const commentEnd = (i: number) => {
    const close = raw[i + 1] === "/" ? "\n" : "*/";
    const at = raw.indexOf(close, i + 2);
    return at === -1 ? n : at + close.length;
  };
  const skipBlank = (i: number) => {
    while (i < n) {
      if (/\s/.test(raw[i])) i++;
      else if (raw[i] === "/" && (raw[i + 1] === "/" || raw[i + 1] === "*")) i = commentEnd(i);
      else break;
    }
    return i;
  };
  let out = "";
  let i = 0;
  let depth = 0;
  let secretFrom = -1; // depth of the array or object a secret field holds; -1 outside one
  let secretName = ""; // that field's name
  let key: string | null = null; // the field whose value comes next
  while (i < n) {
    const c = raw[i];
    if (c === '"') {
      const end = stringEnd(i);
      const after = skipBlank(end);
      if (raw[after] === ":") {
        key = raw.slice(i + 1, end - 1);
        out += raw.slice(i, after + 1);
        i = after + 1;
        continue;
      }
      const value = raw.slice(i + 1, end - 1);
      const secret = secretFrom >= 0 || (key !== null && isSecretKey(key));
      if (secret && value) onSecretRef?.(value);
      out += secret && value && !isVarRef(value) ? '""' : raw.slice(i, end);
      key = null;
      i = end;
      continue;
    }
    // an unquoted {{variable}} (the editor allows them): reported when it sits under a secret field
    if (c === "{" && raw[i + 1] === "{") {
      VAR_AT.lastIndex = i;
      const hit = VAR_AT.exec(raw);
      if (hit) {
        const ref = hit[0];
        const close = i + ref.length - 2;
        if (secretFrom >= 0 || (key !== null && isSecretKey(key))) onSecretRef?.(ref);
        out += ref;
        key = null;
        i = close + 2;
        continue;
      }
    }
    // a number under a secret field (a pin, a cvv); "token" names are left alone, since those are mostly counts
    const numberOwner = key !== null && isSecretKey(key) ? key : secretFrom >= 0 ? secretName : null;
    if ((c === "-" || (c >= "0" && c <= "9")) && numberOwner !== null && !/token/i.test(numberOwner)) {
      let j = i + 1;
      while (j < n && /[\d.eE+-]/.test(raw[j])) j++;
      out += '""';
      key = null;
      i = j;
      continue;
    }
    if (c === "/" && (raw[i + 1] === "/" || raw[i + 1] === "*")) {
      const end = commentEnd(i);
      out += raw.slice(i, end);
      i = end;
      continue;
    }
    if (c === "{" || c === "[") {
      if (secretFrom < 0 && key !== null && isSecretKey(key)) {
        secretFrom = depth;
        secretName = key;
      }
      depth++;
      key = null;
    } else if (c === "}" || c === "]") {
      depth--;
      if (depth === secretFrom) secretFrom = -1;
    } else if (c === ",") key = null;
    out += c;
    i++;
  }
  return out;
}

/** An XML body with the text of secret-looking elements (`<password>`, `<ns:apiKey>`) emptied. */
/** Each secret-looking XML element (`<password>`, `<ns:apiKey>`) with the content up to its closing tag. */
function* secretXmlElements(raw: string): Generator<{ open: string; tag: string; from: number; to: number; inner: string }> {
  // every closing tag, by exact name, in order: `</token>` is not `</tokenType>`
  const closes = new Map<string, number[]>();
  for (const m of raw.matchAll(/<\/([A-Za-z_][\w:.-]*)\s*>/g)) {
    const list = closes.get(m[1]) ?? [];
    list.push(m.index!);
    closes.set(m[1], list);
  }
  const next = new Map<string, number>(); // per tag, the first closing tag not yet passed
  const OPEN = /<([A-Za-z_][\w:.-]*)(\s[^<>]*)?>/g;
  for (let m = OPEN.exec(raw); m; m = OPEN.exec(raw)) {
    const tag = m[1];
    if (!isSecretKey(tag.split(":").pop() ?? tag)) continue;
    const from = m.index + m[0].length;
    const list = closes.get(tag) ?? [];
    let k = next.get(tag) ?? 0;
    while (k < list.length && list[k] < from) k++;
    next.set(tag, k);
    if (k === list.length) continue;
    const close = list[k];
    yield { open: m[0], tag, from, to: close, inner: raw.slice(from, close) };
    OPEN.lastIndex = close;
  }
}


/** An XML body with the content of secret-looking elements emptied, whatever it holds (text, CDATA, comments, child elements). */
function blankSecretXml(raw: string): string {
  let out = "";
  let at = 0;
  for (const el of secretXmlElements(raw)) {
    if (!el.inner.trim() || isVarRef(el.inner.trim())) continue;
    out += raw.slice(at, el.from);
    at = el.to;
  }
  return out + raw.slice(at);
}

function scrubNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((n) =>
    n.type === "folder"
      ? { ...n, children: scrubNodes(n.children) }
      : {
          ...scrubRequest(n),
          examples: n.examples?.map((e) => {
            const request = scrubRequest(e.request);
            // the response URL is the one sent, with variables filled in: the scrubbed template replaces it,
            // and its secrets are emptied wherever the server echoed them (Link headers, a "url" field)
            const response = e.response && { ...scrubEchoes(e.response, sentSecrets(e.response.url, e.request.auth), ""), url: request.url };
            return { ...e, request, response };
          }),
        },
  );
}


/**
 * Variables a request uses as a credential: in an auth field, a secret-looking header, param, form row or body field,
 * or the password of the URL, in a request or in one of its saved examples. Whatever they are called (`{{jwt}}`,
 * `{{pass}}`), their values are credentials, and so are the variables those values use in turn. `layers` are
 * further variable lists (an environment) whose values are followed too.
 */
export function secretVarNames(c: Collection, ...layers: KV[][]): Set<string> {
  const names = new Set<string>();
  const queue: string[] = []; // names whose own values are still to be read
  const take = (s: unknown) => {
    for (const m of String(s ?? "").matchAll(/\{\{([^{}]*)\}\}/g)) {
      const n = m[1].trim();
      if (n && !names.has(n)) {
        names.add(n);
        queue.push(n);
      }
    }
  };
  const requests = requestsOf(c.children).flatMap((r): RequestDef[] => [r, ...(r.examples ?? []).map((e) => e.request).filter(Boolean)]);
  for (const r of requests) {
    const a = r.auth as Record<string, unknown>;
    take(a.token);
    take(a.password);
    // a user name with no real password is the credential itself (`curl -u sk_live_…:`, `token:x-oauth-basic`)
    if (r.auth.type === "basic" && userIsKey(r.auth.password)) take(r.auth.username);
    take(a.value);
    for (const row of [...r.headers, ...r.params, ...r.body.form, ...r.body.multipart]) if (isSecretKey(row.key)) take(row.value);
    // the URL's own query, which the params table may not list in full
    for (const p of parseQuery(r.url)) if (isSecretKey(p.key)) take(p.value);
    const cred = credentialsOf(r.url);
    if (cred && userIsKey(cred.pass)) take(cred.user);
    take(cred?.pass);
    for (const el of secretXmlElements(r.body.raw)) take(el.inner);
    blankSecretJson(r.body.raw, take);
  }
  // a credential variable may be built from other variables: those hold the credential too
  const values = new Map<string, string[]>();
  for (const v of [...c.variables, ...layers.flat()]) {
    // a secret-looking variable that only points at another ({{token}} = {{bot}}): the one it points at holds the secret
    if (isSecretKey(v.key)) take(v.value);
    const list = values.get(v.key);
    if (list) list.push(v.value);
    else values.set(v.key, [v.value]);
    // a variable holding a whole address may carry {{user}}:{{pass}}@ in it
    const cred = addressLike(v.value) ? credentialsOf(v.value) : null;
    take(cred?.user);
    take(cred?.pass);
    // an address held in a variable may carry ?token={{t}}; a JSON value may hold "password": "{{p}}"
    for (const p of parseQuery(v.value)) if (isSecretKey(p.key)) take(p.value);
    if (jsonLike(v.value)) blankSecretJson(v.value, take);
    if (/^\s*</.test(v.value)) for (const el of secretXmlElements(v.value)) take(el.inner);
  }
  // each name is followed once: `take` queues a name the first time it is seen
  while (queue.length) for (const v of values.get(queue.pop()!) ?? []) take(v);
  return names;
}

/**
 * The environment HAR export fills variables from on "Blank": secret-looking values and the variables a request
 * uses as a credential are emptied, user-info passwords are stripped; addresses stay, since a URL needs them.
 */
export function blankHarEnv(c: Collection, vars: KV[]): KV[] {
  const used = secretVarNames(c, vars);
  return blankSecretKv(vars).map((v) => (used.has(v.key) ? { ...v, value: "" } : { ...v, value: scrubVarValue(v.value) }));
}

/** "Blank": environment values emptied, plus secret-looking collection values and literal credentials in requests. */
export function blankValues(c: Collection, envs: Environment[], followThrough: KV[][] = []): { collection: Collection; environments: Environment[] } {
  // `followThrough`: variables that link a credential to collection values without being exported (the active environment)
  const used = secretVarNames(c, ...envs.map((e) => e.variables), ...followThrough);
  return {
    collection: {
      ...c,
      variables: blankSecretKv(c.variables).map((v) => (used.has(v.key) ? { ...v, value: "" } : { ...v, value: scrubVarValue(v.value) })),
      children: scrubNodes(c.children),
    },
    environments: envs.map((e) => ({ ...e, variables: blankKv(e.variables) })),
  };
}

/** A file name from a collection name: lower-case, no characters macOS or other systems choke on. */
export const fileStem = (name: string) =>
  name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase() || "collection";
