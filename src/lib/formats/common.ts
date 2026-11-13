/**
 * Shared shapes for import and export. Every importer turns a file into an ImportPlan:
 * the collections and environments it would add, plus what changed on the way in.
 */
import { parse as parseYaml } from "yaml";
import type { Collection, Environment, KV, RequestDef, RequestNode, TreeNode } from "../../types";
import { isSecretKey } from "../mask";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Any = any;

export type FormatId = "postman" | "postman-env" | "openapi" | "swagger" | "har" | "voidhttp" | "commands";

/** One line of "Changed on the way in". `code` spans are written between backticks. */
export interface Note {
  level: "warn" | "info";
  text: string;
}

/** Where the text came from: a file path lets OpenAPI read `$ref` files beside it, a URL lets it fetch them. */
export interface Source {
  name: string;
  text: string;
  path?: string;
  url?: string;
}

export interface ImportPlan {
  format: FormatId;
  /** e.g. "OpenAPI 3.0.3" */
  label: string;
  /** e.g. "trx-service API v1.4.0 · 3 files joined by $ref" */
  detail: string;
  collections: Collection[];
  environments: Environment[];
  notes: Note[];
}

/** JSON, or YAML when it is not JSON. A byte-order mark is dropped first. */
export function parseDoc(text: string): unknown {
  const t = text.replace(/^﻿/, "");
  try {
    return JSON.parse(t);
  } catch {
    // fall through to YAML
  }
  try {
    return parseYaml(t, { maxAliasCount: 1000 });
  } catch {
    return undefined;
  }
}

const COMMAND = /^\s*(curl|grpcurl)(\.exe)?\s/i;

/** What a file or pasted text is, by its content. */
export function detect(text: string): { format: FormatId; doc?: Any } | null {
  if (COMMAND.test(text)) return { format: "commands" };
  const doc = parseDoc(text) as Any;
  if (!doc || typeof doc !== "object") return null;
  if (doc.voidhttp) return { format: "voidhttp", doc };
  if (typeof doc.openapi === "string") return { format: "openapi", doc };
  if (doc.swagger) return { format: "swagger", doc };
  if (Array.isArray(doc.log?.entries)) return { format: "har", doc };
  if (Array.isArray(doc.item)) return { format: "postman", doc };
  if (Array.isArray(doc.values)) return { format: "postman-env", doc };
  return null;
}

/** A value that is only a variable reference carries no secret. */
export const isVarRef = (v: string) => /^\s*\{\{[^}]+\}\}\s*$/.test(v);

/** Requests below a set of nodes, depth first. */
export function requestsOf(nodes: TreeNode[]): RequestNode[] {
  return nodes.flatMap((n) => (n.type === "folder" ? requestsOf(n.children) : [n]));
}

// ---------- secrets on export ----------

const blankKv = (rows: KV[]) => rows.map((r) => ({ ...r, value: "" }));
export const blankSecretKv = <T extends KV>(rows: T[]) => rows.map((r) => (isSecretKey(r.key) && !isVarRef(r.value) ? { ...r, value: "" } : r));

/** Literal tokens and passwords in a request are emptied; `{{variables}}` stay. */
export function scrubRequest<T extends RequestDef>(r: T): T {
  const a = r.auth;
  const auth =
    a.type === "bearer" && !isVarRef(a.token)
      ? { ...a, token: "" }
      : a.type === "basic" && !isVarRef(a.password)
        ? { ...a, password: "" }
        : a.type === "apikey" && !isVarRef(a.value)
          ? { ...a, value: "" }
          : a;
  return {
    ...r,
    auth,
    headers: blankSecretKv(r.headers),
    params: blankSecretKv(r.params),
    body: { ...r.body, form: blankSecretKv(r.body.form), multipart: blankSecretKv(r.body.multipart) },
  };
}

function scrubNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((n) =>
    n.type === "folder"
      ? { ...n, children: scrubNodes(n.children) }
      : { ...scrubRequest(n), examples: n.examples?.map((e) => ({ ...e, request: scrubRequest(e.request) })) },
  );
}

/** "Blank": environment values emptied, plus secret-looking collection values and literal credentials in requests. */
export function blankValues(c: Collection, envs: Environment[]): { collection: Collection; environments: Environment[] } {
  return {
    collection: { ...c, variables: blankSecretKv(c.variables), children: scrubNodes(c.children) },
    environments: envs.map((e) => ({ ...e, variables: blankKv(e.variables) })),
  };
}

/** A file name from a collection name: lower-case, no characters macOS or other systems choke on. */
export const fileStem = (name: string) =>
  name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase() || "collection";
