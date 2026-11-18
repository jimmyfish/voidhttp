import type { TagColor } from "./lib/tags";

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
  /** An HTTP method, "GQL" for GraphQL over HTTP (see `gql`), "GRPC" for a gRPC call (see `grpc`), "WS" for a WebSocket (see `ws`), "SIO" for Socket.IO (see `sio`), "KAFKA" for a Kafka topic (see `kafka`) or "MQTT" for an MQTT broker (see `mqtt`). */
  method: string;
  /** The URL; for gRPC the server address, host:port; for WebSocket a ws:// or wss:// URL; for Kafka the bootstrap brokers; for MQTT the broker, mqtt:// mqtts:// ws:// or wss://. */
  url: string;
  params: KV[];
  /** HTTP headers; for gRPC the request metadata; for Kafka the produced record's headers; for MQTT 5 the published message's user properties. */
  headers: KV[];
  /** For gRPC, `raw` holds the request message as JSON; for WebSocket, the next message to send; for Socket.IO, the next emit's argument; for Kafka, the next produced record's value; for MQTT, the next published payload. */
  body: RequestBody;
  auth: Auth;
  grpc?: GrpcDef;
  ws?: WsDef;
  sio?: SioDef;
  kafka?: KafkaDef;
  mqtt?: MqttDef;
  gql?: GqlDef;
  /** Postman-style JavaScript run around an HTTP send: `pre` before it, `post` once the response arrives. */
  scripts?: RequestScripts;
}

export interface RequestScripts {
  pre?: string;
  post?: string;
}

/** One line of a script's console: console.* output, a variable it changed ("var"), or the error that stopped it. */
export interface ScriptLog {
  level: "log" | "info" | "warn" | "error" | "var";
  text: string;
  /** ms since that script started */
  at: number;
  src: "pre" | "post";
}

export interface ScriptTest {
  name: string;
  passed: boolean;
  skipped?: boolean;
  /** why it failed, e.g. "AssertionError: expected 'EUR' to deeply equal 'IDR'" */
  error?: string;
  /** the line of the post-response script it failed on */
  line?: number;
}

/** What the scripts of the last send left: tests, console lines, and the error that stopped one of them. */
export interface ScriptRun {
  tests: ScriptTest[];
  logs: ScriptLog[];
  failed?: { src: "pre" | "post"; name: string; message: string; line?: number };
}

/** A GraphQL request: sent as an HTTP POST of `{ query, variables, operationName }` as JSON. */
export interface GqlDef {
  /** the document: one or more operations, fragments, `#` comments */
  query: string;
  /** JSON for `variables`; `{{name}}` resolves like anywhere else; empty sends none */
  variables: string;
  /** which named operation Send runs when the document holds several */
  operation?: string;
}

export interface SioDef {
  /** the namespace to join; empty or "/" takes the URL's path, as socket.io-client does */
  namespace: string;
  /** where the server mounts Socket.IO */
  path: string;
  /** Engine.IO version: 4 for Socket.IO 3 and 4, 3 for Socket.IO 2 */
  eio: 3 | 4;
  /** JSON sent as `auth` with the namespace CONNECT (Engine.IO 4); empty sends none */
  auth: string;
  /** the next emit's event name */
  event: string;
  /** emits ask for an ack */
  ack: boolean;
  /** how long to wait for it; 0 waits as long as the socket is open */
  ackTimeoutMs: number;
}

/** How the Key field's text becomes the record key's bytes. */
export type KafkaKeyType = "string" | "json" | "base64" | "hex";

/** Where reading starts. `time` is ms since the epoch. */
export type KafkaSeek =
  | { kind: "latest" }
  | { kind: "earliest" }
  | { kind: "last"; n: number }
  | { kind: "time"; ms: number }
  | { kind: "offset"; partition: number; offset: number };

export interface KafkaDef {
  topic: string;
  /** the next produced record's key; empty sends none */
  key: string;
  keyType: KafkaKeyType;
  /** the partition to produce to; null lets the key pick (murmur2), round robin without a key */
  partition: number | null;
  sasl: "none" | "plain" | "scram-sha-256" | "scram-sha-512";
  username: string;
  password: string;
  tls: boolean;
  clientId: string;
  /** where reading starts on Connect */
  from: "latest" | "earliest";
  /** 0 none, 1 the leader, -1 all in-sync replicas */
  acks: 0 | 1 | -1;
  compression: "none" | "gzip" | "lz4" | "snappy" | "zstd";
  /** records the list keeps; older ones drop off */
  keep: number;
}

export type MqttQos = 0 | 1 | 2;

/** One row of the Topics tab. */
export interface MqttSub {
  id: string;
  /** a topic filter: + one level, # the rest, $share/<group>/<filter> */
  filter: string;
  qos: MqttQos;
  /** off rows stay in the list but aren't subscribed */
  enabled: boolean;
  /** MQTT 5: skip messages this connection published */
  noLocal: boolean;
  /** MQTT 5: keep the publisher's retain flag */
  retainAsPublished: boolean;
  /** MQTT 5: retained messages on subscribe: 0 send, 1 only for a new subscription, 2 never */
  retainHandling: 0 | 1 | 2;
}

export interface MqttDef {
  version: "5" | "3.1.1";
  /** where Publish sends the payload (`body.raw`) */
  topic: string;
  qos: MqttQos;
  retain: boolean;
  /** MQTT 5 publish properties; user properties are the request's `headers` */
  contentType: string;
  /** payload format indicator: the payload is UTF-8 text */
  utf8: boolean;
  /** seconds; null never expires */
  messageExpiry: number | null;
  responseTopic: string;
  correlation: string;
  subs: MqttSub[];
  username: string;
  password: string;
  /** empty: a random one on every Connect */
  clientId: string;
  cleanStart: boolean;
  /** MQTT 5, seconds */
  sessionExpiry: number;
  /** seconds; 0 sends no pings */
  keepAlive: number;
  will: MqttWill;
  /** messages the list keeps; older ones drop off */
  keep: number;
}

export interface MqttWill {
  enabled: boolean;
  topic: string;
  payload: string;
  json: boolean;
  qos: MqttQos;
  retain: boolean;
  /** MQTT 5, seconds */
  delay: number;
}

export interface WsDef {
  /** offered in Sec-WebSocket-Protocol */
  subprotocols: string[];
  /** keep-alive ping every this many seconds; 0 sends none */
  pingSec: number;
}

export interface WsMessage {
  dir: "in" | "out";
  /** "binary" holds `data` in base64; Socket.IO: "event", or "ack" answering emit `ackId`; Kafka: "record", or "ack" answering produce `ackId`; MQTT: "publish", or "ack" answering publish `ackId` */
  kind: "text" | "binary" | "event" | "ack" | "record" | "publish";
  /** the text, or base64 for binary; Socket.IO: the arguments as a JSON array */
  data: string;
  /** Socket.IO: the event name */
  event?: string;
  /** Socket.IO: how many arguments `data` holds */
  argc?: number;
  /** Socket.IO: an event's ack id (its sender waits on it); an ack's emit */
  ackId?: number;
  /** Socket.IO: an emit waiting for an ack, how long; 0 for no limit. Kafka: an ack, how long the broker took */
  ackMs?: number;
  /** Kafka: the record's partition (an ack's too) */
  partition?: number;
  /** Kafka: the record's offset; an ack's is where the broker stored the record */
  offset?: number;
  /** Kafka: the record's time, ms since the epoch */
  ts?: number;
  /** Kafka: the key as text, or base64 when `keyBin`; absent for a record without a key */
  key?: string;
  keyBin?: boolean;
  /** Kafka, MQTT: `data` holds the value (payload) in base64 */
  valueBin?: boolean;
  /** Kafka: a tombstone, a record with no value */
  valueNull?: boolean;
  headers?: { key: string; value: string; bin?: boolean }[];
  /** Kafka ack: the acks setting it was produced with */
  acks?: number;
  /** Kafka ack: why the produce failed; MQTT ack: why the publish failed */
  error?: string;
  /** MQTT: the message's topic */
  topic?: string;
  /** MQTT: the QoS it travelled at */
  qos?: number;
  /** MQTT: the broker kept it (on a received message: a retained one sent on subscribe) */
  retain?: boolean;
  dup?: boolean;
  /** MQTT 5 properties */
  props?: MqttMsgProps;
  /** MQTT ack: "PUBACK" or "PUBREC → PUBCOMP" */
  ack?: string;
  packetId?: number;
  /** MQTT ack: a reason code that isn't plain Success, e.g. "0x10 No matching subscribers" */
  reason?: string;
  size: number;
  /** ms since the socket opened */
  atMs: number;
}

/** The upgrade request and the server's answer: 101, or the HTTP status it refused with. */
export interface WsHandshake {
  status: number;
  statusText: string;
  requestHeaders: { key: string; value: string }[];
  responseHeaders: { key: string; value: string }[];
  protocol?: string | null;
  /** a refused upgrade's body */
  body?: string;
  elapsedMs: number;
}

export interface WsClose {
  code: number;
  reason: string;
  /** who closed it; "lost" when it dropped without a close */
  by: "server" | "client" | "lost";
  /** ms the socket was open */
  elapsedMs: number;
}

/** One WebSocket connection as the response pane shows it: grows while the socket is open. */
export interface WsResult {
  /** the connection this belongs to; events of an older one are ignored */
  connId?: string;
  startedAt: number;
  url: string;
  handshake?: WsHandshake;
  /** the server answered the upgrade with plain HTTP */
  refused?: boolean;
  messages: WsMessage[];
  /** older messages left out to keep a long session light */
  dropped?: number;
  close?: WsClose;
  /** Socket.IO: the Engine.IO session and the namespace */
  sio?: SioSession;
  /** Kafka: the cluster, the topic and where reading stands */
  kafka?: KafkaSession;
  /** MQTT: the broker's answer and the subscriptions */
  mqtt?: MqttSession;
}

export interface MqttMsgProps {
  contentType?: string;
  utf8?: boolean;
  messageExpiry?: number;
  responseTopic?: string;
  /** text, or base64 when `correlationBin` */
  correlation?: string;
  correlationBin?: boolean;
  user?: { key: string; value: string }[];
  subscriptionIds?: number[];
}

/** What the broker said in CONNACK, and what was asked for. See src-tauri/src/mqtt.rs ConnInfo. */
export interface MqttConnInfo {
  broker: string;
  ip?: string;
  transport: string;
  path?: string;
  version: string;
  clientId: string;
  randomId: boolean;
  assignedId: boolean;
  cleanStart: boolean;
  keepAlive: number;
  serverKeepAlive?: number;
  sessionExpiry: number;
  sessionPresent: boolean;
  username?: string;
  will?: string;
  maxQos?: number;
  retainAvailable?: boolean;
  wildcards?: boolean;
  shared?: boolean;
  subIds?: boolean;
  receiveMax?: number;
  maxPacketSize?: number;
  topicAliasMax?: number;
  responseInfo?: string;
  reason?: string;
  user?: { key: string; value: string }[];
  connectMs: number;
}

/** A subscription as the broker answered it. */
export interface MqttSubState {
  /** the QoS asked for */
  qos: number;
  granted?: number;
  /** "0x87 Not authorized", or why it was never sent */
  error?: string;
}

export interface MqttSession {
  /** the broker accepted */
  conn?: MqttConnInfo;
  /** by topic filter */
  subs: Record<string, MqttSubState>;
  /** the connection never got to the broker's yes */
  failed?: { stage: "connect" | "tls" | "ws" | "mqtt" | "refused"; broker: string; message: string; hint?: string; code?: number; elapsedMs: number };
}

export interface KafkaBroker {
  id: number;
  host: string;
  port: number;
  rack?: string;
}

export interface KafkaPartition {
  partition: number;
  leader: number;
  replicas: number[];
  isr: number[];
  earliest?: number;
  latest?: number;
  error?: string;
}

export interface KafkaCluster {
  clusterId?: string;
  controllerId?: number;
  brokers: KafkaBroker[];
  topic: string;
  partitions: KafkaPartition[];
  /** every topic on the cluster */
  topics: string[];
  /** the bootstrap broker that answered */
  bootstrap: string;
  sasl?: string;
  tls: boolean;
}

export interface KafkaSession {
  topic: string;
  /** set once the cluster answered and the topic was found */
  cluster?: KafkaCluster;
  /** ms from Connect until then */
  connectedMs?: number;
  /** where the current reading started */
  from: KafkaSeek;
  paused?: boolean;
  /** while paused: records on the topic past where reading stopped */
  waiting?: number;
  /** the connection never got to reading */
  failed?: { stage: "connect" | "tls" | "sasl" | "broker" | "topic"; broker?: string; message: string; hint?: string; topics?: string[]; elapsedMs: number };
}

export interface SioSession {
  eio: 3 | 4;
  namespace: string;
  /** the handshake auth as sent, its strings masked */
  auth?: string;
  /** Engine.IO's open packet */
  engine?: { sid: string; upgrades: string[]; pingInterval: number; pingTimeout: number; maxPayload?: number };
  /** the namespace's socket id, once joined */
  sid?: string;
  /** ms after the socket opened that the namespace was joined */
  joinedMs?: number;
  /** the namespace refused the join */
  error?: { message: string; data?: string };
  /** emits whose ack did not come in time */
  late?: number[];
}

/** How a gRPC method streams: one message each way, or a stream from the server, the client, or both. */
export type GrpcStream = "unary" | "server" | "client" | "bidi";

export interface GrpcDef {
  /** full service name, e.g. customer.v1.CustomerService; empty until a method is picked */
  service: string;
  method: string;
  /** remembered with the method, so the request knows its shape before the schema loads */
  stream?: GrpcStream;
  inputType?: string;
  tls: boolean;
  /** where the method list comes from */
  source: "reflection" | "protos";
  /** absolute paths of .proto files, and folders their imports are looked up in */
  protoFiles: string[];
  importPaths: string[];
}

export interface GrpcMessage {
  dir: "in" | "out";
  json: string;
  size: number;
  /** ms since the call started */
  atMs: number;
}

export interface GrpcEnd {
  code: number;
  status: string;
  message: string;
  /** google.rpc.Status details as a JSON array, when the server sent any */
  details?: string | null;
  trailers: { key: string; value: string }[];
  elapsedMs: number;
}

/** One gRPC call as the response pane shows it: grows while the call runs. */
export interface GrpcResult {
  /** the call this belongs to; events of an older call are ignored */
  callId?: string;
  startedAt: number;
  stream: GrpcStream;
  tls: boolean;
  headers: { key: string; value: string }[];
  messages: GrpcMessage[];
  /** older messages left out to keep a long stream light */
  dropped?: number;
  /** the client can still send (client and bidi streams, until End sending) */
  sendOpen?: boolean;
  end?: GrpcEnd;
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
  /** An HTTP example holds `response`, a gRPC example holds `grpc` (an ended call); never both. */
  response?: HttpResponse;
  grpc?: GrpcResult;
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
  /** tag colour (src/lib/tags.ts) so an environment reads at a glance, e.g. Alizarin for Production */
  color?: TagColor;
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
  /** the last gRPC call of a gRPC tab, live while it runs */
  grpc?: GrpcResult;
  /** the last connection of a WebSocket tab, live while it is open */
  ws?: WsResult;
  error?: string;
  /** what the pre-request and post-response scripts of the last send reported */
  scripts?: ScriptRun;
  /** The response came from history, not from a send in this tab. Cleared by the next send. */
  fromHistory?: { at: number; bodyDropped: boolean; entryId?: string };
}

export interface HistoryEntry {
  id: string;
  at: number;
  request: RequestDef;
  /** HTTP status, the gRPC status code for a gRPC call (0 is OK), or the handshake status for a WebSocket (101 is OK) */
  status?: number;
  elapsedMs?: number;
  /** The response is stored in responses/<id>.json: "full", or "meta" when the body was over the size limit and left out. */
  kept?: "full" | "meta";
  /** the saved request (node id) whose tab sent it; entries without one match on method and address */
  ref?: string;
  /** response body bytes (gRPC: received messages) */
  size?: number;
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
  /** Compact mode: same sizes and spacing, fewer icons (no folder or project icons; methods as coloured dots in the sidebar and tabs). */
  compact?: boolean;
  /** Store each response with its history entry (default on). */
  keepResponses?: boolean;
  /** Bodies bigger than this many MB keep only status and headers (default 1). */
  keepResponseMaxMb?: number;
  /** how the Variables dialog shows variables; remembered between openings */
  variablesFormat?: "table" | "json" | "env";
  /** Soft-wrap long lines in the request body editor (default off) and the response body (default on). */
  wrapRequestBody?: boolean;
  wrapResponseBody?: boolean;
  /** Run pre-request and post-response scripts on send (default on). */
  runScripts?: boolean;
  /** Look for a new version when the app opens (default on). */
  autoUpdateCheck?: boolean;
  /** Page zoom (⌘+ / ⌘− / ⌘0), 0.5 to 2; missing = 100%. */
  zoom?: number;
  /** Settings > Network; missing fields take DEFAULT_NET (src/lib/net.ts): all off. */
  network?: NetSettings;
  /** Settings > Certificates; missing = nothing added. */
  certs?: CertSettings;
}

/** Settings > Certificates for every TLS connection (HTTP, WebSocket, gRPC). Files are kept by path;
 * passphrases live in the macOS Keychain, never here. */
export interface CertSettings {
  /** Trust caFiles on top of the public CAs. */
  caEnabled?: boolean;
  /** PEM files with the certificate of a self-signed server or of a company / dev CA (mkcert). */
  caFiles?: string[];
  /** Client certificates for mutual TLS, picked by host and port. */
  clients?: ClientCert[];
}

export interface ClientCert {
  /** Stable id; also the Keychain account of its passphrase. */
  id: string;
  /** api.example.com, or *.example.com for its subdomains */
  host: string;
  /** missing: any port */
  port?: number;
  /** pem: certificate file + key file; pfx: one PKCS#12 file */
  format: "pem" | "pfx";
  cert?: string;
  /** empty: the key is in the certificate file */
  key?: string;
  pfx?: string;
}

/** Secure DNS and proxy for every request (HTTP, WebSocket, gRPC). */
export interface NetSettings {
  /** Look up hostnames over HTTPS (DoH) instead of the Mac's resolver. */
  secureDns?: boolean;
  /** cloudflare | google | quad9 | adguard | custom */
  provider?: string;
  /** DoH endpoint when provider is custom */
  dohUrl?: string;
  /** When secure DNS has no answer, ask the Mac's resolver (intranet names on a VPN). Default on. */
  fallback?: boolean;
  /** Domains that always use the Mac's resolver, comma separated; each covers its subdomains. */
  systemDomains?: string;
  proxy?: "none" | "socks5" | "http";
  /** host:port, optionally user:pass@host:port */
  proxyAddr?: string;
  /** Hosts reached directly, comma separated; each covers its subdomains. */
  proxySkip?: string;
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
