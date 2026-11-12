import type { Prepared } from "./http";
import type { Auth, KV, MultipartField, RequestBody, RequestDef } from "../types";
import { kv, paramsFromUrl } from "./model";

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function toCurl(p: Prepared): string {
  const parts = [`curl -X ${p.method} ${q(p.url)}`];
  for (const h of p.headers) parts.push(`-H ${q(`${h.key}: ${h.value}`)}`);
  if (p.body?.type === "text") parts.push(`--data-raw ${q(p.body.content)}`);
  if (p.body?.type === "formUrlEncoded")
    for (const f of p.body.fields) parts.push(`--data-urlencode ${q(`${f.key}=${f.value}`)}`);
  if (p.body?.type === "multipart")
    for (const f of p.body.fields) parts.push(`-F ${q(f.kind === "file" ? `${f.key}=@${f.value}` : `${f.key}=${f.value}`)}`);
  return parts.join(" \\\n  ");
}

// ---------- import ----------

/** True when pasted text is a curl command rather than a URL. */
export const looksLikeCurl = (text: string): boolean => /^\s*curl(\.exe)?\s/i.test(text);

export type ParsedCurl = Pick<RequestDef, "method" | "url" | "params" | "headers" | "body" | "auth">;

const ANSI: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", '"': '"', a: "\x07", b: "\b", e: "\x1b", f: "\f", v: "\v" };

/** Splits a command line into words the way bash would: quotes, $'…', backslash escapes and line continuations. */
export function shellWords(src: string): string[] {
  // Windows cmd (Chrome's "Copy as cURL (cmd)") escapes with ^ and continues lines with ^
  let s = src;
  if (/\^"/.test(s) || /\^\r?\n/.test(s)) s = s.replace(/\^\r?\n/g, " ").replace(/\^(.)/g, "$1");

  const out: string[] = [];
  let cur = "";
  let inWord = false;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "\n") { i += 2; continue; }
    if (c === "\\" && s[i + 1] === "\r" && s[i + 2] === "\n") { i += 3; continue; }
    if (/\s/.test(c)) {
      if (inWord) out.push(cur);
      cur = "";
      inWord = false;
      i++;
      continue;
    }
    inWord = true;
    if (c === "'") {
      const end = s.indexOf("'", i + 1);
      cur += s.slice(i + 1, end === -1 ? undefined : end);
      i = end === -1 ? s.length : end + 1;
    } else if (c === "$" && s[i + 1] === "'") {
      i += 2;
      while (i < s.length && s[i] !== "'") {
        if (s[i] === "\\" && i + 1 < s.length) {
          const n = s[i + 1];
          const hex = n === "x" ? s.slice(i + 2).match(/^[0-9a-fA-F]{1,2}/) : n === "u" ? s.slice(i + 2).match(/^[0-9a-fA-F]{1,4}/) : null;
          if (hex) {
            cur += String.fromCharCode(parseInt(hex[0], 16));
            i += 2 + hex[0].length;
          } else {
            cur += ANSI[n] ?? `\\${n}`;
            i += 2;
          }
        } else cur += s[i++];
      }
      i++;
    } else if (c === '"') {
      i++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === "\\" && '"\\$`\n'.includes(s[i + 1])) {
          if (s[i + 1] !== "\n") cur += s[i + 1];
          i += 2;
        } else cur += s[i++];
      }
      i++;
    } else if (c === "\\") {
      cur += s[i + 1] ?? "";
      i += 2;
    } else {
      cur += c;
      i++;
    }
  }
  if (inWord) out.push(cur);
  return out;
}

/** Short options this parser reads, by their long name. */
const SHORT: Record<string, string> = {
  X: "request", H: "header", d: "data", F: "form", u: "user", A: "user-agent",
  e: "referer", b: "cookie", G: "get", I: "head",
};
/** Short options that take a value (handled or not). */
const SHORT_VALUE = new Set("XHdFuAebocCmxwEKQrTUyYzP".split(""));
/** Long options that take a value; any other long option is treated as a switch. */
const LONG_VALUE = new Set([
  "request", "header", "data", "data-raw", "data-binary", "data-ascii", "data-urlencode", "json", "form", "form-string",
  "user", "user-agent", "referer", "cookie", "url", "oauth2-bearer",
  "output", "max-time", "connect-timeout", "proxy", "proxy-user", "write-out", "cookie-jar", "cacert", "capath", "cert",
  "cert-type", "key", "key-type", "pass", "upload-file", "range", "config", "retry", "retry-delay", "retry-max-time",
  "resolve", "connect-to", "interface", "limit-rate", "max-redirs", "max-filesize", "aws-sigv4", "ciphers", "dns-servers",
  "proto", "proto-redir", "unix-socket", "abstract-unix-socket", "noproxy", "preproxy", "trace", "trace-ascii", "stderr",
  "variable", "continue-at", "speed-limit", "speed-time", "time-cond", "local-port", "keepalive-time", "expect100-timeout",
  "happy-eyeballs-timeout-ms", "request-target", "hostpubmd5", "pubkey", "crlfile", "delegation", "login-options",
  "mail-from", "mail-rcpt", "mail-auth", "quote", "socks4", "socks4a", "socks5", "socks5-hostname", "tls-max",
]);

const looksJson = (s: string) => {
  const t = s.trim();
  if (!/^[[{]/.test(t)) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
};
const looksForm = (s: string) => s.includes("=") && !s.includes("\n") && s.split("&").every((p) => /^[^=\s]+(=|$)/.test(p));
const decodeForm = (s: string) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
};
/** --data-urlencode forms: "content", "=content", "name=content" (the @file forms are passed through). */
const urlencodeArg = (v: string) => {
  if (/^[^=]*@/.test(v) && !v.includes("=")) return v;
  const eq = v.indexOf("=");
  if (eq === -1) return encodeURIComponent(v);
  const name = v.slice(0, eq);
  return (name ? `${name}=` : "") + encodeURIComponent(v.slice(eq + 1));
};
const plausibleUrl = (s: string) => /^([a-z][a-z0-9+.-]*:\/\/|\{\{|localhost|\[|[\w-]+(\.[\w-]+)+|[\w.-]+:\d+)/i.test(s);

/** Reads a curl command into a request. Returns null when no URL is found. */
export function parseCurl(text: string): ParsedCurl | null {
  const words = shellWords(text.trim());
  if (!words.length || !/^curl(\.exe)?$/i.test(words[0])) return null;

  let method: string | undefined;
  let head = false;
  let get = false;
  const urls: string[] = [];
  const positionals: string[] = [];
  const headers: KV[] = [];
  const data: string[] = [];
  const formFields: MultipartField[] = [];
  let auth: Auth = { type: "none" };
  let json = false;

  const take = (name: string, value: string) => {
    switch (name) {
      case "request": method = value.toUpperCase(); break;
      case "header": {
        const c = value.indexOf(":");
        if (c === -1) {
          // "Name;" sends an empty header
          if (value.endsWith(";")) headers.push(kv(value.slice(0, -1).trim(), ""));
        } else {
          const v = value.slice(c + 1).trim();
          if (v) headers.push(kv(value.slice(0, c).trim(), v)); // "Name:" removes a header in curl
        }
        break;
      }
      case "data": case "data-raw": case "data-binary": case "data-ascii": data.push(value); break;
      case "data-urlencode": data.push(urlencodeArg(value)); break;
      case "json": data.push(value); json = true; break;
      case "form": case "form-string": {
        const eq = value.indexOf("=");
        const key = eq === -1 ? value : value.slice(0, eq);
        const v = eq === -1 ? "" : value.slice(eq + 1);
        if (name === "form" && v.startsWith("@")) formFields.push({ ...kv(key, v.slice(1).replace(/;(type|filename|headers)=.*$/, "")), kind: "file" });
        else formFields.push({ ...kv(key, v), kind: "text" });
        break;
      }
      case "user": {
        const c = value.indexOf(":");
        auth = { type: "basic", username: c === -1 ? value : value.slice(0, c), password: c === -1 ? "" : value.slice(c + 1) };
        break;
      }
      case "oauth2-bearer": auth = { type: "bearer", token: value }; break;
      case "user-agent": headers.push(kv("User-Agent", value)); break;
      case "referer": headers.push(kv("Referer", value.replace(/;auto$/, ""))); break;
      case "cookie": if (value.includes("=")) headers.push(kv("Cookie", value)); break; // otherwise a cookie file
      case "url": urls.push(value); break;
    }
  };
  const flag = (name: string) => {
    if (name === "get") get = true;
    else if (name === "head") head = true;
  };

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    if (w.startsWith("--") && w.length > 2) {
      const name = w.slice(2);
      if (LONG_VALUE.has(name)) take(name, words[++i] ?? "");
      else flag(name);
    } else if (w.startsWith("-") && w.length > 1) {
      // bundled short options: -sSL, -XPOST, -HAccept:x
      for (let j = 1; j < w.length; j++) {
        const ch = w[j];
        if (SHORT_VALUE.has(ch)) {
          const rest = w.slice(j + 1);
          const value = rest || (words[++i] ?? "");
          if (SHORT[ch]) take(SHORT[ch], value);
          break;
        }
        if (SHORT[ch]) flag(SHORT[ch]);
      }
    } else positionals.push(w);
  }

  let url = urls[0] ?? positionals.find(plausibleUrl) ?? positionals[0];
  if (!url) return null;

  const joined = data.join("&");
  if (json) {
    const has = (n: string) => headers.some((h) => h.key.toLowerCase() === n);
    if (!has("content-type")) headers.push(kv("Content-Type", "application/json"));
    if (!has("accept")) headers.push(kv("Accept", "application/json"));
  }

  const body: RequestBody = { mode: "none", raw: "", form: [], multipart: [] };
  if (get && data.length) {
    url += (url.includes("?") ? "&" : "?") + joined;
  } else if (formFields.length) {
    body.mode = "multipart";
    body.multipart = formFields;
  } else if (data.length) {
    const ctype = headers.find((h) => h.key.toLowerCase() === "content-type")?.value.toLowerCase() ?? "";
    if (ctype.includes("json") || (!ctype && looksJson(joined))) {
      body.mode = "json";
      body.raw = looksJson(joined) ? JSON.stringify(JSON.parse(joined), null, 2) : joined;
    } else if (ctype.includes("xml")) {
      body.mode = "xml";
      body.raw = joined;
    } else if ((!ctype || ctype.includes("x-www-form-urlencoded")) && looksForm(joined)) {
      body.mode = "form";
      body.form = joined.split("&").map((p) => {
        const eq = p.indexOf("=");
        return eq === -1 ? kv(decodeForm(p), "") : kv(decodeForm(p.slice(0, eq)), decodeForm(p.slice(eq + 1)));
      });
    } else {
      body.mode = "text";
      body.raw = joined;
    }
  }

  const sendsBody = body.mode !== "none";
  return {
    method: method ?? (head ? "HEAD" : sendsBody ? "POST" : "GET"),
    url,
    params: paramsFromUrl(url, []),
    headers,
    body,
    auth,
  };
}
