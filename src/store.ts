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
  ScriptRun,
  SessionV2,
  Settings,
  Tab,
  TreeNode,
  WorkspaceV2,
  WsClose,
  WsResult,
  KafkaSeek,
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
import { applyVarOps, hasScript, runScript, withScriptRequest, type VarOp } from "./lib/script";
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
import { connectWs, isWs, prepareWs, wsClose, wsMessageText, wsSend, type WsEvent } from "./lib/ws";
import { gqlAsHttp } from "./lib/graphql";
import { connectSio, isSio, isSocket, maskAuth, prepareSio, sioClose, sioEmit, sioEmitOf, type PreparedSio, type SioEvent } from "./lib/sio";
import { connectKafka, defaultKafka, isKafka, kafkaClose, kafkaPause, kafkaProduce, kafkaRefresh, kafkaSeek, prepareKafka, produceOf, type KafkaEvent } from "./lib/kafka";
import { connectMqtt, defaultMqtt, isMqtt, mqttClose, mqttPublish, mqttSubscriptions, prepareMqtt, publishOf, subsOf, type MqttEvent } from "./lib/mqtt";
import { connectPubsub, defaultPubsub, isPubsub, preparePubsub, pubsubClose, pubsubPause, pubsubPublish, pubsubPull, pubsubRefresh, publishOf as pubsubMessageOf, type PubsubEvent } from "./lib/pubsub";

const HISTORY_LIMIT = 200;
/** A gRPC stream keeps this many messages on screen; older ones are counted, not kept. */
const GRPC_MESSAGE_LIMIT = 2000;
/** A WebSocket keeps this many messages on screen, the same way. */
const WS_MESSAGE_LIMIT = 2000;

export type Modal =
  | { kind: "prompt"; title: string; initial: string; onSubmit: (v: string) => void }
  | { kind: "confirm"; title: string; message: string; onConfirm: () => void; confirmLabel?: string }
  | { kind: "save"; tabId: string }
  /** select: an environment or collection id to open on */
  /** addVar: start a new, empty variable of that name in the selected environment or collection */
  | { kind: "environments"; select?: string; addVar?: string }
  | { kind: "settings"; section?: SettingsSection }
  /** ⌘P quick open (requests, examples, open tabs) or, with actions, ⇧⌘P (app actions) */
  | { kind: "quickopen"; actions?: boolean }
  /** About voidHTTP, from the app menu: version, updates, licence, links */
  | { kind: "about" }
  /** create a project (no id) or edit one */
  | { kind: "project"; projectId?: string }
  /** import a file, URL or pasted text; source is set when a file was dropped or picked before the dialog opened */
  | { kind: "import"; source?: Source }
  /** export a collection to a file */
  | { kind: "export"; collectionId: string }
  /** save a response (or an ended gRPC call) as an example; target is the request it goes under when known */
  | { kind: "example"; request: RequestDef; response: HttpResponse | GrpcResult; target?: SavedRef };

export type View = "home" | "project";
export type SettingsSection = "appearance" | "requests" | "network" | "certificates" | "shortcuts" | "updates";

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
  /** Closes several tabs at once (tab menu: other / to the right / to the left); the toast offers Undo.
   * `focus` is the tab the menu was opened on: it becomes the active tab. */
  closeTabs(ids: string[], focus?: string): void;
  /** Pinned tabs come first in `tabs` (the strip draws them at the left); pinning or unpinning moves the tab to that seam. */
  pinTab(id: string, pinned: boolean): void;
  /** ⇧⌘T: brings back the most recently closed tab of the open project */
  reopenTab(): void;
  /** name of the tab ⇧⌘T would bring back, if any */
  lastClosedTab(): string | undefined;
  setActiveTab(id: string): void;
  updateRequest(tabId: string, patch: Partial<RequestDef>): void;
  /** `skipScripts`: send without the pre-request and post-response scripts, once */
  sendTab(tabId: string, opts?: { skipScripts?: boolean }): Promise<void>;
  cancelTab(tabId: string): void;
  clearScriptLogs(tabId: string): void;
  /** gRPC: start the call, or on an open client stream send the next message */
  callGrpc(tabId: string): Promise<void>;
  /** gRPC: send the editor's message on the open client or bidi stream */
  sendGrpcMessage(tabId: string): Promise<void>;
  /** gRPC: no more messages from the client; replies keep coming */
  endGrpcSending(tabId: string): void;
  clearGrpcMessages(tabId: string): void;
  /** WebSocket or Socket.IO: open the socket (Connect); Kafka: connect and read the topic */
  openSocket(tabId: string): Promise<void>;
  /** Kafka's Connect, reached through openSocket */
  openKafka(tabId: string): Promise<void>;
  /** MQTT's Connect, reached through openSocket */
  openMqtt(tabId: string): Promise<void>;
  /** Pub/Sub's Connect, reached through openSocket */
  openPubsub(tabId: string): Promise<void>;
  /** Pub/Sub Peek: pull once and hand the messages straight back */
  pullPubsub(tabId: string): void;
  /** Pub/Sub: stop or resume reading */
  pausePubsub(tabId: string, paused: boolean): void;
  /** Pub/Sub: read the topic and its subscriptions again */
  refreshPubsub(tabId: string): void;
  /** MQTT: make the broker's subscriptions match the Topics tab (while connected) */
  syncMqttSubs(tabId: string): void;
  /** WebSocket: send the editor's message; Socket.IO: emit the event; Kafka: produce the record */
  sendSocketMessage(tabId: string): Promise<void>;
  /** Kafka: read again from somewhere else (the list starts over) */
  seekKafka(tabId: string, from: KafkaSeek): void;
  /** Kafka: stop or resume reading */
  pauseKafka(tabId: string, paused: boolean): void;
  /** Kafka: fetch the topic's partitions and offsets again */
  refreshKafka(tabId: string): void;
  /** WebSocket: close the socket (1000), or stop a handshake still running */
  closeSocket(tabId: string): void;
  clearSocketMessages(tabId: string): void;
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

/** Stores a WebSocket session with its history entry, like keepGrpc. */
function keepWs(id: string, result: WsResult, settings: Settings): HistoryEntry["kept"] {
  if (settings.keepResponses === false) return undefined;
  const size = result.messages.reduce((n, m) => n + m.data.length, 0);
  const over = size > (settings.keepResponseMaxMb ?? 1) * 1024 * 1024;
  const data: WsResult = { ...result, connId: undefined, ...(over && { messages: [], dropped: (result.dropped ?? 0) + result.messages.length }) };
  invoke("save_response", { id, data }).catch((e) => useStore.getState().notify(`Could not keep the response: ${e}`));
  return over ? "meta" : "full";
}

/** Kafka produces and MQTT publishes are numbered so each ack finds its message. */
let produceSeq = 0;

/** The history entry each tab is loading with showRun, so an older pick that lands late is dropped. */
const loadingRun = new Map<string, string>();

/** Stops whatever a tab has in flight: an HTTP request, a gRPC call, a WebSocket or a Socket.IO connection. */
/** Sends whose pre-request script is still running (by inflight id): nothing is on the wire yet. */
const inScript = new Set<string>();

function stopInflight(t: Tab) {
  if (t.inflightId)
    (isGrpc(t.request) ? grpcCancel : isWs(t.request) ? wsClose : isSio(t.request) ? sioClose : isKafka(t.request) ? kafkaClose : isMqtt(t.request) ? mqttClose : isPubsub(t.request) ? pubsubClose : cancel)(t.inflightId).catch(
      () => undefined,
    );
}

/** Closed tabs per project, newest last, for ⇧⌘T. Runtime only: a restart starts empty. */
const closedTabs = new Map<string, Tab[]>();
const CLOSED_LIMIT = 20;
/** A blank scratch tab: nothing typed, never saved, nothing received. */
const pristine = (t: Tab) => !t.savedRef && !t.example && !t.dirty && !t.request.url && !t.response;

/** Pinned tabs first, each side in its own order: the order the strip, ⌘1–⌘9 and ⇧⌘] all follow. */
const pinnedFirst = (tabs: Tab[]) => [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)];

/** Session tabs come back without responses; example tabs get theirs from the collection, or close when it is gone. */
function restoreTabs(tabs: Tab[], collections: Collection[]): Tab[] {
  return pinnedFirst(
    tabs.flatMap((t) => {
      if (!t.example) return [t];
      const ex = findExample(collections, t.example);
      return ex ? [{ ...t, response: ex.response, grpc: ex.grpc }] : [];
    }),
  );
}

export const useStore = create<State>((set, get) => {
  /** Apply a change to one project's data, whether it is open (top of state) or stashed. */
  const applyToProject = (pid: string | null, fn: (d: ProjectData) => Partial<ProjectData>) => {
    const s = get();
    if (!pid || s.currentProjectId === pid) return set(fn(liveData(s)));
    const d = s.stash[pid];
    if (d) set({ stash: { ...s.stash, [pid]: { ...d, ...fn(d) } } });
  };
  /** One project's data, open or stashed. */
  const projectOf = (pid: string | null): ProjectData | undefined => {
    const s = get();
    return !pid || s.currentProjectId === pid ? liveData(s) : s.stash[pid];
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
      if (tab && !pristine(tab)) {
        const key = get().currentProjectId ?? "";
        const list = [...(closedTabs.get(key) ?? []), { id: tab.id, request: tab.request, savedRef: tab.savedRef, example: tab.example, dirty: tab.dirty }];
        closedTabs.set(key, list.slice(-CLOSED_LIMIT));
      }
      set((s) => {
        const idx = s.tabs.findIndex((t) => t.id === id);
        const tabs = s.tabs.filter((t) => t.id !== id);
        const activeTabId = s.activeTabId === id ? (tabs[Math.min(idx, tabs.length - 1)]?.id ?? null) : s.activeTabId;
        return { tabs, activeTabId };
      });
      if (get().tabs.length === 0) get().newTab();
    },

    closeTabs(ids, focus) {
      const s = get();
      const closing = ids.filter((id) => s.tabs.some((t) => t.id === id));
      if (closing.length < 2) {
        closing.forEach((id) => get().closeTab(id));
        if (focus && get().tabs.some((t) => t.id === focus)) set({ activeTabId: focus });
        return;
      }
      const projectId = s.currentProjectId;
      const key = projectId ?? "";
      const before = { tabs: s.tabs, activeTabId: s.activeTabId, closed: [...(closedTabs.get(key) ?? [])] };
      // one by one through closeTab: each stops its call or connection and goes on the ⇧⌘T list
      for (const id of closing) get().closeTab(id);
      if (focus && get().tabs.some((t) => t.id === focus)) set({ activeTabId: focus });
      get().notify(`Closed ${closing.length} tabs`, {
        label: "Undo",
        run: () => {
          const st = get();
          if (st.currentProjectId !== projectId) return set({ toast: null, toastAction: null });
          const gone = new Set(closing);
          const now = new Map(st.tabs.map((t) => [t.id, t]));
          // closed tabs come back as they were saved, without a response or a live connection
          const back = restoreTabs(
            before.tabs.flatMap((t) =>
              now.has(t.id) ? [now.get(t.id)!] : gone.has(t.id) ? [{ id: t.id, request: t.request, savedRef: t.savedRef, dirty: t.dirty, example: t.example, pinned: t.pinned }] : [],
            ),
            st.collections,
          );
          const added = st.tabs.filter((t) => !before.tabs.some((b) => b.id === t.id));
          closedTabs.set(key, before.closed);
          set({ tabs: pinnedFirst([...back, ...added]), activeTabId: before.activeTabId, toast: null, toastAction: null });
        },
      });
    },

    pinTab(id, pinned) {
      set((s) => {
        const tab = s.tabs.find((t) => t.id === id);
        if (!tab) return {};
        const rest = s.tabs.filter((t) => t.id !== id);
        // both land on the seam: pinning puts it at the right end of the pins, unpinning first after them
        return { tabs: [...rest.filter((t) => t.pinned), { ...tab, pinned: pinned || undefined }, ...rest.filter((t) => !t.pinned)] };
      });
    },

    reopenTab() {
      const key = get().currentProjectId ?? "";
      const list = closedTabs.get(key) ?? [];
      while (list.length) {
        const t = list.pop()!;
        // an example opens from its collection again; a deleted one is skipped
        if (t.example) {
          if (!findExample(get().collections, t.example)) continue;
          get().openExample(t.example);
          return;
        }
        const s = get();
        const open = t.savedRef && s.tabs.find((x) => x.savedRef?.nodeId === t.savedRef!.nodeId);
        if (open) return set({ activeTabId: open.id });
        // a request deleted since comes back as an unsaved one
        const col = t.savedRef && s.collections.find((c) => c.id === t.savedRef!.collectionId);
        const savedRef = col && findNode(col.children, t.savedRef!.nodeId) ? t.savedRef : undefined;
        const tab: Tab = { id: uid(), request: t.request, savedRef, dirty: t.dirty || (!!t.savedRef && !savedRef) };
        const active = s.tabs.find((x) => x.id === s.activeTabId);
        // like opening a saved request: a blank scratch tab gives its place
        set((st) => ({
          // taking a pinned blank tab's place keeps the pin, so pinned tabs stay first
          tabs: active && pristine(active) ? st.tabs.map((x) => (x.id === active.id ? { ...tab, pinned: active.pinned } : x)) : [...st.tabs, tab],
          activeTabId: tab.id,
        }));
        return;
      }
    },

    lastClosedTab() {
      const list = closedTabs.get(get().currentProjectId ?? "") ?? [];
      return list[list.length - 1]?.request.name;
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
      // an example tab has no savedRef, but its variables still come from the collection that holds it
      const colId = tab?.savedRef?.collectionId ?? tab?.example?.collectionId;
      const col = colId ? s.collections.find((c) => c.id === colId) : undefined;
      const env = s.environments.find((e) => e.id === s.activeEnvironmentId);
      return buildScope(col?.variables, env?.variables);
    },

    async sendTab(tabId, opts) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (tab && isGrpc(tab.request)) return get().callGrpc(tabId);
      // ⌘Enter on a WebSocket or Socket.IO tab: Connect, or send (emit) once it is open
      if (tab && (isSocket(tab.request) || isKafka(tab.request) || isMqtt(tab.request) || isPubsub(tab.request))) return tab.inflightId ? get().sendSocketMessage(tabId) : get().openSocket(tabId);
      if (!tab || tab.inflightId || tab.example) return;
      // the response lands in this project even if another one is open by the time it arrives
      const pid = get().currentProjectId;
      const inflightId = uid();
      loadingRun.delete(tabId);
      set((s) => ({ tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, inflightId, error: undefined, scripts: undefined })) }));
      const request = structuredClone(tab.request);
      const ref = tab.savedRef?.nodeId;

      // scripts read and write the environment active at Send and the collection the request is saved in
      const scripts = get().settings.runScripts !== false && !opts?.skipScripts ? request.scripts : undefined;
      const envId = get().activeEnvironmentId;
      const colId = tab.savedRef?.collectionId;
      const scriptCtx = () => {
        const d = projectOf(pid);
        const col = d?.collections.find((c) => c.id === colId);
        return { environment: d?.environments.find((e) => e.id === envId), collectionVariables: col?.variables, inCollection: !!col, requestId: ref };
      };
      const saveVars = (ops: VarOp[]) => {
        const env = ops.filter((o) => o.scope === "environment");
        const col = ops.filter((o) => o.scope === "collectionVariables");
        if (!env.length && !col.length) return;
        applyToProject(pid, (d) => ({
          ...(env.length && { environments: d.environments.map((e) => (e.id === envId ? { ...e, variables: applyVarOps(e.variables, env) } : e)) }),
          ...(col.length && { collections: d.collections.map((c) => (c.id === colId ? { ...c, variables: applyVarOps(c.variables, col) } : c)) }),
        }));
      };
      const stillSending = () => projectOf(pid)?.tabs.find((t) => t.id === tabId)?.inflightId === inflightId;
      const run: ScriptRun = { tests: [], logs: [] };

      // scripts see what goes on the wire: a GraphQL request as its POST and JSON payload; history keeps the GraphQL request
      let toSend = gqlAsHttp(request);
      let locals: Record<string, string> = {};
      if (hasScript(scripts?.pre)) {
        inScript.add(inflightId);
        const out = await runScript("pre", scripts!.pre!, { request: toSend, ...scriptCtx() });
        inScript.delete(inflightId);
        if (!stillSending()) return; // cancelled while the script ran: its variable changes are dropped too
        saveVars(out.vars);
        run.logs.push(...out.logs.map((l) => ({ ...l, src: "pre" as const })));
        if (out.error) {
          // nothing goes on the wire: the error stands in for the response
          run.failed = { src: "pre", ...out.error };
          applyToProject(pid, (d) => ({
            tabs: patchTab(d.tabs, tabId, (t) => ({ ...t, inflightId: undefined, response: undefined, error: undefined, fromHistory: undefined, scripts: run })),
          }));
          return;
        }
        toSend = withScriptRequest(toSend, out.request);
        locals = out.locals;
      }

      try {
        const d = projectOf(pid);
        const scope = buildScope(d?.collections.find((c) => c.id === colId)?.variables, d?.environments.find((e) => e.id === envId)?.variables);
        for (const [k, v] of Object.entries(locals)) scope.set(k, v);
        const prepared = prepare(toSend, scope);
        const response = await send(prepared, get().settings, inflightId);
        const entryId = uid();
        const kept = keepResponse(entryId, response, get().settings);
        const ran = hasScript(scripts?.pre) || hasScript(scripts?.post);
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => ({ ...t, inflightId: undefined, response, error: undefined, fromHistory: undefined, scripts: ran ? run : undefined })),
          history: [
            { id: entryId, at: Date.now(), request, ref, status: response.status, elapsedMs: response.elapsedMs, size: response.size, kept },
            ...d.history,
          ].slice(0, HISTORY_LIMIT),
        }));
        if (hasScript(scripts?.post)) {
          const out = await runScript("post", scripts!.post!, { request: toSend, response, locals, ...scriptCtx() });
          saveVars(out.vars);
          const done: ScriptRun = {
            tests: out.tests,
            logs: [...run.logs, ...out.logs.map((l) => ({ ...l, src: "post" as const }))],
            failed: out.error ? { src: "post", ...out.error } : undefined,
          };
          // only onto this send's response: a newer send replaced it
          applyToProject(pid, (d) => ({ tabs: patchTab(d.tabs, tabId, (t) => (t.response === response ? { ...t, scripts: done } : t)) }));
        }
      } catch (e) {
        const error = String(e);
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => ({
            ...t,
            inflightId: undefined,
            response: undefined,
            error,
            fromHistory: undefined,
            scripts: run.logs.length ? run : undefined,
          })),
          history:
            error === "Request cancelled"
              ? d.history
              : [{ id: uid(), at: Date.now(), request, ref }, ...d.history].slice(0, HISTORY_LIMIT),
        }));
      }
    },

    cancelTab(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab) return;
      // a pre-request script has no request to cancel yet: the send just stops waiting for it
      if (tab.inflightId && inScript.has(tab.inflightId)) {
        inScript.delete(tab.inflightId);
        set((s) => ({ tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, inflightId: undefined })) }));
        return;
      }
      stopInflight(tab);
    },

    clearScriptLogs(tabId) {
      set((s) => ({ tabs: patchTab(s.tabs, tabId, (t) => (t.scripts ? { ...t, scripts: { ...t.scripts, logs: [] } } : t)) }));
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

    async openSocket(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab || tab.example || tab.inflightId) return;
      if (isKafka(tab.request)) return get().openKafka(tabId);
      if (isMqtt(tab.request)) return get().openMqtt(tabId);
      if (isPubsub(tab.request)) return get().openPubsub(tabId);
      const pid = get().currentProjectId;
      const connId = uid();
      const settings = get().settings;
      const request = structuredClone(tab.request);
      const sio = isSio(request);
      let prepared: ReturnType<typeof prepareWs> | PreparedSio;
      try {
        prepared = sio ? prepareSio(request, get().scopeFor(tabId), settings) : prepareWs(request, get().scopeFor(tabId), settings);
      } catch (e) {
        return get().notify((e as Error).message);
      }
      loadingRun.delete(tabId);
      const fresh: WsResult = {
        connId,
        startedAt: Date.now(),
        url: prepared.url,
        messages: [],
        ...("eio" in prepared && { sio: { eio: prepared.eio, namespace: prepared.namespace || "/", auth: maskAuth(prepared.auth) } }),
      };
      set((s) => ({
        tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, inflightId: connId, error: undefined, response: undefined, grpc: undefined, fromHistory: undefined, ws: fresh })),
      }));

      // events land in batches: one state update per frame, however fast the server sends
      let queue: (WsEvent | SioEvent)[] = [];
      let timer: ReturnType<typeof setTimeout> | undefined;
      let latest = fresh;
      let finished = false;
      const ref = tab.savedRef?.nodeId;
      const record = (entry: Omit<HistoryEntry, "id" | "at" | "request">, kept?: (id: string) => HistoryEntry["kept"]) => {
        const id = uid();
        applyToProject(pid, (d) => ({ history: [{ id, at: Date.now(), request, ref, ...entry, kept: kept?.(id) }, ...d.history].slice(0, HISTORY_LIMIT) }));
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        const size = latest.messages.reduce((n, m) => n + (m.dir === "in" ? m.size : 0), 0);
        const hs = latest.handshake;
        const elapsedMs = latest.close?.elapsedMs ?? hs?.elapsedMs;
        record({ status: hs?.status, elapsedMs, size }, (id) => keepWs(id, latest, get().settings));
      };
      const flush = () => {
        timer = undefined;
        const batch = queue;
        queue = [];
        if (!batch.length) return;
        let ended = false;
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => {
            if (t.ws?.connId !== connId) return t;
            const w: WsResult = { ...t.ws };
            const incoming = [];
            for (const e of batch) {
              if (e.type === "open" || e.type === "refused") {
                const { type, ...hs } = e;
                w.handshake = hs;
                if (type === "refused") {
                  w.refused = true;
                  ended = true;
                }
              } else if (e.type === "message") {
                const { type: _, ...m } = e;
                incoming.push(m);
              } else if (e.type === "engine") {
                const { type: _, atMs: __, ...engine } = e;
                w.sio = { ...w.sio!, engine };
              } else if (e.type === "joined") w.sio = { ...w.sio!, namespace: e.namespace, sid: e.sid, joinedMs: e.atMs };
              else if (e.type === "connectError") w.sio = { ...w.sio!, namespace: e.namespace, error: { message: e.message, data: e.data } };
              else if (e.type === "ackTimeout") w.sio = { ...w.sio!, late: [...(w.sio?.late ?? []), e.ackId] };
              else {
                const close: WsClose = { code: e.code, reason: e.reason, by: e.by, elapsedMs: e.elapsedMs };
                w.close = close;
                ended = true;
              }
            }
            if (incoming.length) {
              const all = [...w.messages, ...incoming];
              const over = Math.max(0, all.length - WS_MESSAGE_LIMIT);
              w.messages = over ? all.slice(over) : all;
              if (over) w.dropped = (w.dropped ?? 0) + over;
            }
            latest = w;
            return ended ? { ...t, ws: w, inflightId: undefined } : { ...t, ws: w };
          }),
        }));
        if (ended) finish();
      };
      const onEvent = (e: WsEvent | SioEvent) => {
        queue.push(e);
        if (e.type === "close" || e.type === "refused") {
          clearTimeout(timer);
          flush();
        } else if (!timer) timer = setTimeout(flush, 16);
      };

      try {
        await ("eio" in prepared ? connectSio(connId, prepared, onEvent) : connectWs(connId, prepared, onEvent));
        // the close event comes first; should it ever not, end the session rather than spin forever
        setTimeout(() => {
          flush();
          if (!finished) onEvent({ type: "close", code: 1006, reason: "The connection ended without a close", by: "lost", elapsedMs: Date.now() - fresh.startedAt });
        }, 1500);
      } catch (e) {
        clearTimeout(timer);
        flush();
        if (finished) return;
        finished = true;
        const error = String(e);
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => (t.ws?.connId === connId ? { ...t, inflightId: undefined, ws: undefined, error } : t)),
        }));
        if (error !== "Connection cancelled") record({});
      }
    },

    async openKafka(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab || tab.example || tab.inflightId) return;
      const pid = get().currentProjectId;
      const connId = uid();
      const request = structuredClone(tab.request);
      const def = request.kafka ?? defaultKafka();
      const keep = Math.min(100_000, Math.max(50, Math.floor(def.keep || 1000)));
      const prepared = prepareKafka(request, get().scopeFor(tabId), get().settings);
      if (!prepared.brokers) return get().notify("Enter the bootstrap brokers, host:port");
      if (!prepared.topic) return get().notify("Enter a topic");
      loadingRun.delete(tabId);
      const fresh: WsResult = { connId, startedAt: Date.now(), url: prepared.brokers, messages: [], kafka: { topic: prepared.topic, from: prepared.from } };
      set((s) => ({
        tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, inflightId: connId, error: undefined, response: undefined, grpc: undefined, fromHistory: undefined, ws: fresh })),
      }));

      // events land in batches: one state update per frame, however fast records arrive
      let queue: KafkaEvent[] = [];
      let timer: ReturnType<typeof setTimeout> | undefined;
      let latest = fresh;
      let finished = false;
      const ref = tab.savedRef?.nodeId;
      const record = (entry: Omit<HistoryEntry, "id" | "at" | "request">, kept?: (id: string) => HistoryEntry["kept"]) => {
        const id = uid();
        applyToProject(pid, (d) => ({ history: [{ id, at: Date.now(), request, ref, ...entry, kept: kept?.(id) }, ...d.history].slice(0, HISTORY_LIMIT) }));
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        const size = latest.messages.reduce((n, m) => n + (m.dir === "in" ? m.size : 0), 0);
        const ok = !!latest.kafka?.cluster && !latest.kafka.failed;
        record({ status: ok ? 0 : undefined, elapsedMs: latest.close?.elapsedMs ?? latest.kafka?.failed?.elapsedMs, size }, (id) => keepWs(id, latest, get().settings));
      };
      const flush = () => {
        timer = undefined;
        const batch = queue;
        queue = [];
        if (!batch.length) return;
        let ended = false;
        const notices: string[] = [];
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => {
            if (t.ws?.connId !== connId) return t;
            const w: WsResult = { ...t.ws, kafka: { ...t.ws.kafka! } };
            const k = w.kafka!;
            let incoming = [];
            for (const e of batch) {
              if (e.type === "connected") {
                k.cluster = e.cluster;
                k.from = e.from;
                k.connectedMs = e.elapsedMs;
              } else if (e.type === "topic") k.cluster = e.cluster;
              else if (e.type === "message") {
                const { type: _, ...m } = e;
                incoming.push(m);
              } else if (e.type === "seeked") {
                // reading starts over: so does the list
                w.messages = [];
                w.dropped = 0;
                incoming = [];
                k.from = e.from;
                k.paused = false;
                k.waiting = undefined;
              } else if (e.type === "paused") {
                k.paused = e.paused;
                k.waiting = undefined;
              } else if (e.type === "waiting") k.waiting = e.count;
              else if (e.type === "notice") notices.push(e.message);
              else if (e.type === "failed") {
                const { type: _, ...f } = e;
                k.failed = f;
                ended = true;
              } else {
                const close: WsClose = { code: 0, reason: e.reason, by: e.by, elapsedMs: e.elapsedMs };
                w.close = close;
                ended = true;
              }
            }
            if (incoming.length) {
              const all = [...w.messages, ...incoming];
              const over = Math.max(0, all.length - keep);
              w.messages = over ? all.slice(over) : all;
              if (over) w.dropped = (w.dropped ?? 0) + over;
            }
            latest = w;
            return ended ? { ...t, ws: w, inflightId: undefined } : { ...t, ws: w };
          }),
        }));
        for (const n of notices) get().notify(n);
        if (ended) finish();
      };
      const onEvent = (e: KafkaEvent) => {
        queue.push(e);
        if (e.type === "close" || e.type === "failed" || e.type === "connected" || e.type === "seeked") {
          clearTimeout(timer);
          flush();
        } else if (!timer) timer = setTimeout(flush, 16);
      };

      try {
        await connectKafka(connId, prepared, onEvent);
        // the close event comes first; should it ever not, end the session rather than spin forever
        setTimeout(() => {
          flush();
          if (!finished) onEvent({ type: "close", by: "lost", reason: "The connection ended without a close", elapsedMs: Date.now() - fresh.startedAt });
        }, 1500);
      } catch (e) {
        clearTimeout(timer);
        flush();
        if (finished) return;
        finished = true;
        const error = String(e);
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => (t.ws?.connId === connId ? { ...t, inflightId: undefined, ws: undefined, error } : t)),
        }));
        record({});
      }
    },

    async openPubsub(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab || tab.example || tab.inflightId) return;
      const pid = get().currentProjectId;
      const connId = uid();
      const request = structuredClone(tab.request);
      const def = request.pubsub ?? defaultPubsub();
      const keep = Math.min(100_000, Math.max(50, Math.floor(def.keep || 1000)));
      const prepared = preparePubsub(request, get().scopeFor(tabId), get().settings);
      if (!prepared.project) return get().notify("Enter the Google Cloud project ID");
      if (!prepared.topic) return get().notify("Enter a topic");
      if ((prepared.mode === "peek" || prepared.mode === "consume") && !prepared.subscription) return get().notify("Pick the subscription to read in the Read tab");
      if (prepared.auth.kind === "key" && !prepared.auth.file) return get().notify("Choose the service account key file in the Auth tab");
      if (prepared.auth.kind === "token" && !prepared.auth.token) return get().notify("Enter an access token in the Auth tab");
      loadingRun.delete(tabId);
      const fresh: WsResult = {
        connId,
        startedAt: Date.now(),
        url: prepared.project,
        messages: [],
        pubsub: { project: prepared.project, topic: prepared.topic, mode: prepared.mode },
      };
      set((s) => ({
        tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, inflightId: connId, error: undefined, response: undefined, grpc: undefined, fromHistory: undefined, ws: fresh })),
      }));

      // events land in batches: one state update per frame, however fast messages arrive
      let queue: PubsubEvent[] = [];
      let timer: ReturnType<typeof setTimeout> | undefined;
      let latest = fresh;
      let finished = false;
      const ref = tab.savedRef?.nodeId;
      const record = (entry: Omit<HistoryEntry, "id" | "at" | "request">, kept?: (id: string) => HistoryEntry["kept"]) => {
        const id = uid();
        applyToProject(pid, (d) => ({ history: [{ id, at: Date.now(), request, ref, ...entry, kept: kept?.(id) }, ...d.history].slice(0, HISTORY_LIMIT) }));
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        const size = latest.messages.reduce((n, m) => n + (m.dir === "in" ? m.size : 0), 0);
        const ok = !!latest.pubsub?.info && !latest.pubsub.failed;
        record({ status: ok ? 0 : undefined, elapsedMs: latest.close?.elapsedMs ?? latest.pubsub?.failed?.elapsedMs, size }, (id) => keepWs(id, latest, get().settings));
      };
      const flush = () => {
        timer = undefined;
        const batch = queue;
        queue = [];
        if (!batch.length) return;
        let ended = false;
        const notices: string[] = [];
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => {
            if (t.ws?.connId !== connId) return t;
            const w: WsResult = { ...t.ws, pubsub: { ...t.ws.pubsub! } };
            const p = w.pubsub!;
            const incoming = [];
            for (const e of batch) {
              if (e.type === "connected") {
                p.info = e.info;
                p.connectedMs = e.elapsedMs;
              } else if (e.type === "topic") p.info = e.info;
              else if (e.type === "message") {
                const { type: _, ...m } = e;
                incoming.push(m);
              } else if (e.type === "pulled") {
                // the pull line sits above the messages it brought: after = how many were in the list before
                const after = (w.dropped ?? 0) + w.messages.length + incoming.length;
                p.pulls = [...(p.pulls ?? []), { n: e.n, count: e.count, skipped: e.skipped, atMs: e.atMs, after }];
              } else if (e.type === "paused") p.paused = e.paused;
              else if (e.type === "notice") notices.push(e.message);
              else if (e.type === "failed") {
                const { type: _, ...f } = e;
                p.failed = f;
                ended = true;
              } else {
                w.close = { code: 0, reason: e.reason, by: e.by, elapsedMs: e.elapsedMs };
                ended = true;
              }
            }
            if (incoming.length) {
              const all = [...w.messages, ...incoming];
              const over = Math.max(0, all.length - keep);
              w.messages = over ? all.slice(over) : all;
              if (over) w.dropped = (w.dropped ?? 0) + over;
            }
            latest = w;
            return ended ? { ...t, ws: w, inflightId: undefined } : { ...t, ws: w };
          }),
        }));
        for (const n of notices) get().notify(n);
        if (ended) finish();
      };
      const onEvent = (e: PubsubEvent) => {
        queue.push(e);
        if (e.type === "close" || e.type === "failed" || e.type === "connected" || e.type === "pulled") {
          clearTimeout(timer);
          flush();
        } else if (!timer) timer = setTimeout(flush, 16);
      };

      try {
        await connectPubsub(connId, prepared, onEvent);
        // the close event comes first; should it ever not, end the session rather than spin forever
        setTimeout(() => {
          flush();
          if (!finished) onEvent({ type: "close", by: "lost", reason: "The connection ended without a close", elapsedMs: Date.now() - fresh.startedAt });
        }, 1500);
      } catch (e) {
        clearTimeout(timer);
        flush();
        if (finished) return;
        finished = true;
        const error = String(e);
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => (t.ws?.connId === connId ? { ...t, inflightId: undefined, ws: undefined, error } : t)),
        }));
        record({});
      }
    },

    async openMqtt(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab || tab.example || tab.inflightId) return;
      const pid = get().currentProjectId;
      const connId = uid();
      const request = structuredClone(tab.request);
      const def = request.mqtt ?? defaultMqtt();
      const keep = Math.min(100_000, Math.max(50, Math.floor(def.keep || 1000)));
      let prepared;
      try {
        prepared = prepareMqtt(request, get().scopeFor(tabId), get().settings);
      } catch (e) {
        return get().notify(e instanceof Error ? e.message : String(e));
      }
      if (!prepared.url) return get().notify("Enter the broker URL, e.g. mqtt://broker.example.com:1883");
      loadingRun.delete(tabId);
      const fresh: WsResult = { connId, startedAt: Date.now(), url: prepared.url, messages: [], mqtt: { subs: {} } };
      set((s) => ({
        tabs: patchTab(s.tabs, tabId, (t) => ({ ...t, inflightId: connId, error: undefined, response: undefined, grpc: undefined, fromHistory: undefined, ws: fresh })),
      }));

      // events land in batches: one state update per frame, however fast messages arrive
      let queue: MqttEvent[] = [];
      let timer: ReturnType<typeof setTimeout> | undefined;
      let latest = fresh;
      let finished = false;
      const ref = tab.savedRef?.nodeId;
      const record = (entry: Omit<HistoryEntry, "id" | "at" | "request">, kept?: (id: string) => HistoryEntry["kept"]) => {
        const id = uid();
        applyToProject(pid, (d) => ({ history: [{ id, at: Date.now(), request, ref, ...entry, kept: kept?.(id) }, ...d.history].slice(0, HISTORY_LIMIT) }));
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        const size = latest.messages.reduce((n, m) => n + (m.dir === "in" ? m.size : 0), 0);
        const ok = !!latest.mqtt?.conn && !latest.mqtt.failed;
        record({ status: ok ? 0 : undefined, elapsedMs: latest.close?.elapsedMs ?? latest.mqtt?.failed?.elapsedMs, size }, (id) => keepWs(id, latest, get().settings));
      };
      const flush = () => {
        timer = undefined;
        const batch = queue;
        queue = [];
        if (!batch.length) return;
        let ended = false;
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => {
            if (t.ws?.connId !== connId) return t;
            const w: WsResult = { ...t.ws, mqtt: { ...t.ws.mqtt!, subs: { ...t.ws.mqtt!.subs } } };
            const m = w.mqtt!;
            const incoming = [];
            for (const e of batch) {
              if (e.type === "connected") m.conn = e.info;
              else if (e.type === "subscribed") for (const r of e.results) m.subs[r.filter] = { qos: r.qos, granted: r.granted, error: r.error };
              else if (e.type === "unsubscribed") for (const f of e.filters) delete m.subs[f];
              else if (e.type === "message") {
                const { type: _, ...msg } = e;
                incoming.push(msg);
              } else if (e.type === "failed") {
                const { type: _, ...f } = e;
                m.failed = f;
                ended = true;
              } else {
                w.close = { code: e.code ?? 0, reason: e.reason, by: e.by, elapsedMs: e.elapsedMs };
                ended = true;
              }
            }
            if (incoming.length) {
              const all = [...w.messages, ...incoming];
              const over = Math.max(0, all.length - keep);
              w.messages = over ? all.slice(over) : all;
              if (over) w.dropped = (w.dropped ?? 0) + over;
            }
            latest = w;
            return ended ? { ...t, ws: w, inflightId: undefined } : { ...t, ws: w };
          }),
        }));
        if (ended) finish();
      };
      const onEvent = (e: MqttEvent) => {
        queue.push(e);
        if (e.type === "close" || e.type === "failed" || e.type === "connected") {
          clearTimeout(timer);
          flush();
        } else if (!timer) timer = setTimeout(flush, 16);
      };

      try {
        await connectMqtt(connId, prepared, onEvent);
        // the close event comes first; should it ever not, end the session rather than spin forever
        setTimeout(() => {
          flush();
          if (!finished) onEvent({ type: "close", by: "lost", reason: "The connection ended without a close", elapsedMs: Date.now() - fresh.startedAt });
        }, 1500);
      } catch (e) {
        clearTimeout(timer);
        flush();
        if (finished) return;
        finished = true;
        const error = String(e);
        applyToProject(pid, (d) => ({
          tabs: patchTab(d.tabs, tabId, (t) => (t.ws?.connId === connId ? { ...t, inflightId: undefined, ws: undefined, error } : t)),
        }));
        record({});
      }
    },

    syncMqttSubs(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab?.inflightId || !tab.ws?.mqtt?.conn || tab.ws.close || !isMqtt(tab.request)) return;
      const subs = subsOf(tab.request.mqtt ?? defaultMqtt(), get().scopeFor(tabId));
      // answers for filters no longer on the list (renamed, switched off, removed) go now, not at UNSUBACK
      const want = new Set(subs.map((s) => s.filter));
      const known = tab.ws.mqtt.subs;
      if (Object.keys(known).some((f) => !want.has(f)))
        set((s) => ({
          tabs: patchTab(s.tabs, tabId, (t) =>
            t.ws?.mqtt ? { ...t, ws: { ...t.ws, mqtt: { ...t.ws.mqtt, subs: Object.fromEntries(Object.entries(t.ws.mqtt.subs).filter(([f]) => want.has(f))) } } } : t,
          ),
        }));
      mqttSubscriptions(tab.inflightId, subs).catch((e) => get().notify(String(e)));
    },

    pullPubsub(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab?.inflightId || !tab.ws?.pubsub?.info || tab.ws.close) return;
      const max = Math.min(1000, Math.max(1, Math.floor(tab.request.pubsub?.pullMax || 10)));
      pubsubPull(tab.inflightId, max).catch((e) => get().notify(String(e)));
    },

    pausePubsub(tabId, paused) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab?.inflightId || !tab.ws?.pubsub?.info) return;
      pubsubPause(tab.inflightId, paused).catch((e) => get().notify(String(e)));
    },

    refreshPubsub(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab?.inflightId || !tab.ws?.pubsub?.info) return;
      pubsubRefresh(tab.inflightId).catch((e) => get().notify(String(e)));
    },

    seekKafka(tabId, from) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab?.inflightId || !tab.ws?.kafka?.cluster) return;
      kafkaSeek(tab.inflightId, from).catch((e) => get().notify(String(e)));
    },

    pauseKafka(tabId, paused) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab?.inflightId || !tab.ws?.kafka?.cluster) return;
      kafkaPause(tab.inflightId, paused).catch((e) => get().notify(String(e)));
    },

    refreshKafka(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab?.inflightId || !tab.ws?.kafka?.cluster) return;
      kafkaRefresh(tab.inflightId).catch((e) => get().notify(String(e)));
    },

    async sendSocketMessage(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (tab && isPubsub(tab.request)) {
        if (!tab.inflightId || !tab.ws?.pubsub?.info || tab.ws.close) return;
        try {
          await pubsubPublish(tab.inflightId, pubsubMessageOf(tab.request, get().scopeFor(tabId), ++produceSeq));
        } catch (e) {
          get().notify(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (tab && isMqtt(tab.request)) {
        if (!tab.inflightId || !tab.ws?.mqtt?.conn || tab.ws.close) return;
        try {
          await mqttPublish(tab.inflightId, publishOf(tab.request, get().scopeFor(tabId), ++produceSeq));
        } catch (e) {
          get().notify(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (tab && isKafka(tab.request)) {
        if (!tab.inflightId || !tab.ws?.kafka?.cluster || tab.ws.close) return;
        try {
          await kafkaProduce(tab.inflightId, produceOf(tab.request, get().scopeFor(tabId), ++produceSeq));
        } catch (e) {
          get().notify(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (!tab?.inflightId || !tab.ws?.handshake || tab.ws.close) return;
      if (isSio(tab.request)) {
        if (tab.ws.sio?.joinedMs === undefined) return;
        const def = tab.request.sio;
        try {
          const { event, args } = sioEmitOf(tab.request, get().scopeFor(tabId));
          if (!event) return get().notify("Enter an event name");
          await sioEmit(tab.inflightId, event, args, def?.ack ? Math.max(0, Math.floor(def.ackTimeoutMs || 0)) : null);
        } catch (e) {
          get().notify(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      const text = wsMessageText(tab.request, get().scopeFor(tabId));
      if (!text.trim()) return get().notify("The message is empty");
      try {
        await wsSend(tab.inflightId, text);
      } catch (e) {
        get().notify(String(e));
      }
    },

    closeSocket(tabId) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (tab?.inflightId) (isKafka(tab.request) ? kafkaClose : isMqtt(tab.request) ? mqttClose : isPubsub(tab.request) ? pubsubClose : isSio(tab.request) ? sioClose : wsClose)(tab.inflightId).catch((e) => get().notify(String(e)));
    },

    clearSocketMessages(tabId) {
      set((s) => ({
        tabs: patchTab(s.tabs, tabId, (t) => (t.ws ? { ...t, ws: { ...t.ws, messages: [], dropped: 0 } } : t)),
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
      // a WebSocket or Socket.IO entry keeps its session (handshake, messages, close) the same way
      const ws = isSocket(entry.request) || isKafka(entry.request) || isMqtt(entry.request) || isPubsub(entry.request) ? (response as unknown as WsResult) : undefined;
      // the tab may have been sent (or closed) while the file was read
      applyToProject(pid, (d) => ({
        tabs: patchTab(d.tabs, tabId, (t) =>
          t.response || t.grpc || t.ws || t.inflightId || t.error
            ? t
            : grpc
              ? { ...t, grpc, fromHistory }
              : ws
                ? { ...t, ws, fromHistory }
                : { ...t, response, fromHistory },
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
      const ws = isSocket(entry.request) || isKafka(entry.request) || isMqtt(entry.request) || isPubsub(entry.request) ? (response as unknown as WsResult) : undefined;
      applyToProject(pid, (d) => ({
        tabs: patchTab(d.tabs, tabId, (t) =>
          t.inflightId
            ? t
            : {
                ...t,
                error: undefined,
                fromHistory,
                ...(grpc
                  ? { grpc, response: undefined, ws: undefined }
                  : ws
                    ? { ws, response: undefined, grpc: undefined }
                    : { response, grpc: undefined, ws: undefined }),
              },
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
        return [p.id, { activeTabId: d.activeTabId, tabs: d.tabs.map(({ id, request, savedRef, dirty, example, pinned }) => ({ id, request, savedRef, dirty, example, pinned })) }];
      }),
    ),
  }),
  800,
);
