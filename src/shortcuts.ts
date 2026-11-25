import { getCurrentWebview } from "@tauri-apps/api/webview";
import { promptNewCollection, useStore } from "./store";

/**
 * Keyboard shortcuts: the keys (shown in Settings › Shortcuts and in ⇧⌘P), the actions they run,
 * and the one window-level handler. Read-only: the keys are not user-configurable.
 * ⌘ means Ctrl on Windows and Linux; ⌘W comes from the native menu (src-tauri/src/lib.rs).
 */

/** The label each shortcut shows, one per action. */
export const KEYS = {
  quickOpen: "⌘P",
  actions: "⇧⌘P",
  shortcuts: "⌘/",
  send: "⌘↵",
  cancel: "⌘.",
  save: "⌘S",
  saveAs: "⇧⌘S",
  focusUrl: "⌘L",
  filter: "⌘F",
  comment: "⌘/",
  newTab: "⌘T",
  closeTab: "⌘W",
  reopenTab: "⇧⌘T",
  nextTab: "⇧⌘]",
  nextTabAlt: "⌃Tab",
  prevTab: "⇧⌘[",
  prevTabAlt: "⌃⇧Tab",
  firstTabs: "⌘1",
  eighthTab: "⌘8",
  lastTab: "⌘9",
  searchSidebar: "⇧⌘F",
  rename: "F2",
  duplicate: "⌘D",
  remove: "⌘⌫",
  toggleSidebar: "⌘\\",
  variables: "⌘E",
  environment: "⌥E",
  zoomIn: "⌘+",
  zoomOut: "⌘−",
  zoomReset: "⌘0",
  import: "⌘O",
  settings: "⌘,",
  closeWindow: "⇧⌘W",
} as const;

export interface ShortcutRow {
  label: string;
  keys: string[];
  /** word between the keys: "or" (either works), "to" (a range); none = shown side by side */
  joiner?: string;
}

/** Settings › Shortcuts, in order. */
export const SHORTCUT_GROUPS: { title: string; rows: ShortcutRow[] }[] = [
  {
    title: "Quick open",
    rows: [
      { label: "Quick open a request", keys: [KEYS.quickOpen] },
      { label: "Run an action", keys: [KEYS.actions] },
      { label: "Keyboard shortcuts", keys: [KEYS.shortcuts] },
    ],
  },
  {
    title: "Request",
    rows: [
      { label: "Send", keys: [KEYS.send] },
      { label: "Cancel request", keys: [KEYS.cancel] },
      { label: "Save", keys: [KEYS.save] },
      { label: "Save as", keys: [KEYS.saveAs] },
      { label: "Go to URL", keys: [KEYS.focusUrl] },
      { label: "Filter response", keys: [KEYS.filter] },
      { label: "Toggle comment in the editor", keys: [KEYS.comment] },
    ],
  },
  {
    title: "Tabs",
    rows: [
      { label: "New tab", keys: [KEYS.newTab] },
      { label: "Close tab", keys: [KEYS.closeTab] },
      { label: "Reopen closed tab", keys: [KEYS.reopenTab] },
      { label: "Next tab", keys: [KEYS.nextTab, KEYS.nextTabAlt], joiner: "or" },
      { label: "Previous tab", keys: [KEYS.prevTab, KEYS.prevTabAlt], joiner: "or" },
      { label: "Go to tab 1 to 8", keys: [KEYS.firstTabs, KEYS.eighthTab], joiner: "to" },
      { label: "Go to last tab", keys: [KEYS.lastTab] },
    ],
  },
  {
    title: "Sidebar",
    rows: [
      { label: "Search sidebar", keys: [KEYS.searchSidebar] },
      { label: "Move up or down", keys: ["↑", "↓"] },
      { label: "Open", keys: ["↵"] },
      { label: "Expand or collapse", keys: ["→", "←"] },
      { label: "Expand or collapse all", keys: ["⌥→", "⌥←"] },
      { label: "Rename", keys: [KEYS.rename] },
      { label: "Duplicate", keys: [KEYS.duplicate] },
      { label: "Delete", keys: [KEYS.remove] },
    ],
  },
  {
    title: "Interface",
    rows: [
      { label: "Show or hide sidebar", keys: [KEYS.toggleSidebar] },
      { label: "Variables", keys: [KEYS.variables] },
      { label: "Switch environment", keys: [KEYS.environment] },
      { label: "Zoom in, out, reset", keys: [KEYS.zoomIn, KEYS.zoomOut, KEYS.zoomReset] },
      { label: "Import", keys: [KEYS.import] },
      { label: "Settings", keys: [KEYS.settings] },
      { label: "Close window", keys: [KEYS.closeWindow] },
    ],
  },
];

/** The ⌘1–⌘8 / ⌘9 label of the tab at `i` of `n`, or undefined. */
export function tabKey(i: number, n: number): string | undefined {
  if (i < 8) return `⌘${i + 1}`;
  return i === n - 1 ? KEYS.lastTab : undefined;
}

// ---------- zoom ----------

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

/** Applies a zoom factor to the webview; quietly does nothing outside Tauri. */
export function applyZoom(z: number) {
  getCurrentWebview()
    .setZoom(z)
    .catch(() => undefined);
}

function zoomBy(delta: number | null) {
  const s = useStore.getState();
  const cur = s.settings.zoom ?? 1;
  const next = delta === null ? 1 : Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cur + delta)) * 10) / 10;
  if (next !== cur) s.setSettings({ zoom: next === 1 ? undefined : next });
  s.notify(`Zoom ${Math.round(next * 100)}%`);
}

// ---------- actions (keys and ⇧⌘P run the same ones) ----------

const focusField = (selector: string) => {
  const el = document.querySelector<HTMLInputElement>(selector);
  if (!el) return false;
  el.focus();
  el.select();
  return true;
};

/** Runs `fn` once the frame has rendered, e.g. after a dialog closed or the sidebar came back. */
const nextFrame = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));

export const act = {
  send() {
    const s = useStore.getState();
    if (s.activeTabId) void s.sendTab(s.activeTabId);
  },
  cancel() {
    const s = useStore.getState();
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    if (t?.inflightId) s.cancelTab(t.id);
  },
  save() {
    const s = useStore.getState();
    if (s.activeTabId) s.saveTab(s.activeTabId);
  },
  saveAs() {
    const s = useStore.getState();
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    if (t && !t.example) s.openModal({ kind: "save", tabId: t.id });
  },
  focusUrl() {
    focusField(".work .url-input input");
  },
  newTab() {
    useStore.getState().newTab();
  },
  /** a pinned tab stays: only "Close tab" in its right-click menu closes it */
  closeTab() {
    const s = useStore.getState();
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    if (t && !t.pinned) s.closeTab(t.id);
  },
  reopenTab() {
    useStore.getState().reopenTab();
  },
  /** +1 next, -1 previous; wraps around */
  cycleTab(dir: 1 | -1) {
    const s = useStore.getState();
    const i = s.tabs.findIndex((t) => t.id === s.activeTabId);
    const n = s.tabs.length;
    if (n > 1) s.setActiveTab(s.tabs[(i + dir + n) % n].id);
  },
  /** 0-based; past the end does nothing */
  goTab(i: number) {
    const s = useStore.getState();
    const t = s.tabs[i];
    if (t) s.setActiveTab(t.id);
  },
  lastTab() {
    const s = useStore.getState();
    const t = s.tabs[s.tabs.length - 1];
    if (t) s.setActiveTab(t.id);
  },
  toggleSidebar() {
    const s = useStore.getState();
    s.setSettings({ sidebarHidden: !s.settings.sidebarHidden });
  },
  searchSidebar() {
    const s = useStore.getState();
    if (s.settings.sidebarHidden) s.setSettings({ sidebarHidden: false });
    nextFrame(() => focusField(".sidebar .search input"));
  },
  filterResponse() {
    return focusField(".rf-input");
  },
  /** opens the environment picker in the tabs bar; it focuses the current environment */
  environment() {
    document.querySelector<HTMLButtonElement>(".tabsbar .env-picker")?.click();
  },
  variables() {
    const s = useStore.getState();
    // never stacks on top of another dialog
    if (s.modal?.kind === "environments") s.openModal(null);
    else if (!s.modal) s.openModal({ kind: "environments" });
  },
  zoomIn: () => zoomBy(ZOOM_STEP),
  zoomOut: () => zoomBy(-ZOOM_STEP),
  zoomReset: () => zoomBy(null),
  importDialog() {
    const s = useStore.getState();
    if (!s.modal) s.openModal({ kind: "import" });
  },
  settings() {
    const s = useStore.getState();
    s.openModal(s.modal?.kind === "settings" ? null : { kind: "settings" });
  },
  shortcuts() {
    const s = useStore.getState();
    const open = s.modal?.kind === "settings" && s.modal.section === "shortcuts";
    s.openModal(open ? null : { kind: "settings", section: "shortcuts" });
  },
  /** ⌘P / ⇧⌘P: opens the box, switches its mode, or closes it when that mode is already up */
  quickOpen(actions: boolean) {
    const s = useStore.getState();
    if (s.modal?.kind === "quickopen") s.openModal(!!s.modal.actions === actions ? null : { kind: "quickopen", actions });
    else if (!s.modal) s.openModal({ kind: "quickopen", actions });
  },
  newCollection() {
    promptNewCollection();
  },
  toggleLayout() {
    const s = useStore.getState();
    s.setSettings({ layout: s.settings.layout === "split" ? "stacked" : "split" });
  },
  /** flips between Light and Dark from whatever is showing now (Auto included) */
  toggleTheme() {
    const dark = document.documentElement.dataset.theme === "dark";
    useStore.getState().setSettings({ theme: dark ? "light" : "dark" });
  },
  later: nextFrame,
};

// ---------- the window-level handler ----------

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");

/** Every app-wide shortcut. Editors and lists handle their own keys first (⌘/ in a JSON body, arrows in menus). */
export function onGlobalKey(e: KeyboardEvent) {
  if (e.defaultPrevented) return;
  const s = useStore.getState();
  const inProject = s.view === "project";
  const mod = e.metaKey || e.ctrlKey;
  const run = (fn: () => unknown) => {
    e.preventDefault();
    fn();
  };

  // ⌥E: by physical key, since ⌥E types an accent on macOS; never while typing
  if (e.altKey && !mod && !e.shiftKey && e.code === "KeyE") {
    if (inProject && !s.modal && !isEditable(e.target)) run(act.environment);
    return;
  }
  // ⌃Tab / ⌃⇧Tab
  if (e.ctrlKey && !e.metaKey && !e.altKey && e.key === "Tab") {
    if (inProject && !s.modal) run(() => act.cycleTab(e.shiftKey ? -1 : 1));
    return;
  }
  if (!mod || e.altKey) return;
  const k = e.key.toLowerCase();

  // anywhere, Home included
  if (k === ",") return run(act.settings);
  if (k === "=" || k === "+") return run(act.zoomIn);
  if (k === "-" || k === "_") return run(act.zoomOut);
  if (e.code === "Digit0" && !e.shiftKey) return run(act.zoomReset);
  if (e.code === "Slash" && !e.shiftKey) {
    // inside an editor ⌘/ comments lines (or nothing); everywhere else it opens the list
    if (!isEditable(e.target)) run(act.shortcuts);
    return;
  }
  if (k === "o" && !e.shiftKey) return run(act.importDialog);

  if (!inProject) return; // the rest work on the open project's tabs
  if (k === "p") return run(() => act.quickOpen(e.shiftKey));
  if (k === "e" && !e.shiftKey) return run(act.variables);
  if (k === "\\") return run(act.toggleSidebar);
  if (e.key === "Enter" && s.activeTabId) return run(act.send);
  if (k === "s" && s.activeTabId) return run(e.shiftKey ? act.saveAs : act.save);
  if (k === "t") return run(e.shiftKey ? act.reopenTab : act.newTab);
  if (k === "f") {
    if (e.shiftKey) return run(act.searchSidebar);
    // ⌘F only takes over when a response body (and its filter) is on screen
    if (document.querySelector(".rf-input")) run(act.filterResponse);
    return;
  }

  // the rest move around the tabs behind a dialog, so not while one is open
  if (s.modal) return;
  if (k === "l" && !e.shiftKey) return run(act.focusUrl);
  if (k === "." && !e.shiftKey) return run(act.cancel);
  if (e.shiftKey && e.code === "BracketRight") return run(() => act.cycleTab(1));
  if (e.shiftKey && e.code === "BracketLeft") return run(() => act.cycleTab(-1));
  const digit = /^Digit([1-9])$/.exec(e.code);
  if (digit && !e.shiftKey) {
    const n = Number(digit[1]);
    return run(() => (n === 9 ? act.lastTab() : act.goTab(n - 1)));
  }
}
