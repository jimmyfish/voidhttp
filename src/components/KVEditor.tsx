import { useRef } from "react";
import type { KV, MultipartField } from "../types";
import { kv } from "../lib/model";
import { open } from "@tauri-apps/plugin-dialog";

type Row = KV | MultipartField;

interface Props<T extends Row> {
  rows: T[];
  onChange: (rows: T[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  /** multipart mode: each row can be text or a file path */
  files?: boolean;
}

/** Key/value table. An always-present trailing blank row grows the list as you type. */
export function KVEditor<T extends Row>({ rows, onChange, keyPlaceholder = "Key", valuePlaceholder = "Value", files }: Props<T>) {
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
      <tbody>
        {all.map((r, i) => {
          const isBlank = i === rows.length;
          const isFile = files && (r as MultipartField).kind === "file";
          return (
            <tr key={r.id} className={r.enabled ? "" : "off"}>
              <td className="kv-check">
                {!isBlank && (
                  <input type="checkbox" checked={r.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} />
                )}
              </td>
              <td>
                <input spellCheck={false} placeholder={keyPlaceholder} value={r.key} onChange={(e) => update(i, { key: e.target.value })} />
              </td>
              <td>
                {isFile ? (
                  <button className="file-pick" onClick={() => pickFile(i)} title={r.value}>
                    📎 {r.value.split(/[\\/]/).pop() || "Choose file…"}
                  </button>
                ) : (
                  <input spellCheck={false} placeholder={valuePlaceholder} value={r.value} onChange={(e) => update(i, { value: e.target.value })} />
                )}
              </td>
              {files && (
                <td className="kv-kind">
                  <select
                    value={(r as MultipartField).kind}
                    onChange={(e) => update(i, { kind: e.target.value, value: "" } as Partial<MultipartField>)}
                  >
                    <option value="text">Text</option>
                    <option value="file">File</option>
                  </select>
                </td>
              )}
              <td className="kv-del">
                {!isBlank && (
                  <button className="icon" title="Remove" onClick={() => remove(i)}>
                    ×
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
