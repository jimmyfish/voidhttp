import { useRef } from "react";
import type { KV, MultipartField } from "../types";
import { kv } from "../lib/model";
import { open } from "@tauri-apps/plugin-dialog";
import { Paperclip, X, ico } from "./Icon";

type Row = KV | MultipartField;

interface Props<T extends Row> {
  rows: T[];
  onChange: (rows: T[]) => void;
  /** column heads */
  nameLabel?: string;
  valueLabel?: string;
  /** placeholder of the trailing blank row, e.g. "Add a param" */
  addLabel?: string;
  /** multipart mode: each row can be text or a file path */
  files?: boolean;
}

/** Key/value table. An always-present trailing blank row grows the list as you type. */
export function KVEditor<T extends Row>({ rows, onChange, nameLabel = "Name", valueLabel = "Value", addLabel = "Add a row", files }: Props<T>) {
  // Stable id for the trailing blank row, so focus survives re-renders.
  const blankRef = useRef<T | null>(null);
  if (!blankRef.current || rows.some((r) => r.id === blankRef.current!.id)) {
    blankRef.current = (files ? { ...kv(), kind: "text" } : kv()) as T;
  }
  const blank = blankRef.current;
  const all = [...rows, blank];

  const update = (i: number, patch: Partial<Row>) => {
    const next = all.map((r, j) => (j === i ? ({ ...r, ...patch } as T) : r));
    // drop the trailing blank unless it was just filled
    const last = next[next.length - 1];
    const touched = last.key || last.value || (files && (last as MultipartField).kind === "file");
    onChange(touched ? next : next.slice(0, -1));
  };
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));

  const pickFile = async (i: number) => {
    const path = await open({ multiple: false, directory: false });
    if (typeof path === "string") update(i, { value: path, kind: "file" } as Partial<MultipartField>);
  };

  return (
    <table className="kv">
      <thead>
        <tr>
          <th className="check">
            <span className="visually-hidden">Enabled</span>
          </th>
          <th>{nameLabel}</th>
          <th>{valueLabel}</th>
          {files && <th style={{ width: 110 }}>Type</th>}
          <th className="del">
            <span className="visually-hidden">Remove</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {all.map((r, i) => {
          const isBlank = i === rows.length;
          const isFile = files && (r as MultipartField).kind === "file";
          return (
            <tr key={r.id} className={isBlank ? "add" : r.enabled ? "" : "off"}>
              <td className="check">
                {!isBlank && (
                  <input type="checkbox" aria-label="Enabled" checked={r.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} />
                )}
              </td>
              <td>
                <input
                  className="field"
                  spellCheck={false}
                  aria-label={nameLabel}
                  placeholder={isBlank ? addLabel : nameLabel}
                  value={r.key}
                  onChange={(e) => update(i, { key: e.target.value })}
                />
              </td>
              <td>
                {isFile ? (
                  <button type="button" className="btn file-pick" onClick={() => pickFile(i)} title={r.value}>
                    <Paperclip {...ico} />
                    <span>{r.value.split(/[\\/]/).pop() || "Choose file…"}</span>
                  </button>
                ) : (
                  <input
                    className="field"
                    spellCheck={false}
                    aria-label={valueLabel}
                    placeholder={valueLabel}
                    value={r.value}
                    onChange={(e) => update(i, { value: e.target.value })}
                  />
                )}
              </td>
              {files && (
                <td>
                  <select
                    className="field"
                    aria-label="Field type"
                    value={(r as MultipartField).kind}
                    onChange={(e) => update(i, { kind: e.target.value, value: "" } as Partial<MultipartField>)}
                  >
                    <option value="text">Text</option>
                    <option value="file">File</option>
                  </select>
                </td>
              )}
              <td className="del">
                {!isBlank && (
                  <button type="button" className="icon-btn" title="Remove" aria-label="Remove row" onClick={() => remove(i)}>
                    <X {...ico} />
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
