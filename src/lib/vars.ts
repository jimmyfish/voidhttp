import type { KV } from "../types";
import { uid } from "./model";

const VAR_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

export type VarScope = Map<string, string>;

/** Collection vars first, environment overrides (Postman precedence). */
export function buildScope(...layers: (KV[] | undefined)[]): VarScope {
  const scope: VarScope = new Map();
  for (const layer of layers) {
    for (const v of layer ?? []) if (v.enabled && v.key) scope.set(v.key, v.value);
  }
  return scope;
}

export const DYNAMIC = ["$guid", "$randomUUID", "$timestamp", "$isoTimestamp", "$randomInt"];

function dynamic(name: string): string | undefined {
  switch (name) {
    case "$guid":
    case "$randomUUID":
      return uid();
    case "$timestamp":
      return String(Math.floor(Date.now() / 1000));
    case "$isoTimestamp":
      return new Date().toISOString();
    case "$randomInt":
      return String(Math.floor(Math.random() * 1001));
    default:
      return undefined;
  }
}

/** Replaces {{var}} recursively (max depth 5 to stop cycles). */
export function resolve(input: string, scope: VarScope, depth = 0): string {
  if (depth > 5 || !input.includes("{{")) return input;
  const out = input.replace(VAR_RE, (m, name: string) => {
    const v = scope.get(name) ?? dynamic(name);
    return v === undefined ? m : v;
  });
  return out === input ? out : resolve(out, scope, depth + 1);
}

export function unresolved(input: string, scope: VarScope): string[] {
  const missing = new Set<string>();
  for (const m of resolve(input, scope).matchAll(VAR_RE)) missing.add(m[1]);
  return [...missing];
}
