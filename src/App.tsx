import { useEffect, useRef, useState } from "react";
import { useStore } from "./store";
import { Sidebar, type SideView } from "./components/Sidebar";
import { TabsBar } from "./components/TabsBar";
import { RequestPane } from "./components/RequestPane";
import { ResponsePane } from "./components/ResponsePane";
import { Modals } from "./components/Modals";
import { Braces, HistoryIcon, Layers, Mark, Settings, icoLg } from "./components/Icon";

/** The four type tokens a future Settings screen writes; empty settings keep the CSS defaults. */
function useTypeTokens() {
  const s = useStore((st) => st.settings);
  useEffect(() => {
    const root = document.documentElement.style;
    const set = (prop: string, v: string | undefined) => (v ? root.setProperty(prop, v) : root.removeProperty(prop));
    set("--font-ui", s.fontUi);
    set("--font-mono", s.fontMono);
    set("--font-size-ui", s.fontSizeUi ? `${s.fontSizeUi}px` : undefined);
    set("--font-size-code", s.fontSizeCode ? `${s.fontSizeCode}px` : undefined);
  }, [s.fontUi, s.fontMono, s.fontSizeUi, s.fontSizeCode]);
}

export default function App() {
  const loaded = useStore((s) => s.loaded);
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const toast = useStore((s) => s.toast);
  const openModal = useStore((s) => s.openModal);
  const modalKind = useStore((s) => s.modal?.kind);
  const [view, setView] = useState<SideView>("collections");
  // the rail lights the dialog that is open, else the sidebar view
  const lit = modalKind === "environments" ? "variables" : modalKind === "settings" ? "settings" : view;
  const [split, setSplit] = useState(0.5);
  const bodyRef = useRef<HTMLDivElement>(null);
  useTypeTokens();

  useEffect(() => {
    useStore.getState().init();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const s = useStore.getState();
      if (e.key === "Enter" && s.activeTabId) {
        e.preventDefault();
        s.sendTab(s.activeTabId);
      } else if (e.key.toLowerCase() === "s" && s.activeTabId) {
        e.preventDefault();
        s.saveTab(s.activeTabId);
      } else if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        s.newTab();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = bodyRef.current!.getBoundingClientRect();
    const move = (ev: MouseEvent) => setSplit(Math.min(0.85, Math.max(0.15, (ev.clientY - rect.top) / rect.height)));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  if (!loaded) return <div className="boot" />;

  return (
    <div className="app">
      {/* macOS: the native traffic lights float over this strip (titleBarStyle "Overlay"); drag it to move the window */}
      <div className="titlebar" data-tauri-drag-region />
      <nav className="rail" aria-label="Sections">
        <div className="rail-mark">
          <Mark />
        </div>
        <button
          type="button"
          className="rail-item"
          aria-current={lit === "collections" ? "page" : undefined}
          onClick={() => setView("collections")}
        >
          <Layers {...icoLg} />
          Collections
        </button>
        <button type="button" className="rail-item" aria-current={lit === "history" ? "page" : undefined} onClick={() => setView("history")}>
          <HistoryIcon {...icoLg} />
          History
        </button>
        <button type="button" className="rail-item" aria-current={lit === "variables" ? "page" : undefined} onClick={() => openModal({ kind: "environments" })}>
          <Braces {...icoLg} />
          Variables
        </button>
        <span className="rail-spacer" />
        <button type="button" className="rail-item" aria-current={lit === "settings" ? "page" : undefined} onClick={() => openModal({ kind: "settings" })}>
          <Settings {...icoLg} />
          Settings
        </button>
      </nav>

      <div className="panel">
        <Sidebar view={view} />
        <main className="work">
          <TabsBar />
          {tab && (
            <div className="work-body" ref={bodyRef}>
              <RequestPane key={tab.id} tab={tab} grow={split} />
              <div
                className="divider"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize request and response"
                onMouseDown={startDrag}
              />
              <ResponsePane key={`r-${tab.id}`} tab={tab} grow={1 - split} />
            </div>
          )}
        </main>
      </div>
      <Modals />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
