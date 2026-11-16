// Dev or release: `bun tauri dev` runs on the Vite dev server, every other build is treated as a release.
// Dev builds say so in the title strip, About and Settings > Updates, and never check for updates,
// so they are not mistaken for (or replaced by) the release downloaded from GitHub.

export interface DevBuild {
  /** short commit, e.g. 8b686a8 */
  sha: string;
  /** uncommitted changes when the dev server started */
  dirty: boolean;
  branch: string;
  /** `git describe --tags --always --dirty=+`, e.g. v0.1.6-12-g8b686a8+ */
  describe: string;
  /** newest tag reachable from HEAD, e.g. v0.1.6 */
  tag: string;
  /** commits after that tag */
  ahead: number;
  /** when the dev server started, ms */
  startedAt: number;
}

/** set by vite.config.ts: the git state for a dev build, null in a release build */
declare const __DEV_BUILD__: DevBuild | null;

/** The dev build's details, or null in a release build. */
export const DEV_BUILD: DevBuild | null = import.meta.env.DEV
  ? (__DEV_BUILD__ ?? { sha: "", dirty: false, branch: "", describe: "", tag: "", ahead: 0, startedAt: Date.now() })
  : null;
