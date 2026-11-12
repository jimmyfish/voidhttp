import { useStore } from "../store";
import { methodLabel } from "../lib/model";
import { ChevronDown, Menu, Plus, X, ico } from "./Icon";

export function TabsBar() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const environments = useStore((s) => s.environments);
  const activeEnvironmentId = useStore((s) => s.activeEnvironmentId);
  const s = useStore.getState(); // actions only

  const env = environments.find((e) => e.id === activeEnvironmentId);
  const badge = env ? env.name.slice(0, 2).replace(/^./, (c) => c.toUpperCase()) : "";

  return (
    <div className="tabsbar">
      <div className="tabs">
        {tabs.map((t) => (
          <div
            key={t.id}
            className="tab"
            aria-current={t.id === activeTabId ? "page" : undefined}
            onAuxClick={(e) => e.button === 1 && s.closeTab(t.id)}
          >
            <button type="button" className="tab-main" title={t.request.url} onClick={() => s.setActiveTab(t.id)}>
              <span className={`m m-${t.request.method}`}>{methodLabel(t.request.method)}</span>
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

      <div className="joined env-group">
        <label className="env-picker">
          {env && <span className="env-badge">{badge}</span>}
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
          title="Manage environments"
          aria-label="Manage environments"
          onClick={() => s.openModal({ kind: "environments" })}
        >
          <Menu {...ico} />
        </button>
      </div>
    </div>
  );
}
