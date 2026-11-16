/**
 * GraphQL over HTTP: a request holds a document and its variables, and goes on the wire as a plain
 * POST of `{ query, operationName, variables }` as JSON. Everything here is pure, so Send, cURL,
 * scripts and the exports all see the same body.
 */
import type { GqlDef, RequestDef } from "../types";
import { kv } from "./model";

export const isGql = (r: { method: string }) => r.method === "GQL";

export const defaultGql = (): GqlDef => ({ query: "query {\n  \n}\n", variables: "" });

/** What GraphQL servers answer with, newest media type first (GraphQL over HTTP spec). */
export const GQL_ACCEPT = "application/graphql-response+json, application/json";

export type GqlOpKind = "query" | "mutation" | "subscription";

export interface GqlOperation {
  kind: GqlOpKind;
  /** empty for an anonymous operation */
  name: string;
  /** 1-based line the operation starts on */
  line: number;
}

const NAME_START = /[A-Za-z_]/;
const NAME_PART = /\w/;

/**
 * The operations a document defines, in order. A small scan, not a parser: it skips comments and strings,
 * counts braces and parentheses, and reads `query|mutation|subscription Name` at the top level;
 * a bare `{ … }` there is an anonymous query, and fragments are not operations.
 */
export function gqlOperations(doc: string): GqlOperation[] {
  const ops: GqlOperation[] = [];
  const n = doc.length;
  let i = 0;
  let line = 1;
  let depth = 0;
  let parens = 0;
  // a keyword was read at the top level: the next top-level "{" is its selection set, not a new operation
  let pending = false;

  const skipBlank = () => {
    while (i < n) {
      const c = doc[i];
      if (c === "\n") line++;
      else if (c === "#") {
        while (i < n && doc[i] !== "\n") i++;
        continue;
      } else if (c !== " " && c !== "\t" && c !== "\r" && c !== ",") return;
      i++;
    }
  };
  const readName = () => {
    const s = i;
    while (i < n && NAME_PART.test(doc[i])) i++;
    return doc.slice(s, i);
  };

  while (i < n) {
    const c = doc[i];
    if (c === "\n") {
      line++;
      i++;
    } else if (c === "#") {
      while (i < n && doc[i] !== "\n") i++;
    } else if (c === '"') {
      if (doc.startsWith('"""', i)) {
        const end = doc.indexOf('"""', i + 3);
        const stop = end === -1 ? n : end + 3;
        for (let k = i; k < stop; k++) if (doc[k] === "\n") line++;
        i = stop;
      } else {
        i++;
        while (i < n && doc[i] !== '"' && doc[i] !== "\n") i += doc[i] === "\\" ? 2 : 1;
        if (doc[i] === '"') i++;
      }
    } else if (c === "(") {
      parens++;
      i++;
    } else if (c === ")") {
      parens = Math.max(0, parens - 1);
      i++;
    } else if (c === "{") {
      if (depth === 0 && parens === 0) {
        if (!pending) ops.push({ kind: "query", name: "", line });
        pending = false;
      }
      depth++;
      i++;
    } else if (c === "}") {
      depth = Math.max(0, depth - 1);
      i++;
    } else if (depth === 0 && parens === 0 && NAME_START.test(c)) {
      const at = line;
      const word = readName();
      if (word === "query" || word === "mutation" || word === "subscription") {
        skipBlank();
        const name = i < n && NAME_START.test(doc[i]) ? readName() : "";
        ops.push({ kind: word, name, line: at });
        pending = true;
      } else if (word === "fragment") pending = true;
    } else i++;
  }
  return ops;
}

/** The operation Send runs: the picked one while the document still has it, else the first. */
export function pickedOperation(def: GqlDef, ops = gqlOperations(def.query)): GqlOperation | undefined {
  return ops.find((o) => o.name && o.name === def.operation) ?? ops[0];
}

/**
 * The JSON body: `operationName` only when the document holds more than one operation (a server needs it
 * then, and a stale name on a single operation would only fail), `variables` only when there are some.
 * The variables text goes in as written: `{{name}}` and comments are handled where every JSON body's are.
 */
export function gqlPayload(def: GqlDef): string {
  const ops = gqlOperations(def.query);
  const op = ops.length > 1 ? pickedOperation(def, ops) : undefined;
  const vars = def.variables.trim();
  const parts = [`  "query": ${JSON.stringify(def.query)}`];
  if (op?.name) parts.push(`  "operationName": ${JSON.stringify(op.name)}`);
  if (vars) parts.push(`  "variables": ${vars.replace(/\n/g, "\n  ")}`);
  return `{\n${parts.join(",\n")}\n}`;
}

/** The plain HTTP request a GraphQL request goes out as: POST, a JSON body, and an Accept header unless one is set. */
export function gqlAsHttp(req: RequestDef): RequestDef {
  if (!isGql(req)) return req;
  const hasAccept = req.headers.some((h) => h.enabled && h.key.toLowerCase() === "accept");
  return {
    ...req,
    method: "POST",
    headers: hasAccept ? req.headers : [...req.headers, kv("Accept", GQL_ACCEPT)],
    body: { ...req.body, mode: "json", raw: gqlPayload(req.gql ?? defaultGql()) },
  };
}

/** A JSON body read back as a GraphQL request, e.g. an imported Postman or HAR body; null when it is not one. */
export function gqlFromJson(raw: string): GqlDef | null {
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object" || typeof v.query !== "string") return null;
    const variables = v.variables && typeof v.variables === "object" && Object.keys(v.variables).length ? JSON.stringify(v.variables, null, 2) : "";
    return { query: v.query, variables, ...(typeof v.operationName === "string" && v.operationName && { operation: v.operationName }) };
  } catch {
    return null;
  }
}

// ---------- errors in a response ----------

export interface GqlError {
  message: string;
  /** e.g. customer.accounts.0 */
  path?: string;
  /** extensions.code, when the server sends one */
  code?: string;
  /** the first location's line in the document */
  line?: number;
}

/** The `errors` of a GraphQL response body; empty when there are none or the body is not GraphQL JSON. */
export function gqlErrors(body: string): GqlError[] {
  if (!body || body.length > 8 * 1024 * 1024) return [];
  let v: unknown;
  try {
    v = JSON.parse(body);
  } catch {
    return [];
  }
  const errs = v && typeof v === "object" ? (v as { errors?: unknown }).errors : undefined;
  if (!Array.isArray(errs)) return [];
  return errs
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => {
      const loc = Array.isArray(e.locations) ? (e.locations[0] as { line?: unknown } | undefined) : undefined;
      const ext = e.extensions && typeof e.extensions === "object" ? (e.extensions as { code?: unknown }) : undefined;
      return {
        message: typeof e.message === "string" ? e.message : JSON.stringify(e.message ?? "Unknown error"),
        ...(Array.isArray(e.path) && e.path.length && { path: e.path.join(".") }),
        ...(typeof ext?.code === "string" && { code: ext.code }),
        ...(typeof loc?.line === "number" && { line: loc.line }),
      };
    });
}

// ---------- schema (introspection result) ----------

export interface GqlTypeRef {
  kind: string;
  name: string | null;
  ofType: GqlTypeRef | null;
}

export interface GqlInputValue {
  name: string;
  description?: string | null;
  type: GqlTypeRef;
  defaultValue?: string | null;
}

export interface GqlField {
  name: string;
  description?: string | null;
  args: GqlInputValue[];
  type: GqlTypeRef;
  isDeprecated?: boolean;
  deprecationReason?: string | null;
}

export interface GqlEnumValue {
  name: string;
  description?: string | null;
  isDeprecated?: boolean;
  deprecationReason?: string | null;
}

export interface GqlType {
  kind: string;
  name: string;
  description?: string | null;
  fields?: GqlField[] | null;
  inputFields?: GqlInputValue[] | null;
  enumValues?: GqlEnumValue[] | null;
  interfaces?: { name: string }[] | null;
  possibleTypes?: { name: string }[] | null;
}

export interface GqlSchema {
  queryType?: string;
  mutationType?: string;
  subscriptionType?: string;
  types: Map<string, GqlType>;
}

/** The introspection query: types, fields, arguments, enum values and deprecations; no directives. */
export const INTROSPECTION_QUERY = `query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types { ...FullType }
  }
}

fragment FullType on __Type {
  kind
  name
  description
  fields(includeDeprecated: true) {
    name
    description
    args { ...InputValue }
    type { ...TypeRef }
    isDeprecated
    deprecationReason
  }
  inputFields { ...InputValue }
  interfaces { name }
  enumValues(includeDeprecated: true) {
    name
    description
    isDeprecated
    deprecationReason
  }
  possibleTypes { name }
}

fragment InputValue on __InputValue {
  name
  description
  type { ...TypeRef }
  defaultValue
}

fragment TypeRef on __Type {
  kind
  name
  ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } } }
}
`;

/** An introspection result (`{ data: { __schema } }`, or `{ __schema }` as some tools save it) as a schema. Throws a readable message otherwise. */
export function parseIntrospection(text: string): GqlSchema {
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(text);
  } catch {
    throw new Error("The answer is not JSON");
  }
  const data = (v?.data ?? v) as { __schema?: Record<string, unknown> } | null;
  const s = data?.__schema;
  if (!s || !Array.isArray(s.types)) {
    const errs = gqlErrors(text);
    throw new Error(errs[0]?.message ?? "No __schema in the answer");
  }
  const rootName = (r: unknown) => (r && typeof r === "object" && typeof (r as { name?: unknown }).name === "string" ? (r as { name: string }).name : undefined);
  const types = new Map<string, GqlType>();
  for (const t of s.types as GqlType[]) if (t && typeof t.name === "string") types.set(t.name, t);
  return { queryType: rootName(s.queryType), mutationType: rootName(s.mutationType), subscriptionType: rootName(s.subscriptionType), types };
}

/** The named type under NON_NULL and LIST wrappers. */
export function namedType(t: GqlTypeRef): string {
  let r: GqlTypeRef | null = t;
  while (r && !r.name) r = r.ofType;
  return r?.name ?? "?";
}

/** A type reference as GraphQL writes it, split so the name can be a link: ["[", "Account", "!]!"]. */
export function typeParts(t: GqlTypeRef): [string, string, string] {
  if (t.kind === "NON_NULL" && t.ofType) {
    const [a, n, b] = typeParts(t.ofType);
    return [a, n, `${b}!`];
  }
  if (t.kind === "LIST" && t.ofType) {
    const [a, n, b] = typeParts(t.ofType);
    return [`[${a}`, n, `${b}]`];
  }
  return ["", t.name ?? "?", ""];
}

/** Built-in types the browser does not list: scalars everyone knows and the introspection types. */
export const isBuiltinType = (name: string) => name.startsWith("__") || ["String", "Int", "Float", "Boolean", "ID"].includes(name);

// ---------- Beautify ----------

// a {{variable}} is kept whole, like a string: its braces are not GraphQL's
const FMT_TOKEN = /(#[^\n]*)|("""[\s\S]*?"""|"(?:[^"\\\n]|\\.)*"|\{\{[^{}\n]*\}\})|(\.\.\.)|([{}()[\]:=@!|&])|(\$?[A-Za-z_]\w*|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\S)/g;

/**
 * Re-indents a document: one field per line, two spaces per level, arguments and input objects kept inline
 * with ", " between them, a blank line between definitions, comments on their own line. Commas and whitespace
 * are insignificant in GraphQL, so this never changes what the document means.
 */
export function formatGraphql(doc: string): string {
  type T = { k: "com" | "str" | "spread" | "p" | "word"; v: string };
  const toks: T[] = [];
  for (const m of doc.matchAll(FMT_TOKEN)) {
    if (m[1]) toks.push({ k: "com", v: m[1].trimEnd() });
    else if (m[2]) toks.push({ k: "str", v: m[2] });
    else if (m[3]) toks.push({ k: "spread", v: "..." });
    else if (m[4]) toks.push({ k: "p", v: m[4] });
    else if (m[5]) toks.push({ k: "word", v: m[5] });
    // a stray character is kept, as a word, so nothing is lost
    else if (m[6] && m[6] !== ",") toks.push({ k: "word", v: m[6] });
  }

  const lines: string[] = [];
  let cur = "";
  let depth = 0; // selection sets
  let inline = 0; // ( … ), and { … } / [ … ] inside them
  let prev: T | undefined;
  const pad = () => "  ".repeat(depth);
  const breakLine = () => {
    if (cur.trim()) lines.push(cur.trimEnd());
    cur = pad();
  };
  // a value just ended: the next one inside ( … ) needs a comma, the next one in a selection set its own line
  const ended = () => !!prev && (prev.k === "word" || prev.k === "str" || (prev.k === "p" && /[)\]}!]/.test(prev.v)));

  for (const t of toks) {
    if (t.k === "com") {
      breakLine();
      cur += t.v;
      breakLine();
      prev = undefined;
      continue;
    }
    if (t.k === "p") {
      const v = t.v;
      if (v === "{" && !inline) {
        cur += (cur.trim() ? " " : "") + "{";
        depth++;
        breakLine();
      } else if (v === "}" && !inline) {
        depth = Math.max(0, depth - 1);
        breakLine();
        cur += "}";
        if (depth === 0) {
          breakLine();
          lines.push("");
        }
      } else if (v === "(" || ((v === "{" || v === "[") && inline)) {
        if (inline && ended() && v !== "(") cur += ", ";
        else if (v === "{" && prev?.v === ":") cur += "";
        cur += v === "{" ? "{ " : v;
        inline++;
      } else if (v === ")" || ((v === "}" || v === "]") && inline)) {
        inline = Math.max(0, inline - 1);
        cur = cur.trimEnd() + (v === "}" ? " }" : v);
      } else if (v === "[") {
        cur += (prev?.v === ":" || prev?.v === "(" || !cur.trim() ? "" : " ") + "[";
        inline++;
      } else if (v === ":") cur += ": ";
      else if (v === "=") cur = cur.trimEnd() + " = ";
      else if (v === "|" || v === "&") cur = cur.trimEnd() + ` ${v} `;
      else if (v === "@") cur += (cur.trim() && !cur.endsWith(" ") ? " " : "") + "@";
      else cur += v; // "!"
      prev = t;
      continue;
    }
    if (t.k === "spread") {
      if (!inline && depth) breakLine();
      cur += "...";
      prev = t;
      continue;
    }
    // a word or a string
    if (inline) {
      if (ended()) cur += ", ";
    } else if (depth) {
      if (prev?.k === "spread") cur += t.v === "on" ? " " : "";
      else if (ended() && prev?.v !== "on") breakLine();
      else if (prev && prev.v !== "@" && prev.v !== ":" && cur.trim()) cur += " ";
    } else if (cur.trim() && prev?.v !== "@" && prev?.v !== "!") cur += " ";
    cur += t.v;
    prev = t;
  }
  breakLine();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines.join("\n") + "\n";
}
