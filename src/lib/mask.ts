/**
 * Masking for "Save as example": finds sensitive values by field name in a request and its response,
 * and returns masked copies. History never goes through here; it keeps responses as received.
 */
import type { HttpResponse, RequestDef } from "../types";
import { stripJsonComments } from "./jsonc";
import { urlWithParams } from "./model";

export type MaskStyle = "partial" | "full";

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
  | { t: "reqHeader" | "param" | "form" | "multipart" | "resHeader"; i: number }
  | { t: "auth"; field: "token" | "password" | "value" }
  | { t: "reqJson" | "resJson"; path: (string | number)[] };

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
 */
export function findSensitive(req: RequestDef, res: HttpResponse, extra: string[] = []): MaskGroup[] {
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
  const kv = (where: string, t: "reqHeader" | "param" | "form" | "multipart" | "resHeader", rows: { key: string; value: string; enabled?: boolean }[]) =>
    rows.forEach((r, i) => {
      const k = r.enabled !== false && r.key ? kindOf(r.key, names) : null;
      if (k) add(where, r.key, k, r.value, { t, i });
    });
  const walk = (where: string, t: "reqJson" | "resJson", v: unknown, path: (string | number)[]) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(where, t, x, [...path, i]));
    if (v && typeof v === "object") {
      for (const [key, x] of Object.entries(v)) {
        const p = [...path, key];
        if (typeof x === "string" || typeof x === "number") {
          const exact = jsonPathOf(p, false);
          const k = kindOf(key, names) ?? (patterns.some((re) => re.test(exact)) ? "pii" : null);
          if (k) add(where, jsonPathOf(p, true), k, String(x), { t, path: p });
        } else walk(where, t, x, p);
      }
    }
  };

  kv("Request header", "reqHeader", req.headers);
  kv("Request query", "param", req.params);
  const a = req.auth;
  if (a.type === "bearer") add("Request auth", "Bearer token", "secret", a.token, { t: "auth", field: "token" });
  if (a.type === "basic") add("Request auth", "Basic password", "secret", a.password, { t: "auth", field: "password" });
  if (a.type === "apikey") add("Request auth", a.key || "API key", "secret", a.value, { t: "auth", field: "value" });
  if (req.body.mode === "json") walk("Request body", "reqJson", parseJson(req.body.raw), []);
  if (req.body.mode === "form") kv("Request body", "form", req.body.form);
  if (req.body.mode === "multipart") kv("Request body", "multipart", req.body.multipart.filter((f) => f.kind === "text"));
  kv("Response header", "resHeader", res.headers);
  if (res.bodyEncoding === "utf8") walk("Response body", "resJson", parseJson(res.body), []);
  return [...groups.values()];
}

/** The masked form of one value. */
export function maskValue(value: string, kind: Kind, style: MaskStyle): string {
  const dots = (n: number) => "•".repeat(Math.max(2, Math.min(n, 12)));
  // keep the scheme of an auth header and the name of a cookie; the secret part goes
  const scheme = /^(Bearer|Basic|Digest|Token)\s+/i.exec(value);
  if (scheme) return `${scheme[0]}••••••••`;
  const cookie = /^([^=;\s]+)=([^;]*)(.*)$/.exec(value);
  if (cookie && kind === "secret" && cookie[2]) return `${cookie[1]}=••••••••${cookie[3]}`;
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

function setAt(root: unknown, path: (string | number)[], fn: (v: string) => string) {
  let cur = root as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]] as Record<string | number, unknown>;
  const last = path[path.length - 1];
  cur[last] = fn(String(cur[last]));
}

/** Masked copies of `req` and `res`, with the chosen groups replaced. */
export function applyMasks(req: RequestDef, res: HttpResponse, groups: MaskGroup[], style: MaskStyle): { request: RequestDef; response: HttpResponse } {
  const request = structuredClone(req);
  const response = structuredClone(res);
  const reqJson = request.body.mode === "json" ? parseJson(request.body.raw) : undefined;
  const resJson = response.bodyEncoding === "utf8" ? parseJson(response.body) : undefined;
  let reqJsonHit = false;
  let resJsonHit = false;
  let paramHit = false;
  for (const g of groups) {
    const m = (v: string) => maskValue(v, g.kind, style);
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
          response.headers[loc.i].value = m(response.headers[loc.i].value);
          break;
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
      }
    }
  }
  if (paramHit) request.url = urlWithParams(request.url, request.params);
  if (reqJsonHit) request.body.raw = JSON.stringify(reqJson, null, 2);
  if (resJsonHit) {
    response.body = response.body.includes("\n") ? JSON.stringify(resJson, null, 2) : JSON.stringify(resJson);
    response.size = new TextEncoder().encode(response.body).length;
  }
  return { request, response };
}
