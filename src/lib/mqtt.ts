import { Channel, invoke } from "@tauri-apps/api/core";
import type { MqttConnInfo, MqttDef, MqttSub, RequestDef, Settings, WsMessage } from "../types";
import { resolve, type VarScope } from "./vars";
import { stripJsonComments } from "./jsonc";
import { uid } from "./model";

export const isMqtt = (r: { method: string }) => r.method === "MQTT";

export const defaultMqtt = (): MqttDef => ({
  version: "5",
  topic: "",
  qos: 0,
  retain: false,
  contentType: "",
  utf8: false,
  messageExpiry: null,
  responseTopic: "",
  correlation: "",
  subs: [],
  username: "",
  password: "",
  clientId: "",
  cleanStart: true,
  sessionExpiry: 0,
  keepAlive: 60,
  will: { enabled: false, topic: "", payload: "", json: true, qos: 0, retain: false, delay: 0 },
  keep: 1000,
});

export const mqttSub = (filter = "", qos: MqttSub["qos"] = 0): MqttSub => ({
  id: uid(),
  filter,
  qos,
  enabled: true,
  noLocal: false,
  retainAsPublished: false,
  retainHandling: 0,
});

/** How the URL's scheme connects: "TLS" / "WebSocket" / "WebSocket + TLS" / "" for plain TCP. Unknown scheme: null. */
export function transportOf(url: string): { tls: boolean; ws: boolean } | null {
  const m = /^\s*([a-z0-9+.-]+):\/\//i.exec(url);
  const scheme = (m?.[1] ?? "mqtt").toLowerCase();
  if (scheme === "mqtt" || scheme === "tcp") return { tls: false, ws: false };
  if (scheme === "mqtts" || scheme === "ssl" || scheme === "tls" || scheme === "mqtt+ssl") return { tls: true, ws: false };
  if (scheme === "ws") return { tls: false, ws: true };
  if (scheme === "wss") return { tls: true, ws: true };
  return null;
}

/** "MQTT 5 · TLS", "MQTT 3.1.1 · WebSocket", "MQTT 5" */
export function schemeLabel(url: string, version: MqttDef["version"]): string {
  const t = transportOf(url);
  const v = `MQTT ${version}`;
  if (!t) return v;
  const how = t.ws ? (t.tls ? "WebSocket + TLS" : "WebSocket") : t.tls ? "TLS" : "";
  return how ? `${v} · ${how}` : v;
}

/** Why a topic filter can't be subscribed to (mirrors src-tauri/src/mqtt/packet.rs), or null. */
export function filterProblem(f: string): string | null {
  if (!f) return "The topic filter is empty";
  let body = f;
  if (f.startsWith("$share/")) {
    const rest = f.slice(7);
    const i = rest.indexOf("/");
    if (i < 0 || !rest.slice(i + 1)) return "A shared subscription reads $share/<group>/<filter>";
    const group = rest.slice(0, i);
    if (!group || /[+#]/.test(group)) return "The share group name can't be empty or hold + or #";
    body = rest.slice(i + 1);
  }
  const levels = body.split("/");
  for (let i = 0; i < levels.length; i++) {
    const l = levels[i];
    if (l.includes("#") && (l !== "#" || i !== levels.length - 1)) return "# must be a whole level and the last one, e.g. sensors/#";
    if (l.includes("+") && l !== "+") return "+ must be a whole level, e.g. sensors/+/temp";
  }
  return null;
}

/** Whether a topic matches a filter (the part after $share/<group>/ for a shared one). */
export function topicMatches(filter: string, topic: string): boolean {
  let f = filter;
  if (f.startsWith("$share/")) {
    const rest = f.slice(7);
    const i = rest.indexOf("/");
    f = i < 0 ? "" : rest.slice(i + 1);
  }
  if (topic.startsWith("$") && (f.startsWith("+") || f.startsWith("#"))) return false;
  const fl = f.split("/");
  const tl = topic.split("/");
  for (let i = 0; i < fl.length; i++) {
    if (fl[i] === "#") return true;
    if (i >= tl.length) return false;
    if (fl[i] !== "+" && fl[i] !== tl[i]) return false;
  }
  return fl.length === tl.length;
}

// ---------- wire shapes (see src-tauri/src/mqtt.rs) ----------

export interface SubWire {
  filter: string;
  qos: number;
  noLocal: boolean;
  retainAsPublished: boolean;
  retainHandling: number;
}

export interface PreparedMqtt {
  url: string;
  version: MqttDef["version"];
  clientId: string;
  cleanStart: boolean;
  keepAlive: number;
  sessionExpiry: number;
  username: string;
  password: string;
  will: { topic: string; payload: string; qos: number; retain: boolean; delay: number } | null;
  subs: SubWire[];
  insecure: boolean;
  timeoutMs: number;
}

export interface PublishWire {
  seq: number;
  topic: string;
  payload: string;
  qos: number;
  retain: boolean;
  contentType: string;
  utf8: boolean | null;
  messageExpiry: number | null;
  responseTopic: string;
  correlation: string;
  user: { key: string; value: string }[];
}

export type MqttFailure = NonNullable<import("../types").MqttSession["failed"]>;

export type MqttEvent =
  | { type: "connected"; info: MqttConnInfo }
  | { type: "subscribed"; results: { filter: string; qos: number; granted?: number; error?: string }[]; atMs: number }
  | { type: "unsubscribed"; filters: string[]; atMs: number }
  | ({ type: "message" } & WsMessage)
  | ({ type: "failed" } & MqttFailure)
  | { type: "close"; by: "client" | "server" | "lost"; code?: number; reason: string; elapsedMs: number };

const clampQos = (n: unknown): number => (n === 1 || n === 2 ? n : 0);

/** The enabled rows of the Topics tab, variables applied, as the engine takes them. */
export function subsOf(def: MqttDef, scope: VarScope): SubWire[] {
  return def.subs
    .filter((s) => s.enabled && s.filter.trim())
    .map((s) => ({
      filter: resolve(s.filter, scope).trim(),
      qos: clampQos(s.qos),
      noLocal: s.noLocal,
      retainAsPublished: s.retainAsPublished,
      retainHandling: s.retainHandling,
    }));
}

/** Variables applied, as the engine needs them. */
export function prepareMqtt(req: RequestDef, scope: VarScope, settings: Settings): PreparedMqtt {
  const def = req.mqtt ?? defaultMqtt();
  const r = (s: string) => resolve(s, scope).trim();
  const v5 = def.version === "5";
  const w = def.will;
  let will: PreparedMqtt["will"] = null;
  if (w.enabled) {
    const payload = resolve(w.json ? stripJsonComments(w.payload) : w.payload, scope);
    if (w.json && payload.trim()) {
      try {
        JSON.parse(payload);
      } catch (e) {
        throw new Error(`The Last Will message is not valid JSON: ${(e as Error).message}`);
      }
    }
    will = { topic: r(w.topic), payload, qos: clampQos(w.qos), retain: w.retain, delay: v5 ? Math.max(0, Math.floor(w.delay || 0)) : 0 };
    if (!will.topic) throw new Error("Enter the Last Will topic, or turn the Last Will off");
  }
  return {
    url: r(req.url),
    version: def.version,
    clientId: r(def.clientId),
    cleanStart: def.cleanStart,
    keepAlive: Math.min(65_535, Math.max(0, Math.floor(def.keepAlive ?? 60))),
    sessionExpiry: v5 ? Math.max(0, Math.floor(def.sessionExpiry || 0)) : 0,
    username: resolve(def.username, scope),
    password: resolve(def.password, scope),
    will,
    subs: subsOf(def, scope),
    insecure: settings.insecure,
    timeoutMs: settings.timeoutMs,
  };
}

/** The next message as it goes on the wire. Throws when the JSON payload can't be used. */
export function publishOf(req: RequestDef, scope: VarScope, seq: number): PublishWire {
  const def = req.mqtt ?? defaultMqtt();
  const v5 = def.version === "5";
  const json = req.body.mode === "json";
  const payload = resolve(json ? stripJsonComments(req.body.raw) : req.body.raw, scope);
  if (json && payload.trim()) {
    try {
      JSON.parse(payload);
    } catch (e) {
      throw new Error(`The payload is not valid JSON: ${(e as Error).message}`);
    }
  }
  const topic = resolve(def.topic, scope).trim();
  if (!topic) throw new Error("Enter the topic to publish to");
  return {
    seq,
    topic,
    payload,
    qos: clampQos(def.qos),
    retain: def.retain,
    contentType: v5 ? resolve(def.contentType, scope).trim() : "",
    utf8: v5 && def.utf8 ? true : null,
    messageExpiry: v5 && def.messageExpiry !== null && def.messageExpiry > 0 ? Math.floor(def.messageExpiry) : null,
    responseTopic: v5 ? resolve(def.responseTopic, scope).trim() : "",
    correlation: v5 ? resolve(def.correlation, scope) : "",
    user: v5 ? req.headers.filter((h) => h.enabled && h.key.trim()).map((h) => ({ key: resolve(h.key, scope).trim(), value: resolve(h.value, scope) })) : [],
  };
}

/** How many publish properties are set (the dot on the Properties switch). */
export function propCount(req: RequestDef): number {
  const d = req.mqtt;
  if (!d) return 0;
  return (
    (d.contentType.trim() ? 1 : 0) +
    (d.utf8 ? 1 : 0) +
    (d.messageExpiry ? 1 : 0) +
    (d.responseTopic.trim() ? 1 : 0) +
    (d.correlation ? 1 : 0) +
    req.headers.filter((h) => h.enabled && h.key.trim()).length
  );
}

/** Runs a connection until it closes; events arrive on `onEvent`. Rejects only for input the engine can't use. */
export function connectMqtt(id: string, prepared: PreparedMqtt, onEvent: (e: MqttEvent) => void): Promise<void> {
  const channel = new Channel<MqttEvent>();
  channel.onmessage = onEvent;
  return invoke("mqtt_connect", { request: { id, ...prepared }, onEvent: channel });
}

export const mqttPublish = (id: string, message: PublishWire) => invoke<void>("mqtt_publish", { id, message });
export const mqttSubscriptions = (id: string, subs: SubWire[]) => invoke<void>("mqtt_subscriptions", { id, subs });
export const mqttClose = (id: string) => invoke<void>("mqtt_close", { id });

/** A reason code in the words the list uses: "0x87 Not authorized" → "Not authorized". */
export const reasonWords = (s: string) => s.replace(/^0x[0-9a-f]{2}\s+/i, "");
