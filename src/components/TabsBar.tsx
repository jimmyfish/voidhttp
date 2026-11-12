import { useStore } from "../store";

export function TabsBar() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const setActive = useStore((s) => s.setActiveTab);
  const closeTab = useStore((s) => s.closeTab);
  const newTab = useStore((s) => s.newTab);

  return (
    <div className="tabsbar">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`tab ${t.id === activeTabId ? "on" : ""}`}
          onClick={() => setActive(t.id)}
          onAuxClick={(e) => e.button === 1 && closeTab(t.id)}
          title={t.request.url}
        >
          <span className={`mtag m-${t.request.method}`}>{t.request.method}</span>
          <span className="name">{t.request.name}</span>
          {t.dirty && t.savedRef && <span className="dirty" title="Unsaved changes">●</span>}
          <button
            className="icon close"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(t.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button className="icon newtab" title="New tab (⌘T)" onClick={() => newTab()}>
        ＋
      </button>
    </div>
  );
}
