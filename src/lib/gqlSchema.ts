/**
 * GraphQL schemas for the Docs panel: fetched by introspection with the request's own URL, headers and auth,
 * or read from an introspection JSON file. Kept for the session, one per endpoint, shared by every tab on it.
 */
import { useSyncExternalStore } from "react";
import type { RequestDef, Settings } from "../types";
import { prepare, send } from "./http";
import type { VarScope } from "./vars";
import { INTROSPECTION_QUERY, parseIntrospection, type GqlSchema } from "./graphql";

export interface GqlSchemaState {
  loading?: boolean;
  schema?: GqlSchema;
  loadedAt?: number;
  /** where it came from: the server, or the file it was read from */
  from?: "server" | { file: string };
  error?: string;
  /** the server answered but would not describe itself: introspection is off */
  refused?: boolean;
}

const schemas = new Map<string, GqlSchemaState>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const put = (key: string, s: GqlSchemaState) => {
  schemas.set(key, s);
  emit();
};

/** One schema per endpoint: the URL with variables resolved, without its query string. */
export const gqlSchemaKey = (url: string) => url.replace(/[?#].*$/, "");

export function useGqlSchema(key: string): GqlSchemaState | undefined {
  return useSyncExternalStore(subscribe, () => schemas.get(key));
}

export async function fetchGqlSchema(req: RequestDef, scope: VarScope, settings: Settings): Promise<GqlSchemaState> {
  const probe: RequestDef = { ...req, gql: { query: INTROSPECTION_QUERY, variables: "" } };
  const prepared = prepare(probe, scope);
  const key = gqlSchemaKey(prepared.url);
  put(key, { ...schemas.get(key), loading: true, error: undefined, refused: undefined });
  let next: GqlSchemaState;
  try {
    const res = await send(prepared, settings);
    if (res.bodyEncoding !== "utf8") throw new Error(`HTTP ${res.status}: not a JSON answer`);
    try {
      next = { schema: parseIntrospection(res.body), loadedAt: Date.now(), from: "server" };
    } catch (e) {
      const message = (e as Error).message;
      // a GraphQL server that answered with errors and no schema has introspection turned off
      const refused = res.status < 500 && message !== "The answer is not JSON" && message !== "No __schema in the answer";
      next = { error: res.status >= 400 && !refused ? `HTTP ${res.status} ${res.statusText}: ${message}` : message, refused };
    }
  } catch (e) {
    next = { error: e instanceof Error ? e.message : String(e) };
  }
  put(key, next);
  return next;
}

/** An introspection JSON file, saved from another tool or from this server while introspection was on. */
export function loadGqlSchemaFile(key: string, file: string, text: string): GqlSchemaState {
  let next: GqlSchemaState;
  try {
    next = { schema: parseIntrospection(text), loadedAt: Date.now(), from: { file } };
  } catch (e) {
    next = { ...schemas.get(key), loading: false, error: `${file}: ${(e as Error).message}` };
  }
  put(key, next);
  return next;
}
