import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  Collection,
  Environment,
  ProjectData,
  ProjectMeta,
  RequestDef,
  SavedRef,
  SessionV2,
  Settings,
  Tab,
  TreeNode,
  WorkspaceV2,
} from "./types";
import {
  cloneNode,
  findNode,
  insertNode,
  mapTree,
  newRequest,
  nodeIds,
  placeNode,
  removeFromTree,
  toRequestDef,
  uid,
  type DropWhere,
} from "./lib/model";
import { buildScope, type VarScope } from "./lib/vars";
import { cancel, prepare, send } from "./lib/http";
import { importPostman } from "./lib/postman";

const HISTORY_LIMIT = 200;

export type Modal =
  | { kind: "prompt"; title: string; initial: string; onSubmit: (v: string) => void }
  | { kind: "confirm"; title: string; message: string; onConfirm: () => void; confirmLabel?: string }
  | { kind: "save"; tabId: string }
  /** select: an environment or collection id to open on */
  | { kind: "environments"; select?: string }
  | { kind: "settings"; section?: "appearance" | "requests" }
  /** create a project (no id) or edit one */
  | { kind: "project"; projectId?: string }
  /** a file was picked on Home: choose which project it goes into */
  | { kind: "import"; text: string };

export type View = "home" | "project";

/**
 * The open project's data sits at the top of the state (collections, environments, history, tabs…),
 * so every request/collection action works on it unchanged. Other projects wait in `stash`.
 */
interface State extends ProjectData {
  loaded: boolean;
  settings: Settings;
  modal: Modal | null;
  toast: string | null;

  projects: ProjectMeta[];
  currentProjectId: string | null;
  openProjectIds: string[];
  view: View;
  stash: Record<string, ProjectData>;

  init(): Promise<void>;
  notify(msg: string): void;
  openModal(m: Modal | null): void;

  // projects
  projectData(id: string): ProjectData;
  openProject(id: string): void;
  goHome(): void;
  closeProject(id: string): void;
  createProject(p: { name: string; icon: string; color: number }): string;
  updateProject(id: string, patch: Partial<Pick<ProjectMeta, "name" | "icon" | "color">>): void;
  deleteProject(id: string): void;
  importInto(projectId: string, text: string): void;

  // requests and tabs (current project)
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
  deleteSaved(tabId: string): void;

  createCollection(name: string): string;
  addFolder(collectionId: string, parentId: string | null, name: string): void;
  addRequest(collectionId: string, parentId: string | null): void;
  renameNode(collectionId: string, nodeId: string, name: string): void;
  deleteNode(collectionId: string, nodeId: string): void;
  /** Drag and drop in the tree. targetId is a node, or a collection id with "inside" for its root. */
  moveNode(fromCollectionId: string, nodeId: string, toCollectionId: string, targetId: string, where: DropWhere): void;
  moveCollection(collectionId: string, targetCollectionId: string, where: "before" | "after"): void;
  /** Copy a node (or a whole collection when nodeId is the collection id) right after the original. */
  duplicateNode(collectionId: string, nodeId: string): void;
  updateCollection(collectionId: string, patch: Partial<Collection>): void;

  setEnvironments(envs: Environment[]): void;
  setActiveEnvironment(id: string | null): void;
  setSettings(s: Partial<Settings>): void;
  clearHistory(): void;
  importText(text: string): void;
}

const DEFAULT_SETTINGS: Settings = { timeoutMs: 30000, followRedirects: true, insecure: false };

const emptyData = (): ProjectData => ({
  collections: [],
  environments: [],
  activeEnvironmentId: null,
  history: [],
  tabs: [],
  activeTabId: null,
});

/** The open project's data, read off the top of the state. */
const liveData = (s: ProjectData): ProjectData => ({
  collections: s.collections,
  environments: s.environments,
  activeEnvironmentId: s.activeEnvironmentId,
  history: s.history,
  tabs: s.tabs,
  activeTabId: s.activeTabId,
});

let initStarted = false;

const patchTab = (tabs: Tab[], id: string, fn: (t: Tab) => Tab) => tabs.map((t) => (t.id === id ? fn(t) : t));

export const useStore = create<State>((set, get) => {
  /** Apply a change to one project's data, whether it is open (top of state) or stashed. */
  const applyToProject = (pid: string | null, fn: (d: ProjectData) => Partial<ProjectData>) => {
    const s = get();
    if (!pid || s.currentProjectId === pid) return set(fn(liveData(s)));
    const d = s.stash[pid];
    if (d) set({ stash: { ...s.stash, [pid]: { ...d, ...fn(d) } } });
  };

  return {
    loaded: false,
    ...emptyData(),
    settings: DEFAULT_SETTINGS,
    modal: null,
    toast: null,
    projects: [],
    currentProjectId: null,
    openProjectIds: [],
    view: "home",
    stash: {},

    async init() {
      if (initStarted) return; // React StrictMode runs effects twice in dev
      initStarted = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = await invoke<{ workspace: any; history: any; session: any }>("load_state");
        const ws = raw.workspace;
        const projects: ProjectMeta[] = [];
        const data: Record<string, ProjectData> = {};
        let session: SessionV2;

        if (ws?.version === 2) {
          const sess = (raw.session ?? {}) as Partial<SessionV2>;
          for (const p of (ws as WorkspaceV2).projects) {
            const { collections, environments, activeEnvironmentId, ...meta } = p;
            projects.push(meta);
            const per = sess.perProject?.[p.id];
            data[p.id] = {
              collections,
              environments,
              activeEnvironmentId,
              history: raw.history?.[p.id] ?? [],
              tabs: per?.tabs ?? [],
              activeTabId: per?.activeTabId ?? null,
            };
          }
          session = {
            view: sess.view ?? "home",
            currentProjectId: sess.currentProjectId ?? null,
            openProjectIds: sess.openProjectIds ?? [],
            perProject: {},
          };
        } else {
          // Version 1 (one flat workspace) or a fresh install: everything becomes "My project".
          if (ws) {
            // keep the untouched v1 files once, before anything is rewritten in v2 shape
            await invoke("save_state", { name: "backup-v1", data: raw }).catch(() => undefined);
          }
          const id = uid();
          const now = Date.now();
          projects.push({ id, name: "My project", icon: "layers", color: 1, createdAt: now, openedAt: now });
          const tabs: Tab[] = Array.isArray(raw.session?.tabs) ? raw.session.tabs : [];
          data[id] = {
            collections: ws?.collections ?? [],
            environments: ws?.environments ?? [],
            activeEnvironmentId: ws?.activeEnvironmentId ?? null,
            history: Array.isArray(raw.history) ? raw.history : [],
            tabs,
            activeTabId: raw.session?.activeTabId ?? tabs[0]?.id ?? null,
          };
          session = { view: "project", currentProjectId: id, openProjectIds: [id], perProject: {} };
        }

        const known = new Set(projects.map((p) => p.id));
        set({
          projects,
          stash: data,
          settings: { ...DEFAULT_SETTINGS, ...ws?.settings },
          openProjectIds: session.openProjectIds.filter((id) => known.has(id)),
        });
        const target = session.currentProjectId && known.has(session.currentProjectId) ? session.currentProjectId : null;
        if (target) get().openProject(target);
        if (session.view === "home" || !target) set({ view: "home" });
      } catch (e) {
        get().notify(`Could not load data: ${e}`);
      }
      set({ loaded: true });
    },

    notify(msg) {
      set({ toast: msg });
      setTimeout(() => get().toast === msg && set({ toast: null }), 3500);
    },

    openModal(m) {
      set({ modal: m });
    },

    // ---------- projects ----------

    projectData(id) {
      const s = get();
      return s.currentProjectId === id ? liveData(s) : (s.stash[id] ?? emptyData());
    },

    openProject(id) {
      const s = get();
      if (!s.projects.some((p) => p.id === id)) return;
      let swap: Partial<State> = {};
      if (s.currentProjectId !== id) {
        const stash = { ...s.stash };
        if (s.currentProjectId) stash[s.currentProjectId] = liveData(s);
        const next = stash[id] ?? emptyData();
        delete stash[id];
        swap = { ...next, stash, currentProjectId: id };
      }
      set({
        ...swap,
        view: "project",
        openProjectIds: s.openProjectIds.includes(id) ? s.openProjectIds : [...s.openProjectIds, id],
        projects: s.projects.map((p) => (p.id === id ? { ...p, openedAt: Date.now() } : p)),
      });
      if (get().tabs.length === 0) get().newTab();
    },

    goHome() {
      set({ view: "home" });
    },

    closeProject(id) {
      const s = get();
      const openProjectIds = s.openProjectIds.filter((p) => p !== id);
      set({ openProjectIds });
      // closing only hides the tab; the project and its data stay
      if (s.view === "project" && s.currentProjectId === id) {
        const next = openProjectIds[openProjectIds.length - 1];
        if (next) get().openProject(next);
        else set({ view: "home" });
      }
    },

    createProject({ name, icon, color }) {
      const id = uid();
      const now = Date.now();
      set((s) => ({
        projects: [...s.projects, { id, name, icon, color, createdAt: now, openedAt: now }],
        stash: { ...s.stash, [id]: emptyData() },
      }));
      return id;
    },

    updateProject(id, patch) {
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
    },

    deleteProject(id) {
      const s = get();
      if (s.currentProjectId === id) for (const t of s.tabs) if (t.inflightId) cancel(t.inflightId);
      const stash = { ...s.stash };
      delete stash[id];
      const openProjectIds = s.openProjectIds.filter((p) => p !== id);
      set({
        projects: s.projects.filter((p) => p.id !== id),
        stash,
        openProjectIds,
        ...(s.currentProjectId === id ? { ...emptyData(), currentProjectId: null } : {}),
      });
      if (s.currentProjectId === id && s.view === "project") {
        const next = openProjectIds[openProjectIds.length - 1];
        if (next) get().openProject(next);
        else set({ view: "home" });
      }
    },

    importInto(projectId, text) {
      get().openProject(projectId);
      get().importText(text);
    },

    // ---------- tabs and requests (current project) ----------

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
      // the response lands in this project even if another one is open by the time it arrives
      const pid = get().currentProjectId;
      const inflightId = uid();
      set((s) => ({ tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, inflightId, error: undefined })) }));
      const request = structuredClone(tab.request);
      try {
        const prepared = prepare(request, get().scopeFor(tabId));
        const response = await send(prepared, get().settings, inflightId);
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => ({ ...t, inflightId: undefined, response, error: undefined })),
          history: [
            { id: uid(), at: Date.now(), request, status: response.status, elapsedMs: response.elapsedMs },
            ...d.history,
          ].slice(0, HISTORY_LIMIT),
        }));
      } catch (e) {
        const error = String(e);
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => ({ ...t, inflightId: undefined, response: undefined, error })),
          history:
            error === "Request cancelled"
              ? d.history
              : [{ id: uid(), at: Date.now(), request }, ...d.history].slice(0, HISTORY_LIMIT),
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

    deleteSaved(tabId) {
      const ref = get().tabs.find((t) => t.id === tabId)?.savedRef;
      if (!ref) return;
      get().deleteNode(ref.collectionId, ref.nodeId);
      // the tab stays open as an unsaved request, so nothing typed is lost
      set((s) => ({ tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, savedRef: undefined, dirty: false })) }));
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

    moveNode(fromId, nodeId, toId, targetId, where) {
      if (nodeId === targetId) return;
      const s = get();
      const from = s.collections.find((c) => c.id === fromId);
      const to = s.collections.find((c) => c.id === toId);
      const node = from && findNode(from.children, nodeId);
      if (!from || !to || !node) return;
      // a folder cannot go inside itself or one of its own folders
      if (node.type === "folder" && findNode(node.children, targetId)) return;
      const children = (c: typeof from) => (c.id === fromId ? removeFromTree(c.children, nodeId) : c.children);
      let placed: typeof from.children | null;
      if (targetId === toId) placed = [...children(to), node]; // the collection's root
      else placed = placeNode(children(to), targetId, where, node);
      if (!placed) return;
      const moved = new Set(nodeIds(node));
      set({
        collections: s.collections.map((c) =>
          c.id === toId ? { ...c, children: placed! } : c.id === fromId ? { ...c, children: removeFromTree(c.children, nodeId) } : c,
        ),
        // open tabs follow their request into the other collection
        tabs:
          fromId === toId
            ? s.tabs
            : s.tabs.map((t) => (t.savedRef && moved.has(t.savedRef.nodeId) ? { ...t, savedRef: { ...t.savedRef, collectionId: toId } } : t)),
      });
    },

    moveCollection(collectionId, targetId, where) {
      if (collectionId === targetId) return;
      const s = get();
      const c = s.collections.find((x) => x.id === collectionId);
      if (!c) return;
      const rest = s.collections.filter((x) => x.id !== collectionId);
      const i = rest.findIndex((x) => x.id === targetId);
      if (i < 0) return;
      rest.splice(where === "before" ? i : i + 1, 0, c);
      set({ collections: rest });
    },

    duplicateNode(collectionId, nodeId) {
      const s = get();
      const col = s.collections.find((c) => c.id === collectionId);
      if (!col) return;
      if (nodeId === collectionId) {
        const copy = { ...structuredClone(col), id: uid(), name: `${col.name} copy`, children: col.children.map(cloneNode) };
        const i = s.collections.indexOf(col);
        set({ collections: [...s.collections.slice(0, i + 1), copy, ...s.collections.slice(i + 1)] });
        return;
      }
      const node = findNode(col.children, nodeId);
      if (!node) return;
      const copy = { ...cloneNode(node), name: `${node.name} copy` };
      const children = placeNode(col.children, nodeId, "after", copy);
      if (children) set({ collections: s.collections.map((c) => (c.id === collectionId ? { ...c, children } : c)) });
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
  };
});

// ---------- persistence: debounced, only when the slices a file depends on changed ----------

function persist<T>(name: string, select: (s: State) => T, toFile: (v: T) => unknown, delay = 400) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let prev: T | undefined;
  useStore.subscribe((s) => {
    if (!s.loaded) return;
    const next = select(s);
    if (prev !== undefined && shallowEqual(prev, next)) return;
    prev = next;
    clearTimeout(timer);
    timer = setTimeout(() => {
      invoke("save_state", { name, data: toFile(next) }).catch((e) => useStore.getState().notify(`Save failed: ${e}`));
    }, delay);
  });
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => (a as never)[k] === (b as never)[k]);
}

/** Every slice a file might need, by reference, so unrelated changes (a toast) skip the write. */
const refs = (s: State) => ({
  settings: s.settings,
  projects: s.projects,
  stash: s.stash,
  current: s.currentProjectId,
  collections: s.collections,
  environments: s.environments,
  activeEnvironmentId: s.activeEnvironmentId,
  history: s.history,
  tabs: s.tabs,
  activeTabId: s.activeTabId,
  view: s.view,
  openProjectIds: s.openProjectIds,
});
type Refs = ReturnType<typeof refs>;
const dataOf = (v: Refs, id: string): ProjectData => (id === v.current ? v : (v.stash[id] ?? emptyData()));

persist(
  "workspace",
  (s) => {
    const r = refs(s);
    return { settings: r.settings, projects: r.projects, stash: r.stash, current: r.current, collections: r.collections, environments: r.environments, activeEnvironmentId: r.activeEnvironmentId };
  },
  (v): WorkspaceV2 => ({
    version: 2,
    settings: v.settings,
    projects: v.projects.map((p) => {
      const d = dataOf(v as Refs, p.id);
      return { ...p, collections: d.collections, environments: d.environments, activeEnvironmentId: d.activeEnvironmentId };
    }),
  }),
);

persist(
  "history",
  (s) => {
    const r = refs(s);
    return { projects: r.projects, stash: r.stash, current: r.current, history: r.history };
  },
  (v) => Object.fromEntries(v.projects.map((p) => [p.id, dataOf(v as Refs, p.id).history])),
  1000,
);

persist(
  "session",
  (s) => {
    const r = refs(s);
    return { projects: r.projects, stash: r.stash, current: r.current, tabs: r.tabs, activeTabId: r.activeTabId, view: r.view, openProjectIds: r.openProjectIds };
  },
  (v): SessionV2 => ({
    view: v.view,
    currentProjectId: v.current,
    openProjectIds: v.openProjectIds,
    perProject: Object.fromEntries(
      v.projects.map((p) => {
        const d = dataOf(v as Refs, p.id);
        // responses are not persisted: they can be huge and are stale anyway
        return [p.id, { activeTabId: d.activeTabId, tabs: d.tabs.map(({ id, request, savedRef, dirty }) => ({ id, request, savedRef, dirty })) }];
      }),
    ),
  }),
  800,
);
