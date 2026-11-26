import "./LayoutSwitch.css";
import { useStore } from "../store";
import { PanelBottom, PanelRight, ico } from "./Icon";

/** Where the response sits: below the request or beside it. Lives in the response header so it reads as
 *  "move this pane", not "split the window". ⌘K and the Actions list (⇧⌘P) drive the same setting. */
export function LayoutSwitch() {
  const split = useStore((s) => s.settings.layout === "split");
  const setSettings = useStore((s) => s.setSettings);
  return (
    <span className="seg layout-switch" role="group" aria-label="Response position">
      <button
        type="button"
        aria-pressed={!split}
        aria-label="Response below"
        title="Response below the request"
        onClick={() => setSettings({ layout: "stacked" })}
      >
        <PanelBottom {...ico} />
      </button>
      <button
        type="button"
        aria-pressed={split}
        aria-label="Response on the right"
        title="Response beside the request"
        onClick={() => setSettings({ layout: "split" })}
      >
        <PanelRight {...ico} />
      </button>
    </span>
  );
}
