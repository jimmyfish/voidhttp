/**
 * Masking for "Save as example": finds sensitive values by field name in a request and its response,
 * and returns masked copies. History never goes through here; it keeps responses as received.
 */
import type { Auth, GrpcResult, HttpResponse, RequestDef } from "../types";
import { stripJsonComments } from "./jsonc";
import { urlWithParams } from "./model";

export type MaskStyle = "partial" | "full";

/** What an example keeps from the server: an HTTP response, or an ended gRPC call. */
export type Received = HttpResponse | GrpcResult;
export const isGrpcResult = (r: Received): r is GrpcResult => Array.isArray((r as GrpcResult).messages);

/** Secrets: always fully masked, whatever the style. Matched after lower-casing and dropping - and _. */
const SECRET_EXACT = new Set([
  "authorization", "proxyauthorization", "cookie", "setcookie", "pin", "otp", "cvv", "cvc", "privatekey",
  "signature", "session", "sessionid", "sid", "passwd", "pwd",
]);
const SECRET_PART = ["token", "secret", "password", "apikey"];
/** Personal data: masked partially by default, so an example still reads like real data. */
const PII_EXACT = new Set([
  "email", "emailaddress", "phone", "phonenumber", "mobile", "mobilenumber", "msisdn", "nik", "ktp", "npwp",
  "name", "fullname", "firstname", "lastname", "customername", "mothermaidenname", "dob", "dateofbirth",
  "birthdate", "address", "accountnumber", "accountno", "cardnumber", "pan", "iban",
]);

type Kind = "secret" | "pii";

/** True for names that carry credentials (token, password, …). */
export const isSecretKey = (key: string) => kindOf(key, new Set()) === "secret";
const norm = (k: string) => k.toLowerCase().replace(/[-_\s]/g, "");

function kindOf(key: string, extra: Set<string>): Kind | null {
  const k = norm(key);
  if (SECRET_EXACT.has(k) || SECRET_PART.some((p) => k.includes(p))) return "secret";
  if (PII_EXACT.has(k) || extra.has(k)) return "pii";
  return null;
}

/** One place a value sits, so it can be replaced in a copy. */
type Loc =
  | { t: "reqHeader" | "param" | "form" | "multipart" | "resHeader" | "trailer"; i: number }
  | { t: "auth"; field: "token" | "password" | "value" }
  | { t: "reqJson" | "resJson" | "details"; path: (string | number)[] }
  /** a field inside one gRPC message, sent or received */
  | { t: "msgJson"; msg: number; path: (string | number)[] };

/** One line of the dialog: every value found under the same place, e.g. all of `$.data[*].email`. */
export interface MaskGroup {
  id: string;
  where: string;
  label: string;
  kind: Kind;
  /** first value found, to preview the mask */
  sample: string;
  locs: Loc[];
}

/** Values that are only a variable reference carry no secret. */
const isVarRef = (v: string) => /^\s*\{\{[^}]+\}\}\s*$/.test(v);

const jsonPathOf = (path: (string | number)[], wild: boolean) =>
  "$" + path.map((p) => (typeof p === "number" ? (wild ? "[*]" : `[${p}]`) : /^[A-Za-z_$][\w$]*$/.test(p) ? `.${p}` : `["${p}"]`)).join("");

/** A typed pattern like `$.data[*].phone` matched against a concrete path. */
function pathPattern(src: string): RegExp | null {
  const t = src.trim();
  if (!t.startsWith("$")) return null;
  // escape everything, then let [*] stand for any index
  const re = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\[\\\*\\\]/g, "\\[\\d+\\]");
  return new RegExp(`^${re}$`);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(stripJsonComments(text));
  } catch {
    return undefined;
  }
}

/**
 * Every sensitive place in `req` and `res`. `extra` holds what the person typed:
 * field or header names, or JSON paths starting with `$`.
 * For a gRPC call that is the metadata, every message sent or received, the trailers and the error details.
 */
export function findSensitive(req: RequestDef, res: Received, extra: string[] = []): MaskGroup[] {
  const names = new Set(extra.filter((x) => !x.trim().startsWith("$")).map(norm));
  const patterns = extra.map(pathPattern).filter((p): p is RegExp => !!p);
  const groups = new Map<string, MaskGroup>();
  const add = (where: string, label: string, kind: Kind, value: string, loc: Loc) => {
    if (!value || isVarRef(value)) return;
    const id = `${where}|${label}`;
    const g = groups.get(id);
    if (g) g.locs.push(loc);
    else groups.set(id, { id, where, label, kind, sample: value, locs: [loc] });
  };
  const kv = (where: string, t: "reqHeader" | "param" | "form" | "multipart" | "resHeader" | "trailer", rows: { key: string; value: string; enabled?: boolean }[]) =>
    rows.forEach((r, i) => {
      const k = r.enabled !== false && r.key ? kindOf(r.key, names) : null;
      if (k) add(where, r.key, k, r.value, { t, i });
    });
  const walk = (where: string, loc: (path: (string | number)[]) => Loc, v: unknown, path: (string | number)[]) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(where, loc, x, [...path, i]));
    if (v && typeof v === "object") {
      for (const [key, x] of Object.entries(v)) {
        const p = [...path, key];
        if (typeof x === "string" || typeof x === "number") {
          const exact = jsonPathOf(p, false);
          const k = kindOf(key, names) ?? (patterns.some((re) => re.test(exact)) ? "pii" : null);
          if (k) add(where, jsonPathOf(p, true), k, String(x), loc(p));
        } else walk(where, loc, x, p);
      }
    }
  };

  const grpc = isGrpcResult(res);
  kv(grpc ? "Request metadata" : "Request header", "reqHeader", req.headers);
  if (!grpc) kv("Request query", "param", req.params);
  const a = req.auth;
  if (a.type === "bearer") add("Request auth", "Bearer token", "secret", a.token, { t: "auth", field: "token" });
  if (a.type === "basic") add("Request auth", "Basic password", "secret", a.password, { t: "auth", field: "password" });
  if (a.type === "apikey") add("Request auth", a.key || "API key", "secret", a.value, { t: "auth", field: "value" });
  // a GraphQL request sends its variables, not its body
  if (req.method === "GQL") walk("GraphQL variables", (path) => ({ t: "reqJson", path }), parseJson(req.gql?.variables ?? ""), []);
  else if (req.body.mode === "json") walk(grpc ? "Request message" : "Request body", (path) => ({ t: "reqJson", path }), parseJson(req.body.raw), []);
  if (!grpc && req.body.mode === "form") kv("Request body", "form", req.body.form);
  if (!grpc && req.body.mode === "multipart") kv("Request body", "multipart", req.body.multipart.filter((f) => f.kind === "text"));
  if (grpc) {
    kv("Response metadata", "resHeader", res.headers);
    // sent messages too: a stream keeps what went out, so a masked request message must not survive there
    res.messages.forEach((m, msg) =>
      walk(m.dir === "in" ? "Received message" : "Sent message", (path) => ({ t: "msgJson", msg, path }), parseJson(m.json), []),
    );
    if (res.end) {
      kv("Response trailer", "trailer", res.end.trailers);
      if (res.end.details) walk("Error details", (path) => ({ t: "details", path }), parseJson(res.end.details), []);
    }
  } else {
    kv("Response header", "resHeader", res.headers);
    if (res.bodyEncoding === "utf8") walk("Response body", (path) => ({ t: "resJson", path }), parseJson(res.body), []);
  }
  return [...groups.values()];
}

const COOKIE_ATTRS = new Set(["path", "domain", "expires", "max-age", "samesite", "priority"]);
const COOKIE_FLAGS = new Set(["httponly", "secure", "partitioned"]);

/** A Cookie or Set-Cookie field, whose value is masked as name=value. */
export const isCookieName = (key: string) => /^(set-)?cookie2?$/i.test(key.trim());

/** The masked form of one value. */
export function maskValue(value: string, kind: Kind, style: MaskStyle, isCookie = false): string {
  const dots = (n: number) => "•".repeat(Math.max(2, Math.min(n, 12)));
  // keep the scheme of an auth header and the name of a cookie; the secret part goes.
  // Only a Cookie / Set-Cookie value is read as name=value: a base64 key ending in "==" would keep almost all of itself.
  const scheme = /^(Bearer|Basic|Digest|Token)\s+/i.exec(value);
  if (scheme) return `${scheme[0]}••••••••`;
  // every name=value pair goes, so `theme=dark; session=…` keeps no session; Set-Cookie attributes stay readable
  // a part with no name, or a value that is only "=" padding of a bare token, is masked whole
  if (isCookie && kind === "secret")
    return value
      .split(";")
      .map((part) => {
        const lead = /^\s*/.exec(part)![0];
        const body = part.slice(lead.length);
        const eq = body.indexOf("=");
        const name = eq === -1 ? body.trim() : body.slice(0, eq).trim();
        if (eq === -1) return !name || COOKIE_FLAGS.has(name.toLowerCase()) ? part : `${lead}••••••••`;
        const v = body.slice(eq + 1);
        if (COOKIE_ATTRS.has(name.toLowerCase())) return part;
        return /^=*$/.test(v) && v ? `${lead}••••••••` : `${lead}${body.slice(0, eq)}=${v ? "••••••••" : ""}`;
      })
      .join(";");
  if (kind === "secret" || style === "full") return "••••••••";
  const email = /^([^@\s])[^@\s]*(@.+)$/.exec(value);
  if (email) return `${email[1]}••${email[2]}`;
  // numbers like phone, NIK or account numbers keep their last four digits
  if (/^[+\d][\d\s-]{5,}$/.test(value)) {
    const digits = value.replace(/\D/g, "");
    return dots(digits.length - 4) + digits.slice(-4);
  }
  return value.replace(/\S+/g, (w) => w[0] + dots(w.length - 1));
}

/**
 * Values that went out in the query of `sentUrl` as secrets: secret-looking params, and API-key auth sent in the query.
 * A server may echo them back (a Link header, a "url" field), so they are looked for in the response too.
 */
export function sentSecrets(sentUrl: string, auth: Auth): string[] {
  const q = sentUrl.indexOf("?");
  if (q === -1) return [];
  const hash = sentUrl.indexOf("#", q);
  const out = new Set<string>();
  for (const pair of sentUrl.slice(q + 1, hash === -1 ? undefined : hash).split("&")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const decode = (s: string) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    };
    const key = decode(pair.slice(0, eq).replace(/\+/g, " "));
    const raw = pair.slice(eq + 1);
    if (raw.length < 8 || !(isSecretKey(key) || (auth.type === "apikey" && auth.in === "query" && key === auth.key))) continue;
    // the value as it went out, decoded, and encoded again: a server may echo any of them, JSON may escape "/" as "\/"
    for (const v of [raw, decode(raw), decode(raw.replace(/\+/g, " ")), encodeURIComponent(decode(raw))]) {
      out.add(v);
      out.add(v.replace(/\//g, "\\/"));
    }
  }
  // longest first, so a shorter form never splits a longer one before it is replaced
  return [...out].filter((v) => v.length >= 8).sort((a, b) => b.length - a.length);
}

/** `res` with every occurrence of `secrets` in its headers and text body replaced. */
export function scrubEchoes(res: HttpResponse, secrets: string[], replacement: string): HttpResponse {
  if (!secrets.length) return res;
  const scrub = (s: string) => secrets.reduce((acc, v) => acc.split(v).join(replacement), s);
  let body = res.bodyEncoding === "utf8" ? scrub(res.body) : res.body;
  // JSON may write a secret with \uXXXX escapes, which the text search cannot see: scrub the parsed strings too
  const doc = res.bodyEncoding === "utf8" ? parseJson(body) : undefined;
  if (doc !== undefined) {
    let hit = false;
    const walk = (v: unknown): unknown => {
      if (typeof v === "string") {
        const s = scrub(v);
        if (s !== v) hit = true;
        return s;
      }
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [walk(k) as string, walk(x)]));
      return v;
    };
    const out = walk(doc);
    if (hit) body = body.includes("\n") ? JSON.stringify(out, null, 2) : JSON.stringify(out);
  }
  return {
    ...res,
    headers: res.headers.map((h) => ({ ...h, value: scrub(h.value) })),
    body,
    size: body === res.body ? res.size : new TextEncoder().encode(body).length,
  };
}

/**
 * `g` with every occurrence of `secrets` emptied from its metadata, messages, trailers, error details and status
 * message. JSON is scrubbed through its parsed strings (keys and numbers too), so a message stays valid JSON;
 * a message nothing was found in keeps its exact text.
 */
export function scrubGrpcEchoes(g: GrpcResult, secrets: string[], replacement: string): GrpcResult {
  if (!secrets.length) return g;
  const scrub = (s: string) => secrets.reduce((acc, v) => acc.split(v).join(replacement), s);
  const scrubJson = (text: string): string => {
    const doc = parseJson(text);
    if (doc === undefined) return scrub(text);
    let hit = false;
    const walk = (v: unknown): unknown => {
      if (typeof v === "string" || typeof v === "number") {
        const s = scrub(String(v));
        if (s === String(v)) return v;
        hit = true;
        return s;
      }
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [walk(k) as string, walk(x)]));
      return v;
    };
    const out = walk(doc);
    return hit ? restringify(text, out) : text;
  };
  const rows = (list: { key: string; value: string }[]) => list.map((h) => ({ ...h, value: scrub(h.value) }));
  return {
    ...g,
    headers: rows(g.headers),
    messages: g.messages.map((m) => {
      const json = scrubJson(m.json);
      return json === m.json ? m : { ...m, json, size: new TextEncoder().encode(json).length };
    }),
    end: g.end && {
      ...g.end,
      message: scrub(g.end.message),
      details: g.end.details ? scrubJson(g.end.details) : g.end.details,
      trailers: rows(g.end.trailers),
    },
  };
}

function setAt(root: unknown, path: (string | number)[], fn: (v: string) => string) {
  let cur = root as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1 && cur && typeof cur === "object"; i++) cur = cur[path[i]] as Record<string | number, unknown>;
  // a path that no longer exists in the value is skipped, not thrown on
  if (!cur || typeof cur !== "object") return;
  const last = path[path.length - 1];
  if (last in cur) cur[last] = fn(String(cur[last]));
}

/** Keeps a JSON text on one line or pretty, as it was. */
const restringify = (was: string, doc: unknown) => (was.includes("\n") ? JSON.stringify(doc, null, 2) : JSON.stringify(doc));

/** Masked copies of `req` and `res`, with the chosen groups replaced. */
export function applyMasks<R extends Received>(req: RequestDef, res: R, groups: MaskGroup[], style: MaskStyle): { request: RequestDef; response: R } {
  const request = structuredClone(req);
  const copy = structuredClone(res) as Received;
  const http = isGrpcResult(copy) ? undefined : copy;
  const grpc = isGrpcResult(copy) ? copy : undefined;
  const gqlVars = request.method === "GQL" ? request.gql : undefined;
  const reqJson = gqlVars ? parseJson(gqlVars.variables) : request.body.mode === "json" ? parseJson(request.body.raw) : undefined;
  const resJson = http?.bodyEncoding === "utf8" ? parseJson(http.body) : undefined;
  // gRPC messages are parsed when a mask first reaches them
  const msgDocs = new Map<number, unknown>();
  const msgDoc = (i: number) => {
    if (!msgDocs.has(i)) msgDocs.set(i, parseJson(grpc!.messages[i].json));
    return msgDocs.get(i);
  };
  const detailsJson = grpc?.end?.details ? parseJson(grpc.end.details) : undefined;
  let reqJsonHit = false;
  let resJsonHit = false;
  let detailsHit = false;
  let paramHit = false;
  for (const g of groups) {
    const m = (v: string) => maskValue(v, g.kind, style, isCookieName(g.label));
    for (const loc of g.locs) {
      switch (loc.t) {
        case "reqHeader":
          request.headers[loc.i].value = m(request.headers[loc.i].value);
          break;
        case "param":
          request.params[loc.i].value = m(request.params[loc.i].value);
          paramHit = true;
          break;
        case "form":
          request.body.form[loc.i].value = m(request.body.form[loc.i].value);
          break;
        case "multipart": {
          // indexes were taken over text fields only
          const f = request.body.multipart.filter((x) => x.kind === "text")[loc.i];
          if (f) f.value = m(f.value);
          break;
        }
        case "resHeader":
          copy.headers[loc.i].value = m(copy.headers[loc.i].value);
          break;
        case "trailer": {
          const row = grpc?.end?.trailers[loc.i];
          if (row) row.value = m(row.value);
          break;
        }
        case "auth": {
          const a = request.auth as Record<string, string>;
          a[loc.field] = m(a[loc.field]);
          break;
        }
        case "reqJson":
          setAt(reqJson, loc.path, m);
          reqJsonHit = true;
          break;
        case "resJson":
          setAt(resJson, loc.path, m);
          resJsonHit = true;
          break;
        case "msgJson":
          if (grpc?.messages[loc.msg]) setAt(msgDoc(loc.msg), loc.path, m);
          break;
        case "details":
          setAt(detailsJson, loc.path, m);
          detailsHit = true;
          break;
      }
    }
  }
  if (paramHit) request.url = urlWithParams(request.url, request.params);
  if (reqJsonHit && gqlVars) gqlVars.variables = JSON.stringify(reqJson, null, 2);
  else if (reqJsonHit) request.body.raw = JSON.stringify(reqJson, null, 2);
  if (grpc) {
    for (const [i, doc] of msgDocs) {
      const msg = grpc.messages[i];
      if (doc === undefined) continue;
      msg.json = restringify(msg.json, doc);
      msg.size = new TextEncoder().encode(msg.json).length;
    }
    if (detailsHit && grpc.end && detailsJson !== undefined) grpc.end.details = restringify(grpc.end.details ?? "", detailsJson);
    // a gRPC address has no query, so nothing sent there can be echoed back
    return { request, response: grpc as R };
  }
  const response = http!;
  if (resJsonHit) {
    response.body = restringify(response.body, resJson);
    response.size = new TextEncoder().encode(response.body).length;
  }
  // the response URL is the one sent, with variables and query auth filled in; the masked template stands in for it,
  // and secrets sent in the query are masked wherever the server echoed them. This runs last, so field masks find
  // their keys; secret fields are masked whole, so no part of an echoed secret is left for it to miss.
  return { request, response: { ...scrubEchoes(response, sentSecrets(response.url, req.auth), maskValue("", "secret", style)), url: request.url } as R };
}
