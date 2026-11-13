/** Import: what a source is, and how far it gets before the review step. */
import { detect, type ImportPlan, type Source } from "./common";
import { importPostman, importPostmanEnv } from "./postman";
import { loadOpenApi, type LoadedSpec, type RefLoader } from "./openapi";
import { readHar, type HarFile } from "./har";
import { importNative } from "./native";
import { importCommands } from "./commands";

export type Analysis =
  /** a finished plan: Postman, voidHTTP, pasted commands */
  | { kind: "plan"; plan: ImportPlan }
  /** a spec to build with options (folders from tags or paths) */
  | { kind: "openapi"; spec: LoadedSpec }
  /** captured calls to pick from */
  | { kind: "har"; har: HarFile };

export async function analyze(src: Source, load?: RefLoader): Promise<Analysis> {
  const hit = detect(src.text);
  if (!hit) throw new Error("Not a Postman, OpenAPI / Swagger, HAR or voidHTTP file, and no cURL command found.");
  switch (hit.format) {
    case "postman":
      return { kind: "plan", plan: importPostman(hit.doc) };
    case "postman-env":
      return { kind: "plan", plan: importPostmanEnv(hit.doc) };
    case "voidhttp":
      return { kind: "plan", plan: importNative(hit.doc) };
    case "commands":
      return { kind: "plan", plan: importCommands(src.text) };
    case "openapi":
    case "swagger":
      return { kind: "openapi", spec: await loadOpenApi(hit.doc, src, load) };
    case "har":
      return { kind: "har", har: readHar(hit.doc) };
  }
}
