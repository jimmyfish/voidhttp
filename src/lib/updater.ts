// In-app updates: reads latest.json from the newest published GitHub release
// (plugins.updater.endpoints in tauri.conf.json), downloads the signed .app.tar.gz,
// verifies it against plugins.updater.pubkey, replaces the installed app and relaunches.
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export const RELEASES_URL = "https://github.com/jimmyfish/voidhttp/releases";

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "current" }
  | { kind: "available"; version: string; current: string; notes?: string; date?: string }
  | { kind: "downloading"; version: string; received: number; total?: number }
  | { kind: "installing"; version: string }
  | { kind: "ready"; version: string }
  | { kind: "error"; message: string };

let pending: Update | null = null;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Asks the update endpoint whether a newer version exists. */
export async function checkForUpdate(): Promise<UpdateState> {
  try {
    const update = await check({ timeout: 30_000 });
    pending = update;
    if (!update) return { kind: "current" };
    return {
      kind: "available",
      version: update.version,
      current: update.currentVersion,
      notes: update.body,
      date: update.date,
    };
  } catch (e) {
    pending = null;
    return { kind: "error", message: message(e) };
  }
}

/** Whether checkForUpdate() left an update that installUpdate() can retry. */
export const hasPendingUpdate = () => pending !== null;

/**
 * Downloads and installs the update found by the last checkForUpdate(), reporting
 * progress through `onState`. Resolves with "ready": call restartToUpdate() then.
 */
export async function installUpdate(onState: (s: UpdateState) => void): Promise<UpdateState> {
  const update = pending;
  if (!update) return { kind: "error", message: "No update to install. Check for updates first." };
  const version = update.version;
  let received = 0;
  let total: number | undefined;
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength;
        onState({ kind: "downloading", version, received, total });
      } else if (event.event === "Progress") {
        received += event.data.chunkLength;
        onState({ kind: "downloading", version, received, total });
      } else if (event.event === "Finished") {
        onState({ kind: "installing", version });
      }
    });
    pending = null;
    return { kind: "ready", version };
  } catch (e) {
    return { kind: "error", message: message(e) };
  }
}

export function restartToUpdate(): Promise<void> {
  return relaunch();
}

/** "2026-11-20 11:05:04.0 +00:00:00" (the manifest's pub_date as the plugin passes it) → "20 Nov 2026". */
export function releaseDate(date?: string): string | undefined {
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Release notes as list lines: markdown bullets and headings lose their markers, blank lines go. */
export function noteLines(notes?: string): string[] {
  return (notes ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*+]|\d+\.|#{1,6})\s+/, "").replace(/\*\*|__|`/g, "").trim())
    .filter(Boolean);
}

export const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
