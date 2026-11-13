import { useStore } from "../store";
import { methodLabel } from "../lib/model";
import { envStyle } from "../lib/tags";
import { Bookmark, ChevronDown, Columns2, Menu, PanelLeftClose, PanelLeftOpen, Plus, Rows2, X, ico } from "./Icon";

export function TabsBar() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const environments = useStore((s) => s.environments);
  const activeEnvironmentId = useStore((s) => s.activeEnvironmentId);
  const sidebarHidden = useStore((s) => !!s.settings.sidebarHidden);
  const split = useStore((s) => s.settings.layout === "split");
  const s = useStore.getState(); // actions only

  const env = environments.find((e) => e.id === activeEnvironmentId);
  const badge = env ? env.name.slice(0, 2).replace(/^./, (c) => c.toUpperCase()) : "";

  return (
    <div className="tabsbar">
      <button
        type="button"
        className="icon-btn side-toggle"
        title={`${sidebarHidden ? "Show" : "Hide"} sidebar (⌘\\)`}
        aria-label={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
        onClick={() => s.setSettings({ sidebarHidden: !sidebarHidden })}
      >
        {sidebarHidden ? <PanelLeftOpen {...ico} /> : <PanelLeftClose {...ico} />}
      </button>
      <div className="tabs">
        {tabs.map((t) => (
          <div
            key={t.id}
            className="tab"
            aria-current={t.id === activeTabId ? "page" : undefined}
            onAuxClick={(e) => e.button === 1 && s.closeTab(t.id)}
          >
            <button type="button" className="tab-main" title={t.request.url} onClick={() => s.setActiveTab(t.id)}>
              {t.example ? <Bookmark {...ico} className="ico ex-ico" /> : <span className={`m m-${t.request.method}`}>{methodLabel(t.request.method)}</span>}
              <span className="name">{t.request.name}</span>
              {t.dirty && t.savedRef && <span className="dirty" role="img" aria-label="Unsaved changes" />}
            </button>
            <button type="button" className="icon-btn close" aria-label={`Close ${t.request.name}`} onClick={() => s.closeTab(t.id)}>
              <X {...ico} />
            </button>
          </div>
        ))}
        <button type="button" className="icon-btn tab-add" title="New tab (⌘T)" aria-label="New tab" onClick={() => s.newTab()}>
          <Plus {...ico} />
        </button>
      </div>

      <button
        type="button"
        className="icon-btn layout-toggle"
        title={split ? "Response below the request" : "Response beside the request"}
        aria-label={split ? "Stacked layout" : "Side by side layout"}
        onClick={() => s.setSettings({ layout: split ? "stacked" : "split" })}
      >
        {split ? <Rows2 {...ico} /> : <Columns2 {...ico} />}
      </button>
      <div className="joined env-group">
        <label className="env-picker" style={envStyle(env?.color)}>
          {env && <span className="env-badge">{badge}</span>}
          {env?.color && <span className="env-dot" aria-hidden="true" />}
          <span className="env-name">{env ? env.name : "No environment"}</span>
          <ChevronDown {...ico} />
          <select aria-label="Environment" value={activeEnvironmentId ?? ""} onChange={(e) => s.setActiveEnvironment(e.target.value || null)}>
            <option value="">No environment</option>
            {environments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn joined-tail"
          title="Manage environments (⌘E)"
          aria-label="Manage environments"
          onClick={() => s.openModal({ kind: "environments" })}
        >
          <Menu {...ico} />
        </button>
      </div>
    </div>
  );
}
