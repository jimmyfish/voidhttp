import { useEffect, useRef, useState } from "react";
import { useStore } from "./store";
import { Sidebar } from "./components/Sidebar";
import { TabsBar } from "./components/TabsBar";
import { RequestPane } from "./components/RequestPane";
import { ResponsePane } from "./components/ResponsePane";
import { Modals } from "./components/Modals";

export default function App() {
  const loaded = useStore((s) => s.loaded);
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const toast = useStore((s) => s.toast);
  const [split, setSplit] = useState(0.45);
  const mainRef = useRef<HTMLDivElement>(null);

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
    const rect = mainRef.current!.getBoundingClientRect();
    const move = (ev: MouseEvent) => setSplit(Math.min(0.8, Math.max(0.15, (ev.clientY - rect.top) / rect.height)));
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
      <Sidebar />
      <main className="main">
        <TabsBar />
        {tab && (
          <div className="panes" ref={mainRef} style={{ gridTemplateRows: `${split}fr 6px ${1 - split}fr` }}>
            <RequestPane key={tab.id} tab={tab} />
            <div className="divider" onMouseDown={startDrag} />
            <ResponsePane key={`r-${tab.id}`} tab={tab} />
          </div>
        )}
      </main>
      <Modals />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
