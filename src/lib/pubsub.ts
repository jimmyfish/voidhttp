import { Channel, invoke } from "@tauri-apps/api/core";
import type { PubsubAuthKind, PubsubDef, PubsubInfo, PubsubMode, RequestDef, Settings, WsMessage } from "../types";
import { resolve, type VarScope } from "./vars";
import { stripJsonComments } from "./jsonc";

export const isPubsub = (r: { method: string }) => r.method === "PUBSUB";

export const defaultPubsub = (): PubsubDef => ({
  topic: "",
  orderingKey: "",
  auth: "key",
  keyFile: "",
  adcFile: "",
  impersonate: "",
  token: "",
  emulatorHost: "localhost:8085",
  createTopic: true,
  mode: "temp",
  subscription: "",
  filter: "",
  ordering: false,
  pullMax: 10,
  endpoint: "",
  ackDeadline: 60,
  keep: 1000,
});

export const AUTH_KINDS: [PubsubAuthKind, string][] = [
  ["key", "Service account key"],
  ["adc", "Application Default"],
  ["token", "Access token"],
  ["emulator", "Emulator"],
];

export const MODES: [PubsubMode, string][] = [
  ["temp", "Temporary"],
  ["peek", "Peek"],
  ["consume", "Consume"],
  ["publish", "Publish only"],
];

/** The request-line pill: how this tab signs in, in a few words. */
export function authLabel(def: PubsubDef): string {
  if (def.auth === "emulator") return `Emulator · ${def.emulatorHost.trim() || "localhost:8085"}`;
  if (def.auth === "token") return "Access token";
  const as = def.impersonate.trim() ? ` · as ${def.impersonate.trim().split("@")[0]}` : "";
  return def.auth === "adc" ? `ADC${as}` : `Service account${as}`;
}

// ---------- wire shapes (see src-tauri/src/pubsub.rs) ----------

export interface PubsubAuth {
  kind: PubsubAuthKind;
  file: string;
  impersonate: string;
  token: string;
  emulatorHost: string;
}

export interface PreparedPubsub {
  project: string;
  topic: string;
  auth: PubsubAuth;
  endpoint: string;
  mode: PubsubMode;
  subscription: string;
  filter: string;
  ordering: boolean;
  ackDeadline: number;
  createTopic: boolean;
  insecure: boolean;
  timeoutMs: number;
}

export interface PubsubFailure {
  stage: "auth" | "topic" | "subscription";
  message: string;
  hint?: string;
  elapsedMs: number;
}

export type PubsubEvent =
  | { type: "connected"; info: PubsubInfo; elapsedMs: number }
  | { type: "topic"; info: PubsubInfo }
  | ({ type: "message" } & WsMessage)
  | { type: "pulled"; n: number; count: number; skipped: number; atMs: number }
  | { type: "paused"; paused: boolean; atMs: number }
  | { type: "notice"; message: string }
  | ({ type: "failed" } & PubsubFailure)
  | { type: "close"; by: "client" | "lost"; reason: string; elapsedMs: number };

export interface PublishMessage {
  seq: number;
  /** the editor's text, as is */
  data: string;
  attributes: { key: string; value: string }[];
  orderingKey?: string;
}

/** What the credentials file says, read locally (no network). */
export interface PubsubInspect {
  kind: string;
  email?: string;
  projects: { id: string; source: string }[];
  error?: string;
}

export interface PubsubListItem {
  name: string;
  detail?: string;
  disabled?: boolean;
}

/** The credentials as the engine needs them, variables applied. */
export function authOf(def: PubsubDef, scope: VarScope): PubsubAuth {
  const r = (s: string) => resolve(s, scope).trim();
  return {
    kind: def.auth,
    file: def.auth === "key" ? r(def.keyFile) : def.auth === "adc" ? r(def.adcFile) : "",
    impersonate: def.auth === "key" || def.auth === "adc" ? r(def.impersonate) : "",
    token: def.auth === "token" ? r(def.token) : "",
    emulatorHost: def.auth === "emulator" ? r(def.emulatorHost) || "localhost:8085" : "",
  };
}

/** Variables applied, as the engine needs them. */
export function preparePubsub(req: RequestDef, scope: VarScope, settings: Settings): PreparedPubsub {
  const def = req.pubsub ?? defaultPubsub();
  const r = (s: string) => resolve(s, scope).trim();
  return {
    project: r(req.url),
    topic: shortName(r(def.topic)),
    auth: authOf(def, scope),
    endpoint: r(def.endpoint),
    mode: def.mode,
    subscription: shortName(r(def.subscription)),
    filter: def.mode === "temp" ? r(def.filter) : "",
    ordering: def.mode === "temp" && def.ordering,
    ackDeadline: Math.min(600, Math.max(10, Math.floor(def.ackDeadline || 60))),
    createTopic: def.auth === "emulator" && def.createTopic,
    insecure: settings.insecure,
    timeoutMs: settings.timeoutMs,
  };
}

/** "projects/p/topics/t" → "t": a full name pasted from the console still works. */
export const shortName = (s: string) => s.slice(s.lastIndexOf("/") + 1);

/** The next message as it goes on the wire. Throws when JSON data isn't valid. */
export function publishOf(req: RequestDef, scope: VarScope, seq: number): PublishMessage {
  const def = req.pubsub ?? defaultPubsub();
  const raw = req.body.mode === "json" ? stripJsonComments(req.body.raw) : req.body.raw;
  const data = resolve(raw, scope);
  if (req.body.mode === "json" && data.trim()) {
    try {
      JSON.parse(data);
    } catch (e) {
      throw new Error(`The data is not valid JSON: ${(e as Error).message}`);
    }
  }
  const attributes = req.headers.filter((h) => h.enabled && h.key.trim()).map((h) => ({ key: resolve(h.key, scope).trim(), value: resolve(h.value, scope) }));
  const orderingKey = resolve(def.orderingKey, scope);
  if (!data && !attributes.length) throw new Error("A message needs data or at least one attribute");
  return { seq, data, attributes, ...(orderingKey && { orderingKey }) };
}

/** Runs a connection until it closes; events arrive on `onEvent`. Rejects only for input the engine can't use. */
export function connectPubsub(id: string, prepared: PreparedPubsub, onEvent: (e: PubsubEvent) => void): Promise<void> {
  const channel = new Channel<PubsubEvent>();
  channel.onmessage = onEvent;
  return invoke("pubsub_connect", { request: { id, ...prepared }, onEvent: channel });
}

export const pubsubPublish = (id: string, message: PublishMessage) => invoke<void>("pubsub_publish", { id, message });
export const pubsubPull = (id: string, max: number) => invoke<void>("pubsub_pull", { id, max });
export const pubsubPause = (id: string, paused: boolean) => invoke<void>("pubsub_pause", { id, paused });
export const pubsubRefresh = (id: string) => invoke<void>("pubsub_refresh", { id });
export const pubsubClose = (id: string) => invoke<void>("pubsub_close", { id });

export const pubsubInspect = (auth: PubsubAuth) => invoke<PubsubInspect>("pubsub_inspect", { auth });

export interface ListArgs {
  auth: PubsubAuth;
  endpoint: string;
  insecure: boolean;
  timeoutMs: number;
  what: "projects" | "topics" | "subscriptions";
  project: string;
  topic: string;
}
export const pubsubList = (args: ListArgs) => invoke<PubsubListItem[]>("pubsub_list", { ...args });
