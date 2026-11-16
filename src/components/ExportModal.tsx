import { useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { useStore } from "../store";
import type { Environment } from "../types";
import { TriangleAlert, X, ico } from "./Icon";
import { blankHarEnv, blankValues, fileStem, requestsOf } from "../lib/formats/common";
import { exportNative } from "../lib/formats/native";
import { exportPostman, exportPostmanEnv } from "../lib/formats/postman";
import { exportHar } from "../lib/formats/har";
import { baseName, pickSavePath, writeTextFile } from "../lib/files";
import { buildScope } from "../lib/vars";

type Format = "void" | "postman" | "har";
type Envs = "none" | "active" | "all";

const FORMATS: { id: Format; title: string; desc: string; ext: string; suffix: string; label: string }[] = [
  {
    id: "void",
    title: "voidHTTP",
    desc: "Everything, nothing lost: gRPC calls, examples, environment colours. For backups and other voidHTTP users.",
    ext: "json",
    suffix: ".voidhttp.json",
    label: "voidHTTP export",
  },
  {
    id: "postman",
    title: "Postman Collection v2.1",
    desc: "Opens in Postman, Insomnia, Bruno, Apidog and Hoppscotch.",
    ext: "json",
    suffix: ".postman_collection.json",
    label: "Postman collection",
  },
  {
    id: "har",
    title: "HAR",
    desc: "Each request with its latest saved example as the response. For devtools and proxies.",
    ext: "har",
    suffix: ".har",
    label: "HTTP Archive",
  },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function ExportModal({ collectionId, onClose }: { collectionId: string; onClose: () => void }) {
  const s = useStore.getState();
  const collection = s.collections.find((c) => c.id === collectionId);
  const active = s.environments.find((e) => e.id === s.activeEnvironmentId);
  const [format, setFormat] = useState<Format>("void");
  const [envs, setEnvs] = useState<Envs>(active ? "active" : "none");
  const [keep, setKeep] = useState(false);
  const [examples, setExamples] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!collection) return null;
  const reqs = requestsOf(collection.children);
  const grpc = reqs.filter((r) => r.method === "GRPC").length;
  const ws = reqs.filter((r) => r.method === "WS").length;
  const sio = reqs.filter((r) => r.method === "SIO").length;
  const kafka = reqs.filter((r) => r.method === "KAFKA").length;
  const left = grpc + ws + sio + kafka;
  const leftParts = [grpc && plural(grpc, "gRPC call"), ws && plural(ws, "WebSocket"), sio && plural(sio, "Socket.IO request"), kafka && plural(kafka, "Kafka request")].filter(Boolean) as string[];
  const leftLabel = leftParts.length > 1 ? `${leftParts.slice(0, -1).join(", ")} and ${leftParts[leftParts.length - 1]}` : leftParts.join("");
  const exampleCount = reqs.reduce((n, r) => n + (r.examples?.length ?? 0), 0);
  const fmt = FORMATS.find((f) => f.id === format)!;
  const fileName = fileStem(collection.name) + fmt.suffix;
  const chosenEnvs: Environment[] = envs === "all" ? s.environments : envs === "active" && active ? [active] : [];

  const run = async () => {
    setError("");
    const path = await pickSavePath(fileName, fmt.ext, fmt.label);
    if (!path) return;
    setBusy(true);
    try {
      const strip = (nodes: typeof collection.children): typeof collection.children =>
        nodes.map((n) => (n.type === "folder" ? { ...n, children: strip(n.children) } : { ...n, examples: examples ? n.examples : undefined }));
      const base = { ...collection, children: strip(collection.children) };
      const safe = keep ? { collection: base, environments: chosenEnvs } : blankValues(base, chosenEnvs, s.environments.map((e) => e.variables)) /* every environment: any of them may link a secret-named variable to a collection value */;
      const written: string[] = [baseName(path)];
      if (format === "void") {
        await writeTextFile(path, exportNative([safe.collection], safe.environments));
      } else if (format === "postman") {
        await writeTextFile(path, exportPostman(safe.collection, { examples }));
        // Postman keeps environments in files of their own: written beside the collection
        const dir = path.slice(0, path.length - baseName(path).length);
        for (const e of safe.environments) {
          const p = `${dir}${fileStem(e.name)}.postman_environment.json`;
          await writeTextFile(p, exportPostmanEnv(e));
          written.push(baseName(p));
        }
      } else {
        // variables are filled in: the active environment over the collection's own; Blank empties only secret-looking ones
        // and the ones a request uses as a credential, since an address cannot be filled in from an empty value
        const scope = buildScope(safe.collection.variables, keep ? active?.variables : blankHarEnv(base, active?.variables ?? []));
        await writeTextFile(path, exportHar(safe.collection, scope, await getVersion().catch(() => "")).text);
      }
      s.notify(`Exported “${collection.name}” to ${written.join(", ")}`);
      onClose();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog xf" role="dialog" aria-modal="true" aria-labelledby="xf-exp">
        <div className="xf-head">
          <h3 id="xf-exp">Export {collection.name}</h3>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X {...ico} />
          </button>
        </div>
        <div className="xf-body">
          <div className="xf-fmts" role="radiogroup" aria-label="Format">
            {FORMATS.map((f) => (
              <label key={f.id} className="xf-fmt">
                <input type="radio" name="xf-fmt" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} />
                <b>{f.title}</b>
                <span className="desc">{f.desc}</span>
                <code>.{f.ext}</code>
              </label>
            ))}
          </div>
          {format !== "void" && left > 0 && (
            <div className="xf-warn">
              <TriangleAlert {...ico} />
              <span>
                {leftLabel} can't be written to {format === "har" ? "HAR" : "Postman v2.1"} and {left === 1 ? "is" : "are"} left out.
                {format === "har" && active && ` Variables are filled in from ${active.name}.`}
              </span>
            </div>
          )}
          {format === "har" && !left && (
            <div className="xf-warn">
              <TriangleAlert {...ico} />
              <span>Environments are not part of HAR: variables are filled in from {active ? active.name : "the collection"}.</span>
            </div>
          )}
          <div className="set-list xf-opts xf-opts-full">
            {format !== "har" && (
              <div className="set-item">
                <div className="set-text">
                  <span className="set-label">Environments</span>
                  <span className="desc">{format === "postman" ? "Written as files beside the collection" : "Collection variables always go along"}</span>
                </div>
                <div className="seg" role="group" aria-label="Environments">
                  <button type="button" aria-pressed={envs === "none"} onClick={() => setEnvs("none")}>
                    None
                  </button>
                  {active && (
                    <button type="button" aria-pressed={envs === "active"} onClick={() => setEnvs("active")}>
                      {active.name}
                    </button>
                  )}
                  {s.environments.length > (active ? 1 : 0) && (
                    <button type="button" aria-pressed={envs === "all"} onClick={() => setEnvs("all")}>
                      All {s.environments.length}
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="set-item">
              <div className="set-text">
                <span className="set-label">Variable values</span>
                <span className="desc">{keep ? "Values go along as they are" : "Names are kept, values are emptied"}</span>
              </div>
              <div className="seg" role="group" aria-label="Variable values">
                <button type="button" aria-pressed={!keep} onClick={() => setKeep(false)}>
                  Blank
                </button>
                <button type="button" aria-pressed={keep} onClick={() => setKeep(true)}>
                  Keep
                </button>
              </div>
            </div>
            <div className="set-item">
              <div className="set-text">
                <label className="set-label" htmlFor="xf-exx">
                  Saved examples
                </label>
                <span className="desc">
                  {exampleCount ? `${plural(exampleCount, "example")}, already masked when saved` : "None saved in this collection"}
                </span>
              </div>
              <input id="xf-exx" type="checkbox" className="switch" checked={examples} disabled={!exampleCount} onChange={(e) => setExamples(e.target.checked)} />
            </div>
          </div>
          {keep && (
            <div className="xf-warn">
              <TriangleAlert {...ico} />
              <span>Values can hold tokens and passwords. Share this file only with people who may see them.</span>
            </div>
          )}
          {error && (
            <p className="xf-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="xf-foot">
          <span className="note">
            <code>{fileName}</code>
          </span>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={busy} aria-busy={busy} onClick={run}>
            Export…
          </button>
        </div>
      </div>
    </div>
  );
}
