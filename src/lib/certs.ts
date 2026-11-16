/**
 * Settings > Certificates: CA certificates trusted on top of the public CAs (self-signed and
 * company-CA dev servers) and client certificates for mutual TLS. The settings keep file paths only;
 * the Rust side (src-tauri/src/certs.rs) reads the files and builds the TLS setup that HTTP,
 * WebSocket and gRPC all use. Passphrases go to the macOS Keychain through the commands below.
 */
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";
import { useStore } from "../store";
import type { CertSettings, ClientCert } from "../types";

export interface CertSummary {
  /** common name, else organisation, else the whole subject */
  name: string;
  /** unix seconds */
  notAfter: number;
  selfSigned: boolean;
  isCa: boolean;
}

/** What a file holds, or why it can't be used. */
export interface FileInfo {
  certs: CertSummary[];
  error?: string | null;
}

const toRust = (c: ClientCert) => ({ ...c, port: c.port ?? null, cert: c.cert ?? "", key: c.key ?? "", pfx: c.pfx ?? "" });

async function apply(s?: CertSettings) {
  try {
    await invoke("certs_configure", {
      config: { caEnabled: !!s?.caEnabled, caFiles: s?.caFiles ?? [], clients: (s?.clients ?? []).map(toRust) },
    });
  } catch (e) {
    console.error("Certificate settings were not applied", e);
  }
}

/** Sends Settings > Certificates to Rust once the workspace has loaded, then after each change. */
export function useCerts() {
  const loaded = useStore((s) => s.loaded);
  const certs = useStore((s) => s.settings.certs);
  const first = useRef(true);
  useEffect(() => {
    if (!loaded) return;
    if (first.current) {
      first.current = false;
      void apply(certs);
      return;
    }
    const t = setTimeout(() => void apply(certs), 300);
    return () => clearTimeout(t);
  }, [loaded, certs]);
}

const failed = (e: unknown): FileInfo => ({ certs: [], error: String(e) });

export const inspectCa = (path: string) => invoke<FileInfo>("certs_inspect_ca", { path }).catch(failed);

/** Reads a client certificate the way a request would, Keychain passphrase included. */
export const inspectClient = (client: ClientCert) => invoke<FileInfo>("certs_inspect_client", { client: toRust(client) }).catch(failed);

/** Saves the passphrase in the Keychain; empty or missing forgets it. */
export const setPassphrase = (id: string, passphrase?: string) => invoke<void>("certs_set_passphrase", { id, passphrase: passphrase || null });

export const hasPassphrase = (id: string) => invoke<boolean>("certs_has_passphrase", { id }).catch(() => false);

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "until 14 Feb 2029", or "expired 2 Mar 2026" with expired set; the soonest expiry of the file counts. */
export function expiry(certs: CertSummary[]): { text: string; expired: boolean } | null {
  if (!certs.length) return null;
  const soonest = Math.min(...certs.map((c) => c.notAfter));
  const expired = soonest * 1000 < Date.now();
  return { text: `${expired ? "expired" : "until"} ${DATE.format(new Date(soonest * 1000))}`, expired };
}

/** The line beside a CA file: "Amarbank Dev Root CA · 2 certificates · until 3 Jan 2031". */
export function caLine(info: FileInfo): { text: string; expired: boolean } {
  const first = info.certs[0];
  const parts = [first.name];
  if (info.certs.length > 1) parts.push(`${info.certs.length} certificates`);
  else if (first.selfSigned && !first.isCa) parts.push("self-signed");
  const e = expiry(info.certs);
  if (e) parts.push(e.text);
  return { text: parts.join(" · "), expired: !!e?.expired };
}

/** api.partner.dev:8443, or the bare host when any port matches. */
export const hostLabel = (c: Pick<ClientCert, "host" | "port">) => (c.port ? `${c.host}:${c.port}` : c.host);

/** /Users/me/certs/a.pem → ~/certs/a.pem */
export const tildePath = (p: string) => p.replace(/^\/Users\/[^/]+/, "~");

export const fileName = (p: string) => p.slice(p.lastIndexOf("/") + 1);
