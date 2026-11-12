import type { KV } from "../types";
import { kv } from "./model";

/** Variables as text: a flat JSON object, or .env lines. Both round-trip back to rows. */
export type VarsFormat = "table" | "json" | "env";

/** Reuse the id of the row that had this key, so the table keeps its focus and order keys. */
function rowFor(prev: KV[], used: Set<string>, key: string, value: string, enabled: boolean): KV {
  const hit = prev.find((r) => r.key === key && !used.has(r.id));
  if (hit) {
    used.add(hit.id);
    return { ...hit, value, enabled };
  }
  return kv(key, value, enabled);
}

/** Enabled rows only: JSON has no comments, so disabled rows stay out and are kept as they are. */
export function toJson(rows: KV[]): string {
  const o: Record<string, string> = {};
  for (const r of rows) if (r.enabled && r.key) o[r.key] = r.value;
  return JSON.stringify(o, null, 2);
}

export function fromJson(text: string, prev: KV[]): KV[] {
  const data: unknown = text.trim() ? JSON.parse(text) : {};
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Expected an object, like { \"baseUrl\": \"https://…\" }");
  const used = new Set<string>();
  const out: KV[] = [];
  for (const [key, v] of Object.entries(data as Record<string, unknown>)) {
    if (v !== null && typeof v === "object") throw new Error(`“${key}”: values must be text, numbers or booleans`);
    out.push(rowFor(prev, used, key, v === null ? "" : String(v), true));
  }
  // disabled rows are not in the JSON; keep those whose key was not written back as enabled
  const keys = new Set(out.map((r) => r.key));
  for (const r of prev) if (!r.enabled && r.key && !keys.has(r.key)) out.push(r);
  return out;
}

const needsQuotes = (v: string) => /^\s|\s$|[\n\r"'#]/.test(v);

/** KEY=value per line; a disabled row is written as a comment: # KEY=value */
export function toDotenv(rows: KV[]): string {
  return rows
    .filter((r) => r.key)
    .map((r) => `${r.enabled ? "" : "# "}${r.key}=${needsQuotes(r.value) ? JSON.stringify(r.value) : r.value}`)
    .join("\n");
}

function unquote(v: string): string {
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  return v;
}

export function fromDotenv(text: string, prev: KV[]): KV[] {
  const used = new Set<string>();
  const out: KV[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith("#")) {
      // "# KEY=value" is a disabled variable; any other comment is ignored
      const m = /^#\s*([A-Za-z_][\w.-]*)\s*=(.*)$/.exec(line);
      if (m) out.push(rowFor(prev, used, m[1], unquote(m[2].trim()), false));
      return;
    }
    const m = /^(?:export\s+)?([^=\s]+)\s*=(.*)$/.exec(line);
    if (!m) throw new Error(`Line ${i + 1}: expected KEY=value`);
    out.push(rowFor(prev, used, m[1], unquote(m[2].trim()), true));
  });
  return out;
}

export const formatVars = (f: VarsFormat, rows: KV[]) => (f === "json" ? toJson(rows) : toDotenv(rows));
export const parseVars = (f: VarsFormat, text: string, prev: KV[]) => (f === "json" ? fromJson(text, prev) : fromDotenv(text, prev));
