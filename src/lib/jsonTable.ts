/**
 * Table view of a JSON response: which parts of the body can be a table, the rows and columns at a path,
 * and the text a copied table becomes. Pure functions; the view is src/components/JsonTable.tsx.
 *
 * A path is a list of object keys and array indexes from the root. `"*"` after an array fans out:
 * `["data", "*", "hobbies"]` is every hobby of every item of `data`, in one table.
 */

export type PathKey = string | number;
export type Path = PathKey[];

/** One row of an array table. `path` is its real place in the body (no `*`). */
export interface Row {
  v: unknown;
  /** index shown in the # column: its index in its own array, or its running number in a fanned-out table */
  index: number;
  path: Path;
  /** fanned-out rows: the index taken at each `*`, and a short name for the parent row */
  from?: number[];
  label?: string;
}

export interface Column {
  name: string;
  /** every value is a number (or null / missing): right-aligned */
  numeric: boolean;
}

export type TableData =
  | { kind: "object"; entries: [string, unknown][] }
  | { kind: "array"; rows: Row[]; columns: Column[]; scalar: boolean; parent?: string };

export interface Source {
  path: Path;
  /** "6 rows", "4 fields" */
  what: string;
  /** rows for an array, fields for an object: used to pick the default */
  size: number;
  array: boolean;
}

export const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
export const isNested = (v: unknown): v is object => v !== null && typeof v === "object";

/** `$.data[*].hobbies[0]` */
export const jsonPathOf = (path: Path) =>
  "$" + path.map((k) => (k === "*" ? "[*]" : typeof k === "number" ? `[${k}]` : /^[A-Za-z_$][\w$]*$/.test(k) ? `.${k}` : `[${JSON.stringify(k)}]`)).join("");

/** How a path step reads in the trail. */
export const crumbOf = (k: PathKey) => (k === "*" ? "[*]" : typeof k === "number" ? `[${k}]` : k);

/** A short name for a row: its first non-empty string field. */
export function labelOf(v: unknown): string {
  if (!isObj(v)) return "";
  for (const x of Object.values(v)) if (typeof x === "string" && x) return x;
  return "";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Stop listing sources here; a body with thousands of nested arrays does not need them all in a menu. */
const MAX_SOURCES = 200;
const MAX_DEPTH = 12;

/**
 * Every array or object the rows can come from, in body order. An array of objects also offers
 * `[*].key` for each key that holds arrays of objects in its items.
 */
export function sources(root: unknown): Source[] {
  const out: Source[] = [];
  const walk = (v: unknown, path: Path, depth: number) => {
    if (out.length >= MAX_SOURCES || depth > MAX_DEPTH) return;
    if (Array.isArray(v)) {
      out.push({ path, what: plural(v.length, "row", "rows"), size: v.length, array: true });
      const objs = v.filter(isObj);
      const keys = new Set<string>();
      for (const o of objs) for (const k of Object.keys(o)) keys.add(k);
      for (const k of keys) {
        const all = objs.flatMap((o) => (Array.isArray(o[k]) ? (o[k] as unknown[]) : []));
        if (all.some(isObj)) walk(all, [...path, "*", k], depth + 1);
      }
    } else if (isObj(v)) {
      const n = Object.keys(v).length;
      out.push({ path, what: plural(n, "field", "fields"), size: n, array: false });
      for (const [k, x] of Object.entries(v)) walk(x, [...path, k], depth + 1);
    }
  };
  walk(root, [], 0);
  return out;
}

/** Where a new response opens: the biggest array of objects without a `*`, else the root. */
export function defaultPath(root: unknown, list = sources(root)): Path {
  let best: Source | undefined;
  for (const s of list) {
    if (!s.array || s.path.includes("*")) continue;
    const v = valueAt(root, s.path);
    if (!Array.isArray(v) || !v.some(isObj)) continue;
    if (!best || s.size > best.size) best = s;
  }
  return best?.path ?? [];
}

/** The value at a path without `*`; undefined when it is not there. */
export function valueAt(root: unknown, path: Path): unknown {
  let v: unknown = root;
  for (const k of path) {
    if (v === null || typeof v !== "object") return undefined;
    v = (v as Record<string, unknown>)[k as string];
  }
  return v;
}

/** The values a path reaches, each with the indexes taken at its `*` steps. */
function fanOut(root: unknown, path: Path): { v: unknown; from: number[] }[] {
  let cur: { v: unknown; from: number[] }[] = [{ v: root, from: [] }];
  for (const k of path) {
    if (k === "*") cur = cur.flatMap((c) => (Array.isArray(c.v) ? c.v.map((x, i) => ({ v: x, from: [...c.from, i] })) : []));
    else
      cur = cur
        .map((c) => ({ v: c.v !== null && typeof c.v === "object" ? (c.v as Record<string, unknown>)[k as string] : undefined, from: c.from }))
        .filter((c) => c.v !== undefined);
  }
  return cur;
}

/** A path with each `*` replaced by the index it went through. */
const realPath = (path: Path, from: number[]) => {
  let j = 0;
  return path.map((k) => (k === "*" ? from[j++] : k));
};

function columnsOf(rows: Row[]): { columns: Column[]; scalar: boolean } {
  if (rows.some((r) => !isObj(r.v))) {
    return { scalar: true, columns: [{ name: "value", numeric: rows.every((r) => r.v === null || typeof r.v === "number") }] };
  }
  const names = new Map<string, boolean>();
  for (const r of rows) {
    for (const [k, x] of Object.entries(r.v as Record<string, unknown>)) {
      const num = x === null || typeof x === "number";
      names.set(k, (names.get(k) ?? true) && num);
    }
  }
  return { scalar: false, columns: [...names].map(([name, numeric]) => ({ name, numeric })) };
}

/** An array as rows. `base` is the array's own path (for the real path of each row). */
export function arrayTable(arr: unknown[], base: Path): TableData {
  const rows = arr.map((v, i) => ({ v, index: i, path: [...base, i] }));
  return { kind: "array", rows, ...columnsOf(rows) };
}

/** The table at a path: an object as Field | Value, an array (or a fanned-out path) as rows. null = nothing there. */
export function tableAt(root: unknown, path: Path): TableData | null {
  const star = path.lastIndexOf("*");
  if (star < 0) {
    const v = valueAt(root, path);
    if (Array.isArray(v)) return arrayTable(v, path);
    if (isObj(v)) return { kind: "object", entries: Object.entries(v) };
    return null;
  }
  if (path[path.length - 1] === "*") return null;
  const rows: Row[] = [];
  for (const c of fanOut(root, path)) {
    const parentPath = realPath(path.slice(0, star + 1), c.from);
    const label = labelOf(valueAt(root, parentPath));
    const list = Array.isArray(c.v) ? c.v : [c.v];
    const own = realPath(path, c.from);
    list.forEach((v, i) => rows.push({ v, index: rows.length, path: Array.isArray(c.v) ? [...own, i] : own, from: c.from, label }));
  }
  const parent = path[star - 1];
  return { kind: "array", rows, parent: parent === undefined ? "" : String(parent), ...columnsOf(rows) };
}

/** Sort order for one column: numbers by value, everything else as text; missing and null last either way. */
export function compareCells(a: unknown, b: unknown, dir: 1 | -1): number {
  const none = (x: unknown) => x === undefined || x === null;
  if (none(a) || none(b)) return none(a) === none(b) ? 0 : none(a) ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * dir;
  const s = (x: unknown) => (typeof x === "object" ? JSON.stringify(x) : String(x));
  return s(a).localeCompare(s(b), undefined, { numeric: true }) * dir;
}

/** A value as one spreadsheet cell: tabs and line breaks become spaces. */
function tsvCell(v: unknown): string {
  if (v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.replace(/[\t\r\n]+/g, " ");
}

/** The table as tab-separated text, header first, ready to paste into a spreadsheet. */
export function toTsv(data: TableData, rows?: Row[]): string {
  if (data.kind === "object") return ["Field\tValue", ...data.entries.map(([k, v]) => `${tsvCell(k)}\t${tsvCell(v)}`)].join("\n");
  const list = rows ?? data.rows;
  const head = [...(data.parent !== undefined ? [data.parent] : []), ...data.columns.map((c) => c.name)];
  const body = list.map((r) => {
    const lead = data.parent !== undefined ? [`[${r.from?.join("][") ?? ""}]${r.label ? ` ${r.label}` : ""}`] : [];
    const cells = data.scalar ? [tsvCell(r.v)] : data.columns.map((c) => tsvCell((r.v as Record<string, unknown>)[c.name]));
    return [...lead, ...cells].join("\t");
  });
  return [head.map(tsvCell).join("\t"), ...body].join("\n");
}
