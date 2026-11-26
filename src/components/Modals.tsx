import "./Modals.css";
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Select } from "./Select";
import { useStore, type PromptPlace, type SettingsSection } from "../store";
import type { Environment, KV } from "../types";
import { kv, listFolders, methodLabel, uid } from "../lib/model";
import { ExampleModal } from "./ExampleModal";
import { ImportModal } from "./ImportModal";
import { ExportModal } from "./ExportModal";
import { KVEditor } from "./KVEditor";
import { Ban, BookmarkPlus, Braces, Check, ChevronDown, ChevronRight, CircleAlert, CircleArrowDown, CircleCheck, CopyPlus, Ellipsis, ExternalLink, FileBadge, Folder, FolderPlus, HistoryIcon, Keyboard, LibraryBig, Network, Plus, Send, Settings as Gear, Trash2, TriangleAlert, Type, X, ico } from "./Icon";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useUpdates } from "../updates";
import { DEV_BUILD } from "../build";
import { BuildBadge } from "./BuildTag";
import { CertificatesPane } from "./CertificatesPane";
import { AboutModal } from "./AboutModal";
import { QuickOpen } from "./QuickOpen";
import { ShortcutsPane } from "./ShortcutsPane";
import { RELEASES_URL } from "../lib/updater";
import { ago } from "../lib/time";
import { RowMenu, openAtPointer, type MenuItem, type MenuState } from "./RowMenu";
import { CodeArea } from "./CodeArea";
import { formatVars, parseVars, type VarsFormat } from "../lib/varsFormat";
import { TAG_COLORS, envStyle, tagName, type TagColor } from "../lib/tags";
import { systemFonts } from "../lib/fonts";
import { DNS_PROVIDERS, checkHost, netSettings, useNetProblems, type NetCheck } from "../lib/net";
import type { NetSettings } from "../types";
import { BUILTIN, DEFAULT_SCHEME, FAMILIES, SCHEMES, schemeSwatch, type BuiltinId } from "../lib/themes";
import { PROJECT_COLORS, PROJECT_ICONS, ProjectTile, tileStyle } from "./ProjectIcon";

export function Modals() {
  const modal = useStore((s) => s.modal);
  const close = () => useStore.getState().openModal(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!modal) return null;
  switch (modal.kind) {
    case "prompt":
      return <PromptModal title={modal.title} initial={modal.initial} place={modal.place} onSubmit={(v) => (modal.onSubmit(v), close())} onClose={close} />;
    case "confirm":
      return (
        <Shell title={modal.title} sub={modal.message} tone="danger" icon={modal.icon === "history" ? <HistoryIcon {...ico} /> : <Trash2 {...ico} />} onClose={close}>
          <footer className="sh-foot">
            <button type="button" className="btn btn--quiet" onClick={close}>
              Cancel
            </button>
            <button type="button" className="btn btn--danger sh-danger" autoFocus onClick={() => (modal.onConfirm(), close())}>
              <Trash2 {...ico} />
              {modal.confirmLabel ?? "Delete"}
            </button>
          </footer>
        </Shell>
      );
    case "save":
      return <SaveModal tabId={modal.tabId} onClose={close} />;
    case "environments":
      return <VariablesModal onClose={close} select={modal.select} addVar={modal.addVar} />;
    case "settings":
      return <SettingsModal onClose={close} section={modal.section} />;
    case "quickopen":
      return <QuickOpen actions={modal.actions} onClose={close} />;
    case "about":
      return <AboutModal onClose={close} />;
    case "project":
      return <ProjectModal projectId={modal.projectId} onClose={close} />;
    case "import":
      return <ImportModal source={modal.source} onClose={close} />;
    case "export":
      return <ExportModal collectionId={modal.collectionId} onClose={close} />;
    case "example":
      return <ExampleModal request={modal.request} response={modal.response} target={modal.target} onClose={close} />;
  }
}

type Tone = "create" | "danger" | "plain";

/**
 * Every simple dialog: a header that says what it does (a tinted tile, the title, one line of context, close),
 * then the caller's `.sh-body` and `footer.sh-foot`. Escape and a click on the backdrop close it too.
 */
function Shell({
  title,
  sub,
  icon,
  tile,
  tone = "plain",
  onClose,
  children,
  wide,
}: {
  title: string;
  sub?: ReactNode;
  icon?: ReactNode;
  /** replaces the tinted tile, e.g. the project's own tile */
  tile?: ReactNode;
  tone?: Tone;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog sh${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={`${id}t`} aria-describedby={sub ? `${id}s` : undefined}>
        <div className="sh-head">
          {tile ?? <span className={`sh-tile sh-tile--${tone}`}>{icon}</span>}
          <div className="sh-title">
            <h3 id={`${id}t`}>{title}</h3>
            {sub && (
              <p className="sh-sub" id={`${id}s`}>
                {sub}
              </p>
            )}
          </div>
          <button type="button" className="icon-btn sh-close" aria-label="Close" title="Close" onClick={onClose}>
            <X {...ico} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** "In orders-api / refunds": a lead word, then names joined by slashes. */
function Path({ lead, parts }: { lead: string; parts: string[] }) {
  return (
    <>
      {lead}
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="sep">/</span>}
          <b>{p}</b>
        </Fragment>
      ))}
    </>
  );
}

/** Where a prompt's new item lands, drawn with the sidebar's own rows: the parent, the new row, what is already there. */
function PlaceTree({ place, name, clash }: { place: PromptPlace; name: string; clash?: string }) {
  const folder = place.kind === "folder";
  const indent = { "--indent": folder ? "16px" : "0px" } as React.CSSProperties;
  const shown = place.taken.slice(0, 4);
  if (clash && !shown.includes(clash)) shown.splice(Math.max(0, shown.length - 1), 1, clash);
  const more = place.taken.length - shown.length;
  const glyph = folder ? <Folder {...ico} className="ico folder" /> : null;
  const parent = place.path[place.path.length - 1];
  return (
    <div className="sh-tree" aria-hidden="true">
      {folder && (
        <div className={`row${place.path.length === 1 ? " collection" : ""}`}>
          <div className="row-main">
            <ChevronDown {...ico} className="ico caret" />
            {place.path.length > 1 && <Folder {...ico} className="ico folder" />}
            <span className="name">{parent}</span>
          </div>
        </div>
      )}
      <div className={`row sh-ghost${folder ? "" : " collection"}${name ? "" : " is-empty"}${clash ? " is-dupe" : ""}`} style={indent}>
        <div className="row-main">
          <ChevronRight {...ico} className="ico caret" />
          {glyph}
          <span className="name">{name || (folder ? "Refunds" : "payments-service")}</span>
        </div>
      </div>
      {shown.map((t) => (
        <div key={t} className={`row sh-sib${folder ? "" : " collection"}${t === clash ? " sh-dupe" : ""}`} style={indent}>
          <div className="row-main">
            <ChevronRight {...ico} className="ico caret" />
            {glyph}
            <span className="name">{t}</span>
            {t === clash && <span className="sh-tag">Already here</span>}
          </div>
        </div>
      ))}
      {more > 0 && (
        <p className="sh-more" style={indent}>
          {more} more
        </p>
      )}
    </div>
  );
}

function PromptModal({
  title,
  initial,
  place,
  onSubmit,
  onClose,
}: {
  title: string;
  initial: string;
  place?: PromptPlace;
  onSubmit: (v: string) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(initial);
  const id = useId();
  const name = v.trim();
  const clash = place && name ? place.taken.find((t) => t.toLowerCase() === name.toLowerCase()) : undefined;
  const ok = !!name && !clash;
  const folder = place?.kind === "folder";
  const Glyph = folder ? Folder : LibraryBig;
  const owner = place ? (folder ? place.path[place.path.length - 1] : place.path[0]) : "";
  return (
    <Shell
      title={title}
      tone="create"
      icon={folder ? <FolderPlus {...ico} /> : <LibraryBig {...ico} />}
      sub={place && <Path lead={folder ? "In" : "In project"} parts={place.path} />}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onSubmit(name);
        }}
      >
        <div className="sh-body">
          <label className="sh-label" htmlFor={`${id}n`}>
            Name
          </label>
          <div className="sh-field">
            <Glyph {...ico} />
            <input
              id={`${id}n`}
              className="field sh-input"
              autoFocus
              value={v}
              placeholder={folder ? "e.g. Refunds" : "e.g. payments-service"}
              aria-invalid={clash ? true : undefined}
              aria-describedby={clash ? `${id}e` : undefined}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setV(e.target.value)}
            />
          </div>
          {clash && (
            <p className="sh-err" id={`${id}e`}>
              <CircleAlert {...ico} />
              {owner} already has {folder ? "a folder" : "a collection"} named {clash}.
            </p>
          )}
          {place && <PlaceTree place={place} name={name} clash={clash} />}
        </div>
        <footer className="sh-foot">
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!ok}>
            <Plus {...ico} />
            {folder ? "Create folder" : place ? "Create collection" : "Create"}
          </button>
        </footer>
      </form>
    </Shell>
  );
}

function SaveModal({ tabId, onClose }: { tabId: string; onClose: () => void }) {
  const s = useStore.getState();
  const tab = s.tabs.find((t) => t.id === tabId);
  const [name, setName] = useState(tab?.request.name ?? "Untitled request");
  const [target, setTarget] = useState(() => {
    const c = s.collections[0];
    return c ? `${c.id}|` : "";
  });
  const [newCol, setNewCol] = useState("My collection");

  const submit = () => {
    if (!name.trim()) return;
    let [collectionId, parentId] = target.split("|");
    if (!collectionId) collectionId = s.createCollection(newCol.trim() || "My collection");
    s.saveTabAs(tabId, collectionId, parentId || null, name.trim());
    onClose();
  };

  return (
    <Shell
      title="Save request"
      tone="create"
      icon={<BookmarkPlus {...ico} />}
      sub={
        tab && (
          <>
            <span className={`m m-${tab.request.method}`}>{methodLabel(tab.request.method)}</span>
            <b>{tab.request.name || "Untitled request"}</b>
          </>
        )
      }
      onClose={onClose}
    >
      <div className="sh-body">
        <label>
          Name
          <input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </label>
        <label>
          Save to
          <Select className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
            {s.collections.map((c) => [
              <option key={c.id} value={`${c.id}|`}>
                {c.name}
              </option>,
              ...listFolders(c.children).map(({ folder, depth }) => (
                <option key={folder.id} value={`${c.id}|${folder.id}`}>
                  {"  ".repeat(depth + 1)}
                  {folder.name}
                </option>
              )),
            ])}
            <option value="">New collection…</option>
          </Select>
        </label>
        {target === "" && (
          <label>
            Collection name
            <input className="field" value={newCol} onChange={(e) => setNewCol(e.target.value)} />
          </label>
        )}
      </div>
      <footer className="sh-foot">
        <button type="button" className="btn btn--quiet" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" onClick={submit}>
          <Check {...ico} />
          Save
        </button>
      </footer>
    </Shell>
  );
}

/** Environments + collection variables, edited on a local draft and committed on Save. */
function VariablesModal({ onClose, select, addVar }: { onClose: () => void; select?: string; addVar?: string }) {
  const s = useStore.getState();
  const projectName = s.projects.find((p) => p.id === s.currentProjectId)?.name;
  // a variable added from the address bar lands in the draft, so Cancel drops it
  const withNew = (id: string, vars: KV[]) => (addVar && id === select ? [...vars, kv(addVar)] : vars);
  const [envs, setEnvs] = useState<Environment[]>(() =>
    structuredClone(s.environments).map((e) => ({ ...e, variables: withNew(e.id, e.variables) })),
  );
  const [colVars, setColVars] = useState<Record<string, KV[]>>(() =>
    Object.fromEntries(s.collections.map((c) => [c.id, withNew(c.id, structuredClone(c.variables))])),
  );
  const [sel, setSel] = useState<string>(select ?? s.activeEnvironmentId ?? envs[0]?.id ?? s.collections[0]?.id ?? "");
  const [format, setFormat] = useState<VarsFormat>(s.settings.variablesFormat ?? "table");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const env = envs.find((e) => e.id === sel);
  const col = s.collections.find((c) => c.id === sel);
  const rows = env ? env.variables : col ? (colVars[col.id] ?? []) : [];
  const setRows = (v: KV[]) => {
    if (env) setEnvs(envs.map((e) => (e.id === env.id ? { ...e, variables: v } : e)));
    else if (col) setColVars({ ...colVars, [col.id]: v });
  };

  // the text is written from the rows when the selection or the format changes, never while typing
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => {
    if (format !== "table") setText(formatVars(format, rowsRef.current));
    setError(null);
  }, [sel, format]);

  const onText = (t: string) => {
    setText(t);
    try {
      setRows(parseVars(format, t, rows));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const pickFormat = (f: VarsFormat) => {
    if (error) return; // fix the text first, so nothing typed is lost
    setFormat(f);
    s.setSettings({ variablesFormat: f });
  };

  const addEnv = () => {
    const e: Environment = { id: uid(), name: `Environment ${envs.length + 1}`, variables: [] };
    setEnvs([...envs, e]);
    setSel(e.id);
  };
  const duplicateEnv = (id: string) => {
    const i = envs.findIndex((e) => e.id === id);
    const src = envs[i];
    const copy: Environment = { id: uid(), name: `${src.name} copy`, color: src.color, variables: src.variables.map((v) => ({ ...v, id: uid() })) };
    setEnvs([...envs.slice(0, i + 1), copy, ...envs.slice(i + 1)]);
    setSel(copy.id);
  };
  const deleteEnv = (id: string) => {
    const i = envs.findIndex((e) => e.id === id);
    const rest = envs.filter((e) => e.id !== id);
    setEnvs(rest);
    if (sel === id) setSel(rest[Math.min(i, rest.length - 1)]?.id ?? s.collections[0]?.id ?? "");
  };

  const save = () => {
    s.setEnvironments(envs);
    for (const c of s.collections) if (colVars[c.id] !== c.variables) s.updateCollection(c.id, { variables: colVars[c.id] });
    onClose();
  };

  const editor =
    format === "table" ? (
      <KVEditor rows={rows} nameLabel="Variable" addLabel="Add a variable" onChange={setRows} />
    ) : (
      <>
        <div className="vars-code">
          <CodeArea
            value={text}
            onChange={onText}
            json={format === "json"}
            label={format === "json" ? "Variables as JSON" : "Variables as .env"}
            placeholder={format === "json" ? '{\n  "baseUrl": "https://api.example.com"\n}' : "baseUrl=https://api.example.com"}
          />
        </div>
        {error && (
          <p className="vars-error" role="alert">
            {error}
          </p>
        )}
      </>
    );

  return (
    <Shell title="Variables" sub={projectName} icon={<Braces {...ico} />} onClose={onClose} wide>
      <div className="sh-body">
        <div className="vars">
          <ul>
            <li className="group">
              Environments
              <button type="button" className="icon-btn" title="Add environment" aria-label="Add environment" onClick={addEnv}>
                <Plus {...ico} />
              </button>
            </li>
            {envs.map((e) => (
              <EnvItem
                key={e.id}
                env={e}
                current={sel === e.id}
                onSelect={() => !error && setSel(e.id)}
                onDuplicate={() => duplicateEnv(e.id)}
                onDelete={() => deleteEnv(e.id)}
              />
            ))}
            {s.collections.length > 0 && <li className="group">Collection variables</li>}
            {s.collections.map((c) => (
              <li key={c.id}>
                <button type="button" aria-current={sel === c.id} onClick={() => !error && setSel(c.id)}>
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
          <div className="vars-body">
            {(env || col) && (
              <>
                {env ? (
                  <div className="env-head">
                    <input
                      className="field"
                      aria-label="Environment name"
                      value={env.name}
                      onChange={(ev) => setEnvs(envs.map((x) => (x.id === env.id ? { ...x, name: ev.target.value } : x)))}
                    />
                    <EnvColor value={env.color} onChange={(color) => setEnvs(envs.map((x) => (x.id === env.id ? { ...x, color } : x)))} />
                  </div>
                ) : (
                  <p className="muted">
                    Used by requests saved in <b>{col!.name}</b>. Environment values override these.
                  </p>
                )}
                <div className="vars-tools">
                  <div className="seg" role="group" aria-label="Format">
                    {(["table", "json", "env"] as VarsFormat[]).map((f) => (
                      <button key={f} type="button" aria-pressed={format === f} disabled={!!error && format !== f} onClick={() => pickFormat(f)}>
                        {f === "table" ? "Table" : f === "json" ? "JSON" : ".env"}
                      </button>
                    ))}
                  </div>
                  {format === "json" && rows.some((r) => !r.enabled && r.key) && <span className="vars-hint">Disabled variables are kept, not shown</span>}
                  {format === "env" && <span className="vars-hint">Lines starting with # are disabled</span>}
                </div>
                {editor}
              </>
            )}
            {!env && !col && (
              <div className="empty">
                <strong>No environments yet</strong>
                <span>Add one to store variables like {"{{baseUrl}}"}.</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <footer className="sh-foot">
        <button type="button" className="btn btn--quiet" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" disabled={!!error} title={error ? "Fix the variables text first" : undefined} onClick={save}>
          <Check {...ico} />
          Save
        </button>
      </footer>
    </Shell>
  );
}

/** One environment in the Variables list, with its "…" menu (Duplicate, Delete). */
/** [ name ][ o ]: the colour button beside an environment's name, opening a popover of the tag colours. */
function EnvColor({ value, onChange }: { value?: TagColor; onChange: (c: TagColor | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation(); // close the popover, not the dialog
      setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc, true);
    };
  }, [open]);
  const pick = (c: TagColor | undefined) => {
    onChange(c);
    setOpen(false);
  };
  return (
    <div className="env-color" ref={wrap}>
      <button
        type="button"
        className="env-color-btn"
        title="Colour"
        aria-label={`Environment colour: ${tagName(value) ?? "none"}`}
        aria-haspopup="true"
        aria-expanded={open}
        style={envStyle(value)}
        onClick={() => setOpen(!open)}
      >
        {value ? <span className="env-dot" aria-hidden="true" /> : <Ban {...ico} className="ico env-none-ico" />}
      </button>
      {open && (
        <div className="env-color-pop" role="radiogroup" aria-label="Environment colour">
          {TAG_COLORS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="env-swatch"
              role="radio"
              aria-checked={value === t.id}
              aria-label={t.name}
              title={t.name}
              style={envStyle(t.id)}
              onClick={() => pick(t.id)}
            />
          ))}
          <button type="button" className="link" onClick={() => pick(undefined)}>
            No colour
          </button>
        </div>
      )}
    </div>
  );
}

function EnvItem({
  env,
  current,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  env: Environment;
  current: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const moreRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<MenuState>(false);
  const items: MenuItem[] = [
    { label: "Duplicate", icon: <CopyPlus {...ico} />, run: onDuplicate },
    "sep",
    { label: "Delete", icon: <Trash2 {...ico} />, run: onDelete, danger: true },
  ];
  return (
    <li className={`env-item${menu ? " menu-open" : ""}`} onContextMenu={openAtPointer(setMenu)}>
      <button type="button" aria-current={current} title={env.name} onClick={onSelect}>
        {env.color && <span className="env-dot" aria-hidden="true" style={envStyle(env.color)} />}
        {env.name}
      </button>
      <button
        ref={moreRef}
        type="button"
        className="icon-btn row-more"
        title="More actions"
        aria-label={`More actions for ${env.name}`}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={() => setMenu(!menu)}
      >
        <Ellipsis {...ico} />
      </button>
      {menu && <RowMenu anchor={moreRef} label={`${env.name} actions`} items={items} onClose={() => setMenu(false)} at={menu} />}
    </li>
  );
}

/** Fallback suggestions when the system font list is unavailable (browser dev build). */
const UI_FONTS = ["Inter", "SF Pro Text", "Helvetica Neue", "Avenir Next", "IBM Plex Sans", "Roboto", "Georgia"];
const MONO_FONTS = ["JetBrains Mono", "SF Mono", "Menlo", "Monaco", "Fira Code", "IBM Plex Mono", "Cascadia Code", "Courier New"];
const UI_SIZES = [12, 13, 14, 15, 16, 17, 18];
const CODE_SIZES = [11, 12, 13, 14, 15, 16];

/** The one app-wide settings dialog: appearance (theme, fonts), request defaults, network, certificates and updates. */
function SettingsModal({ onClose, section: initial }: { onClose: () => void; section?: SettingsSection }) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [section, setSection] = useState<SettingsSection>(initial ?? "appearance");
  // ⌘/ while Settings is open on another section moves it to Shortcuts
  useEffect(() => {
    if (initial) setSection(initial);
  }, [initial]);
  const theme = settings.theme ?? "auto";
  const [fonts, setFonts] = useState({ all: UI_FONTS, mono: MONO_FONTS });
  useEffect(() => {
    let live = true;
    systemFonts().then((f) => {
      if (live && f.all.length) setFonts({ all: f.all, mono: f.mono.length ? f.mono : MONO_FONTS });
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <Shell title="Settings" sub="Applies to every project" icon={<Gear {...ico} />} onClose={onClose} wide>
      <div className="sh-body sh-body--end">
        <div className="vars settings">
          <ul>
            <li>
              <button type="button" aria-current={section === "appearance"} onClick={() => setSection("appearance")}>
                <Type {...ico} />
                Appearance
              </button>
            </li>
            <li>
              <button type="button" aria-current={section === "requests"} onClick={() => setSection("requests")}>
                <Send {...ico} />
                Requests
              </button>
            </li>
            <li>
              <button type="button" aria-current={section === "network"} onClick={() => setSection("network")}>
                <Network {...ico} />
                Network
              </button>
            </li>
            <li>
              <button type="button" aria-current={section === "certificates"} onClick={() => setSection("certificates")}>
                <FileBadge {...ico} />
                Certificates
              </button>
            </li>
            <li>
              <button type="button" aria-current={section === "shortcuts"} onClick={() => setSection("shortcuts")}>
                <Keyboard {...ico} />
                Shortcuts
              </button>
            </li>
            <li>
              <button type="button" aria-current={section === "updates"} onClick={() => setSection("updates")}>
                <CircleArrowDown {...ico} />
                Updates
              </button>
            </li>
          </ul>

          {section === "appearance" ? (
            <div className="set-pane">
              <h4>Appearance</h4>
              <div className="set-list">
                <div className="set-item">
                  <div className="set-text">
                    <span className="set-label" id="set-theme">
                      Theme
                    </span>
                    <span className="desc">Auto follows your Mac's appearance</span>
                  </div>
                  <div className="set-ctl">
                    <div className="seg seg--lg" role="group" aria-labelledby="set-theme">
                      {(["auto", "light", "dark"] as const).map((t) => (
                        <button key={t} type="button" aria-pressed={theme === t} onClick={() => setSettings({ theme: t === "auto" ? undefined : t })}>
                          {t[0].toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {theme === "auto" ? (
                  <>
                    <SchemeRow id="set-scheme-light" label="Light theme" desc="Used while your Mac is light" value={settings.lightScheme ?? DEFAULT_SCHEME.light} onChange={(lightScheme) => setSettings({ lightScheme })} />
                    <SchemeRow id="set-scheme-dark" label="Dark theme" desc="Used while your Mac is dark" value={settings.darkScheme ?? DEFAULT_SCHEME.dark} onChange={(darkScheme) => setSettings({ darkScheme })} />
                  </>
                ) : (
                  <SchemeRow
                    id="set-scheme"
                    label="Color scheme"
                    desc="Any scheme, light or dark"
                    value={(theme === "dark" ? settings.darkScheme : settings.lightScheme) ?? DEFAULT_SCHEME[theme]}
                    onChange={(v) => setSettings(theme === "dark" ? { darkScheme: v } : { lightScheme: v })}
                  />
                )}
                <div className="set-item">
                  <div className="set-text">
                    <label htmlFor="set-compact">Compact mode</label>
                    <span className="desc">UI elements take up less screen space</span>
                  </div>
                  <div className="set-ctl">
                    <input
                      id="set-compact"
                      className="switch"
                      type="checkbox"
                      role="switch"
                      checked={settings.compact === true}
                      onChange={(e) => setSettings({ compact: e.target.checked || undefined })}
                    />
                  </div>
                </div>
                <FontRow
                  id="set-ui-font"
                  label="Interface font"
                  desc="Menus, tabs and dialogs"
                  placeholder="System default"
                  fonts={fonts.all}
                  font={settings.fontUi}
                  size={settings.fontSizeUi ?? 14}
                  sizes={UI_SIZES}
                  onFont={(fontUi) => setSettings({ fontUi })}
                  onSize={(n) => setSettings({ fontSizeUi: n === 14 ? undefined : n })}
                />
                <FontRow
                  id="set-code-font"
                  label="Code font"
                  desc="URLs, bodies and responses"
                  placeholder="System monospace"
                  fonts={fonts.mono}
                  font={settings.fontMono}
                  size={settings.fontSizeCode ?? 13}
                  sizes={CODE_SIZES}
                  onFont={(fontMono) => setSettings({ fontMono })}
                  onSize={(n) => setSettings({ fontSizeCode: n === 13 ? undefined : n })}
                />
                <div className="set-sample" aria-label="Sample">
                  <span className="set-sample-ui">
                    Create customer <span className="muted">trx-service / Customers</span>
                  </span>
                  <code>
                    <span className="m m-POST">POST</span> {"{{baseUrl}}"}/v1/customers
                  </code>
                </div>
              </div>
              <button
                type="button"
                className="link set-reset"
                onClick={() => setSettings({ theme: undefined, lightScheme: undefined, darkScheme: undefined, compact: undefined, fontUi: undefined, fontMono: undefined, fontSizeUi: undefined, fontSizeCode: undefined })}
              >
                Reset to defaults
              </button>
            </div>
          ) : section === "updates" ? (
            <UpdatesPane />
          ) : section === "network" ? (
            <NetworkPane />
          ) : section === "shortcuts" ? (
            <ShortcutsPane />
          ) : section === "certificates" ? (
            <CertificatesPane onOpenRequests={() => setSection("requests")} />
          ) : (
            <div className="set-pane">
              <h4>Requests</h4>
              <div className="set-list">
                <div className="set-item">
                  <div className="set-text">
                    <label htmlFor="set-timeout">Timeout</label>
                    <span className="desc">How long to wait for a response before giving up</span>
                  </div>
                  <div className="set-ctl">
                    <span className="unit-field">
                      <input
                        id="set-timeout"
                        className="field"
                        type="number"
                        min={1}
                        value={settings.timeoutMs}
                        onChange={(e) => setSettings({ timeoutMs: Math.max(1, Number(e.target.value) || 30000) })}
                      />
                      <span className="unit">ms</span>
                    </span>
                  </div>
                </div>
                <div className="set-item">
                  <div className="set-text">
                    <label htmlFor="set-redirects">Follow redirects</label>
                    <span className="desc">Follow 3xx responses to their Location</span>
                  </div>
                  <div className="set-ctl">
                    <input
                      id="set-redirects"
                      className="switch"
                      type="checkbox"
                      role="switch"
                      checked={settings.followRedirects}
                      onChange={(e) => setSettings({ followRedirects: e.target.checked })}
                    />
                  </div>
                </div>
                <div className="set-item">
                  <div className="set-text">
                    <label htmlFor="set-insecure">Skip TLS verification</label>
                    <span className="desc">Accept self-signed or invalid certificates. Use only for local servers.</span>
                  </div>
                  <div className="set-ctl">
                    <input
                      id="set-insecure"
                      className="switch switch--warn"
                      type="checkbox"
                      role="switch"
                      checked={settings.insecure}
                      onChange={(e) => setSettings({ insecure: e.target.checked })}
                    />
                  </div>
                </div>
                <div className="set-item">
                  <div className="set-text">
                    <label htmlFor="set-scripts">Run scripts</label>
                    <span className="desc">Run pre-request and post-response scripts on each send, including those from imported collections</span>
                  </div>
                  <div className="set-ctl">
                    <input
                      id="set-scripts"
                      className="switch"
                      type="checkbox"
                      role="switch"
                      checked={settings.runScripts !== false}
                      onChange={(e) => setSettings({ runScripts: e.target.checked })}
                    />
                  </div>
                </div>
                <div className="set-item">
                  <div className="set-text">
                    <label htmlFor="set-keep">Keep responses in history</label>
                    <span className="desc">Status, headers and body of each send, stored on this Mac as received</span>
                  </div>
                  <div className="set-ctl">
                    <input
                      id="set-keep"
                      className="switch"
                      type="checkbox"
                      role="switch"
                      checked={settings.keepResponses !== false}
                      onChange={(e) => setSettings({ keepResponses: e.target.checked })}
                    />
                  </div>
                </div>
                <div className="set-item">
                  <div className="set-text">
                    <label htmlFor="set-keep-max">Largest body kept</label>
                    <span className="desc">Bigger responses keep only status and headers</span>
                  </div>
                  <div className="set-ctl">
                    <span className="unit-field">
                      <input
                        id="set-keep-max"
                        className="field"
                        type="number"
                        min={1}
                        disabled={settings.keepResponses === false}
                        value={settings.keepResponseMaxMb ?? 1}
                        onChange={(e) => setSettings({ keepResponseMaxMb: Math.max(1, Number(e.target.value) || 1) })}
                      />
                      <span className="unit">MB</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

/** Settings > Network: secure DNS, a proxy (Cloudflare WARP in proxy mode) and a connection check.
 * Applies to HTTP, WebSocket and gRPC alike; see src/lib/net.ts and src-tauri/src/net.rs. */
function NetworkPane() {
  const raw = useStore((s) => s.settings.network);
  const setSettings = useStore((s) => s.setSettings);
  const n = netSettings(raw);
  const set = (patch: Partial<NetSettings>) => setSettings({ network: { ...raw, ...patch } });
  const problems = useNetProblems();
  const dnsProblem = problems.find((p) => p.startsWith("Secure DNS"));
  const proxyProblem = problems.find((p) => p.startsWith("Proxy"));
  const other = problems.filter((p) => p !== dnsProblem && p !== proxyProblem);

  const [host, setHost] = useState("");
  const [testing, setTesting] = useState(false);
  const [check, setCheck] = useState<NetCheck | string | null>(null);
  const test = async () => {
    if (!host.trim() || testing) return;
    setTesting(true);
    setCheck(null);
    try {
      setCheck(await checkHost(host));
    } catch (e) {
      setCheck(String(e));
    }
    setTesting(false);
  };

  return (
    <div className="set-pane">
      <h4>Network</h4>
      <div className="set-group">DNS</div>
      <div className="set-list">
        <div className="set-item">
          <div className="set-text">
            <label htmlFor="set-dns">Secure DNS</label>
            <span className="desc">Look up hostnames over HTTPS, like Chrome's secure DNS. Gets past DNS blocking by your ISP.</span>
          </div>
          <div className="set-ctl">
            <input id="set-dns" className="switch" type="checkbox" role="switch" checked={n.secureDns} onChange={(e) => set({ secureDns: e.target.checked })} />
          </div>
        </div>
        {n.secureDns && (
          <>
            <div className="set-item set-item--sub">
              <div className="set-text">
                <label htmlFor="set-dns-provider">Provider</label>
                <span className="desc">Who answers the lookups</span>
              </div>
              <div className="set-ctl">
                <Select id="set-dns-provider" className="field set-wide" value={n.provider} onChange={(e) => set({ provider: e.target.value })}>
                  {DNS_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {n.provider === "custom" && (
              <div className="set-item set-item--sub">
                <div className="set-text">
                  <label htmlFor="set-dns-url">Server URL</label>
                  <span className="desc">A DNS-over-HTTPS endpoint (RFC 8484)</span>
                </div>
                <div className="set-ctl">
                  <input
                    id="set-dns-url"
                    className="field set-wide"
                    placeholder="https://dns.example.com/dns-query"
                    spellCheck={false}
                    value={n.dohUrl}
                    onChange={(e) => set({ dohUrl: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="set-item set-item--sub">
              <div className="set-text">
                <label htmlFor="set-dns-fallback">Fall back to system DNS</label>
                <span className="desc">When secure DNS has no answer, ask your Mac's DNS. Keeps intranet hosts on your VPN working.</span>
              </div>
              <div className="set-ctl">
                <input id="set-dns-fallback" className="switch" type="checkbox" role="switch" checked={n.fallback} onChange={(e) => set({ fallback: e.target.checked })} />
              </div>
            </div>
            <div className="set-item set-item--sub">
              <div className="set-text">
                <label htmlFor="set-dns-system">Always use system DNS for</label>
                <span className="desc">Intranet domains, comma separated. Lookups for them never leave your Mac.</span>
              </div>
              <div className="set-ctl">
                <input
                  id="set-dns-system"
                  className="field set-wide"
                  placeholder="*.corp.local, *.internal"
                  spellCheck={false}
                  value={n.systemDomains}
                  onChange={(e) => set({ systemDomains: e.target.value })}
                />
              </div>
            </div>
          </>
        )}
        {dnsProblem && (
          <p className="set-problem" role="alert">
            <TriangleAlert {...ico} />
            {dnsProblem}
          </p>
        )}
      </div>

      <div className="set-group">Proxy</div>
      <div className="set-list">
        <div className="set-item">
          <div className="set-text">
            <span className="set-label" id="set-proxy">
              Proxy
            </span>
            <span className="desc">Send HTTP, WebSocket and gRPC traffic through a proxy</span>
          </div>
          <div className="set-ctl">
            <div className="seg seg--lg" role="group" aria-labelledby="set-proxy">
              {(
                [
                  ["none", "None"],
                  ["socks5", "SOCKS5"],
                  ["http", "HTTP"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={n.proxy === id} onClick={() => set({ proxy: id })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {n.proxy !== "none" && (
          <>
            <div className="set-item set-item--sub">
              <div className="set-text">
                <label htmlFor="set-proxy-addr">Address</label>
                <span className="desc">Cloudflare WARP in proxy mode listens on 127.0.0.1:40000. The proxy looks up hostnames itself.</span>
              </div>
              <div className="set-ctl">
                <input
                  id="set-proxy-addr"
                  className="field set-wide"
                  placeholder="127.0.0.1:40000"
                  spellCheck={false}
                  value={n.proxyAddr}
                  onChange={(e) => set({ proxyAddr: e.target.value })}
                />
              </div>
            </div>
            <div className="set-item set-item--sub">
              <div className="set-text">
                <label htmlFor="set-proxy-skip">Skip proxy for</label>
                <span className="desc">Hosts reached directly, comma separated. localhost always is.</span>
              </div>
              <div className="set-ctl">
                <input
                  id="set-proxy-skip"
                  className="field set-wide"
                  placeholder="*.corp.local, 10.0.0.5"
                  spellCheck={false}
                  value={n.proxySkip}
                  onChange={(e) => set({ proxySkip: e.target.value })}
                />
              </div>
            </div>
          </>
        )}
        {proxyProblem && (
          <p className="set-problem" role="alert">
            <TriangleAlert {...ico} />
            {proxyProblem}
          </p>
        )}
      </div>
      {other.map((p) => (
        <p key={p} className="set-problem" role="alert">
          <TriangleAlert {...ico} />
          {p}
        </p>
      ))}

      <div className="set-group">Test</div>
      <div className="set-list">
        <div className="set-item">
          <div className="set-text">
            <label htmlFor="set-net-host">Check a host</label>
            <span className="desc">Look up, connect and finish a TLS handshake with the settings above</span>
          </div>
          <div className="set-ctl">
            <form
              className="net-test"
              onSubmit={(e) => {
                e.preventDefault();
                void test();
              }}
            >
              <input
                id="set-net-host"
                className="field"
                placeholder="api.example.com"
                spellCheck={false}
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
              <button type="submit" className="btn" disabled={testing || !host.trim()}>
                {testing ? "Testing…" : "Test"}
              </button>
            </form>
          </div>
        </div>
        {typeof check === "string" && (
          <div className="net-result" role="status">
            <span className="set-status bad">
              <TriangleAlert {...ico} />
              {check}
            </span>
          </div>
        )}
        {check && typeof check !== "string" && (
          <div className="net-result" role="status">
            {check.ok ? (
              <span className="set-status ok">
                <CircleCheck {...ico} />
                Reachable · {check.ms} ms
              </span>
            ) : (
              <span className="set-status bad">
                <TriangleAlert {...ico} />
                {`${check.steps[check.steps.length - 1]?.name ?? "Check"} failed`}
              </span>
            )}
            <dl className="net-steps">
              {check.steps.map((st) => (
                <div key={st.name} className="net-step">
                  <dt>{st.name}</dt>
                  <dd className={st.ok ? undefined : "bad"}>{st.detail}</dd>
                </div>
              ))}
            </dl>
            {check.hint && <span className="net-hint">{check.hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Settings > Updates in a dev build: where it comes from, and the updater switched off so it never replaces this build. */
function DevUpdatesPane({ version }: { version: string }) {
  const b = DEV_BUILD!;
  const where = [b.describe, b.branch && `on branch ${b.branch}`].filter(Boolean).join(" ");
  return (
    <div className="set-pane">
      <h4>Updates</h4>
      <div className="set-list">
        <div className="set-item">
          <div className="set-text">
            <span className="set-label">
              voidHTTP {version}
              <BuildBadge />
            </span>
            <span className="desc">{where ? `${where} · ` : ""}updates are off in dev builds</span>
          </div>
          <div className="set-ctl">
            <button type="button" className="upd-link" onClick={() => void openUrl(`${RELEASES_URL}/latest`)}>
              Get the release
              <ExternalLink {...ico} />
            </button>
          </div>
        </div>
        <div className="set-item" aria-disabled="true">
          <div className="set-text">
            <label htmlFor="set-auto-update">Check automatically</label>
            <span className="desc">Off in dev builds, so an update never replaces this build</span>
          </div>
          <div className="set-ctl">
            <input id="set-auto-update" className="switch" type="checkbox" role="switch" checked={false} disabled readOnly />
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <span className="set-label">Release notes</span>
            <span className="desc">What changed in each version</span>
          </div>
          <div className="set-ctl">
            <button type="button" className="upd-link" onClick={() => void openUrl(RELEASES_URL)}>
              Open on GitHub
              <ExternalLink {...ico} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Settings > Updates: the running version and what the updater knows, plus the launch check switch. */
function UpdatesPane() {
  const auto = useStore((s) => s.settings.autoUpdateCheck !== false);
  const setSettings = useStore((s) => s.setSettings);
  const u = useUpdates();
  if (DEV_BUILD) return <DevUpdatesPane version={u.version} />;
  const st = u.state;
  const pct = st.kind === "downloading" && st.total ? Math.floor((st.received / st.total) * 100) : undefined;

  let status: ReactNode;
  let action: ReactNode = (
    <button type="button" className="btn" disabled={st.kind === "checking"} onClick={() => void u.check()}>
      {st.kind === "checking" ? "Checking…" : "Check for updates"}
    </button>
  );
  if (st.kind === "checking") status = "Checking…";
  else if (st.kind === "current")
    status = (
      <span className="set-status ok">
        <CircleCheck {...ico} />
        Up to date{u.checkedAt ? ` · checked ${ago(u.checkedAt)}` : ""}
      </span>
    );
  else if (st.kind === "available") {
    status = (
      <span className="set-status new">
        <CircleArrowDown {...ico} />
        {st.version} is available
      </span>
    );
    action = (
      <button type="button" className="btn btn--primary" onClick={() => void u.install()}>
        Install update
      </button>
    );
  } else if (st.kind === "downloading" || st.kind === "installing") {
    status = st.kind === "installing" ? `Installing ${st.version}…` : `Downloading ${st.version}${pct !== undefined ? ` · ${pct}%` : "…"}`;
    action = null;
  } else if (st.kind === "ready") {
    status = (
      <span className="set-status ok">
        <CircleCheck {...ico} />
        {st.version} is installed · restart to finish
      </span>
    );
    action = (
      <button type="button" className="btn btn--primary" onClick={() => void u.restart()}>
        Restart now
      </button>
    );
  } else if (st.kind === "error") {
    status = (
      <span className="set-status bad" title={st.message}>
        <TriangleAlert {...ico} />
        {u.failed === "install" ? `Couldn't install ${u.target ?? "the update"}` : "Couldn't check for updates"}
      </span>
    );
    if (u.failed === "install")
      action = (
        <button type="button" className="btn" onClick={() => void u.install()}>
          Try again
        </button>
      );
  } else status = "Not checked yet";

  return (
    <div className="set-pane">
      <h4>Updates</h4>
      <div className="set-list">
        <div className="set-item">
          <div className="set-text">
            <span className="set-label">voidHTTP {u.version}</span>
            <span className="desc">{status}</span>
          </div>
          <div className="set-ctl">{action}</div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <label htmlFor="set-auto-update">Check automatically</label>
            <span className="desc">Look for a new version when voidHTTP opens</span>
          </div>
          <div className="set-ctl">
            <input
              id="set-auto-update"
              className="switch"
              type="checkbox"
              role="switch"
              checked={auto}
              onChange={(e) => setSettings({ autoUpdateCheck: e.target.checked ? undefined : false })}
            />
          </div>
        </div>
        <div className="set-item">
          <div className="set-text">
            <span className="set-label">Release notes</span>
            <span className="desc">What changed in each version</span>
          </div>
          <div className="set-ctl">
            <button type="button" className="upd-link" onClick={() => void openUrl(RELEASES_URL)}>
              Open on GitHub
              <ExternalLink {...ico} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One colour scheme slot: the scheme's chip and a dropdown of every scheme, grouped by family. */
function SchemeRow(p: { id: string; label: string; desc: string; value: string; onChange: (id: string) => void }) {
  const [bg, ...dots] = schemeSwatch(p.value);
  return (
    <div className="set-item">
      <div className="set-text">
        <label htmlFor={p.id}>{p.label}</label>
        <span className="desc">{p.desc}</span>
      </div>
      <div className="set-ctl">
        <span className="scheme-dots" aria-hidden="true" style={{ background: bg }}>
          {dots.map((c, i) => (
            <i key={i} style={{ background: c }} />
          ))}
        </span>
        <Select id={p.id} className="field set-scheme" value={p.value} onChange={(e) => p.onChange(e.target.value)}>
          <optgroup label="voidHTTP">
            {(Object.keys(BUILTIN) as BuiltinId[]).map((id) => (
              <option key={id} value={id}>
                {BUILTIN[id].name}
              </option>
            ))}
          </optgroup>
          {FAMILIES.map((f) => (
            <optgroup key={f} label={f}>
              {SCHEMES.filter((s) => s.family === f).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </div>
    </div>
  );
}

function FontRow(p: {
  id: string;
  label: string;
  desc: string;
  placeholder: string;
  fonts: string[];
  font?: string;
  size: number;
  sizes: number[];
  onFont: (v: string | undefined) => void;
  onSize: (n: number) => void;
}) {
  return (
    <div className="set-item">
      <div className="set-text">
        <label htmlFor={p.id}>{p.label}</label>
        <span className="desc">{p.desc}</span>
      </div>
      <div className="set-ctl">
        <input
          id={p.id}
          className="field set-font"
          list={`${p.id}-list`}
          placeholder={p.placeholder}
          spellCheck={false}
          value={p.font ?? ""}
          onChange={(e) => p.onFont(e.target.value.trim() ? e.target.value : undefined)}
        />
        <datalist id={`${p.id}-list`}>
          {p.fonts.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <Select className="field set-size" aria-label={`${p.label} size`} value={p.size} onChange={(e) => p.onSize(Number(e.target.value))}>
          {p.sizes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

/** Create a project, or edit one: name, a Lucide icon and a colour, with a live preview. */
function ProjectModal({ projectId, onClose }: { projectId?: string; onClose: () => void }) {
  const s = useStore.getState();
  const existing = projectId ? s.projects.find((p) => p.id === projectId) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [icon, setIcon] = useState(existing?.icon && PROJECT_ICONS[existing.icon] ? existing.icon : "landmark");
  const [color, setColor] = useState(existing?.color ?? 1);
  const title = existing ? "Edit project" : "New project";

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    if (existing) s.updateProject(existing.id, { name: n, icon, color });
    else s.openProject(s.createProject({ name: n, icon, color }));
    onClose();
  };

  return (
    <Shell title={title} sub={existing ? existing.name : "Collections, environments and history of its own"} tile={<ProjectTile icon={icon} color={color} />} onClose={onClose}>
      <div className="sh-body">
        <label>
          Name
          <input
            className="field"
            autoFocus
            placeholder="e.g. Amarbank"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </label>
        <div className="pick">
          <span className="pick-label" id="lbl-icon">
            Icon
          </span>
          <div className="icon-grid" role="radiogroup" aria-labelledby="lbl-icon" style={tileStyle(color)}>
            {Object.entries(PROJECT_ICONS).map(([key, I]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={icon === key}
                aria-label={key.replace(/-/g, " ")}
                title={key.replace(/-/g, " ")}
                onClick={() => setIcon(key)}
              >
                <I {...ico} />
              </button>
            ))}
          </div>
        </div>
        <div className="pick">
          <span className="pick-label" id="lbl-colour">
            Colour
          </span>
          <div className="swatches" role="radiogroup" aria-labelledby="lbl-colour">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={color === c.id}
                aria-label={c.name}
                style={tileStyle(c.id)}
                onClick={() => setColor(c.id)}
              >
                <Check {...ico} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <footer className="sh-foot">
        <button type="button" className="btn btn--quiet" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" disabled={!name.trim()} onClick={submit}>
          {existing ? <Check {...ico} /> : <Plus {...ico} />}
          {existing ? "Save" : "Create project"}
        </button>
      </footer>
    </Shell>
  );
}

