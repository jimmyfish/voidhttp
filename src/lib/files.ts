/** Files for import and export: picked with the native dialogs, read and written by the Rust side. */
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { Source } from "./formats/common";

export const IMPORT_EXTENSIONS = ["json", "yaml", "yml", "har"];

export const readTextFile = (path: string) => invoke<string>("read_text_file", { path });
export const writeTextFile = (path: string, contents: string) => invoke<void>("write_text_file", { path, contents });

export const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** Reads a file into an import source, keeping its path so `$ref` files beside it can be found. */
export async function sourceFromPath(path: string): Promise<Source> {
  return { name: baseName(path), path, text: await readTextFile(path) };
}

/** The native open dialog for one import file; null when cancelled. */
export async function pickImportFile(): Promise<Source | null> {
  const picked = await open({ multiple: false, filters: [{ name: "Postman, OpenAPI, Swagger, HAR, voidHTTP", extensions: IMPORT_EXTENSIONS }] });
  return typeof picked === "string" ? sourceFromPath(picked) : null;
}

/** The native save dialog; null when cancelled. */
export async function pickSavePath(defaultName: string, ext: string, label: string): Promise<string | null> {
  return save({ defaultPath: defaultName, filters: [{ name: label, extensions: [ext] }] });
}
