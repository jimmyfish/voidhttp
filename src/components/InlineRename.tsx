import "./InlineRename.css";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { findNode } from "../lib/model";
import type { Tab } from "../types";

/**
 * In-place rename: Enter or leaving the field saves, Escape cancels.
 * Reports the trimmed new name, or null when nothing should change (cancelled, empty or unchanged).
 */
export function RenameField({ initial, onDone, className = "row-rename" }: { initial: string; onDone: (name: string | null) => void; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    const name = v?.trim();
    onDone(name && name !== initial ? name : null);
  };
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      className={className}
      defaultValue={initial}
      aria-label="New name"
      spellCheck={false}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(e.currentTarget.value);
        else if (e.key === "Escape") finish(null);
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}

/** Renames whatever the tab shows: its example, its saved request (tree and tab together), or just the unsaved tab. */
function renameTab(tab: Tab, name: string) {
  const s = useStore.getState();
  if (tab.example) return s.renameExample(tab.example, name);
  const ref = tab.savedRef;
  const col = ref && s.collections.find((c) => c.id === ref.collectionId);
  if (ref && col && findNode(col.children, ref.nodeId)) return s.renameNode(ref.collectionId, ref.nodeId, name);
  s.updateRequest(tab.id, { name });
}

/** The request's name in the pane's title row: click it to rename in place. */
export function TitleName({ tab }: { tab: Tab }) {
  const [editing, setEditing] = useState(false);
  const name = tab.request.name;
  if (editing) return <RenameField className="title-rename" initial={name} onDone={(v) => (setEditing(false), v !== null && renameTab(tab, v))} />;
  return (
    <button type="button" className="name" title="Rename" onClick={() => setEditing(true)}>
      {name}
    </button>
  );
}
