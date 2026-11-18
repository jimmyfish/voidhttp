import { Fragment, useCallback, useMemo, useState } from "react";
import {
  type Path,
  type Row,
  type TableData,
  compareCells,
  crumbOf,
  defaultPath,
  isNested,
  isObj,
  jsonPathOf,
  labelOf,
  sources,
  tableAt,
  arrayTable,
  toTsv,
} from "../lib/jsonTable";
import { useDismiss } from "./useDismiss";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check, ChevronDown, ChevronRight, Filter, Table2, ico } from "./Icon";

/**
 * Table view of a static JSON response (REST, GraphQL, gRPC unary). Live message lists never get one.
 * The rows come from a path in the body; nested values open as tables under their row.
 */

/** Rows drawn before "Show all"; nested tables stop here and offer "Open as table". */
const ROW_LIMIT = 500;
/** Longer strings are cut in the cell (the full value stays in the body and in Copy). */
const CELL_CHARS = 2000;

/** The path each tab's table reads from, kept while the app runs (the pane remounts on every tab switch). */
const paths = new Map<string, Path>();

type Sort = { col: string; dir: 1 | -1 } | null;

export interface TableModel {
  data: TableData | null;
  path: Path;
  /** the rows are a JSONPath filter's result: no trail, no picker */
  filtered: boolean;
  sources: ReturnType<typeof sources>;
  /** array rows after search and sort */
  rows: Row[];
  entries: [string, unknown][];
  search: string;
  sort: Sort;
  open: Set<string>;
  count: string;
  /** "3 of 6 rows" while searching */
  status: string;
  go(path: Path): void;
  toggleSort(col: string): void;
  toggleOpen(path: Path): void;
  tsv(): string;
}

const keyOf = (p: Path) => JSON.stringify(p);

/**
 * The table for `root` (the parsed body, or a JSONPath result when `filtered`). `root` undefined = no table.
 * Call it on every render; it returns null when there is nothing to show.
 */
export function useJsonTable(tabId: string, root: unknown, filtered: boolean, search: string): TableModel | null {
  const [saved, setSaved] = useState<Path | undefined>(() => paths.get(tabId));
  const [sort, setSort] = useState<Sort>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const active = root !== undefined;

  const list = useMemo(() => (active && !filtered ? sources(root) : []), [active, filtered, root]);
  const path = useMemo((): Path => {
    if (!active || filtered) return [];
    // a new response keeps the tab's path when it still leads somewhere
    return saved && tableAt(root, saved) ? saved : defaultPath(root, list);
  }, [active, filtered, root, list, saved]);
  const data = useMemo(() => {
    if (!active) return null;
    if (filtered) return Array.isArray(root) ? arrayTable(root, []) : isObj(root) ? ({ kind: "object", entries: Object.entries(root) } as TableData) : null;
    return tableAt(root, path);
  }, [active, filtered, root, path]);

  const needle = search.toLowerCase();
  // each row as lower-case text once, only while searching
  const hay = useMemo(
    () => (needle && data?.kind === "array" ? data.rows.map((r) => (JSON.stringify(r.v) + (r.label ? ` ${r.label}` : "")).toLowerCase()) : null),
    [data, needle !== ""],
  );

  const rows = useMemo(() => {
    if (data?.kind !== "array") return [];
    let out = hay ? data.rows.filter((_, i) => hay[i].includes(needle)) : data.rows;
    if (sort) {
      const { col, dir } = sort;
      const get = (r: Row) => (data.scalar ? r.v : (r.v as Record<string, unknown>)[col]);
      out = [...out].sort((a, b) => compareCells(get(a), get(b), dir));
    }
    return out;
  }, [data, hay, needle, sort]);

  const entries = useMemo(() => {
    if (data?.kind !== "object") return [];
    return needle ? data.entries.filter((e) => JSON.stringify(e).toLowerCase().includes(needle)) : data.entries;
  }, [data, needle]);

  const go = useCallback(
    (p: Path) => {
      paths.set(tabId, p);
      setSaved(p);
      setSort(null);
      setOpen(new Set());
    },
    [tabId],
  );
  const toggleSort = useCallback((col: string) => setSort((s) => (s?.col !== col ? { col, dir: 1 } : s.dir === 1 ? { col, dir: -1 } : null)), []);
  const toggleOpen = useCallback(
    (p: Path) =>
      setOpen((s) => {
        const next = new Set(s);
        const k = keyOf(p);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      }),
    [],
  );

  if (!data) return null;
  const all = data.kind === "array" ? data.rows.length : data.entries.length;
  const shown = data.kind === "array" ? rows.length : entries.length;
  const unit = data.kind === "array" ? "rows" : "fields";
  return {
    data,
    path,
    filtered,
    sources: list,
    rows,
    entries,
    search: needle ? search : "",
    sort,
    open,
    count:
      data.kind === "array"
        ? `${all} ${all === 1 ? "row" : "rows"} · ${data.columns.length + (data.parent !== undefined ? 1 : 0)} ${data.columns.length === 1 ? "column" : "columns"}`
        : `${all} ${all === 1 ? "field" : "fields"}`,
    status: needle ? (shown ? `${shown} of ${all} ${unit}` : "No matches") : "",
    go,
    toggleSort,
    toggleOpen,
    tsv: () => toTsv(data.kind === "object" ? { kind: "object", entries } : data, rows),
  };
}

/** Where the rows come from ($ › data › [*] › hobbies), the picker of every other table in the body, and the size. */
export function TableTrail({ m }: { m: TableModel }) {
  const [menu, setMenu] = useState(false);
  const close = useCallback(() => setMenu(false), []);
  const ref = useDismiss(menu, close);
  const cur = keyOf(m.path);

  if (m.filtered)
    return (
      <span className="jt-trail" aria-label="Rows from">
        <span aria-current="location">
          <Filter {...ico} />
          JSONPath result
        </span>
      </span>
    );

  const steps: React.ReactNode[] = [];
  const crumb = (label: string, p: Path | null, last: boolean, key: string) =>
    last || !p ? (
      <span key={key} aria-current={last ? "location" : undefined}>
        {label}
      </span>
    ) : (
      <button key={key} type="button" title={jsonPathOf(p)} onClick={() => m.go(p)}>
        {label}
      </button>
    );
  steps.push(crumb("$", [], m.path.length === 0, "root"));
  m.path.forEach((k, i) => {
    steps.push(<ChevronRight key={`s${i}`} {...ico} />);
    // a `*` step is not a table of its own: it reads as part of the trail only
    steps.push(crumb(String(crumbOf(k)), k === "*" ? null : m.path.slice(0, i + 1), i === m.path.length - 1, `k${i}`));
  });

  return (
    <>
      <div className="snip-wrap" ref={ref}>
        <span className="jt-trail" aria-label="Rows from">
          {steps}
          <button
            type="button"
            className="icon-btn"
            title="Pick rows from…"
            aria-label="Pick rows from"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <ChevronDown {...ico} />
          </button>
        </span>
        {menu && (
          <div className="menu jt-pick-menu" role="menu" aria-label="Rows from">
            {m.sources.map((s) => {
              const on = keyOf(s.path) === cur;
              return (
                <button
                  key={keyOf(s.path)}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => {
                    m.go(s.path);
                    setMenu(false);
                  }}
                >
                  {on ? <Check {...ico} className="ico ok" /> : <span className="slot" />}
                  <code>{jsonPathOf(s.path)}</code>
                  <span className="what">{s.what}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <span className="count-lbl">{m.count}</span>
    </>
  );
}

/** The table itself: sticky head, sticky # column, nested values opening under their row. */
export function TableView({ m, wrap, example }: { m: TableModel; wrap: boolean; example: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const data = m.data!;
  const cls = `jt${wrap ? " wrap" : ""}`;

  if (data.kind === "object")
    return (
      <div className="jt-wrap">
        <table className={cls} aria-label="Response as a table">
          <ObjectRows entries={m.entries} base={m.filtered ? [] : m.path} m={m} example={example} />
        </table>
        {m.entries.length === 0 && <p className="jt-none">{m.search ? "No matches" : "Empty object"}</p>}
      </div>
    );

  const many = !showAll && m.rows.length > ROW_LIMIT;
  const rows = many ? m.rows.slice(0, ROW_LIMIT) : m.rows;
  const fanned = data.parent !== undefined;
  const span = data.columns.length + (fanned ? 1 : 0);
  return (
    <>
      <div className="jt-wrap">
        <table className={cls} aria-label="Response as a table">
          <thead>
            <tr>
              <th className="ix">#</th>
              {fanned && (
                <th>
                  <span className="th">{data.parent}</span>
                </th>
              )}
              {data.columns.map((c) => {
                const on = m.sort?.col === c.name ? m.sort.dir : 0;
                return (
                  <th key={c.name} className={c.numeric ? "num" : undefined} aria-sort={on === 1 ? "ascending" : on === -1 ? "descending" : undefined}>
                    <button type="button" title={`Sort by ${c.name}`} onClick={() => m.toggleSort(c.name)}>
                      {c.name}
                      {on === 1 ? <ArrowUpNarrowWide {...ico} /> : <ArrowDownWideNarrow {...ico} />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={keyOf(r.path)}>
                <tr>
                  <td className="ix">{r.index}</td>
                  {fanned && (
                    <td className="from" title={jsonPathOf(r.path.slice(0, -1))}>
                      [{r.from?.join("][")}]{r.label && <span> {r.label}</span>}
                    </td>
                  )}
                  {data.scalar ? (
                    <Cell v={r.v} path={r.path} m={m} example={example} />
                  ) : (
                    data.columns.map((c) => <Cell key={c.name} v={(r.v as Record<string, unknown>)[c.name]} path={[...r.path, c.name]} m={m} example={example} />)
                  )}
                </tr>
                {!data.scalar && <SubRows obj={r.v as Record<string, unknown>} base={r.path} span={span} lead m={m} example={example} />}
              </Fragment>
            ))}
          </tbody>
        </table>
        {m.rows.length === 0 && <p className="jt-none">{m.search ? "No matches" : "Empty array"}</p>}
      </div>
      {many && (
        <p className="truncated">
          Showing the first {ROW_LIMIT.toLocaleString()} of {m.rows.length.toLocaleString()} rows.
          <button type="button" className="btn btn--quiet" onClick={() => setShowAll(true)}>
            Show all
          </button>
        </p>
      )}
    </>
  );
}

function ObjectRows({ entries, base, m, example }: { entries: [string, unknown][]; base: Path; m: TableModel; example: boolean }) {
  return (
    <>
      <thead>
        <tr>
          <th>
            <span className="th">Field</span>
          </th>
          <th>
            <span className="th">Value</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([k, v]) => (
          <Fragment key={k}>
            <tr>
              <td className="key">
                <Marked text={k} q={m.search} />
              </td>
              <Cell v={v} path={[...base, k]} m={m} example={example} />
            </tr>
            <SubRows obj={{ [k]: v }} base={base} span={2} m={m} example={example} />
          </Fragment>
        ))}
      </tbody>
    </>
  );
}

/** The opened nested values of one row, each as a table in a row of its own under it. */
function SubRows({ obj, base, span, lead, m, example }: { obj: Record<string, unknown>; base: Path; span: number; lead?: boolean; m: TableModel; example: boolean }) {
  if (!isObj(obj) || m.open.size === 0) return null;
  return (
    <>
      {Object.entries(obj).map(([k, v]) => {
        const p = [...base, k];
        if (!isNested(v) || !m.open.has(keyOf(p))) return null;
        const arr = Array.isArray(v);
        const n = arr ? v.length : Object.keys(v).length;
        return (
          <tr key={k} className="jt-sub">
            {lead && <td className="ix" />}
            <td colSpan={span}>
              <div className="jt-subwrap">
                <div className="jt-subhead">
                  <code>{k}</code>
                  <span>{arr ? `${n} ${n === 1 ? "row" : "rows"}` : `${n} ${n === 1 ? "field" : "fields"}`}</span>
                  {/* a JSONPath result has no place in the body to open */}
                  {!m.filtered && (
                    <button type="button" className="btn btn--quiet" onClick={() => m.go(p)}>
                      <Table2 {...ico} />
                      Open as table
                    </button>
                  )}
                </div>
                <table className="jt">
                  {arr ? <NestedArray arr={v} base={p} m={m} example={example} /> : <ObjectRows entries={Object.entries(v)} base={p} m={m} example={example} />}
                </table>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

/** An array inside a row: no sorting or row filter, marks only; long ones stop and point to "Open as table". */
function NestedArray({ arr, base, m, example }: { arr: unknown[]; base: Path; m: TableModel; example: boolean }) {
  const data = arrayTable(arr, base);
  if (data.kind !== "array") return null;
  const rows = data.rows.slice(0, ROW_LIMIT);
  return (
    <>
      <thead>
        <tr>
          <th className="ix">#</th>
          {data.columns.map((c) => (
            <th key={c.name} className={c.numeric ? "num" : undefined}>
              <span className="th">{c.name}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Fragment key={r.index}>
            <tr>
              <td className="ix">{r.index}</td>
              {data.scalar ? (
                <Cell v={r.v} path={r.path} m={m} example={example} />
              ) : (
                data.columns.map((c) => <Cell key={c.name} v={(r.v as Record<string, unknown>)[c.name]} path={[...r.path, c.name]} m={m} example={example} />)
              )}
            </tr>
            {!data.scalar && <SubRows obj={r.v as Record<string, unknown>} base={r.path} span={data.columns.length} lead m={m} example={example} />}
          </Fragment>
        ))}
        {arr.length > ROW_LIMIT && (
          <tr>
            <td className="ix" />
            <td colSpan={data.columns.length} className="more">
              {(arr.length - ROW_LIMIT).toLocaleString()} more rows{m.filtered ? "" : ". Open as table to see them all."}
            </td>
          </tr>
        )}
      </tbody>
    </>
  );
}

/** One value: same colours as the code view, strings without quotes, null spelled out, a missing key left blank. */
function Cell({ v, path, m, example }: { v: unknown; path: Path; m: TableModel; example: boolean }) {
  if (v === undefined) return <td />;
  if (v === null) return <td className="null">null</td>;
  if (isNested(v)) {
    const arr = Array.isArray(v);
    const n = arr ? v.length : Object.keys(v).length;
    const isOpen = m.open.has(keyOf(path));
    // a peek of what is inside: plain values as they are, objects by their first string field
    const peek = arr && !isOpen ? v.map((x) => (isNested(x) ? labelOf(x) : String(x))).filter(Boolean).join(", ").slice(0, 200) : "";
    return (
      <td>
        <button
          type="button"
          className="jt-nest"
          aria-expanded={isOpen}
          title={`${isOpen ? "Hide" : "Show"} ${n} ${arr ? (n === 1 ? "item" : "items") : n === 1 ? "field" : "fields"}`}
          onClick={() => m.toggleOpen(path)}
        >
          <span className="br">{arr ? "[" : "{"}</span>
          {n}
          <span className="br">{arr ? "]" : "}"}</span>
        </button>
        {peek && (
          <span className="peek">
            <Marked text={peek} q={m.search} />
          </span>
        )}
      </td>
    );
  }
  if (typeof v === "string") {
    if (v === "") return <td className="empty-str">""</td>;
    const text = v.length > CELL_CHARS ? `${v.slice(0, CELL_CHARS)}…` : v;
    return (
      <td className="str" title={v.length <= CELL_CHARS ? v : undefined}>
        {/* in an example, tint the values that were masked when it was saved */}
        {example && v.includes("•") ? <span className="masked">{text}</span> : <Marked text={text} q={m.search} />}
      </td>
    );
  }
  if (typeof v === "number")
    return (
      <td className="num">
        <Marked text={String(v)} q={m.search} />
      </td>
    );
  return <td className="bool">{String(v)}</td>;
}

/** `text` with every case-insensitive match of `q` in <mark class="hit">. */
function Marked({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const low = text.toLowerCase();
  const n = q.toLowerCase();
  const out: React.ReactNode[] = [];
  let at = 0;
  for (let i = low.indexOf(n); i >= 0; i = low.indexOf(n, i + n.length)) {
    if (i > at) out.push(text.slice(at, i));
    out.push(
      <mark key={i} className="hit">
        {text.slice(i, i + n.length)}
      </mark>,
    );
    at = i + n.length;
  }
  if (at === 0) return <>{text}</>;
  out.push(text.slice(at));
  return <>{out}</>;
}
