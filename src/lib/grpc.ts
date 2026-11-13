import { useSyncExternalStore } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import type { GrpcDef, GrpcEnd, GrpcMessage, GrpcStream, KV, RequestDef, Settings } from "../types";
import { resolve, type VarScope } from "./vars";
import { prepare } from "./http";
import { stripJsonComments } from "./jsonc";
import { shellWords } from "./curl";
import { kv } from "./model";

export const isGrpc = (r: { method: string }) => r.method === "GRPC";

/** A new gRPC request talks TLS unless the address is clearly local or plain http. */
export function defaultGrpc(address: string): GrpcDef {
  const plain = /^http:\/\//i.test(address) || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(address.trim());
  return { service: "", method: "", tls: !plain, source: "reflection", protoFiles: [], importPaths: [] };
}

export const STREAM_LABEL: Record<GrpcStream, string> = {
  unary: "Unary",
  server: "Server stream",
  client: "Client stream",
  bidi: "Bidi stream",
};

/** The client sends more than one message: Invoke opens the stream, then messages go one by one. */
export const clientStreams = (s?: GrpcStream) => s === "client" || s === "bidi";

/** Short service name for tight places: customer.v1.CustomerService → CustomerService */
export const shortService = (full: string) => full.slice(full.lastIndexOf(".") + 1);

// ---------- wire shapes (see src-tauri/src/grpc.rs) ----------

export interface Target {
  address: string;
  tls: boolean;
  insecure: boolean;
  metadata: { key: string; value: string }[];
}

export type SchemaSource = { source: "reflection" } | { source: "protos"; files: string[]; importPaths: string[] };

export interface MethodInfo {
  name: string;
  stream: GrpcStream;
  inputType: string;
  outputType: string;
  example: string;
}

export interface SchemaInfo {
  services: { name: string; methods: MethodInfo[] }[];
}

export type GrpcEvent =
  | { type: "headers"; metadata: { key: string; value: string }[] }
  | ({ type: "message" } & GrpcMessage)
  | ({ type: "end" } & GrpcEnd);

export interface PreparedCall {
  target: Target;
  schema: SchemaSource;
  service: string;
  method: string;
  message: string;
}

const schemaOf = (def: GrpcDef): SchemaSource =>
  def.source === "protos" ? { source: "protos", files: def.protoFiles, importPaths: def.importPaths } : { source: "reflection" };

/** Variables, auth and metadata applied, as the engine needs them. Pure: also used by Copy as grpcurl. */
export function prepareGrpc(req: RequestDef, scope: VarScope, settings: Settings): PreparedCall {
  const def = req.grpc ?? defaultGrpc(req.url);
  // auth becomes metadata like it becomes a header for HTTP; an API key always goes in metadata
  const auth = req.auth.type === "apikey" ? { ...req.auth, in: "header" as const } : req.auth;
  const p = prepare({ ...req, auth, body: { ...req.body, mode: "none" } }, scope);
  return {
    target: { address: p.url.trim(), tls: def.tls, insecure: settings.insecure, metadata: p.headers },
    schema: schemaOf(def),
    service: def.service,
    method: def.method,
    message: resolve(stripJsonComments(req.body.raw), scope),
  };
}

// ---------- schemas: loaded once per source, shared by every tab that uses it ----------

export interface SchemaState {
  loading?: boolean;
  info?: SchemaInfo;
  error?: string;
  loadedAt?: number;
}

const schemas = new Map<string, SchemaState>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** One key per place a schema comes from; mirrors pool_key in grpc.rs. */
export function schemaKey(call: Pick<PreparedCall, "target" | "schema">): string {
  const s = call.schema;
  return s.source === "protos" ? `protos|${s.files.join(",")}|${s.importPaths.join(",")}` : `reflection|${call.target.tls}|${call.target.address}`;
}

export function useSchema(key: string): SchemaState | undefined {
  return useSyncExternalStore(subscribe, () => schemas.get(key));
}

export async function loadSchema(call: Pick<PreparedCall, "target" | "schema">): Promise<SchemaState> {
  const key = schemaKey(call);
  schemas.set(key, { ...schemas.get(key), loading: true, error: undefined });
  emit();
  let next: SchemaState;
  try {
    const info = await invoke<SchemaInfo>("grpc_describe", { target: call.target, schema: call.schema });
    next = { info, loadedAt: Date.now() };
  } catch (e) {
    next = { error: String(e) };
  }
  schemas.set(key, next);
  emit();
  return next;
}

export function findMethod(info: SchemaInfo | undefined, service: string, method: string): MethodInfo | undefined {
  return info?.services.find((s) => s.name === service)?.methods.find((m) => m.name === method);
}

// ---------- calls ----------

/** Runs a call; events arrive on `onEvent`. Rejects only when the call could not start. */
export function invokeGrpc(id: string, call: PreparedCall, timeoutMs: number, onEvent: (e: GrpcEvent) => void): Promise<void> {
  const channel = new Channel<GrpcEvent>();
  channel.onmessage = onEvent;
  return invoke("grpc_invoke", { request: { id, ...call, timeoutMs }, onEvent: channel });
}

export const grpcSend = (id: string, message: string) => invoke<void>("grpc_send", { id, message });
export const grpcEndSending = (id: string) => invoke<void>("grpc_end", { id });
export const grpcCancel = (id: string) => invoke<void>("grpc_cancel", { id });

// ---------- Copy as grpcurl ----------

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function toGrpcurl(call: PreparedCall): string {
  const parts = ["grpcurl"];
  const address = call.target.address.replace(/^grpc:\/\//, "");
  const plain = /^http:\/\//i.test(address) || (!/^https:\/\//i.test(address) && !call.target.tls);
  if (plain) parts.push("-plaintext");
  else if (call.target.insecure) parts.push("-insecure");
  for (const h of call.target.metadata) parts.push("-H", q(`${h.key}: ${h.value}`));
  if (call.schema.source === "protos") {
    // grpcurl names each -proto relative to an -import-path, like an import line
    const imports = [...call.schema.importPaths];
    const names = call.schema.files.map((f) => {
      const under = imports.find((p) => f.startsWith(p.replace(/\/?$/, "/")));
      if (under) return f.slice(under.replace(/\/?$/, "/").length);
      const dir = f.slice(0, f.lastIndexOf("/")) || "/";
      if (!imports.includes(dir)) imports.push(dir);
      return f.slice(f.lastIndexOf("/") + 1);
    });
    for (const p of imports) parts.push("-import-path", q(p));
    for (const n of names) parts.push("-proto", q(n));
  }
  const body = call.message.trim();
  if (body) parts.push("-d", q(body));
  parts.push(q(address.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")), q(`${call.service}/${call.method}`));
  return parts.join(" ");
}

// ---------- paste a grpcurl command ----------

export const looksLikeGrpcurl = (text: string): boolean => /^\s*grpcurl(\.exe)?\s/i.test(text);

export interface ParsedGrpcurl {
  request: Pick<RequestDef, "method" | "url" | "headers" | "body" | "grpc">;
  /** what could not be carried over, said once in the toast */
  notes: string[];
}

/** grpcurl flags that take a value; every other flag is a switch. */
const GRPCURL_VALUE = new Set([
  "H", "rpc-header", "reflect-header", "d", "import-path", "proto", "protoset", "protoset-out", "max-time", "connect-timeout",
  "keepalive-time", "authority", "cacert", "cert", "key", "servername", "user-agent", "format", "max-msg-sz", "alts-handshaker-service",
  "alts-target-service-account",
]);

/**
 * Reads a grpcurl call: address, service/method, -d message, -H/-rpc-header/-reflect-header metadata,
 * -plaintext, and -proto with -import-path. `list` and `describe` keep only the address.
 */
export function parseGrpcurl(text: string): ParsedGrpcurl | null {
  const words = shellWords(text);
  if (!/^grpcurl(\.exe)?$/i.test(words[0] ?? "")) return null;
  const notes: string[] = [];
  const headers: KV[] = [];
  const protos: string[] = [];
  const imports: string[] = [];
  const positional: string[] = [];
  let data: string | undefined;
  let plaintext = false;

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const m = /^--?([\w-]+)(?:=([\s\S]*))?$/.exec(w);
    if (!m || w === "-") {
      positional.push(w);
      continue;
    }
    const flag = m[1];
    const value = m[2] ?? (GRPCURL_VALUE.has(flag) ? words[++i] : undefined);
    switch (flag) {
      case "plaintext":
        plaintext = value === undefined || value !== "false";
        break;
      case "insecure":
        if (value !== "false") notes.push("-insecure: turn on Skip TLS verification in Settings");
        break;
      case "H":
      case "rpc-header":
      case "reflect-header": {
        const c = (value ?? "").indexOf(":");
        const key = c < 0 ? (value ?? "").trim() : value!.slice(0, c).trim();
        const val = c < 0 ? "" : value!.slice(c + 1).trim();
        if (key && !headers.some((h) => h.key === key && h.value === val)) headers.push(kv(key, val));
        break;
      }
      case "d":
        data = value;
        break;
      case "proto":
        if (value) protos.push(value);
        break;
      case "import-path":
        if (value) imports.push(value);
        break;
      case "protoset":
        notes.push("-protoset files are not supported; add the .proto files in Schema");
        break;
      case "cert":
      case "key":
      case "cacert":
        notes.push(`-${flag} is not supported`);
        break;
    }
  }

  const [address = "", verb = ""] = positional;
  if (!address) return null;
  let service = "";
  let method = "";
  if (verb && !/^(list|describe)$/.test(verb)) {
    // pkg.Service/Method, or pkg.Service.Method
    const cut = verb.includes("/") ? verb.lastIndexOf("/") : verb.lastIndexOf(".");
    if (cut > 0) {
      service = verb.slice(0, cut);
      method = verb.slice(cut + 1);
    }
  }

  // grpcurl names a -proto relative to an -import-path; the app keeps full paths
  const base = imports.find((p) => p.startsWith("/") || p.startsWith("~"));
  const files = protos.map((p) => (p.startsWith("/") || p.startsWith("~") || !base ? p : `${base.replace(/\/$/, "")}/${p}`));
  if (files.some((f) => !f.startsWith("/") && !f.startsWith("~"))) notes.push("relative .proto paths: check them in Schema");

  let raw = "";
  if (data === "@") notes.push("-d @ reads stdin; paste the message into Message");
  else if (data !== undefined) {
    try {
      raw = JSON.stringify(JSON.parse(data), null, 2);
    } catch {
      raw = data;
    }
  }

  return {
    request: {
      method: "GRPC",
      url: address,
      headers,
      body: { mode: "json", raw, form: [], multipart: [] },
      grpc: {
        service,
        method,
        tls: !plaintext,
        source: files.length ? "protos" : "reflection",
        protoFiles: files,
        importPaths: imports,
      },
    },
    notes,
  };
}
