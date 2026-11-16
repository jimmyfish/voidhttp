import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

const host = process.env.TAURI_DEV_HOST;

const git = (args: string) => {
  try {
    return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
};

/**
 * Where a dev build (`bun tauri dev`) comes from, shown in its title-strip pill, About and Settings > Updates.
 * Read once when the dev server starts. Release builds get null: they show nothing and stay as they are.
 */
const devBuild = () => {
  const tag = git("describe --tags --abbrev=0");
  // "+" marks changes to tracked files (untracked files don't count), the same rule as `git describe --dirty`
  const describe = git("describe --tags --always --dirty=+");
  return {
    sha: git("rev-parse --short HEAD"),
    dirty: describe.endsWith("+"),
    branch: git("rev-parse --abbrev-ref HEAD"),
    describe,
    tag,
    ahead: tag ? Number(git(`rev-list --count refs/tags/${tag}..HEAD`)) || 0 : 0,
    startedAt: Date.now(),
  };
};

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: { __DEV_BUILD__: JSON.stringify(command === "serve" ? devBuild() : null) },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "safari15",
    minify: "esbuild",
    sourcemap: false,
  },
}));
