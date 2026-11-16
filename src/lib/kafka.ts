import { Channel, invoke } from "@tauri-apps/api/core";
import type { KafkaCluster, KafkaDef, KafkaKeyType, KafkaSeek, RequestDef, Settings, WsMessage } from "../types";
import { resolve, type VarScope } from "./vars";
import { stripJsonComments } from "./jsonc";

export const isKafka = (r: { method: string }) => r.method === "KAFKA";

export const defaultKafka = (): KafkaDef => ({
  topic: "",
  key: "",
  keyType: "string",
  partition: null,
  sasl: "none",
  username: "",
  password: "",
  tls: false,
  clientId: "voidhttp",
  from: "latest",
  acks: -1,
  compression: "none",
  keep: 1000,
});

export const KEY_TYPES: [KafkaKeyType, string][] = [
  ["string", "String"],
  ["json", "JSON"],
  ["base64", "Base64"],
  ["hex", "Hex"],
];

// ---------- wire shapes (see src-tauri/src/kafka.rs) ----------

export interface PreparedKafka {
  brokers: string;
  topic: string;
  clientId: string;
  sasl: KafkaDef["sasl"];
  username: string;
  password: string;
  tls: boolean;
  insecure: boolean;
  from: KafkaSeek;
  acks: number;
  compression: KafkaDef["compression"];
  timeoutMs: number;
}

export interface KafkaFailure {
  stage: "connect" | "tls" | "sasl" | "broker" | "topic";
  broker?: string;
  message: string;
  hint?: string;
  topics?: string[];
  elapsedMs: number;
}

export type KafkaEvent =
  | { type: "connected"; cluster: KafkaCluster; from: KafkaSeek; elapsedMs: number }
  | { type: "topic"; cluster: KafkaCluster }
  | ({ type: "message" } & WsMessage)
  | { type: "seeked"; from: KafkaSeek; atMs: number }
  | { type: "paused"; paused: boolean; atMs: number }
  | { type: "waiting"; count: number }
  | { type: "notice"; message: string }
  | ({ type: "failed" } & KafkaFailure)
  | { type: "close"; by: "client" | "lost"; reason: string; elapsedMs: number };

export interface ProduceRecord {
  seq: number;
  /** base64 */
  key?: string;
  value?: string;
  headers: { key: string; value: string }[];
  partition?: number;
}

/** Variables applied, as the engine needs them. */
export function prepareKafka(req: RequestDef, scope: VarScope, settings: Settings, from?: KafkaSeek): PreparedKafka {
  const def = req.kafka ?? defaultKafka();
  const r = (s: string) => resolve(s, scope).trim();
  return {
    brokers: r(req.url),
    topic: r(def.topic),
    clientId: r(def.clientId),
    sasl: def.sasl,
    username: def.sasl === "none" ? "" : r(def.username),
    password: def.sasl === "none" ? "" : resolve(def.password, scope),
    tls: def.tls,
    insecure: settings.insecure,
    from: from ?? { kind: def.from },
    acks: def.acks,
    compression: def.compression,
    timeoutMs: settings.timeoutMs,
  };
}

/** The next record as it goes on the wire. Throws when the key or the JSON value can't be used. */
export function produceOf(req: RequestDef, scope: VarScope, seq: number): ProduceRecord {
  const def = req.kafka ?? defaultKafka();
  const keyText = resolve(def.key, scope);
  const key = keyBytes(keyText, def.keyType);
  const raw = req.body.mode === "json" ? stripJsonComments(req.body.raw) : req.body.raw;
  const value = resolve(raw, scope);
  if (req.body.mode === "json" && value.trim()) {
    try {
      JSON.parse(value);
    } catch (e) {
      throw new Error(`The value is not valid JSON: ${(e as Error).message}`);
    }
  }
  const headers = req.headers.filter((h) => h.enabled && h.key.trim()).map((h) => ({ key: resolve(h.key, scope).trim(), value: resolve(h.value, scope) }));
  return { seq, ...(key !== undefined && { key }), value, headers, ...(def.partition !== null && { partition: def.partition }) };
}

/** The key's bytes as base64, from what the Key field says and its type. Empty String sends no key. */
export function keyBytes(text: string, type: KafkaKeyType): string | undefined {
  if (type === "string") return text === "" ? undefined : b64(new TextEncoder().encode(text));
  const t = text.trim();
  if (!t) return undefined;
  if (type === "json") {
    try {
      JSON.parse(t);
    } catch (e) {
      throw new Error(`The key is not valid JSON: ${(e as Error).message}`);
    }
    return b64(new TextEncoder().encode(t));
  }
  if (type === "base64") {
    const clean = t.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    try {
      return b64(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
    } catch {
      throw new Error("The key is not valid Base64");
    }
  }
  const hex = t.replace(/^0x/i, "").replace(/[\s:-]+/g, "");
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2) throw new Error("The key is not valid Hex: use pairs of 0-9 and a-f");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b64(bytes);
}

function b64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** A base64 key or value as hex, for a record whose bytes are not text. */
export function b64ToHex(s: string, max = 64): string {
  let bin = "";
  try {
    bin = atob(s);
  } catch {
    return s;
  }
  const out: string[] = [];
  for (let i = 0; i < Math.min(bin.length, max); i++) out.push(bin.charCodeAt(i).toString(16).padStart(2, "0"));
  return out.join("") + (bin.length > max ? "…" : "");
}

/** "latest" · "earliest" · "last 100" · "Nov 16, 10:00" · "partition 2 at 1834" */
export function seekLabel(s: KafkaSeek): string {
  switch (s.kind) {
    case "latest":
      return "latest";
    case "earliest":
      return "earliest";
    case "last":
      return `last ${s.n}`;
    case "time":
      return new Date(s.ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    case "offset":
      return `partition ${s.partition} at ${s.offset}`;
  }
}

/** A record's time as the list shows it: local, with milliseconds and the zone offset. */
export function recordTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const off = -d.getTimezoneOffset();
  const zone = `${off >= 0 ? "+" : "-"}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)} ${zone}`;
}

/** Runs a connection until it closes; events arrive on `onEvent`. Rejects only for input the engine can't use. */
export function connectKafka(id: string, prepared: PreparedKafka, onEvent: (e: KafkaEvent) => void): Promise<void> {
  const channel = new Channel<KafkaEvent>();
  channel.onmessage = onEvent;
  return invoke("kafka_connect", { request: { id, ...prepared }, onEvent: channel });
}

export const kafkaProduce = (id: string, record: ProduceRecord) => invoke<void>("kafka_produce", { id, record });
export const kafkaSeek = (id: string, from: KafkaSeek) => invoke<void>("kafka_seek", { id, from });
export const kafkaPause = (id: string, paused: boolean) => invoke<void>("kafka_pause", { id, paused });
export const kafkaRefresh = (id: string) => invoke<void>("kafka_refresh", { id });
export const kafkaClose = (id: string) => invoke<void>("kafka_close", { id });
