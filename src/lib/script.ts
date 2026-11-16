import { invoke } from "@tauri-apps/api/core";
import type { Environment, HttpResponse, KV, RequestDef, ScriptLog, ScriptTest } from "../types";
import { uid } from "./model";

/** A variable change a script asked for; the app saves it to the environment or the collection. */
export interface VarOp {
  scope: "environment" | "collectionVariables";
  op: "set" | "unset" | "clear";
  key?: string;
  value?: string;
}

/** What one run of a script hands back (src-tauri/src/script/prelude.js `__finish`). */
export interface ScriptOutput {
  tests: ScriptTest[];
  logs: Omit<ScriptLog, "src">[];
  vars: VarOp[];
  /** values set with pm.variables.set: they last for this send only */
  locals: Record<string, string>;
  /** the request as the pre-request script left it; missing when it did not change it */
  request?: { method: string; url: string; headers: { key: string; value: string }[]; body: { raw: string } | null };
  error: { name: string; message: string; line?: number } | null;
}

/** Asks the request pane of `tabId` to show one of its scripts (the response pane's "Open script"). */
export const OPEN_SCRIPT = "voidhttp:open-script";
export type OpenScript = { tabId: string; src: "pre" | "post" };

export const hasScript = (s: string | undefined) => !!s && s.trim().length > 0;

/** How much of a response body a post-response script gets, in characters. */
const SCRIPT_BODY_LIMIT = 8 << 20;

/** Body modes a script can read and rewrite as text. */
const TEXT_BODY = new Set(["json", "text", "xml"]);

const values = (rows: KV[] | undefined) => Object.fromEntries((rows ?? []).filter((v) => v.enabled && v.key).map((v) => [v.key, v.value]));

export async function runScript(
  phase: "pre" | "post",
  code: string,
  ctx: {
    request: RequestDef;
    response?: HttpResponse;
    environment?: Environment;
    collectionVariables?: KV[];
    inCollection: boolean;
    requestId?: string;
    /** pm.variables set by the pre-request script, still there for the post-response one */
    locals?: Record<string, string>;
  },
): Promise<ScriptOutput> {
  const r = ctx.request;
  const res = ctx.response;
  const input = {
    phase,
    requestName: r.name,
    requestId: ctx.requestId,
    request: {
      method: r.method,
      url: r.url,
      headers: r.headers.filter((h) => h.enabled && h.key).map((h) => ({ key: h.key, value: h.value })),
      body: TEXT_BODY.has(r.body.mode) ? { raw: r.body.raw } : null,
    },
    response: res && {
      code: res.status,
      status: res.statusText,
      headers: res.headers,
      // the sandbox has 64 MB: a bigger body would not fit beside its parsed JSON
      body: res.bodyEncoding === "utf8" ? res.body.slice(0, SCRIPT_BODY_LIMIT) : "",
      bodyTruncated: res.bodyEncoding === "utf8" && res.body.length > SCRIPT_BODY_LIMIT,
      responseTime: res.elapsedMs,
      size: res.size,
    },
    environment: ctx.environment ? { name: ctx.environment.name, values: values(ctx.environment.variables) } : null,
    collectionVariables: values(ctx.collectionVariables),
    inCollection: ctx.inCollection,
    locals: ctx.locals ?? {},
  };
  try {
    return await invoke<ScriptOutput>("run_script", { code, input });
  } catch (e) {
    // the sandbox itself failed (not the script): reported the same way, so the send stops cleanly
    return { tests: [], logs: [], vars: [], locals: {}, error: { name: "Error", message: String(e) } };
  }
}

/** The request the pre-request script left, for this send only: the tab keeps what the user wrote. */
export function withScriptRequest(req: RequestDef, out: ScriptOutput["request"]): RequestDef {
  if (!out) return req;
  return {
    ...req,
    method: out.method,
    url: out.url,
    headers: out.headers.map((h) => ({ id: uid(), key: h.key, value: h.value, enabled: true })),
    body: out.body && TEXT_BODY.has(req.body.mode) ? { ...req.body, raw: out.body.raw } : req.body,
  };
}

/** A variable table after a script's changes to that scope. */
export function applyVarOps(rows: KV[], ops: VarOp[]): KV[] {
  let next = rows;
  for (const o of ops) {
    if (o.op === "clear") next = [];
    else if (o.op === "unset") next = next.filter((v) => v.key !== o.key);
    else {
      const i = next.findIndex((v) => v.key === o.key && v.enabled);
      const j = i >= 0 ? i : next.findIndex((v) => v.key === o.key);
      next =
        j >= 0
          ? next.map((v, k) => (k === j ? { ...v, value: o.value ?? "", enabled: true } : v))
          : [...next, { id: uid(), key: o.key ?? "", value: o.value ?? "", enabled: true }];
    }
  }
  return next;
}

/** Snippets for the Scripts tab, grouped as the menu shows them. */
export const SNIPPETS: { group: string; items: { label: string; code: string; only?: "pre" | "post" }[] }[] = [
  {
    group: "Variables",
    items: [
      { label: "Get an environment variable", code: 'const value = pm.environment.get("name");' },
      { label: "Set an environment variable", code: 'pm.environment.set("name", "value");' },
      { label: "Set a collection variable", code: 'pm.collectionVariables.set("name", "value");' },
      { label: "Save a response field to a variable", code: 'pm.environment.set("id", pm.response.json().id);', only: "post" },
    ],
  },
  {
    group: "Tests",
    items: [
      { label: "Status code is 200", code: 'pm.test("Status code is 200", () => {\n  pm.response.to.have.status(200);\n});', only: "post" },
      {
        label: "Response time is below 500 ms",
        code: 'pm.test("Response time is below 500 ms", () => {\n  pm.expect(pm.response.responseTime).to.be.below(500);\n});',
        only: "post",
      },
      {
        label: "Body has a JSON field",
        code: 'pm.test("Body has an id", () => {\n  pm.expect(pm.response.json()).to.have.property("id");\n});',
        only: "post",
      },
      {
        label: "Header is present",
        code: 'pm.test("Content-Type is present", () => {\n  pm.response.to.have.header("Content-Type");\n});',
        only: "post",
      },
    ],
  },
  {
    group: "Request",
    items: [
      { label: "Add a header", code: 'pm.request.headers.upsert({ key: "X-Request-Id", value: pm.variables.replaceIn("{{$guid}}") });', only: "pre" },
      { label: "Log the response", code: "console.log(pm.response.json());", only: "post" },
    ],
  },
];
