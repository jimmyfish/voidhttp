/**
 * voidHTTP's own export: collections and environments exactly as stored, so nothing is lost
 * (gRPC calls, saved examples, environment colours). Ids are made fresh on import.
 */
import type { Auth, Collection, Environment, GqlDef, GrpcDef, GrpcResult, KafkaDef, KV, MultipartField, RequestNode, RequestScripts, SioDef, TreeNode, WsDef } from "../../types";
import { defaultSio } from "../sio";
import { defaultKafka } from "../kafka";
import { cloneNode, uid } from "../model";
import { newRequest } from "../model";
import { dropFilePaths, requestsOf, type Any, type ImportPlan } from "./common";

export const NATIVE_VERSION = 1;

export interface NativeFile {
  voidhttp: number;
  exportedAt: string;
  collections: Collection[];
  environments: Environment[];
}

export function exportNative(collections: Collection[], environments: Environment[]): string {
  const file: NativeFile = { voidhttp: NATIVE_VERSION, exportedAt: new Date().toISOString(), collections, environments };
  return JSON.stringify(file, null, 2);
}

const text = (v: unknown, fallback = "") => (typeof v === "string" ? v : v === undefined || v === null ? fallback : typeof v === "object" ? fallback : String(v));

/** Key/value rows: anything that is not an object is dropped, and every field gets the type the app expects. */
function rows<T extends KV>(list: unknown, extra: (r: Any) => Partial<T> = () => ({})): T[] {
  return (Array.isArray(list) ? list : [])
    .filter((r) => r && typeof r === "object")
    .map((r: Any) => ({ ...r, id: text(r.id) || uid(), key: text(r.key), value: text(r.value), enabled: r.enabled !== false, ...extra(r) }) as T);
}

/** Auth with the fields of its type, as strings; an unknown type becomes none. */
function saneAuth(a: Any): Auth {
  if (!a || typeof a !== "object") return { type: "none" };
  if (a.type === "bearer") return { type: "bearer", token: text(a.token) };
  if (a.type === "basic") return { type: "basic", username: text(a.username), password: text(a.password) };
  if (a.type === "apikey") return { type: "apikey", key: text(a.key), value: text(a.value), in: a.in === "query" ? "query" : "header" };
  return { type: "none" };
}

/** A gRPC call's settings with every field of the type the app expects; anything that is not an object is dropped. */
function saneGrpc(g: Any): GrpcDef | undefined {
  if (!g || typeof g !== "object") return undefined;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  return {
    ...g,
    service: text(g.service),
    method: text(g.method),
    stream: ["unary", "server", "client", "bidi"].includes(g.stream) ? g.stream : undefined,
    inputType: typeof g.inputType === "string" ? g.inputType : undefined,
    tls: g.tls === true,
    source: g.source === "protos" ? "protos" : "reflection",
    protoFiles: list(g.protoFiles),
    importPaths: list(g.importPaths),
  };
}

/** GraphQL settings with every field of the type the app expects. */
function saneGql(v: Any): GqlDef | undefined {
  if (!v || typeof v !== "object") return undefined;
  return {
    query: typeof v.query === "string" ? v.query : "",
    variables: typeof v.variables === "string" ? v.variables : "",
    ...(typeof v.operation === "string" && v.operation && { operation: v.operation }),
  };
}

/** Kafka settings with every field of the type the app expects. */
function saneKafka(v: Any): KafkaDef | undefined {
  if (!v || typeof v !== "object") return undefined;
  const d = defaultKafka();
  const str = (x: unknown, fallback: string) => (typeof x === "string" ? x : fallback);
  const pick = <T extends string>(x: unknown, all: readonly T[], fallback: T): T => (all.includes(x as T) ? (x as T) : fallback);
  return {
    topic: str(v.topic, d.topic),
    key: str(v.key, d.key),
    keyType: pick(v.keyType, ["string", "json", "base64", "hex"] as const, d.keyType),
    partition: typeof v.partition === "number" && Number.isInteger(v.partition) && v.partition >= 0 ? v.partition : null,
    sasl: pick(v.sasl, ["none", "plain", "scram-sha-256", "scram-sha-512"] as const, d.sasl),
    username: str(v.username, ""),
    password: str(v.password, ""),
    tls: v.tls === true,
    clientId: str(v.clientId, d.clientId),
    from: v.from === "earliest" ? "earliest" : "latest",
    acks: v.acks === 0 || v.acks === 1 ? v.acks : -1,
    compression: pick(v.compression, ["none", "gzip", "lz4", "snappy", "zstd"] as const, d.compression),
    keep: typeof v.keep === "number" && Number.isFinite(v.keep) && v.keep > 0 ? Math.floor(v.keep) : d.keep,
  };
}

/** Socket.IO settings with every field of the type the app expects. */
function saneSio(v: Any): SioDef | undefined {
  if (!v || typeof v !== "object") return undefined;
  const d = defaultSio();
  const str = (x: unknown, fallback: string) => (typeof x === "string" ? x : fallback);
  return {
    namespace: str(v.namespace, d.namespace),
    path: str(v.path, d.path),
    eio: v.eio === 3 ? 3 : 4,
    auth: str(v.auth, ""),
    event: str(v.event, d.event),
    ack: v.ack === true,
    ackTimeoutMs: typeof v.ackTimeoutMs === "number" && Number.isFinite(v.ackTimeoutMs) && v.ackTimeoutMs >= 0 ? Math.floor(v.ackTimeoutMs) : d.ackTimeoutMs,
  };
}

/** A WebSocket's settings with every field of the type the app expects. */
function saneWs(w: Any): WsDef | undefined {
  if (!w || typeof w !== "object") return undefined;
  return {
    subprotocols: Array.isArray(w.subprotocols) ? w.subprotocols.filter((x: unknown) => typeof x === "string") : [],
    pingSec: typeof w.pingSec === "number" && Number.isFinite(w.pingSec) && w.pingSec > 0 ? Math.floor(w.pingSec) : 0,
  };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const pairs = (list: unknown) =>
  (Array.isArray(list) ? list : []).filter((r) => r && typeof r === "object").map((r: Any) => ({ key: text(r.key), value: text(r.value) }));

/**
 * The ended gRPC call of a gRPC example, with every field of the type the app expects. A call without an end
 * is dropped: an example is a finished call. Error details are kept only when they parse, since the pane reads them as JSON.
 */
function saneGrpcResult(g: Any): GrpcResult | undefined {
  if (!g || typeof g !== "object" || !g.end || typeof g.end !== "object") return undefined;
  const e = g.end;
  let details: string | undefined;
  if (typeof e.details === "string") {
    try {
      JSON.parse(e.details);
      details = e.details;
    } catch {
      details = undefined;
    }
  }
  return {
    startedAt: num(g.startedAt),
    stream: ["unary", "server", "client", "bidi"].includes(g.stream) ? g.stream : "unary",
    tls: g.tls === true,
    headers: pairs(g.headers),
    messages: (Array.isArray(g.messages) ? g.messages : [])
      .filter((m: unknown) => m && typeof m === "object")
      .map((m: Any) => ({ dir: m.dir === "out" ? "out" : "in", json: text(m.json), size: num(m.size), atMs: num(m.atMs) })),
    dropped: num(g.dropped) || undefined,
    end: { code: num(e.code), status: text(e.status), message: text(e.message), details, trailers: pairs(e.trailers), elapsedMs: num(e.elapsedMs) },
  };
}

function saneScripts(v: Any): RequestScripts | undefined {
  if (!v || typeof v !== "object") return undefined;
  const pre = typeof v.pre === "string" && v.pre ? v.pre : undefined;
  const post = typeof v.post === "string" && v.post ? v.post : undefined;
  return pre || post ? { ...(pre && { pre }), ...(post && { post }) } : undefined;
}

/** Fills fields a hand-edited or older file may miss, and gives every field its type, so the rest of the app can trust the shape. */
function sane(n: Any): TreeNode | null {
  if (!n || typeof n !== "object") return null;
  if (n.type === "folder") return { type: "folder", id: uid(), name: text(n.name, "Folder"), children: (Array.isArray(n.children) ? n.children : []).map(sane).filter(Boolean) as TreeNode[] };
  if (n.type !== "request") return null;
  const base = newRequest();
  const body = n.body && typeof n.body === "object" ? n.body : {};
  const node: RequestNode = {
    ...base,
    ...n,
    type: "request",
    name: text(n.name, base.name),
    method: text(n.method, base.method),
    url: text(n.url),
    params: rows(n.params),
    headers: rows(n.headers),
    body: {
      ...base.body,
      ...body,
      mode: typeof body.mode === "string" ? body.mode : base.body.mode,
      raw: text(body.raw),
      form: rows(body.form),
      multipart: rows<MultipartField>(body.multipart, (r) => ({ kind: r.kind === "file" ? "file" : "text" })),
    },
    auth: saneAuth(n.auth),
    grpc: saneGrpc(n.grpc),
    ws: saneWs(n.ws),
    sio: saneSio(n.sio),
    kafka: saneKafka(n.kafka),
    gql: saneGql(n.gql),
    scripts: saneScripts(n.scripts),
    examples: Array.isArray(n.examples)
      ? n.examples
          // an HTTP example has a response; a gRPC example has an ended call instead
          .filter(
            (e: Any) =>
              e && typeof e === "object" && e.request && typeof e.request === "object" && ((e.response && typeof e.response === "object") || saneGrpcResult(e.grpc)),
          )
          .map((e: Any) => {
            // the saved request gets the same checks; it has no examples of its own
            const { type: _t, examples: _e, ...request } = sane({ ...e.request, type: "request", examples: undefined }) as RequestNode;
            const r = e.response;
            const head = {
              ...e,
              name: text(e.name, "Example"),
              savedAt: num(e.savedAt),
              masked: Array.isArray(e.masked) ? e.masked.map((m: unknown) => text(m)) : [],
              request,
            };
            if (!r || typeof r !== "object") return { ...head, response: undefined, grpc: saneGrpcResult(e.grpc) };
            return {
              ...head,
              grpc: undefined,
              response: {
                ...r,
                status: num(r.status),
                statusText: text(r.statusText),
                httpVersion: text(r.httpVersion),
                url: text(r.url),
                headers: rows(r.headers),
                body: text(r.body),
                bodyEncoding: r.bodyEncoding === "base64" ? "base64" : "utf8",
                size: num(r.size),
                elapsedMs: num(r.elapsedMs),
              },
            };
          })
      : undefined,
  };
  return cloneNode(node);
}

export function importNative(doc: Any): ImportPlan {
  if (Number(doc.voidhttp) > NATIVE_VERSION) throw new Error("This file is from a newer voidHTTP. Update the app to import it.");
  const files = dropFilePaths(
    (Array.isArray(doc.collections) ? doc.collections : []).map((c: Any) => ({
      id: uid(),
      name: String(c.name ?? "Imported collection"),
      children: (Array.isArray(c.children) ? c.children : []).map(sane).filter(Boolean) as TreeNode[],
      variables: rows(c.variables),
    })),
  );
  const collections: Collection[] = files.collections;
  const environments: Environment[] = (Array.isArray(doc.environments) ? doc.environments : []).map((e: Any) => ({
    id: uid(),
    name: String(e.name ?? "Imported environment"),
    variables: rows(e.variables),
    ...(typeof e.color === "string" && { color: e.color }),
  }));
  const n = collections.reduce((m, c) => m + requestsOf(c.children).length, 0);
  const parts = [
    collections.length === 1 ? collections[0].name : `${collections.length} collections`,
    `${n} request${n === 1 ? "" : "s"}`,
    environments.length && `${environments.length} environment${environments.length === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return { format: "voidhttp", label: "voidHTTP", detail: parts.join(" · "), collections, environments, notes: files.notes };
}
