/**
 * voidHTTP's own export: collections and environments exactly as stored, so nothing is lost
 * (gRPC calls, saved examples, environment colours). Ids are made fresh on import.
 */
import type { Collection, Environment, RequestNode, TreeNode } from "../../types";
import { cloneNode, uid } from "../model";
import { newRequest } from "../model";
import { requestsOf, type Any, type ImportPlan } from "./common";

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

/** Fills fields a hand-edited or older file may miss, so the rest of the app can trust the shape. */
function sane(n: Any): TreeNode | null {
  if (!n || typeof n !== "object") return null;
  if (n.type === "folder") return { type: "folder", id: uid(), name: String(n.name ?? "Folder"), children: (Array.isArray(n.children) ? n.children : []).map(sane).filter(Boolean) as TreeNode[] };
  if (n.type !== "request") return null;
  const base = newRequest();
  const node: RequestNode = {
    ...base,
    ...n,
    type: "request",
    params: Array.isArray(n.params) ? n.params : [],
    headers: Array.isArray(n.headers) ? n.headers : [],
    body: { ...base.body, ...(n.body ?? {}) },
    auth: n.auth?.type ? n.auth : base.auth,
  };
  return cloneNode(node);
}

export function importNative(doc: Any): ImportPlan {
  if (Number(doc.voidhttp) > NATIVE_VERSION) throw new Error("This file is from a newer voidHTTP. Update the app to import it.");
  const collections: Collection[] = (Array.isArray(doc.collections) ? doc.collections : []).map((c: Any) => ({
    id: uid(),
    name: String(c.name ?? "Imported collection"),
    children: (Array.isArray(c.children) ? c.children : []).map(sane).filter(Boolean) as TreeNode[],
    variables: Array.isArray(c.variables) ? c.variables : [],
  }));
  const environments: Environment[] = (Array.isArray(doc.environments) ? doc.environments : []).map((e: Any) => ({
    id: uid(),
    name: String(e.name ?? "Imported environment"),
    variables: Array.isArray(e.variables) ? e.variables : [],
    ...(e.color && { color: e.color }),
  }));
  const n = collections.reduce((m, c) => m + requestsOf(c.children).length, 0);
  const parts = [
    collections.length === 1 ? collections[0].name : `${collections.length} collections`,
    `${n} request${n === 1 ? "" : "s"}`,
    environments.length && `${environments.length} environment${environments.length === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return { format: "voidhttp", label: "voidHTTP", detail: parts.join(" · "), collections, environments, notes: [] };
}
