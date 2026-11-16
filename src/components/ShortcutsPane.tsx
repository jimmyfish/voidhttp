import { Fragment, useState } from "react";
import { SHORTCUT_GROUPS } from "../shortcuts";
import { Search, ico } from "./Icon";

/** Settings › Shortcuts: every shortcut, read-only, with a search box that filters rows and hides empty groups. */
export function ShortcutsPane() {
  const [filter, setFilter] = useState("");
  const f = filter.trim().toLowerCase();
  const groups = SHORTCUT_GROUPS.map((g) => ({
    ...g,
    rows: g.rows.filter((r) => !f || r.label.toLowerCase().includes(f) || g.title.toLowerCase().includes(f) || r.keys.some((k) => k.toLowerCase().includes(f))),
  })).filter((g) => g.rows.length);

  return (
    <div className="set-pane sc-pane">
      <div className="set-head">
        <h4>Shortcuts</h4>
        <div className="search">
          <Search {...ico} />
          <input className="field" placeholder="Search shortcuts" aria-label="Search shortcuts" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>
      {groups.map((g) => (
        <Fragment key={g.title}>
          <div className="set-group">{g.title}</div>
          <div className="set-list">
            {g.rows.map((r) => (
              <div key={r.label} className="set-item compact">
                <span className="set-label">{r.label}</span>
                {r.keys.length === 1 ? (
                  <kbd>{r.keys[0]}</kbd>
                ) : (
                  <span className="sc-keys">
                    {r.keys.map((k, i) => (
                      <Fragment key={k}>
                        {i > 0 && r.joiner}
                        <kbd>{k}</kbd>
                      </Fragment>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Fragment>
      ))}
      {!groups.length && <p className="sc-note">No shortcut matches “{filter.trim()}”.</p>}
      <p className="sc-note">On Windows and Linux, ⌘ is Ctrl and ⌥ is Alt.</p>
    </div>
  );
}
