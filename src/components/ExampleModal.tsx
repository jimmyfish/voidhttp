import { useMemo, useState } from "react";
import { Select } from "./Select";
import { useStore } from "../store";
import type { Collection, HttpResponse, RequestDef, SavedRef, TreeNode } from "../types";
import { findNode, uid } from "../lib/model";
import { applyMasks, findSensitive, isCookieName, maskValue, type MaskStyle } from "../lib/mask";

/** Every saved request, as "Collection / Folder / Request", for the "Save under" list. */
function allRequests(collections: Collection[]): { ref: SavedRef; label: string; method: string; url: string }[] {
  const out: { ref: SavedRef; label: string; method: string; url: string }[] = [];
  const walk = (c: Collection, nodes: TreeNode[], trail: string[]) => {
    for (const n of nodes) {
      if (n.type === "folder") walk(c, n.children, [...trail, n.name]);
      else out.push({ ref: { collectionId: c.id, nodeId: n.id }, label: [...trail, n.name].join(" / "), method: n.method, url: n.url });
    }
  };
  for (const c of collections) walk(c, c.children, [c.name]);
  return out;
}

const key = (r: SavedRef) => `${r.collectionId}|${r.nodeId}`;

/**
 * Save a response as an example under a saved request. Sensitive values are found by name and masked
 * in the saved copy only; the tab and history keep what was received.
 */
export function ExampleModal({
  request,
  response,
  target,
  onClose,
}: {
  request: RequestDef;
  response: HttpResponse;
  target?: SavedRef;
  onClose: () => void;
}) {
  const s = useStore.getState();
  const requests = useMemo(() => allRequests(s.collections), [s.collections]);
  const [name, setName] = useState(`${response.status} ${response.statusText}`.trim());
  const [under, setUnder] = useState(() => {
    const col = target && s.collections.find((c) => c.id === target.collectionId);
    if (target && col && findNode(col.children, target.nodeId)) return key(target);
    // from history: the saved request with the same method and URL, when there is one
    const same = requests.find((r) => r.method === request.method && r.url === request.url);
    return same ? key(same.ref) : requests[0] ? key(requests[0].ref) : "";
  });
  const [style, setStyle] = useState<MaskStyle>("partial");
  const [extra, setExtra] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  // groups start ticked; this holds the ones the person unticked
  const [off, setOff] = useState<Set<string>>(new Set());

  const groups = useMemo(() => findSensitive(request, response, extra), [request, response, extra]);
  const chosen = groups.filter((g) => !off.has(g.id));

  const toggle = (id: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addField = () => {
    const v = typed.trim();
    if (!v) return;
    if (!extra.includes(v)) setExtra([...extra, v]);
    setTyped("");
  };

  const save = () => {
    const ref = requests.find((r) => key(r.ref) === under)?.ref;
    if (!ref || !name.trim()) return;
    const masked = applyMasks(request, response, chosen, style);
    s.saveExample(ref, {
      id: uid(),
      name: name.trim(),
      savedAt: Date.now(),
      request: masked.request,
      response: masked.response,
      masked: chosen.map((g) => `${g.where} ${g.label}`),
    });
    onClose();
  };

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog dialog--example" role="dialog" aria-modal="true" aria-label="Save as example">
        <h3>Save as example</h3>
        {requests.length === 0 ? (
          <>
            <p>Examples are kept under a saved request. Save this request to a collection first.</p>
            <footer>
              <button type="button" className="btn btn--primary" autoFocus onClick={onClose}>
                OK
              </button>
            </footer>
          </>
        ) : (
          <>
            <div className="ex-grid">
              <label>
                Name
                <input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} />
              </label>
              <label>
                Save under
                <Select className="field" value={under} onChange={(e) => setUnder(e.target.value)}>
                  {requests.map((r) => (
                    <option key={key(r.ref)} value={key(r.ref)}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="mask-head">
              <div className="set-text">
                <span className="set-label">Mask before saving</span>
                <span className="desc">Found by name. History keeps the original values.</span>
              </div>
              <div className="seg" role="group" aria-label="Mask style">
                <button type="button" aria-pressed={style === "partial"} onClick={() => setStyle("partial")}>
                  Partial
                </button>
                <button type="button" aria-pressed={style === "full"} onClick={() => setStyle("full")}>
                  Full
                </button>
              </div>
            </div>
            <div className="mask-list">
              {groups.length === 0 && (
                <p className="mask-none">Nothing sensitive found by name. Add a field below if something should be masked.</p>
              )}
              {groups.map((g) => {
                const on = !off.has(g.id);
                return (
                  <label key={g.id} className="mask-row">
                    <input type="checkbox" checked={on} onChange={() => toggle(g.id)} />
                    <span className="mask-where">{g.where}</span>
                    <code className="mask-path" title={g.locs.length > 1 ? `${g.label} (${g.locs.length} values)` : g.label}>
                      {g.label}
                      {g.locs.length > 1 && <span className="mask-n"> ×{g.locs.length}</span>}
                    </code>
                    <code className="mask-val">{on ? maskValue(g.sample, g.kind, style, isCookieName(g.label)) : g.sample}</code>
                  </label>
                );
              })}
              <form
                className="mask-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  addField();
                }}
              >
                <input
                  className="field"
                  placeholder="Mask another field: $.data[*].phone or X-Api-Key"
                  aria-label="Field to mask"
                  spellCheck={false}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                />
              </form>
            </div>
            <footer>
              <span className="mask-count">
                {chosen.length} of {groups.length} masked
              </span>
              <button type="button" className="btn" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" disabled={!name.trim()} onClick={save}>
                Save example
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
