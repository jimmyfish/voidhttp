import "./BuildTag.css";
import { DEV_BUILD } from "../build";
import { useStore } from "../store";
import { Bug, ico } from "./Icon";

/** "DEV 8b686a8+" in the title strip, left of the Settings gear. Only in a dev build; a click opens About. */
export function BuildTag() {
  if (!DEV_BUILD) return null;
  const b = DEV_BUILD;
  const where = [b.describe, b.branch && `on branch ${b.branch}`].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      className="build-tag"
      title={`Dev build${where ? ` · ${where}` : ""} · click for details`}
      aria-label="Dev build, details"
      onClick={() => useStore.getState().openModal({ kind: "about" })}
    >
      <Bug {...ico} />
      DEV
      {b.sha && (
        <span className="sha">
          {b.sha}
          {b.dirty ? "+" : ""}
        </span>
      )}
    </button>
  );
}

/** The same mark without the commit, beside the version in About and Settings > Updates. */
export const BuildBadge = () => (
  <span className="build-tag">
    <Bug {...ico} />
    DEV
  </span>
);
