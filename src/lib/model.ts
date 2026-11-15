import type { Collection, FolderNode, HistoryEntry, KV, RequestDef, Tab, TreeNode } from "../types";

export const uid = (): string =>
  crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);

export const kv = (key = "", value = "", enabled = true): KV => ({ id: uid(), key, value, enabled });

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

export function newRequest(partial: Partial<RequestDef> = {}): RequestDef {
  return {
    id: uid(),
    name: "Untitled request",
    method: "GET",
    url: "",
    params: [],
    headers: [],
    body: { mode: "none", raw: "", form: [], multipart: [] },
    auth: { type: "none" },
    ...partial,
  };
}

export function cloneRequest(r: RequestDef): RequestDef {
  return structuredClone(r);
}

/** Strips tree-only fields so a node can be edited as a plain request. */
export function toRequestDef(node: RequestDef): RequestDef {
  const { id, name, method, url, params, headers, body, auth, grpc, ws, sio } = node;
  return cloneRequest({ id, name, method, url, params, headers, body, auth, ...(grpc && { grpc }), ...(ws && { ws }), ...(sio && { sio }) });
}

// ---------- tree helpers (immutable) ----------

export function findNode(nodes: TreeNode[], id: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.type === "folder") {
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

export function mapTree(nodes: TreeNode[], id: string, fn: (n: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map((n) => {
    if (n.id === id) return fn(n);
    if (n.type === "folder") return { ...n, children: mapTree(n.children, id, fn) };
    return n;
  });
}

export function removeFromTree(nodes: TreeNode[], id: string): TreeNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => (n.type === "folder" ? { ...n, children: removeFromTree(n.children, id) } : n));
}

/** Inserts into folder `parentId`, or at the collection root when null. */
/** Where a dragged node lands relative to a target row. */
export type DropWhere = "before" | "after" | "inside";

/** Put `node` before/after the node `targetId`, or at the end of folder `targetId` ("inside"). Returns null when the target is not in `nodes`. */
export function placeNode(nodes: TreeNode[], targetId: string, where: DropWhere, node: TreeNode): TreeNode[] | null {
  const i = nodes.findIndex((n) => n.id === targetId);
  if (i >= 0) {
    if (where === "inside") {
      const t = nodes[i];
      if (t.type !== "folder") return null;
      return nodes.map((n, j) => (j === i ? { ...t, children: [...t.children, node] } : n));
    }
    const out = [...nodes];
    out.splice(where === "before" ? i : i + 1, 0, node);
    return out;
  }
  for (let j = 0; j < nodes.length; j++) {
    const n = nodes[j];
    if (n.type !== "folder") continue;
    const kids = placeNode(n.children, targetId, where, node);
    if (kids) return nodes.map((m, k) => (k === j ? { ...n, children: kids } : m));
  }
  return null;
}

/** A deep copy with fresh ids for the node, its descendants and their rows. */
export function cloneNode(n: TreeNode): TreeNode {
  if (n.type === "folder") return { ...n, id: uid(), children: n.children.map(cloneNode) };
  return { ...n, ...cloneRequest(n), type: "request", id: uid(), examples: n.examples?.map((e) => ({ ...structuredClone(e), id: uid() })) };
}

/** Ids of a node and everything inside it. */
export function nodeIds(n: TreeNode): string[] {
  return n.type === "folder" ? [n.id, ...n.children.flatMap(nodeIds)] : [n.id];
}

export function insertNode(c: Collection, parentId: string | null, node: TreeNode): Collection {
  if (!parentId || parentId === c.id) return { ...c, children: [...c.children, node] };
  return {
    ...c,
    children: mapTree(c.children, parentId, (p) =>
      p.type === "folder" ? { ...p, children: [...p.children, node] } : p,
    ),
  };
}

export function listFolders(nodes: TreeNode[], depth = 0): { folder: FolderNode; depth: number }[] {
  const out: { folder: FolderNode; depth: number }[] = [];
  for (const n of nodes) {
    if (n.type === "folder") {
      out.push({ folder: n, depth });
      out.push(...listFolders(n.children, depth + 1));
    }
  }
  return out;
}

// ---------- URL <-> params sync ----------

export function parseQuery(url: string): { key: string; value: string }[] {
  const q = url.indexOf("?");
  if (q === -1) return [];
  const hash = url.indexOf("#", q);
  const qs = url.slice(q + 1, hash === -1 ? undefined : hash);
  if (!qs) return [];
  return qs.split("&").map((pair) => {
    const eq = pair.indexOf("=");
    return eq === -1 ? { key: pair, value: "" } : { key: pair.slice(0, eq), value: pair.slice(eq + 1) };
  });
}

/** More query params than any real request has; a table of them would hang the editor. */
export const MAX_PARAMS = 1000;

/** URL changed → rebuild enabled params, keep disabled ones. */
export function paramsFromUrl(url: string, prev: KV[]): KV[] {
  // the table shows at most MAX_PARAMS rows; the URL keeps its whole query, so what is sent does not change
  const parsed = parseQuery(url).slice(0, MAX_PARAMS);
  const enabledPrev = prev.filter((p) => p.enabled);
  const next = parsed.map((p, i) => {
    const old = enabledPrev[i];
    return old ? { ...old, key: p.key, value: p.value } : kv(p.key, p.value);
  });
  return [...next, ...prev.filter((p) => !p.enabled)];
}

/** Params changed → rewrite the query part of the URL. */
export function urlWithParams(url: string, params: KV[]): string {
  const q = url.indexOf("?");
  const hashIdx = url.indexOf("#");
  const base = q === -1 ? (hashIdx === -1 ? url : url.slice(0, hashIdx)) : url.slice(0, q);
  const hash = hashIdx === -1 ? "" : url.slice(hashIdx);
  const qs = params
    .filter((p) => p.enabled && p.key)
    .map((p) => (p.value === "" ? p.key : `${p.key}=${p.value}`))
    .join("&");
  return base + (qs ? `?${qs}` : "") + hash;
}

export function formatBytes(n: number): string {
  // non-breaking space keeps the figure and its unit together
  if (n < 1024) return `${n}\u00a0B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}\u00a0KB`;
  return `${(n / 1024 / 1024).toFixed(2)}\u00a0MB`;
}

/** Folder names from the collection root down to the node's parent, or null when absent. */
export function pathTo(nodes: TreeNode[], id: string, trail: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.id === id) return trail;
    if (n.type === "folder") {
      const hit = pathTo(n.children, id, [...trail, n.name]);
      if (hit) return hit;
    }
  }
  return null;
}

/** Requests below a node, recursively (the count shown beside folders). */
export function countRequests(nodes: TreeNode[]): number {
  return nodes.reduce((n, c) => n + (c.type === "request" ? 1 : countRequests(c.children)), 0);
}

/** Short method label for tight places: tree, tabs, history. */
export function methodLabel(m: string): string {
  const u = m.toUpperCase();
  return u === "DELETE" ? "DEL" : u === "OPTIONS" ? "OPT" : u === "GRPC" ? "gRPC" : u;
}

/** A history entry's status as shown: HTTP below 400 is good; for gRPC only code 0 (OK) is. */
export function entryStatus(h: { request: { method: string }; status?: number }): { text: string; ok: boolean } {
  if (h.status === undefined) return { text: "ERR", ok: false };
  if (h.request.method === "GRPC") return { text: h.status === 0 ? "OK" : String(h.status), ok: h.status === 0 };
  return { text: String(h.status), ok: h.status < 400 };
}

/** What makes two history entries the same request when neither names its saved request. */
const runKey = (r: RequestDef) => (r.method === "GRPC" ? `GRPC ${r.url} ${r.grpc?.service}/${r.grpc?.method}` : `${r.method} ${r.url}`);

/**
 * The earlier runs of a tab's request that can be shown again (a response was kept), newest first.
 * An entry made from a saved request matches that request only; older entries and unsaved tabs match on method and address.
 */
export function runsOf(history: HistoryEntry[], tab: Tab): HistoryEntry[] {
  if (tab.example) return [];
  const node = tab.savedRef?.nodeId;
  const key = runKey(tab.request);
  return history.filter((h) => h.kept && (node && h.ref ? h.ref === node : runKey(h.request) === key));
}
