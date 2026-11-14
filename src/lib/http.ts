import { invoke } from "@tauri-apps/api/core";
import type { HttpResponse, RequestDef, Settings } from "../types";
import { resolve, type VarScope, resolveWithin } from "./vars";
import { uid } from "./model";
import { stripJsonComments } from "./jsonc";

type WireKV = { key: string; value: string };
type WireBody =
  | { type: "text"; content: string }
  | { type: "formUrlEncoded"; fields: WireKV[] }
  | { type: "multipart"; fields: (WireKV & { kind: "text" | "file" })[] };

export interface Prepared {
  method: string;
  url: string;
  headers: WireKV[];
  body: WireBody | null;
}

const CONTENT_TYPES: Record<string, string> = {
  json: "application/json",
  xml: "application/xml",
  text: "text/plain",
};

/** UTF-8 then base64, in chunks: spreading a large credential into one call overflows the stack. */
function base64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Applies variables, auth and implicit headers. Pure: used by Send and by cURL export. */
export function prepare(req: RequestDef, scope: VarScope, budget?: number): Prepared {
  // `budget`: one allowance for the whole request when rendering a preview; left out (a send), each field gets the full one
  const shared = budget === undefined ? undefined : { left: budget };
  const r = (s: string) => (shared ? resolveWithin(s, scope, shared) : resolve(s, scope));
  let url = r(req.url);
  const headers: WireKV[] = req.headers
    .filter((h) => h.enabled && h.key)
    .map((h) => ({ key: r(h.key), value: r(h.value) }));
  const has = (name: string) => headers.some((h) => h.key.toLowerCase() === name.toLowerCase());

  const auth = req.auth;
  if (auth.type === "bearer" && auth.token && !has("authorization")) {
    headers.push({ key: "Authorization", value: `Bearer ${r(auth.token)}` });
  } else if (auth.type === "basic" && !has("authorization")) {
    const raw = `${r(auth.username)}:${r(auth.password)}`;
    const b64 = base64Utf8(raw);
    headers.push({ key: "Authorization", value: `Basic ${b64}` });
  } else if (auth.type === "apikey" && auth.key) {
    if (auth.in === "header") headers.push({ key: r(auth.key), value: r(auth.value) });
    else url += (url.includes("?") ? "&" : "?") + `${encodeURIComponent(r(auth.key))}=${encodeURIComponent(r(auth.value))}`;
  }

  let body: WireBody | null = null;
  const b = req.body;
  if (b.mode === "json" || b.mode === "text" || b.mode === "xml") {
    // JSON bodies may carry // and /* */ comments while editing; they never go on the wire
    body = { type: "text", content: r(b.mode === "json" ? stripJsonComments(b.raw) : b.raw) };
    if (!has("content-type")) headers.push({ key: "Content-Type", value: CONTENT_TYPES[b.mode] });
  } else if (b.mode === "form") {
    body = {
      type: "formUrlEncoded",
      fields: b.form.filter((f) => f.enabled && f.key).map((f) => ({ key: r(f.key), value: r(f.value) })),
    };
  } else if (b.mode === "multipart") {
    body = {
      type: "multipart",
      fields: b.multipart
        .filter((f) => f.enabled && f.key)
        .map((f) => ({ key: r(f.key), value: f.kind === "file" ? f.value : r(f.value), kind: f.kind })),
    };
  }

  return { method: req.method, url, headers, body };
}

export async function send(
  p: Prepared,
  settings: Settings,
  inflightId: string = uid(),
): Promise<HttpResponse> {
  return invoke<HttpResponse>("send_request", {
    request: {
      id: inflightId,
      method: p.method,
      url: p.url,
      headers: p.headers,
      body: p.body,
      options: {
        timeoutMs: settings.timeoutMs,
        followRedirects: settings.followRedirects,
        insecure: settings.insecure,
      },
    },
  });
}

export function cancel(inflightId: string): Promise<void> {
  return invoke("cancel_request", { id: inflightId });
}
