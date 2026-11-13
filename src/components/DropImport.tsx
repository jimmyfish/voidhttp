import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useStore } from "../store";
import { FileUp } from "./Icon";
import { sourceFromPath } from "../lib/files";

/**
 * A file dragged over the window shows where it will go; dropping it opens Import with that file.
 * Tauri hands over the dropped paths, so OpenAPI can also read the `$ref` files beside it.
 */
export function DropImport() {
  const [over, setOver] = useState(false);
  const project = useStore((s) => (s.view === "project" ? s.projects.find((p) => p.id === s.currentProjectId)?.name : undefined));

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let gone = false;
    getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (payload.type === "enter" || payload.type === "over") setOver(true);
        else if (payload.type === "leave") setOver(false);
        else if (payload.type === "drop") {
          setOver(false);
          const path = payload.paths[0];
          if (!path) return;
          const s = useStore.getState();
          sourceFromPath(path)
            .then((source) => s.openModal({ kind: "import", source }))
            .catch((e) => s.notify(`Import failed: ${e}`));
        }
      })
      .then((fn) => (gone ? fn() : (unlisten = fn)));
    return () => {
      gone = true;
      unlisten?.();
    };
  }, []);

  if (!over) return null;
  return (
    <div className="xf-dropover" aria-hidden="true">
      <FileUp size={40} strokeWidth={1.5} className="ico" />
      <strong>Drop to import{project ? ` into ${project}` : ""}</strong>
      <span>Postman · OpenAPI / Swagger · HAR · voidHTTP</span>
    </div>
  );
}
