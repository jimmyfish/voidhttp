import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  Collection,
  Environment,
  HistoryEntry,
  RequestDef,
  SavedRef,
  Settings,
  Tab,
  TreeNode,
  Workspace,
} from "./types";
import {
  findNode,
  insertNode,
  mapTree,
  newRequest,
  removeFromTree,
  toRequestDef,
  uid,
} from "./lib/model";
import { buildScope, type VarScope } from "./lib/vars";
import { cancel, prepare, send } from "./lib/http";
import { importPostman } from "./lib/postman";

const HISTORY_LIMIT = 200;

export type Modal =
  | { kind: "prompt"; title: string; initial: string; onSubmit: (v: string) => void }
  | { kind: "confirm"; title: string; message: string; onConfirm: () => void }
  | { kind: "save"; tabId: string }
  | { kind: "environments" }
  | { kind: "settings" };

interface State {
  loaded: boolean;
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  settings: Settings;
  history: HistoryEntry[];
  tabs: Tab[];
  activeTabId: string | null;
  modal: Modal | null;
  toast: string | null;

  init(): Promise<void>;
  notify(msg: string): void;
  openModal(m: Modal | null): void;

  newTab(req?: RequestDef, savedRef?: SavedRef): void;
  closeTab(id: string): void;
  setActiveTab(id: string): void;
  updateRequest(tabId: string, patch: Partial<RequestDef>): void;
  sendTab(tabId: string): Promise<void>;
  cancelTab(tabId: string): void;
  scopeFor(tabId: string): VarScope;

  saveTab(tabId: string): void;
  saveTabAs(tabId: string, collectionId: string, parentId: string | null, name: string): void;
  openSaved(collectionId: string, nodeId: string): void;

  createCollection(name: string): string;
  addFolder(collectionId: string, parentId: string | null, name: string): void;
  addRequest(collectionId: string, parentId: string | null): void;
  renameNode(collectionId: string, nodeId: string, name: string): void;
  deleteNode(collectionId: string, nodeId: string): void;
  updateCollection(collectionId: string, patch: Partial<Collection>): void;

  setEnvironments(envs: Environment[]): void;
  setActiveEnvironment(id: string | null): void;
  setSettings(s: Partial<Settings>): void;
  clearHistory(): void;
  importText(text: string): void;
}

const DEFAULT_SETTINGS: Settings = { timeoutMs: 30000, followRedirects: true, insecure: false };

let initStarted = false;

const patchTab = (tabs: Tab[], id: string, fn: (t: Tab) => Tab) => tabs.map((t) => (t.id === id ? fn(t) : t));

export const useStore = create<State>((set, get) => ({
  loaded: false,
  collections: [],
  environments: [],
  activeEnvironmentId: null,
  settings: DEFAULT_SETTINGS,
  history: [],
  tabs: [],
  activeTabId: null,
  modal: null,
  toast: null,

  async init() {
    if (initStarted) return; // React StrictMode runs effects twice in dev
    initStarted = true;
    try {
      const s = await invoke<{ workspace: Workspace | null; history: HistoryEntry[] | null; session: { tabs: Tab[]; activeTabId: string | null } | null }>("load_state");
      const ws = s.workspace;
      const tabs = s.session?.tabs ?? [];
      set({
        collections: ws?.collections ?? [],
        environments: ws?.environments ?? [],
        activeEnvironmentId: ws?.activeEnvironmentId ?? null,
        settings: { ...DEFAULT_SETTINGS, ...ws?.settings },
        history: s.history ?? [],
        tabs,
        activeTabId: s.session?.activeTabId ?? tabs[0]?.id ?? null,
      });
    } catch (e) {
      get().notify(`Could not load data: ${e}`);
    }
    if (get().tabs.length === 0) get().newTab();
    set({ loaded: true });
  },

  notify(msg) {
    set({ toast: msg });
    setTimeout(() => get().toast === msg && set({ toast: null }), 3500);
  },

  openModal(m) {
    set({ modal: m });
  },

  newTab(req, savedRef) {
    const tab: Tab = { id: uid(), request: req ?? newRequest(), savedRef, dirty: false };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
  },

  closeTab(id) {
    const tab = get().tabs.find((t) => t.id === id);
    if (tab?.inflightId) cancel(tab.inflightId);
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      const tabs = s.tabs.filter((t) => t.id !== id);
      const activeTabId = s.activeTabId === id ? (tabs[Math.min(idx, tabs.length - 1)]?.id ?? null) : s.activeTabId;
      return { tabs, activeTabId };
    });
    if (get().tabs.length === 0) get().newTab();
  },

  setActiveTab(id) {
    set({ activeTabId: id });
  },

  updateRequest(tabId, patch) {
    set((s) => ({ tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, request: { ...t.request, ...patch }, dirty: true })) }));
  },

  scopeFor(tabId) {
    const s = get();
    const tab = s.tabs.find((t) => t.id === tabId);
    const col = tab?.savedRef && s.collections.find((c) => c.id === tab.savedRef!.collectionId);
    const env = s.environments.find((e) => e.id === s.activeEnvironmentId);
    return buildScope(col?.variables, env?.variables);
  },

  async sendTab(tabId) {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || tab.inflightId) return;
    const inflightId = uid();
    set((s) => ({ tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, inflightId, error: undefined })) }));
    const request = structuredClone(tab.request);
    try {
      const prepared = prepare(request, get().scopeFor(tabId));
      const response = await send(prepared, get().settings, inflightId);
      set((s) => ({
        tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, inflightId: undefined, response, error: undefined })),
        history: [
          { id: uid(), at: Date.now(), request, status: response.status, elapsedMs: response.elapsedMs },
          ...s.history,
        ].slice(0, HISTORY_LIMIT),
      }));
    } catch (e) {
      const error = String(e);
      set((s) => ({
        tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, inflightId: undefined, response: undefined, error })),
        history: error === "Request cancelled" ? s.history : [{ id: uid(), at: Date.now(), request }, ...s.history].slice(0, HISTORY_LIMIT),
      }));
    }
  },

  cancelTab(tabId) {
    const id = get().tabs.find((t) => t.id === tabId)?.inflightId;
    if (id) cancel(id);
  },

  saveTab(tabId) {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const ref = tab.savedRef;
    const col = ref && get().collections.find((c) => c.id === ref.collectionId);
    if (!ref || !col || !findNode(col.children, ref.nodeId)) {
      get().openModal({ kind: "save", tabId });
      return;
    }
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id !== ref.collectionId
          ? c
          : { ...c, children: mapTree(c.children, ref.nodeId, () => ({ type: "request", ...toRequestDef(tab.request), id: ref.nodeId })) },
      ),
      tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, dirty: false })),
    }));
    get().notify("Saved");
  },

  saveTabAs(tabId, collectionId, parentId, name) {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const nodeId = uid();
    const node: TreeNode = { type: "request", ...toRequestDef(tab.request), id: nodeId, name };
    set((s) => ({
      collections: s.collections.map((c) => (c.id === collectionId ? insertNode(c, parentId, node) : c)),
      tabs: patchTab(s.tabs, tabId, (t) => ({
        ...t,
        request: { ...t.request, name },
        savedRef: { collectionId, nodeId },
        dirty: false,
      })),
    }));
    get().notify("Saved");
  },

  openSaved(collectionId, nodeId) {
    const existing = get().tabs.find((t) => t.savedRef?.nodeId === nodeId);
    if (existing) return set({ activeTabId: existing.id });
    const col = get().collections.find((c) => c.id === collectionId);
    const node = col && findNode(col.children, nodeId);
    if (node?.type !== "request") return;
    // Replace the active tab if it is a pristine, empty scratch tab.
    const active = get().tabs.find((t) => t.id === get().activeTabId);
    if (active && !active.savedRef && !active.dirty && !active.request.url && !active.response) {
      set((s) => ({
        tabs: patchTab(s.tabs, active.id, (t) => ({ ...t, request: toRequestDef(node), savedRef: { collectionId, nodeId } })),
      }));
      return;
    }
    get().newTab(toRequestDef(node), { collectionId, nodeId });
  },

  createCollection(name) {
    const id = uid();
    set((s) => ({ collections: [...s.collections, { id, name, children: [], variables: [] }] }));
    return id;
  },

  addFolder(collectionId, parentId, name) {
    const node: TreeNode = { type: "folder", id: uid(), name, children: [] };
    set((s) => ({ collections: s.collections.map((c) => (c.id === collectionId ? insertNode(c, parentId, node) : c)) }));
  },

  addRequest(collectionId, parentId) {
    const req = newRequest();
    const node: TreeNode = { type: "request", ...req };
    set((s) => ({ collections: s.collections.map((c) => (c.id === collectionId ? insertNode(c, parentId, node) : c)) }));
    get().newTab(toRequestDef(node), { collectionId, nodeId: node.id });
  },

  renameNode(collectionId, nodeId, name) {
    set((s) => ({
      collections: s.collections.map((c) => {
        if (c.id !== collectionId) return c;
        if (nodeId === c.id) return { ...c, name };
        return { ...c, children: mapTree(c.children, nodeId, (n) => ({ ...n, name })) };
      }),
      tabs: s.tabs.map((t) => (t.savedRef?.nodeId === nodeId ? { ...t, request: { ...t.request, name } } : t)),
    }));
  },

  deleteNode(collectionId, nodeId) {
    set((s) => ({
      collections:
        nodeId === collectionId
          ? s.collections.filter((c) => c.id !== collectionId)
          : s.collections.map((c) => (c.id === collectionId ? { ...c, children: removeFromTree(c.children, nodeId) } : c)),
    }));
  },

  updateCollection(collectionId, patch) {
    set((s) => ({ collections: s.collections.map((c) => (c.id === collectionId ? { ...c, ...patch } : c)) }));
  },

  setEnvironments(environments) {
    set((s) => ({
      environments,
      activeEnvironmentId: environments.some((e) => e.id === s.activeEnvironmentId) ? s.activeEnvironmentId : null,
    }));
  },

  setActiveEnvironment(id) {
    set({ activeEnvironmentId: id });
  },

  setSettings(patch) {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
  },

  clearHistory() {
    set({ history: [] });
  },

  importText(text) {
    try {
      const res = importPostman(text);
      if (res.kind === "collection") {
        set((s) => ({ collections: [...s.collections, res.collection] }));
        get().notify(`Imported collection “${res.collection.name}”`);
      } else {
        set((s) => ({ environments: [...s.environments, res.environment] }));
        get().notify(`Imported environment “${res.environment.name}”`);
      }
    } catch (e) {
      get().notify(`Import failed: ${(e as Error).message}`);
    }
  },
}));

// ---------- persistence: debounced, only when the relevant slice changed ----------

function persist<T>(name: string, select: (s: State) => T, delay = 400) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let prev: T | undefined;
  useStore.subscribe((s) => {
    if (!s.loaded) return;
    const next = select(s);
    if (prev !== undefined && shallowEqual(prev, next)) return;
    prev = next;
    clearTimeout(timer);
    timer = setTimeout(() => {
      invoke("save_state", { name, data: serialize(name, next) }).catch((e) =>
        useStore.getState().notify(`Save failed: ${e}`),
      );
    }, delay);
  });
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => (a as never)[k] === (b as never)[k]);
}

function serialize(name: string, data: unknown): unknown {
  if (name !== "session") return data;
  // responses are not persisted: they can be huge and are stale anyway
  const s = data as { tabs: Tab[]; activeTabId: string | null };
  return {
    activeTabId: s.activeTabId,
    tabs: s.tabs.map(({ id, request, savedRef, dirty }) => ({ id, request, savedRef, dirty })),
  };
}

persist("workspace", (s) => ({
  version: 1,
  collections: s.collections,
  environments: s.environments,
  activeEnvironmentId: s.activeEnvironmentId,
  settings: s.settings,
}));
persist("history", (s) => s.history, 1000);
persist("session", (s) => ({ tabs: s.tabs, activeTabId: s.activeTabId }), 800);
