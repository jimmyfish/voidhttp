import type { KV } from "../types";
import { uid } from "./model";

// one run of non-brace characters, trimmed by the callers: `\s*([^{}]+?)\s*` backtracked in cubic time on `{{` + spaces
const VAR_RE = /\{\{([^{}]*)\}\}/g;

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

/**
 * How much {{var}} substitution may add to a value: a variable that holds itself many times would grow without end.
 * Sending allows a large file-sized value; what runs on every render (`unresolved`) gets far less.
 */
const MAX_GROWTH = 64 << 20;
export const RENDER_GROWTH = 1 << 20;

/** What {{var}} substitution may still spend; one object can be shared by many fields (a whole render). */
export type Budget = { left: number };

/** Replaces {{var}} recursively (max depth 5 to stop cycles, and at most MAX_GROWTH characters added). */
export function resolve(input: string, scope: VarScope, depth = 0, budget = MAX_GROWTH): string {
  return resolveWithin(input, scope, { left: budget }, depth);
}

/**
 * `resolve` against a budget object: growth is charged, and so is each pass after the first (a chain of
 * same-length hops would otherwise rescan a large value for free). When it runs out, the rest stays as written.
 */
export function resolveWithin(input: string, scope: VarScope, budget: Budget, depth = 0): string {
  if (depth > 5 || !input.includes("{{") || budget.left <= 0) return input;
  if (depth > 0) budget.left -= input.length;
  const out = input.replace(VAR_RE, (m, raw: string) => {
    const name = raw.trim();
    if (!name) return m;
    const v = scope.get(name) ?? dynamic(name);
    if (v === undefined || v.length - m.length > budget.left) return m;
    budget.left -= Math.max(0, v.length - m.length);
    return v;
  });
  return out === input ? out : resolveWithin(out, scope, budget, depth + 1);
}

export function unresolved(input: string, scope: VarScope): string[] {
  const missing = new Set<string>();
  for (const m of resolve(input, scope, 0, RENDER_GROWTH).matchAll(VAR_RE)) if (m[1].trim()) missing.add(m[1].trim());
  return [...missing];
}
