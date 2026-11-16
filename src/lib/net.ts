/**
 * Settings > Network: secure DNS (DNS over HTTPS), an optional proxy and the connection check.
 * The settings live with the others in the workspace; the Rust side (src-tauri/src/net.rs) holds
 * the live setup that HTTP, WebSocket and gRPC requests all go through.
 */
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useStore } from "../store";
import type { NetSettings } from "../types";

export const DNS_PROVIDERS = [
  { id: "cloudflare", name: "Cloudflare (1.1.1.1)" },
  { id: "google", name: "Google (8.8.8.8)" },
  { id: "quad9", name: "Quad9 (9.9.9.9)" },
  { id: "adguard", name: "AdGuard" },
  { id: "custom", name: "Custom…" },
] as const;

/** Everything off: hostnames go to the Mac's resolver, connections are direct. */
export const DEFAULT_NET: Required<NetSettings> = {
  secureDns: false,
  provider: "cloudflare",
  dohUrl: "",
  fallback: true,
  systemDomains: "",
  proxy: "none",
  proxyAddr: "127.0.0.1:40000",
  proxySkip: "",
};

export function netSettings(s?: NetSettings): Required<NetSettings> {
  return { ...DEFAULT_NET, ...s };
}

// what could not be turned on (bad custom URL, bad proxy address), shown in Settings
let problems: string[] = [];
const listeners = new Set<() => void>();
const setProblems = (p: string[]) => {
  problems = p;
  listeners.forEach((l) => l());
};

export function useNetProblems(): string[] {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => problems,
  );
}

async function apply(s?: NetSettings) {
  const n = netSettings(s);
  try {
    setProblems(
      await invoke<string[]>("net_configure", {
        config: { ...n, proxy: n.proxy === "none" ? "" : n.proxy },
      }),
    );
  } catch (e) {
    setProblems([`Network settings were not applied: ${e}`]);
  }
}

/** Sends Settings > Network to Rust once the workspace has loaded, then after each change (typing settles first). */
export function useNetwork() {
  const loaded = useStore((s) => s.loaded);
  const network = useStore((s) => s.settings.network);
  const first = useRef(true);
  useEffect(() => {
    if (!loaded) return;
    if (first.current) {
      first.current = false;
      void apply(network);
      return;
    }
    const t = setTimeout(() => void apply(network), 400);
    return () => clearTimeout(t);
  }, [loaded, network]);
}

export interface NetStep {
  name: string;
  ok: boolean;
  detail: string;
}

export interface NetCheck {
  ok: boolean;
  ms: number;
  steps: NetStep[];
  hint?: string | null;
}

/** Looks up, connects to and (for https) shakes hands with a host using the settings on screen
 * (applied first, so an edit still waiting out the typing pause counts). */
export async function checkHost(host: string): Promise<NetCheck> {
  await apply(useStore.getState().settings.network);
  return invoke<NetCheck>("net_test", { host });
}
