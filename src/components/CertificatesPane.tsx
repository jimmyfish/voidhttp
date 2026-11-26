import "./CertificatesPane.css";
/**
 * Settings > Certificates: CA certificates trusted on top of the public CAs, and client certificates
 * (mutual TLS) per host. Each row shows what the file holds, read by Rust, or why it can't be used.
 * See src/lib/certs.ts and src-tauri/src/certs.rs.
 */
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import type { CertSettings, ClientCert } from "../types";
import { uid } from "../lib/model";
import { caLine, expiry, fileName, hasPassphrase, hostLabel, inspectCa, inspectClient, setPassphrase, tildePath, type FileInfo } from "../lib/certs";
import { Ellipsis, FileBadge, FileUp, KeyRound, Pencil, Plus, Trash2, TriangleAlert, X, ico } from "./Icon";
import { RowMenu, openAtPointer, type MenuState } from "./RowMenu";

const CERT_FILES = [{ name: "Certificates", extensions: ["pem", "crt", "cer", "der"] }];
const KEY_FILES = [{ name: "Private keys", extensions: ["key", "pem"] }];
const PFX_FILES = [{ name: "PKCS #12", extensions: ["pfx", "p12"] }];

async function pickOne(filters: { name: string; extensions: string[] }[]): Promise<string | null> {
  const picked = await open({ multiple: false, filters });
  return typeof picked === "string" ? picked : null;
}

export function CertificatesPane({ onOpenRequests }: { onOpenRequests: () => void }) {
  const raw = useStore((s) => s.settings.certs);
  const insecure = useStore((s) => s.settings.insecure);
  const setSettings = useStore((s) => s.setSettings);
  const set = (patch: Partial<CertSettings>) => setSettings({ certs: { ...useStore.getState().settings.certs, ...patch } });
  const caEnabled = !!raw?.caEnabled;
  const caFiles = raw?.caFiles ?? [];
  const clients = raw?.clients ?? [];

  // what each CA file holds, read again whenever the list changes
  const [caInfo, setCaInfo] = useState<Record<string, FileInfo>>({});
  const caKey = caFiles.join("\n");
  useEffect(() => {
    let live = true;
    Promise.all(caFiles.map(async (f) => [f, await inspectCa(f)] as const)).then((all) => live && setCaInfo(Object.fromEntries(all)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caKey]);

  const addCa = async () => {
    const picked = await open({ multiple: true, filters: CERT_FILES });
    const list = (Array.isArray(picked) ? picked : picked ? [picked] : []).filter((f) => !caFiles.includes(f));
    if (list.length) set({ caEnabled: true, caFiles: [...caFiles, ...list] });
  };

  // null: no form; "new": adding; otherwise the id being edited
  const [editing, setEditing] = useState<string | null>(null);
  const saveClient = (c: ClientCert) => {
    const exists = clients.some((x) => x.id === c.id);
    set({ clients: exists ? clients.map((x) => (x.id === c.id ? c : x)) : [...clients, c] });
    setEditing(null);
  };
  const removeClient = (c: ClientCert) => {
    void setPassphrase(c.id).catch(() => {});
    set({ clients: clients.filter((x) => x.id !== c.id) });
  };

  return (
    <div className="set-pane">
      <h4>Certificates</h4>
      {insecure && (
        <p className="set-notice" role="note">
          <TriangleAlert {...ico} />
          <span>
            <b>Skip TLS verification</b> is on in{" "}
            <button type="button" className="link" onClick={onOpenRequests}>
              Requests
            </button>
            , so every server certificate is accepted and the CA list is not checked. Client certificates are still sent.
          </span>
        </p>
      )}

      <div className="set-group">CA certificates</div>
      <div className="set-list">
        <div className="set-item">
          <div className="set-text">
            <label htmlFor="set-ca">Trust custom CA certificates</label>
            <span className="desc">For dev servers with a self-signed or company certificate. Trusted on top of the public CAs.</span>
          </div>
          <div className="set-ctl">
            <input id="set-ca" className="switch" type="checkbox" role="switch" checked={caEnabled} onChange={(e) => set({ caEnabled: e.target.checked })} />
          </div>
        </div>
        {caEnabled && (
          <>
            {caFiles.map((f) => (
              <CaRow key={f} path={f} info={caInfo[f]} onRemove={() => set({ caFiles: caFiles.filter((x) => x !== f) })} />
            ))}
            <div className="set-item set-item--sub cert-add">
              <button type="button" className="btn" onClick={addCa}>
                <FileUp {...ico} />
                Add .pem file
              </button>
              <span className="hint">
                The server's or its CA's certificate (<code>BEGIN CERTIFICATE</code>), never a private key
              </span>
            </div>
          </>
        )}
      </div>

      <div className="set-group">Client certificates</div>
      <div className="set-list">
        {clients.map((c) =>
          editing === c.id ? (
            <ClientForm key={c.id} initial={c} onCancel={() => setEditing(null)} onSave={saveClient} />
          ) : (
            <ClientRow key={c.id} client={c} onEdit={() => setEditing(c.id)} onRemove={() => removeClient(c)} />
          ),
        )}
        {editing === "new" ? (
          <ClientForm onCancel={() => setEditing(null)} onSave={saveClient} />
        ) : (
          <div className="set-item cert-add">
            <button type="button" className="btn" onClick={() => setEditing("new")}>
              <Plus {...ico} />
              Add certificate
            </button>
            <span className="hint">Sent when a server asks for one (mutual TLS), matched by host and port</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CaRow({ path, info, onRemove }: { path: string; info?: FileInfo; onRemove: () => void }) {
  const name = fileName(path);
  const remove = (
    <button type="button" className="icon-btn row-del" aria-label={`Remove ${name}`} onClick={onRemove}>
      <X {...ico} />
    </button>
  );
  if (info?.error || (info && !info.certs.length)) {
    return (
      <div className="set-item set-item--sub cert-row">
        <div className="cert-file">
          <div className="file-row" title={path}>
            <TriangleAlert {...ico} className="ico bad" />
            <code>{name}</code>
            <span className="dim bad">not used</span>
          </div>
          <span className="why">{info.error ?? "No certificate in this file"}</span>
        </div>
        {remove}
      </div>
    );
  }
  const line = info ? caLine(info) : null;
  return (
    <div className="set-item set-item--sub cert-row">
      <div className="file-row" title={tildePath(path)}>
        <FileBadge {...ico} />
        <code>{name}</code>
        <span className={line?.expired ? "dim warn" : "dim"}>{line?.text ?? tildePath(path)}</span>
      </div>
      {remove}
    </div>
  );
}

function ClientRow({ client, onEdit, onRemove }: { client: ClientCert; onEdit: () => void; onRemove: () => void }) {
  const [info, setInfo] = useState<FileInfo | null>(null);
  const [menu, setMenu] = useState<MenuState>(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const key = JSON.stringify(client);
  useEffect(() => {
    let live = true;
    setInfo(null);
    inspectClient(client).then((i) => live && setInfo(i));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const label = hostLabel(client);
  const kind = client.format === "pfx" ? "PFX" : "CRT + KEY";
  const cert = info?.certs[0];
  const exp = info ? expiry(info.certs) : null;
  const line = [kind, cert?.name, exp?.text].filter(Boolean).join(" · ");
  const error = info?.error;
  return (
    <div className="set-item cert-row" onContextMenu={openAtPointer(setMenu)}>
      <div className="cert-file">
        <div className="file-row" title={label}>
          {error ? <TriangleAlert {...ico} className="ico bad" /> : <KeyRound {...ico} />}
          <code>{label}</code>
          <span className={error ? "dim bad" : exp?.expired ? "dim warn" : "dim"}>{error ? `${kind} · not used` : line}</span>
        </div>
        {error && <span className="why">{error}</span>}
      </div>
      <button
        ref={moreRef}
        type="button"
        className="icon-btn row-more"
        aria-label={`More actions for ${label}`}
        aria-haspopup="menu"
        title="More actions"
        onClick={() => setMenu((m) => !m)}
      >
        <Ellipsis {...ico} />
      </button>
      {menu && (
        <RowMenu
          anchor={moreRef}
          at={menu}
          label={`${label} actions`}
          onClose={() => setMenu(false)}
          items={[
            { label: "Edit", icon: <Pencil {...ico} />, run: onEdit },
            "sep",
            { label: "Remove", icon: <Trash2 {...ico} />, run: onRemove, danger: true },
          ]}
        />
      )}
    </div>
  );
}

function FilePick({ id, path, filters, onPick }: { id: string; path?: string; filters: typeof CERT_FILES; onPick: (p: string) => void }) {
  const Icon = /\.(key|p12|pfx)$/i.test(path ?? "") ? KeyRound : FileBadge;
  return (
    <button type="button" id={id} className="btn cert-pick" title={path ? tildePath(path) : undefined} onClick={async () => {
      const p = await pickOne(filters);
      if (p) onPick(p);
    }}>
      <Icon {...ico} />
      {path ? <span>{tildePath(path)}</span> : <span className="placeholder">Choose file…</span>}
    </button>
  );
}

/** Add or edit a client certificate, inline in the list. The passphrase goes to the Keychain on save. */
function ClientForm({ initial, onCancel, onSave }: { initial?: ClientCert; onCancel: () => void; onSave: (c: ClientCert) => void }) {
  const [host, setHost] = useState(initial?.host ?? "");
  const [port, setPort] = useState(initial?.port ? String(initial.port) : initial ? "" : "443");
  const [format, setFormat] = useState<ClientCert["format"]>(initial?.format ?? "pem");
  const [cert, setCert] = useState(initial?.cert ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const [pfx, setPfx] = useState(initial?.pfx ?? "");
  const [pass, setPass] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (initial) hasPassphrase(initial.id).then(setSaved);
  }, [initial]);

  const portNum = port.trim() ? Number(port) : undefined;
  const portOk = portNum === undefined || (Number.isInteger(portNum) && portNum > 0 && portNum < 65536);
  const ready = host.trim() !== "" && portOk && (format === "pfx" ? pfx !== "" : cert !== "");

  const save = async () => {
    if (!ready) return;
    const id = initial?.id ?? uid();
    try {
      if (pass) await setPassphrase(id, pass);
    } catch (e) {
      setError(String(e));
      return;
    }
    onSave({
      id,
      host: host.trim().toLowerCase(),
      port: portNum,
      format,
      ...(format === "pfx" ? { pfx } : { cert, key: key || undefined }),
    });
  };
  const passPlaceholder = saved ? "Saved in Keychain" : "None";

  return (
    <>
      <div className="set-item cert-form">
        <span className="cert-form-head">{initial ? `Edit ${hostLabel(initial)}` : "New client certificate"}</span>
      </div>
      <div className="set-item set-item--sub cert-form">
        <div className="set-text">
          <label htmlFor="cc-host">Host</label>
          <span className="desc">
            <code>*.example.com</code> covers its subdomains. Leave the port empty for any port.
          </span>
        </div>
        <div className="set-ctl">
          <span className="cert-host">
            <input id="cc-host" className="field" value={host} spellCheck={false} autoFocus placeholder="api.example.com" onChange={(e) => setHost(e.target.value)} />
            <span className="sep">:</span>
            <input
              className="field cert-port"
              value={port}
              inputMode="numeric"
              aria-label="Port"
              aria-invalid={!portOk}
              placeholder="any"
              onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))}
            />
          </span>
        </div>
      </div>
      <div className="set-item set-item--sub cert-form">
        <div className="set-text">
          <span className="set-label">
            <span id="cc-format">Format</span>
          </span>
        </div>
        <div className="set-ctl">
          <div className="seg seg--lg" role="group" aria-labelledby="cc-format">
            <button type="button" aria-pressed={format === "pem"} onClick={() => setFormat("pem")}>
              CRT + KEY
            </button>
            <button type="button" aria-pressed={format === "pfx"} onClick={() => setFormat("pfx")}>
              PFX
            </button>
          </div>
        </div>
      </div>
      {format === "pfx" ? (
        <div className="set-item set-item--sub cert-form">
          <div className="set-text">
            <label htmlFor="cc-pfx">PFX file</label>
            <span className="desc">.pfx or .p12, certificate and key together</span>
          </div>
          <div className="set-ctl">
            <FilePick id="cc-pfx" path={pfx} filters={PFX_FILES} onPick={setPfx} />
          </div>
        </div>
      ) : (
        <>
          <div className="set-item set-item--sub cert-form">
            <div className="set-text">
              <label htmlFor="cc-cert">Certificate</label>
              <span className="desc">.crt or .pem</span>
            </div>
            <div className="set-ctl">
              <FilePick id="cc-cert" path={cert} filters={CERT_FILES} onPick={setCert} />
            </div>
          </div>
          <div className="set-item set-item--sub cert-form">
            <div className="set-text">
              <label htmlFor="cc-key">Private key</label>
              <span className="desc">.key or .pem. Skip it when the certificate file holds the key too.</span>
            </div>
            <div className="set-ctl">
              <FilePick id="cc-key" path={key} filters={KEY_FILES} onPick={setKey} />
            </div>
          </div>
        </>
      )}
      <div className="set-item set-item--sub cert-form">
        <div className="set-text">
          <label htmlFor="cc-pass">Passphrase</label>
          <span className="desc">
            {format === "pfx" ? "Unlocks the .pfx file." : "Only if the key file is encrypted."} Saved in the macOS Keychain, not in the workspace.
          </span>
        </div>
        <div className="set-ctl">
          <input
            id="cc-pass"
            className="field cert-pass"
            type="password"
            value={pass}
            placeholder={passPlaceholder}
            autoComplete="off"
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void save()}
          />
        </div>
      </div>
      {error && (
        <p className="set-problem" role="alert">
          <TriangleAlert {...ico} />
          {error}
        </p>
      )}
      <div className="set-item cert-form cert-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" disabled={!ready} onClick={() => void save()}>
          {initial ? "Save" : "Add"}
        </button>
      </div>
    </>
  );
}
