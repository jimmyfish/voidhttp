import { Channel, invoke } from "@tauri-apps/api/core";
import type { RequestDef, Settings, SioDef, WsClose, WsHandshake, WsMessage } from "../types";
import { prepare } from "./http";
import { resolve, type VarScope } from "./vars";
import { stripJsonComments } from "./jsonc";

export const isSio = (r: { method: string }) => r.method === "SIO";
/** A WebSocket or Socket.IO tab: Connect / Disconnect, a live list in `tab.ws`. */
export const isSocket = (r: { method: string }) => r.method === "WS" || r.method === "SIO";

export const defaultSio = (): SioDef => ({ namespace: "/", path: "/socket.io", eio: 4, auth: "", event: "message", ack: false, ackTimeoutMs: 5000 });

// ---------- wire shapes (see src-tauri/src/sio.rs) ----------

export interface PreparedSio {
  url: string;
  headers: { key: string; value: string }[];
  path: string;
  namespace: string;
  auth: unknown;
  eio: 3 | 4;
  insecure: boolean;
  timeoutMs: number;
}

export type SioEvent =
  | ({ type: "open" } & WsHandshake)
  | ({ type: "refused" } & WsHandshake)
  | { type: "engine"; sid: string; upgrades: string[]; pingInterval: number; pingTimeout: number; maxPayload?: number; atMs: number }
  | { type: "joined"; namespace: string; sid?: string; atMs: number }
  | { type: "connectError"; namespace: string; message: string; data?: string; atMs: number }
  | ({ type: "message" } & WsMessage)
  | { type: "ackTimeout"; ackId: number; atMs: number }
  | ({ type: "close" } & WsClose);

/** Variables, query params, auth and the handshake auth applied. Throws when the handshake auth is not JSON. */
export function prepareSio(req: RequestDef, scope: VarScope, settings: Settings): PreparedSio {
  const def = req.sio ?? defaultSio();
  const p = prepare({ ...req, body: { ...req.body, mode: "none" } }, scope);
  let auth: unknown = null;
  const rawAuth = stripJsonComments(resolve(def.auth, scope)).trim();
  if (rawAuth && def.eio === 4) {
    try {
      auth = JSON.parse(rawAuth);
    } catch (e) {
      throw new Error(`Handshake auth is not valid JSON: ${(e as Error).message}`);
    }
  }
  return {
    url: p.url.trim(),
    headers: p.headers,
    path: resolve(def.path, scope).trim(),
    namespace: resolve(def.namespace, scope).trim(),
    auth,
    eio: def.eio,
    insecure: settings.insecure,
    timeoutMs: settings.timeoutMs,
  };
}

/** The next emit as it goes on the wire: the event name and its one argument (none when the editor is empty). */
export function sioEmitOf(req: RequestDef, scope: VarScope): { event: string; args: unknown[] } {
  const def = req.sio ?? defaultSio();
  const event = resolve(def.event, scope).trim();
  const raw = req.body.raw;
  if (!raw.trim()) return { event, args: [] };
  if (req.body.mode === "text") return { event, args: [resolve(raw, scope)] };
  const text = resolve(stripJsonComments(raw), scope);
  try {
    return { event, args: [JSON.parse(text)] };
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }
}

/** The handshake auth for display and history: every string value masked. */
export function maskAuth(auth: unknown): string | undefined {
  if (auth === null || auth === undefined) return undefined;
  const mask = (v: unknown): unknown =>
    typeof v === "string" ? "••••••••" : Array.isArray(v) ? v.map(mask) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mask(x)])) : v;
  return JSON.stringify(mask(auth));
}

/** Runs a connection until it closes; events arrive on `onEvent`. Rejects only when the socket never opened. */
export function connectSio(id: string, prepared: PreparedSio, onEvent: (e: SioEvent) => void): Promise<void> {
  const channel = new Channel<SioEvent>();
  channel.onmessage = onEvent;
  return invoke("sio_connect", { request: { id, ...prepared }, onEvent: channel });
}

export const sioEmit = (id: string, event: string, args: unknown[], ackMs: number | null) => invoke<void>("sio_emit", { id, event, args, ackMs });
export const sioClose = (id: string) => invoke<void>("sio_close", { id });

/** A row's one-line preview: the arguments without the array's brackets. */
export const argsPreview = (m: Pick<WsMessage, "data">) => (m.data.length >= 2 ? m.data.slice(1, -1) : m.data);

/** What a refused upgrade most likely means for Socket.IO. */
export function refusedHint(body: string | undefined): string {
  if (body && /"code"\s*:\s*5\b/.test(body)) return "The server speaks another Engine.IO version. Switch the server version in Settings.";
  return "This server or a proxy refused the WebSocket upgrade; polling transport is not supported.";
}
