export type KV = { id: string; key: string; value: string; enabled: boolean };

export type MultipartField = KV & { kind: "text" | "file" };

export type BodyMode = "none" | "json" | "text" | "xml" | "form" | "multipart";

export type Auth =
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | { type: "apikey"; key: string; value: string; in: "header" | "query" };

export interface RequestBody {
  mode: BodyMode;
  raw: string;
  form: KV[];
  multipart: MultipartField[];
}

export interface RequestDef {
  id: string;
  name: string;
  method: string;
  url: string;
  params: KV[];
  headers: KV[];
  body: RequestBody;
  auth: Auth;
}

export interface RequestNode extends RequestDef {
  type: "request";
}

export interface FolderNode {
  type: "folder";
  id: string;
  name: string;
  children: TreeNode[];
}

export type TreeNode = RequestNode | FolderNode;

export interface Collection {
  id: string;
  name: string;
  children: TreeNode[];
  variables: KV[];
}

export interface Environment {
  id: string;
  name: string;
  variables: KV[];
}

export interface HttpResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
  bodyEncoding: "utf8" | "base64";
  size: number;
  elapsedMs: number;
}

export interface SavedRef {
  collectionId: string;
  nodeId: string;
}

export interface Tab {
  id: string;
  request: RequestDef;
  savedRef?: SavedRef;
  dirty: boolean;
  // runtime only (not persisted)
  inflightId?: string;
  response?: HttpResponse;
  error?: string;
}

export interface HistoryEntry {
  id: string;
  at: number;
  request: RequestDef;
  status?: number;
  elapsedMs?: number;
}

export interface Settings {
  timeoutMs: number;
  followRedirects: boolean;
  insecure: boolean;
  /** Type overrides, written to the four type tokens on :root. Empty = the token default. */
  fontUi?: string;
  fontMono?: string;
  fontSizeUi?: number;
  fontSizeCode?: number;
}

/** A project: the unit shown as a tab in the title strip and as a card on Home. */
export interface ProjectMeta {
  id: string;
  name: string;
  /** Lucide icon name from PROJECT_ICONS */
  icon: string;
  /** 1..6, the --proj-N-fg / --proj-N-bg token pair */
  color: number;
  createdAt: number;
  openedAt: number;
}

/** Everything a project owns. The open project's copy lives at the top of the store. */
export interface ProjectData {
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  history: HistoryEntry[];
  tabs: Tab[];
  activeTabId: string | null;
}

/** workspace.json, version 2: settings plus every project's collections and environments. */
export interface WorkspaceV2 {
  version: 2;
  settings: Settings;
  projects: (ProjectMeta & Pick<ProjectData, "collections" | "environments" | "activeEnvironmentId">)[];
}

/** session.json, version 2: what was open, per project. */
export interface SessionV2 {
  view: "home" | "project";
  currentProjectId: string | null;
  openProjectIds: string[];
  perProject: Record<string, { tabs: Tab[]; activeTabId: string | null }>;
}

/** workspace.json, version 1 (before projects); migrated into one project on first load. */
export interface Workspace {
  version: 1;
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  settings: Settings;
}
