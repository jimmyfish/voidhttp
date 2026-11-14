import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  Collection,
  Environment,
  Example,
  ExampleRef,
  GrpcEnd,
  GrpcResult,
  HistoryEntry,
  HttpResponse,
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
import { capEnvironments, capRows, type Source } from "./lib/formats/common";
import {
  clientStreams,
  findMethod,
  grpcCancel,
  grpcEndSending,
  grpcSend,
  invokeGrpc,
  isGrpc,
  loadSchema,
  prepareGrpc,
  type GrpcEvent,
} from "./lib/grpc";

const HISTORY_LIMIT = 200;
/** A gRPC stream keeps this many messages on screen; older ones are counted, not kept. */
const GRPC_MESSAGE_LIMIT = 2000;

export type Modal =
  | { kind: "prompt"; title: string; initial: string; onSubmit: (v: string) => void }
  | { kind: "confirm"; title: string; message: string; onConfirm: () => void; confirmLabel?: string }
  | { kind: "save"; tabId: string }
  /** select: an environment or collection id to open on */
  /** addVar: start a new, empty variable of that name in the selected environment or collection */
  | { kind: "environments"; select?: string; addVar?: string }
  | { kind: "settings"; section?: "appearance" | "requests" | "updates" }
  /** create a project (no id) or edit one */
  | { kind: "project"; projectId?: string }
  /** import a file, URL or pasted text; source is set when a file was dropped or picked before the dialog opened */
  | { kind: "import"; source?: Source }
  /** export a collection to a file */
  | { kind: "export"; collectionId: string }
  /** save a response (or an ended gRPC call) as an example; target is the request it goes under when known */
  | { kind: "example"; request: RequestDef; response: HttpResponse | GrpcResult; target?: SavedRef };

export type View = "home" | "project";

/**
 * The open project's data sits at the top of the state (collections, environments, history, tabs…),
 * so every request/collection action works on it unchanged. Other projects wait in `stash`.
 */
interface State extends ProjectData {
  loaded: boolean;
  /** Set when loading failed: saving now would write an empty state over the real files. */
  saveBlocked: boolean;
  settings: Settings;
  modal: Modal | null;
  toast: string | null;
  /** a button on the toast, e.g. Undo after an import */
  toastAction: { label: string; run: () => void } | null;

  projects: ProjectMeta[];
  currentProjectId: string | null;
  openProjectIds: string[];
  view: View;
  stash: Record<string, ProjectData>;

  init(): Promise<void>;
  notify(msg: string, action?: { label: string; run: () => void }): void;
  openModal(m: Modal | null): void;

  // projects
  projectData(id: string): ProjectData;
  openProject(id: string): void;
  goHome(): void;
  closeProject(id: string): void;
  createProject(p: { name: string; icon: string; color: number }): string;
  updateProject(id: string, patch: Partial<Pick<ProjectMeta, "name" | "icon" | "color">>): void;
  deleteProject(id: string): void;
  /** Adds imported collections and environments to a project and opens it; the toast offers Undo. */
  applyImport(projectId: string, collections: Collection[], environments: Environment[], message: string): void;

  // requests and tabs (current project)
  newTab(req?: RequestDef, savedRef?: SavedRef): void;
  closeTab(id: string): void;
  setActiveTab(id: string): void;
  updateRequest(tabId: string, patch: Partial<RequestDef>): void;
  sendTab(tabId: string): Promise<void>;
  cancelTab(tabId: string): void;
  /** gRPC: start the call, or on an open client stream send the next message */
  callGrpc(tabId: string): Promise<void>;
  /** gRPC: send the editor's message on the open client or bidi stream */
  sendGrpcMessage(tabId: string): Promise<void>;
  /** gRPC: no more messages from the client; replies keep coming */
  endGrpcSending(tabId: string): void;
  clearGrpcMessages(tabId: string): void;
  scopeFor(tabId: string): VarScope;

  /** Open a history entry in a new tab, with its stored response when there is one. */
  openHistory(entryId: string): Promise<void>;
  /** Show the stored response of a history entry in an existing tab (a run of the tab's request). */
  showRun(tabId: string, entryId: string): Promise<void>;
  /** The stored response of a history entry, or null. */
  historyResponse(entryId: string): Promise<HttpResponse | null>;
  deleteHistory(entryId: string): void;

  saveExample(target: SavedRef, example: Example): void;
  openExample(ref: ExampleRef): void;
  renameExample(ref: ExampleRef, name: string): void;
  deleteExample(ref: ExampleRef): void;

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
/** gRPC tabs looking up how their method streams before the first call; a second Invoke waits it out. */
const resolvingGrpc = new Set<string>();

const patchTab = (tabs: Tab[], id: string, fn: (t: Tab) => Tab) => tabs.map((t) => (t.id === id ? fn(t) : t));

/** A duplicated collection copies its example ids, so a ref is only the same with its collection and request. */
export const sameExample = (a: ExampleRef | undefined, b: ExampleRef) =>
  !!a && a.exampleId === b.exampleId && a.nodeId === b.nodeId && a.collectionId === b.collectionId;

function findExample(collections: Collection[], ref: ExampleRef): Example | undefined {
  const col = collections.find((c) => c.id === ref.collectionId);
  const node = col && findNode(col.children, ref.nodeId);
  return node?.type === "request" ? node.examples?.find((e) => e.id === ref.exampleId) : undefined;
}

function mapExamples(collections: Collection[], ref: ExampleRef, fn: (list: Example[]) => Example[]): Collection[] {
  return collections.map((c) =>
    c.id !== ref.collectionId
      ? c
      : { ...c, children: mapTree(c.children, ref.nodeId, (n) => (n.type === "request" ? { ...n, examples: fn(n.examples ?? []) } : n)) },
  );
}

/**
 * Stores the response of history entry `id` as received (never masked), when the setting allows.
 * A body over the size limit is left out; status and headers are kept.
 */
function keepResponse(id: string, response: HttpResponse, settings: Settings): HistoryEntry["kept"] {
  if (settings.keepResponses === false) return undefined;
  const over = response.size > (settings.keepResponseMaxMb ?? 1) * 1024 * 1024;
  const data = over ? { ...response, body: "" } : response;
  invoke("save_response", { id, data }).catch((e) => useStore.getState().notify(`Could not keep the response: ${e}`));
  return over ? "meta" : "full";
}

/** Stores a gRPC call with its history entry, like keepResponse; a call over the size limit keeps status and metadata only. */
function keepGrpc(id: string, result: GrpcResult, settings: Settings): HistoryEntry["kept"] {
  if (settings.keepResponses === false) return undefined;
  const size = result.messages.reduce((n, m) => n + m.json.length, 0);
  const over = size > (settings.keepResponseMaxMb ?? 1) * 1024 * 1024;
  const data: GrpcResult = { ...result, callId: undefined, sendOpen: false, ...(over && { messages: [], dropped: (result.dropped ?? 0) + result.messages.length }) };
  invoke("save_response", { id, data }).catch((e) => useStore.getState().notify(`Could not keep the response: ${e}`));
  return over ? "meta" : "full";
}

/** The history entry each tab is loading with showRun, so an older pick that lands late is dropped. */
const loadingRun = new Map<string, string>();

/** Stops whatever a tab has in flight: an HTTP request or a gRPC call. */
function stopInflight(t: Tab) {
  if (t.inflightId) (isGrpc(t.request) ? grpcCancel : cancel)(t.inflightId).catch(() => undefined);
}

/** Session tabs come back without responses; example tabs get theirs from the collection, or close when it is gone. */
function restoreTabs(tabs: Tab[], collections: Collection[]): Tab[] {
  return tabs.flatMap((t) => {
    if (!t.example) return [t];
    const ex = findExample(collections, t.example);
    return ex ? [{ ...t, response: ex.response, grpc: ex.grpc }] : [];
  });
}

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
    saveBlocked: false,
    ...emptyData(),
    settings: DEFAULT_SETTINGS,
    modal: null,
    toast: null,
    toastAction: null,
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
              tabs: restoreTabs(per?.tabs ?? [], collections),
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
        set({ saveBlocked: true });
        get().notify(`Could not load data: ${e}. Changes won't be saved until restart.`);
      }
      set({ loaded: true });
    },

    notify(msg, action) {
      set({ toast: msg, toastAction: action ?? null });
      // a toast with a button stays longer, so there is time to reach it
      setTimeout(() => get().toast === msg && set({ toast: null, toastAction: null }), action ? 8000 : 3500);
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
      if (s.currentProjectId === id) for (const t of s.tabs) stopInflight(t);
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

    applyImport(projectId, imported, importedEnvs, message) {
      const collections = capRows(imported);
      const environments = capEnvironments(importedEnvs);
      const s = get();
      if (s.currentProjectId !== projectId || s.view !== "project") get().openProject(projectId);
      set((st) => ({ collections: [...st.collections, ...collections], environments: [...st.environments, ...environments] }));
      const cIds = new Set(collections.map((c) => c.id));
      const eIds = new Set(environments.map((e) => e.id));
      const strip = <T extends Pick<ProjectData, "collections" | "environments" | "activeEnvironmentId">>(d: T): T => ({
        ...d,
        collections: d.collections.filter((c) => !cIds.has(c.id)),
        environments: d.environments.filter((e) => !eIds.has(e.id)),
        activeEnvironmentId: d.activeEnvironmentId && eIds.has(d.activeEnvironmentId) ? null : d.activeEnvironmentId,
      });
      get().notify(message, {
        label: "Undo",
        run: () => {
          const st = get();
          if (st.currentProjectId === projectId) set(strip(liveData(st)));
          else if (st.stash[projectId]) set({ stash: { ...st.stash, [projectId]: strip(st.stash[projectId]) } });
          set({ toast: null, toastAction: null });
        },
      });
    },

    // ---------- tabs and requests (current project) ----------

    newTab(req, savedRef) {
      const tab: Tab = { id: uid(), request: req ?? newRequest(), savedRef, dirty: false };
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
    },

    closeTab(id) {
      const tab = get().tabs.find((t) => t.id === id);
      if (tab) stopInflight(tab);
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
      if (tab && isGrpc(tab.request)) return get().callGrpc(tabId);
      if (!tab || tab.inflightId || tab.example) return;
      // the response lands in this project even if another one is open by the time it arrives
      const pid = get().currentProjectId;
      const inflightId = uid();
      loadingRun.delete(tabId);
      set((s) => ({ tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, inflightId, error: undefined })) }));
      const request = structuredClone(tab.request);
      const ref = tab.savedRef?.nodeId;
      try {
        const prepared = prepare(request, get().scopeFor(tabId));
        const response = await send(prepared, get().settings, inflightId);
        const entryId = uid();
        const kept = keepResponse(entryId, response, get().settings);
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => ({ ...t, inflightId: undefined, response, error: undefined, fromHistory: undefined })),
          history: [
            { id: entryId, at: Date.now(), request, ref, status: response.status, elapsedMs: response.elapsedMs, size: response.size, kept },
            ...d.history,
          ].slice(0, HISTORY_LIMIT),
        }));
      } catch (e) {
        const error = String(e);
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => ({ ...t, inflightId: undefined, response: undefined, error, fromHistory: undefined })),
          history:
            error === "Request cancelled"
              ? d.history
              : [{ id: uid(), at: Date.now(), request, ref }, ...d.history].slice(0, HISTORY_LIMIT),
        }));
      }
    },

    cancelTab(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (tab) stopInflight(tab);
    },

    async callGrpc(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab || tab.example) return;
      if (tab.inflightId) {
        // ⌘Enter on an open client or bidi stream sends the next message
        if (tab.grpc?.sendOpen) await get().sendGrpcMessage(tabId);
        return;
      }
      let def = tab.request.grpc;
      if (!def?.service || !def.method) return get().notify("Pick a method first");
      const pid = get().currentProjectId;
      const callId = uid();
      const settings = get().settings;
      // a pasted grpcurl command names the method but not how it streams: ask the schema once
      let source = tab.request;
      if (!def.stream) {
        if (resolvingGrpc.has(tabId)) return;
        resolvingGrpc.add(tabId);
        try {
          const sc = await loadSchema(prepareGrpc(tab.request, get().scopeFor(tabId), settings));
          const m = findMethod(sc.info, def.service, def.method);
          if (m) get().updateRequest(tabId, { grpc: { ...def, stream: m.stream, inputType: m.inputType } });
        } finally {
          resolvingGrpc.delete(tabId);
        }
        // read the tab again: it may have been edited, closed or sent meanwhile
        const now = get().tabs.find((t) => t.id === tabId);
        if (!now || now.inflightId || !now.request.grpc) return;
        source = now.request;
        def = now.request.grpc;
      }
      const request = structuredClone(source);
      const call = prepareGrpc(request, get().scopeFor(tabId), settings);
      const stream = def.stream ?? "unary";
      const tls = /^https:\/\//i.test(call.target.address) || (!/^http:\/\//i.test(call.target.address) && call.target.tls);
      loadingRun.delete(tabId);
      const fresh: GrpcResult = { callId, startedAt: Date.now(), stream, tls, headers: [], messages: [], sendOpen: clientStreams(stream) };
      set((s) => ({
        tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, inflightId: callId, error: undefined, response: undefined, fromHistory: undefined, grpc: fresh })),
      }));

      // events land in batches: one state update per frame, however fast the server streams
      let queue: GrpcEvent[] = [];
      let timer: ReturnType<typeof setTimeout> | undefined;
      let latest = fresh;
      let finished = false;
      const ref = tab.savedRef?.nodeId;
      const record = (entry: Omit<HistoryEntry, "id" | "at" | "request">, kept?: (id: string) => HistoryEntry["kept"]) => {
        const id = uid();
        applyToProject(pid, (d) => ({ history: [{ id, at: Date.now(), request, ref, ...entry, kept: kept?.(id) }, ...d.history].slice(0, HISTORY_LIMIT) }));
      };
      const finish = (end: GrpcEnd) => {
        if (finished) return;
        finished = true;
        const size = latest.messages.reduce((n, m) => n + (m.dir === "in" ? m.size : 0), 0);
        record({ status: end.code, elapsedMs: end.elapsedMs, size }, (id) => keepGrpc(id, latest, get().settings));
      };
      const flush = () => {
        timer = undefined;
        const batch = queue;
        queue = [];
        if (!batch.length) return;
        let end: GrpcEnd | undefined;
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => {
            if (t.grpc?.callId !== callId) return t;
            const g: GrpcResult = { ...t.grpc };
            const incoming = [];
            for (const e of batch) {
              if (e.type === "headers") g.headers = e.metadata;
              else if (e.type === "message") incoming.push({ dir: e.dir, json: e.json, size: e.size, atMs: e.atMs });
              else {
                end = { code: e.code, status: e.status, message: e.message, details: e.details, trailers: e.trailers, elapsedMs: e.elapsedMs };
                g.end = end;
                g.sendOpen = false;
              }
            }
            if (incoming.length) {
              const all = [...g.messages, ...incoming];
              const over = Math.max(0, all.length - GRPC_MESSAGE_LIMIT);
              g.messages = over ? all.slice(over) : all;
              if (over) g.dropped = (g.dropped ?? 0) + over;
            }
            latest = g;
            return end ? { ...t, grpc: g, inflightId: undefined } : { ...t, grpc: g };
          }),
        }));
        if (end) finish(end);
      };
      const onEvent = (e: GrpcEvent) => {
        queue.push(e);
        if (e.type === "end") {
          clearTimeout(timer);
          flush();
        } else if (!timer) timer = setTimeout(flush, 16);
      };

      try {
        await invokeGrpc(callId, call, settings.timeoutMs, onEvent);
        // the end event comes first; should it ever not, close the call rather than spin forever
        setTimeout(() => {
          flush();
          if (!finished)
            onEvent({ type: "end", code: 2, status: "UNKNOWN", message: "The call ended without a status", trailers: [], elapsedMs: Date.now() - fresh.startedAt });
        }, 1500);
      } catch (e) {
        clearTimeout(timer);
        flush();
        if (finished) return;
        finished = true;
        const error = String(e);
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => (t.grpc?.callId === callId ? { ...t, inflightId: undefined, grpc: undefined, error } : t)),
        }));
        record({});
      }
    },

    async sendGrpcMessage(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab?.inflightId || !tab.grpc?.sendOpen) return;
      try {
        const { message } = prepareGrpc(tab.request, get().scopeFor(tabId), get().settings);
        await grpcSend(tab.inflightId, message);
      } catch (e) {
        get().notify(String(e));
      }
    },

    endGrpcSending(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab?.inflightId || !tab.grpc) return;
      grpcEndSending(tab.inflightId).catch((e) => get().notify(String(e)));
      set((s) => ({ tabs: patchTab(s.tabs, tabId, (t) => (t.grpc ? { ...t, grpc: { ...t.grpc, sendOpen: false } } : t)) }));
    },

    clearGrpcMessages(tabId) {
      set((s) => ({
        tabs: patchTab(s.tabs, tabId, (t) => (t.grpc ? { ...t, grpc: { ...t.grpc, messages: [], dropped: 0 } } : t)),
      }));
    },

    async historyResponse(entryId) {
      const entry = get().history.find((h) => h.id === entryId);
      if (!entry?.kept) return null;
      try {
        return (await invoke<HttpResponse | null>("load_response", { id: entryId })) ?? null;
      } catch {
        return null;
      }
    },

    async openHistory(entryId) {
      const entry = get().history.find((h) => h.id === entryId);
      if (!entry) return;
      get().newTab({ ...toRequestDef(entry.request), name: entry.request.url || entry.request.name });
      const tabId = get().activeTabId!;
      if (!entry.kept) return;
      const pid = get().currentProjectId;
      const response = await get().historyResponse(entryId);
      if (!response) return get().notify("The saved response is missing");
      const fromHistory = { at: entry.at, bodyDropped: entry.kept === "meta", entryId };
      // a gRPC entry keeps its call (messages, status, metadata) in the same file
      const grpc = isGrpc(entry.request) ? (response as unknown as GrpcResult) : undefined;
      // the tab may have been sent (or closed) while the file was read
      applyToProject(pid, (d) => ({
        tabs: patchTab(d.tabs, tabId, (t) =>
          t.response || t.grpc || t.inflightId || t.error ? t : grpc ? { ...t, grpc, fromHistory } : { ...t, response, fromHistory },
        ),
      }));
    },

    async showRun(tabId, entryId) {
      const entry = get().history.find((h) => h.id === entryId);
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!entry?.kept || !tab || tab.inflightId) return;
      const pid = get().currentProjectId;
      loadingRun.set(tabId, entryId);
      const response = await get().historyResponse(entryId);
      // a later pick (or a send) in the same tab wins
      if (loadingRun.get(tabId) !== entryId) return;
      loadingRun.delete(tabId);
      if (!response) return get().notify("The saved response is missing");
      const fromHistory = { at: entry.at, bodyDropped: entry.kept === "meta", entryId };
      const grpc = isGrpc(entry.request) ? (response as unknown as GrpcResult) : undefined;
      applyToProject(pid, (d) => ({
        tabs: patchTab(d.tabs, tabId, (t) =>
          t.inflightId
            ? t
            : { ...t, error: undefined, fromHistory, ...(grpc ? { grpc, response: undefined } : { response, grpc: undefined }) },
        ),
      }));
    },

    deleteHistory(entryId) {
      // the stored response goes with it on the next prune (see the history persist below)
      set((s) => ({ history: s.history.filter((h) => h.id !== entryId) }));
    },

    saveExample(target, example) {
      set((s) => ({
        collections: s.collections.map((c) =>
          c.id !== target.collectionId
            ? c
            : {
                ...c,
                children: mapTree(c.children, target.nodeId, (n) =>
                  n.type === "request" ? { ...n, examples: [...(n.examples ?? []), example] } : n,
                ),
              },
        ),
      }));
      get().notify(`Example “${example.name}” saved`);
    },

    openExample(ref) {
      const existing = get().tabs.find((t) => sameExample(t.example, ref));
      if (existing) return set({ activeTabId: existing.id });
      const ex = findExample(get().collections, ref);
      if (!ex) return;
      const tab: Tab = { id: uid(), request: { ...structuredClone(ex.request), name: ex.name }, example: ref, response: ex.response, grpc: ex.grpc, dirty: false };
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
    },

    renameExample(ref, name) {
      set((s) => ({
        collections: mapExamples(s.collections, ref, (list) => list.map((e) => (e.id === ref.exampleId ? { ...e, name } : e))),
        tabs: s.tabs.map((t) => (sameExample(t.example, ref) ? { ...t, request: { ...t.request, name } } : t)),
      }));
    },

    deleteExample(ref) {
      set((s) => ({ collections: mapExamples(s.collections, ref, (list) => list.filter((e) => e.id !== ref.exampleId)) }));
      for (const t of get().tabs.filter((t) => sameExample(t.example, ref))) get().closeTab(t.id);
    },

    saveTab(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab || tab.example) return;
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
            : {
                ...c,
                children: mapTree(c.children, ref.nodeId, (n) => ({
                  type: "request",
                  ...toRequestDef(tab.request),
                  id: ref.nodeId,
                  examples: n.type === "request" ? n.examples : undefined,
                })),
              },
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
            : s.tabs.map((t) =>
                t.savedRef && moved.has(t.savedRef.nodeId)
                  ? { ...t, savedRef: { ...t.savedRef, collectionId: toId } }
                  : t.example && moved.has(t.example.nodeId)
                    ? { ...t, example: { ...t.example, collectionId: toId } }
                    : t,
              ),
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
  };
});

// ---------- persistence: debounced, only when the slices a file depends on changed ----------

function persist<T>(name: string, select: (s: State) => T, toFile: (v: T) => unknown, delay = 400, after?: (v: T) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let prev: T | undefined;
  useStore.subscribe((s) => {
    if (!s.loaded || s.saveBlocked) return;
    const next = select(s);
    if (prev !== undefined && shallowEqual(prev, next)) return;
    prev = next;
    clearTimeout(timer);
    timer = setTimeout(() => {
      invoke("save_state", { name, data: toFile(next) })
        .then(() => after?.(next))
        .catch((e) => useStore.getState().notify(`Save failed: ${e}`));
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
  // stored responses live only as long as their history entry, across every project.
  // Read the state now, not the debounced snapshot: a send that landed since then has its file already.
  () => {
    const v = refs(useStore.getState());
    const keep = v.projects.flatMap((p) => dataOf(v, p.id).history.filter((h) => h.kept).map((h) => h.id));
    invoke("prune_responses", { keep }).catch(() => undefined);
  },
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
        // tab responses are not persisted: history keeps its own copy, and examples come from their collection
        return [p.id, { activeTabId: d.activeTabId, tabs: d.tabs.map(({ id, request, savedRef, dirty, example }) => ({ id, request, savedRef, dirty, example })) }];
      }),
    ),
  }),
  800,
);
