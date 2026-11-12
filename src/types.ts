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
  /** Saved responses, each with the request that produced it. Sensitive values were masked when it was saved. */
  examples?: Example[];
}

export interface Example {
  id: string;
  name: string;
  savedAt: number;
  request: RequestDef;
  response: HttpResponse;
  /** What was masked before saving, e.g. "Response body $.email" */
  masked: string[];
}

/** Points at one example: the request node that holds it, and the example. */
export interface ExampleRef {
  collectionId: string;
  nodeId: string;
  exampleId: string;
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
  /** The tab shows a saved example: read-only, no Send. */
  example?: ExampleRef;
  // runtime only (not persisted)
  inflightId?: string;
  response?: HttpResponse;
  error?: string;
  /** The response came from history, not from a send in this tab. Cleared by the next send. */
  fromHistory?: { at: number; bodyDropped: boolean };
}

export interface HistoryEntry {
  id: string;
  at: number;
  request: RequestDef;
  status?: number;
  elapsedMs?: number;
  /** The response is stored in responses/<id>.json: "full", or "meta" when the body was over the size limit and left out. */
  kept?: "full" | "meta";
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
  /** Sidebar width in px; hidden when the edge is dragged past the minimum or toggled off. */
  sidebarWidth?: number;
  sidebarHidden?: boolean;
  /** Where the response sits: below the request (stacked) or beside it (split). */
  layout?: "stacked" | "split";
  /** auto follows the OS appearance */
  theme?: "auto" | "light" | "dark";
  /** colour scheme id (src/lib/themes.ts) used while the look is light: Auto with a light Mac, or Theme Light. Any scheme fits either slot. */
  lightScheme?: string;
  /** colour scheme id used while the look is dark */
  darkScheme?: string;
  /** Store each response with its history entry (default on). */
  keepResponses?: boolean;
  /** Bodies bigger than this many MB keep only status and headers (default 1). */
  keepResponseMaxMb?: number;
  /** how the Variables dialog shows variables; remembered between openings */
  variablesFormat?: "table" | "json" | "env";
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
