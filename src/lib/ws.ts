import { Channel, invoke } from "@tauri-apps/api/core";
import type { RequestDef, Settings, WsClose, WsDef, WsMessage } from "../types";
import { prepare } from "./http";
import { resolve, type VarScope } from "./vars";
import { stripJsonComments } from "./jsonc";

export const isWs = (r: { method: string }) => r.method === "WS";

export const defaultWs = (): WsDef => ({ subprotocols: [], pingSec: 0 });

/** Close codes worth a name (RFC 6455 §7.4.1); others show as their number. */
export const CLOSE_NAMES: Record<number, string> = {
  1000: "Normal closure",
  1001: "Going away",
  1002: "Protocol error",
  1003: "Unsupported data",
  1005: "No status",
  1006: "Abnormal closure",
  1007: "Invalid payload",
  1008: "Policy violation",
  1009: "Message too big",
  1010: "Missing extension",
  1011: "Internal error",
  1012: "Service restart",
  1013: "Try again later",
  1015: "TLS handshake",
};

/** A close that ended well: a normal one, or the server going away on purpose. */
export const closeOk = (c: Pick<WsClose, "code">) => c.code === 1000 || c.code === 1001;

// ---------- wire shapes (see src-tauri/src/ws.rs) ----------

export interface PreparedWs {
  url: string;
  headers: { key: string; value: string }[];
  subprotocols: string[];
  insecure: boolean;
  pingSec: number;
  timeoutMs: number;
}

type Pair = { key: string; value: string };

export type WsEvent =
  | { type: "open"; status: number; statusText: string; requestHeaders: Pair[]; responseHeaders: Pair[]; protocol?: string | null; elapsedMs: number }
  | { type: "refused"; status: number; statusText: string; requestHeaders: Pair[]; responseHeaders: Pair[]; body: string; elapsedMs: number }
  | ({ type: "message" } & WsMessage)
  | ({ type: "close" } & WsClose);

/** Variables, query params and auth applied, as the engine needs them. */
export function prepareWs(req: RequestDef, scope: VarScope, settings: Settings): PreparedWs {
  const def = req.ws ?? defaultWs();
  const p = prepare({ ...req, body: { ...req.body, mode: "none" } }, scope);
  return {
    url: p.url.trim(),
    headers: p.headers,
    subprotocols: def.subprotocols.map((s) => resolve(s, scope).trim()).filter(Boolean),
    insecure: settings.insecure,
    pingSec: Math.max(0, Math.floor(def.pingSec || 0)),
    timeoutMs: settings.timeoutMs,
  };
}

/** The editor's message as it goes on the wire: variables filled in; comments dropped when it is JSON. */
export function wsMessageText(req: RequestDef, scope: VarScope): string {
  const raw = req.body.mode === "json" ? stripJsonComments(req.body.raw) : req.body.raw;
  return resolve(raw, scope);
}

/** Runs a connection until it closes; events arrive on `onEvent`. Rejects only when it never opened. */
export function connectWs(id: string, prepared: PreparedWs, onEvent: (e: WsEvent) => void): Promise<void> {
  const channel = new Channel<WsEvent>();
  channel.onmessage = onEvent;
  return invoke("ws_connect", { request: { id, ...prepared }, onEvent: channel });
}

export const wsSend = (id: string, message: string) => invoke<void>("ws_send", { id, message });
export const wsClose = (id: string) => invoke<void>("ws_close", { id });

/** The first bytes of a base64 frame as hex, for one line in the list. */
export function hexPreview(b64: string, max = 48): string {
  let bin = "";
  try {
    bin = atob(b64.slice(0, Math.ceil((max * 4) / 3) + 4));
  } catch {
    return "";
  }
  const out: string[] = [];
  for (let i = 0; i < Math.min(bin.length, max); i++) out.push(bin.charCodeAt(i).toString(16).padStart(2, "0"));
  return out.join(" ");
}

/** A full hex dump: offset, 16 bytes per line. */
export function hexDump(b64: string, maxBytes = 4096): string {
  let bin = "";
  try {
    bin = atob(b64);
  } catch {
    return "";
  }
  const n = Math.min(bin.length, maxBytes);
  const lines: string[] = [];
  for (let off = 0; off < n; off += 16) {
    const bytes: string[] = [];
    let text = "";
    for (let i = off; i < Math.min(off + 16, n); i++) {
      const c = bin.charCodeAt(i);
      bytes.push(c.toString(16).padStart(2, "0"));
      text += c >= 0x20 && c < 0x7f ? bin[i] : ".";
    }
    lines.push(`${off.toString(16).padStart(8, "0")}  ${bytes.join(" ").padEnd(47)}  ${text}`);
  }
  if (bin.length > n) lines.push(`… ${bin.length - n} more bytes`);
  return lines.join("\n");
}
