/** Pasted cURL and grpcurl commands, one or many, as one collection. */
import type { Collection, RequestNode } from "../../types";
import { newRequest, uid } from "../model";
import { parseCurl } from "../curl";
import { parseGrpcurl } from "../grpc";
import type { ImportPlan, Note } from "./common";

const START = /^\s*(curl|grpcurl)(\.exe)?\s/i;

/** Splits text into commands: a new one starts on each line that begins with curl or grpcurl. */
export function splitCommands(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (START.test(line)) out.push(line);
    else if (out.length) out[out.length - 1] += `\n${line}`;
  }
  return out.map((c) => c.trim()).filter(Boolean);
}

/** The method shows beside the name everywhere, so the name is the path. */
function nameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.replace(/^\w+:\/\//, "").split("?")[0].slice(0, 80);
  }
}

export function commandsSummary(text: string): { curl: number; grpcurl: number; bad: number } {
  let curl = 0;
  let grpcurl = 0;
  let bad = 0;
  for (const c of splitCommands(text)) {
    if (/^grpcurl/i.test(c)) (parseGrpcurl(c) ? grpcurl++ : bad++);
    else (parseCurl(c) ? curl++ : bad++);
  }
  return { curl, grpcurl, bad };
}

export function importCommands(text: string): ImportPlan {
  const notes: Note[] = [];
  const children: RequestNode[] = [];
  let bad = 0;
  for (const c of splitCommands(text)) {
    if (/^grpcurl/i.test(c)) {
      const g = parseGrpcurl(c);
      if (!g) {
        bad++;
        continue;
      }
      for (const n of g.notes) notes.push({ level: "warn", text: n });
      const name = g.request.grpc?.method ? `${g.request.grpc.method}` : g.request.url;
      children.push({ type: "request", ...newRequest({ ...g.request, name }) });
    } else {
      const p = parseCurl(c);
      if (!p) {
        bad++;
        continue;
      }
      children.push({ type: "request", ...newRequest({ ...p, name: nameOf(p.url) }) });
    }
  }
  if (bad) notes.push({ level: "warn", text: `${bad} command${bad === 1 ? "" : "s"} could not be read and ${bad === 1 ? "is" : "are"} left out.` });
  const collection: Collection = { id: uid(), name: "Pasted requests", children, variables: [] };
  return {
    format: "commands",
    label: "Commands",
    detail: `${children.length} request${children.length === 1 ? "" : "s"}`,
    collections: [collection],
    environments: [],
    notes,
  };
}
