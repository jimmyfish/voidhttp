import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "./store";
import { Sidebar, type SideView } from "./components/Sidebar";
import { TabsBar } from "./components/TabsBar";
import { RequestPane } from "./components/RequestPane";
import { ResponsePane } from "./components/ResponsePane";
import { Modals } from "./components/Modals";
import { Home } from "./components/Home";
import { ProjectTile } from "./components/ProjectIcon";
import { DEFAULT_SCHEME, findScheme, isDark, schemeTokens } from "./lib/themes";
import { Braces, CircleCheck, HistoryIcon, House, Layers, Mark, Settings, Undo2, X, ico, icoLg } from "./components/Icon";
import { DropImport } from "./components/DropImport";
import { UpdateChip } from "./components/UpdateChip";
import { useUpdates } from "./updates";
import { useNetwork } from "./lib/net";
import { useCerts } from "./lib/certs";
import { applyZoom, onGlobalKey } from "./shortcuts";

export const SIDEBAR_DEFAULT = 296;
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 560;
/** dragging the edge this far below the minimum hides the sidebar */
const SIDEBAR_HIDE_AT = SIDEBAR_MIN - 80;

const UI_FALLBACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO_FALLBACK = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
/** A family typed in Settings ("JetBrains Mono") becomes a quoted stack with system fallbacks; a full stack is used as is. */
function stack(font: string | undefined, fallback: string): string | undefined {
  const f = font?.trim();
  if (!f) return undefined;
  return f.includes(",") ? f : `"${f.replace(/"/g, "")}", ${fallback}`;
}

/**
 * Theme picks the look (Auto follows the OS), the look picks a slot, the slot holds a colour scheme.
 * Built-in schemes are tokens.css under data-theme; an imported scheme also writes its tokens inline on :root.
 * data-theme follows the scheme's own lightness, so a dark scheme in the light slot still renders dark.
 */
function useTheme() {
  const theme = useStore((st) => st.settings.theme) ?? "auto";
  const lightScheme = useStore((st) => st.settings.lightScheme) ?? DEFAULT_SCHEME.light;
  const darkScheme = useStore((st) => st.settings.darkScheme) ?? DEFAULT_SCHEME.dark;
  const [osDark, setOsDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setOsDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const look = theme === "auto" ? (osDark ? "dark" : "light") : theme;
    const id = look === "dark" ? darkScheme : lightScheme;
    const scheme = findScheme(id);
    const vars = scheme ? schemeTokens(scheme) : {};
    root.dataset.theme = scheme ? (isDark(scheme) ? "dark" : "light") : id === "void-dark" ? "dark" : id === "void-light" ? "light" : look;
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
    };
  }, [theme, osDark, lightScheme, darkScheme]);
}

/** The four type tokens a future Settings screen writes; empty settings keep the CSS defaults. */
function useTypeTokens() {
  const s = useStore((st) => st.settings);
  useEffect(() => {
    const root = document.documentElement.style;
    const set = (prop: string, v: string | undefined) => (v ? root.setProperty(prop, v) : root.removeProperty(prop));
    set("--font-ui", stack(s.fontUi, UI_FALLBACK));
    set("--font-mono", stack(s.fontMono, MONO_FALLBACK));
    set("--font-size-ui", s.fontSizeUi ? `${s.fontSizeUi}px` : undefined);
    set("--font-size-code", s.fontSizeCode ? `${s.fontSizeCode}px` : undefined);
  }, [s.fontUi, s.fontMono, s.fontSizeUi, s.fontSizeCode]);
  // Compact mode: one attribute on <html>; the rules live under [data-density="compact"] in styles.css
  useEffect(() => {
    const root = document.documentElement;
    if (s.compact) root.dataset.density = "compact";
    else delete root.dataset.density;
  }, [s.compact]);
}

/** Title strip: Home and the open projects, beside the native macOS traffic lights. Drag it to move the window. */
function AppStrip() {
  const projects = useStore((s) => s.projects);
  const openIds = useStore((s) => s.openProjectIds);
  const view = useStore((s) => s.view);
  const current = useStore((s) => s.currentProjectId);
  const settingsOpen = useStore((s) => s.modal?.kind === "settings");
  const st = useStore.getState(); // actions only

  return (
    <div className="app-strip" data-tauri-drag-region>
      <nav className="ptabs" aria-label="Projects" data-tauri-drag-region>
        <button type="button" className="ptab" aria-current={view === "home" ? "page" : undefined} onClick={() => st.goHome()}>
          <House {...ico} />
          Home
        </button>
        {openIds.length > 0 && <span className="ptab-sep" aria-hidden="true" />}
        {openIds.map((id) => {
          const p = projects.find((x) => x.id === id);
          if (!p) return null;
          return (
            <div key={id} className="ptab ptab--project" aria-current={view === "project" && current === id ? "page" : undefined}>
              <button type="button" className="ptab-main" onClick={() => st.openProject(id)}>
                <ProjectTile icon={p.icon} color={p.color} small />
                {p.name}
              </button>
              <button type="button" className="icon-btn ptab-close" aria-label={`Close ${p.name}`} onClick={() => st.closeProject(id)}>
                <X {...ico} />
              </button>
            </div>
          );
        })}
      </nav>
      <UpdateChip />
      <button
        type="button"
        className="icon-btn strip-settings"
        title="Settings (⌘,)"
        aria-label="Settings"
        aria-expanded={settingsOpen}
        onClick={() => st.openModal({ kind: "settings" })}
      >
        <Settings {...ico} />
      </button>
    </div>
  );
}

export default function App() {
  const loaded = useStore((s) => s.loaded);
  const appView = useStore((s) => s.view);
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const toast = useStore((s) => s.toast);
  const toastAction = useStore((s) => s.toastAction);
  const openModal = useStore((s) => s.openModal);
  const modalKind = useStore((s) => s.modal?.kind);
  const [view, setView] = useState<SideView>("collections");
  // the rail lights the dialog that is open, else the sidebar view
  const lit = modalKind === "environments" ? "variables" : view;
  const [split, setSplit] = useState(0.5); // stacked: request height share
  const [splitX, setSplitX] = useState(0.5); // side by side: request width share
  const bodyRef = useRef<HTMLDivElement>(null);
  const settings = useStore((s) => s.settings);
  const sideSplit = settings.layout === "split";
  // while the edge is dragged the width lives here; it is saved to settings on release
  const [liveSide, setLiveSide] = useState<{ width: number; hidden: boolean } | null>(null);
  const sideWidth = liveSide?.width ?? settings.sidebarWidth ?? SIDEBAR_DEFAULT;
  const sideHidden = liveSide?.hidden ?? !!settings.sidebarHidden;
  useTypeTokens();
  useTheme();
  useNetwork();
  useCerts();

  useEffect(() => {
    useStore.getState().init();
  }, []);

  // every app-wide shortcut lives in src/shortcuts.ts (Settings › Shortcuts lists them)
  useEffect(() => {
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, []);

  // ⌘+ / ⌘− / ⌘0 zoom the whole webview; the level is kept in settings
  const zoom = settings.zoom ?? 1;
  useEffect(() => {
    if (loaded) applyZoom(zoom);
  }, [loaded, zoom]);

  // Updates: one quiet check once the workspace has loaded (Settings > Updates can turn it off),
  // and "Check for Updates…" in the app menu, which opens the chip's popover or Settings > Updates
  useEffect(() => {
    if (!loaded || useStore.getState().settings.autoUpdateCheck === false) return;
    void useUpdates.getState().check({ quiet: true });
  }, [loaded]);
  useEffect(() => {
    const unlisten = listen("menu:check-updates", async () => {
      const u = useUpdates.getState();
      const busy = ["downloading", "installing", "ready"].includes(u.state.kind);
      const s = busy ? u.state : await u.check();
      if (s.kind === "available" || busy) u.setPopover(true);
      else useStore.getState().openModal({ kind: "settings", section: "updates" });
    });
    return () => {
      unlisten.then((off) => off());
    };
  }, []);

  // "About voidHTTP" in the app menu opens our own dialog instead of the native panel
  useEffect(() => {
    const unlisten = listen("menu:about", () => useStore.getState().openModal({ kind: "about" }));
    return () => {
      unlisten.then((off) => off());
    };
  }, []);

  // ⌘W comes from the native menu (it never reaches keydown): close the open
  // dialog first, otherwise the active request tab
  useEffect(() => {
    const unlisten = listen("menu:close-tab", () => {
      const s = useStore.getState();
      if (s.modal) s.openModal(null);
      else if (s.view === "project" && s.activeTabId) s.closeTab(s.activeTabId);
    });
    return () => {
      unlisten.then((off) => off());
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = bodyRef.current!.getBoundingClientRect();
    const clamp = (v: number) => Math.min(0.85, Math.max(0.15, v));
    const move = (ev: MouseEvent) =>
      sideSplit ? setSplitX(clamp((ev.clientX - rect.left) / rect.width)) : setSplit(clamp((ev.clientY - rect.top) / rect.height));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  /** Drag the sidebar's right edge: resize between the limits, hide past the minimum, come back when dragged out again. */
  const startSideResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = sideWidth;
    let state = { width: w0, hidden: false };
    document.body.classList.add("col-resizing");
    const move = (ev: MouseEvent) => {
      const w = w0 + ev.clientX - x0;
      // hidden keeps the width it had before the drag, so showing it again restores that
      state = w < SIDEBAR_HIDE_AT ? { width: w0, hidden: true } : { width: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w)), hidden: false };
      setLiveSide(state);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.classList.remove("col-resizing");
      useStore.getState().setSettings({ sidebarWidth: state.width, sidebarHidden: state.hidden });
      setLiveSide(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  /** A rail section brings the sidebar back if it was hidden. */
  const showSection = (v: SideView) => {
    setView(v);
    if (useStore.getState().settings.sidebarHidden) useStore.getState().setSettings({ sidebarHidden: false });
  };

  if (!loaded) return <div className="boot" />;

  return (
    <div className="app">
      <AppStrip />
      {appView === "home" ? (
        <Home />
      ) : (
        <>
          <nav className="rail" aria-label="Sections">
            <div className="rail-mark">
              <Mark size={20} />
            </div>
            <button
              type="button"
              className="rail-item"
              aria-label="Collections"
              title="Collections"
              aria-current={lit === "collections" ? "page" : undefined}
              onClick={() => showSection("collections")}
            >
              <Layers {...icoLg} />
            </button>
            <button type="button" className="rail-item" aria-label="History" title="History" aria-current={lit === "history" ? "page" : undefined} onClick={() => showSection("history")}>
              <HistoryIcon {...icoLg} />
            </button>
            <button type="button" className="rail-item" aria-label="Variables" title="Variables" aria-current={lit === "variables" ? "page" : undefined} onClick={() => openModal({ kind: "environments" })}>
              <Braces {...icoLg} />
            </button>
          </nav>

          <div className="panel" style={{ gridTemplateColumns: sideHidden ? "minmax(0, 1fr)" : `${sideWidth}px minmax(0, 1fr)` }}>
            {!sideHidden && <Sidebar view={view} onResizeStart={startSideResize} />}
            <main className="work">
              <TabsBar />
              {tab && (
                <div
                  className={`work-body${sideSplit ? " split" : ""}`}
                  ref={bodyRef}
                  style={sideSplit ? { gridTemplateColumns: `minmax(0, ${splitX}fr) 12px minmax(0, ${1 - splitX}fr)` } : undefined}
                >
                  <RequestPane key={tab.id} tab={tab} grow={split} />
                  <div
                    className="divider"
                    role="separator"
                    aria-orientation={sideSplit ? "vertical" : "horizontal"}
                    aria-label="Resize request and response"
                    onMouseDown={startDrag}
                  />
                  <ResponsePane key={`r-${tab.id}`} tab={tab} grow={1 - split} />
                </div>
              )}
            </main>
          </div>
        </>
      )}
      <Modals />
      <DropImport />
      {toast &&
        (toastAction ? (
          <div className="xf-toast" role="status">
            <CircleCheck {...ico} />
            <span>{toast}</span>
            <button type="button" className="btn btn--quiet" onClick={toastAction.run}>
              <Undo2 {...ico} />
              {toastAction.label}
            </button>
            <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => useStore.setState({ toast: null, toastAction: null })}>
              <X {...ico} />
            </button>
          </div>
        ) : (
          <div className="toast" role="status">
            {toast}
          </div>
        ))}
    </div>
  );
}
