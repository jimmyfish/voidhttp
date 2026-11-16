import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useUpdates } from "../updates";
import { RELEASES_URL, REPO_URL, mb, noteLines, releaseDate } from "../lib/updater";
import { ago } from "../lib/time";
import { ChevronDown, CircleArrowDown, CircleDot, Copy, ExternalLink, Github, LoaderCircle, RefreshCw, Scale, X, ico } from "./Icon";

/** Notes longer than this fold behind "Show all n changes". */
const NOTES_SHOWN = 3;

/**
 * About voidHTTP, opened from the app menu in place of the native macOS panel (which only takes plain text).
 * Updates and the licence are drawn as requests, since that is what voidHTTP shows all day.
 * The update card reads the same store as the title-strip chip and Settings > Updates.
 */
export function AboutModal({ onClose }: { onClose: () => void }) {
  const version = useUpdates((u) => u.version);
  const kind = useUpdates((u) => u.state.kind);
  const orbit = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // opening About is a good moment to look: check once if nothing has been checked yet
  useEffect(() => {
    if (kind === "idle") void useUpdates.getState().check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  const copyVersion = () => {
    void navigator.clipboard.writeText(`voidHTTP ${version}`).then(() => setCopied(true));
  };

  // a click on the icon restarts the ripple from the middle
  const ping = () => {
    const el = orbit.current;
    if (!el) return;
    el.classList.remove("ping");
    void el.offsetWidth;
    el.classList.add("ping");
  };

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="about" role="dialog" aria-modal="true" aria-labelledby="about-name">
        <button type="button" className="icon-btn about-close" aria-label="Close" onClick={onClose}>
          <X {...ico} />
        </button>
        <header className="about-hero">
          <div className="about-orbit ping" ref={orbit} aria-hidden="true" onClick={ping}>
            <i />
            <i />
            <i />
            <img src="/app-icon.png" alt="" />
          </div>
          <h2 className="about-name" id="about-name">
            void<span>HTTP</span>
          </h2>
          <p className="about-tag">A lightweight API client.</p>
          {version && (
            <button type="button" className="about-ver" title="Copy version" data-copied={copied || undefined} onClick={copyVersion}>
              {copied ? "Copied" : `v${version}`}
              <Copy {...ico} />
            </button>
          )}
        </header>
        <div className="about-body">
          <UpdateCard />
          <div className="about-res" aria-label="License">
            <div className="about-res-line">
              <span className="m">GET</span>
              <span className="url">/license</span>
              <span className="status">200 OK</span>
            </div>
            <dl>
              <dt>License</dt>
              <dd>Apache-2.0 + Commons Clause</dd>
              <dt>Allow</dt>
              <dd>use, modify, fork, redistribute</dd>
              <dt>Deny</dt>
              <dd className="deny">selling it, paid hosting or support</dd>
              <dt>Keep</dt>
              <dd>NOTICE and a link back here</dd>
            </dl>
          </div>
          <nav className="about-links" aria-label="Links">
            <button type="button" className="btn btn--quiet" onClick={() => void openUrl(REPO_URL)}>
              <Github {...ico} />
              GitHub
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => void openUrl(`${REPO_URL}/blob/master/LICENSE`)}>
              <Scale {...ico} />
              Full license
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => void openUrl(`${REPO_URL}/issues/new/choose`)}>
              <CircleDot {...ico} />
              Report an issue
            </button>
          </nav>
          <p className="about-foot">© 2026 Fish &amp; Lovely OSS Community</p>
        </div>
      </div>
    </div>
  );
}

/** One request line: GET path, status on the right, optional progress along its bottom edge. */
function Line({ path, status, progress }: { path: string; status: ReactNode; progress?: number }) {
  return (
    <div className="about-res-line">
      <span className="m">GET</span>
      <span className="url">{path}</span>
      {status}
      {progress !== undefined && <i className="about-prog" style={{ "--p": `${progress}%` } as CSSProperties} />}
    </div>
  );
}

const Wait = ({ label }: { label: string }) => (
  <span className="status wait">
    <LoaderCircle {...ico} className="ico upd-spin" />
    {label}
  </span>
);

/** Updates as a request: 304 when current, 200 with notes when there is one, 206 while downloading, 205 to restart. */
function UpdateCard() {
  const u = useUpdates();
  const st = u.state;
  const latest = "/releases/latest";

  let line: ReactNode;
  let body: ReactNode;
  const checkAgain = (
    <button type="button" className="btn" disabled={st.kind === "checking"} onClick={() => void u.check()}>
      <RefreshCw {...ico} />
      Check again
    </button>
  );

  if (st.kind === "available") {
    line = <Line path={latest} status={<span className="status">200 OK</span>} />;
    const date = releaseDate(st.date);
    body = (
      <>
        <div className="about-upd-row">
          <p className="about-upd-text">
            <strong>voidHTTP {st.version} is out</strong>
            <span className="sub">
              You have {st.current}
              {date ? ` · released ${date}` : ""}
            </span>
          </p>
        </div>
        <Notes notes={st.notes} />
        <div className="about-upd-row">
          <button type="button" className="upd-link" onClick={() => void openUrl(`${RELEASES_URL}/tag/v${st.version}`)}>
            Release notes
            <ExternalLink {...ico} />
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void u.install()}>
            <CircleArrowDown {...ico} />
            Install update
          </button>
        </div>
      </>
    );
  } else if (st.kind === "downloading") {
    const pct = st.total ? Math.floor((st.received / st.total) * 100) : undefined;
    line = <Line path={`/releases/${st.version}`} status={<span className="status busy">206 Partial Content</span>} progress={pct ?? 0} />;
    body = (
      <div className="about-upd-row">
        <p className="about-upd-text">
          Downloading {st.version}
          {pct !== undefined ? ` · ${pct}%` : "…"}
          <span className="sub">
            {st.total ? `${mb(st.received)} of ${mb(st.total)} MB` : `${mb(st.received)} MB`} · you can keep working
          </span>
        </p>
      </div>
    );
  } else if (st.kind === "installing") {
    line = <Line path={`/releases/${st.version}`} status={<Wait label="installing" />} progress={100} />;
    body = (
      <div className="about-upd-row">
        <p className="about-upd-text">
          Installing {st.version}…<span className="sub">Downloaded and verified</span>
        </p>
      </div>
    );
  } else if (st.kind === "ready") {
    line = <Line path={`/releases/${st.version}`} status={<span className="status">205 Reset Content</span>} />;
    body = (
      <div className="about-upd-row">
        <p className="about-upd-text">
          <strong>{st.version} is installed</strong>
          <span className="sub">Restart voidHTTP to finish. Your tabs come back.</span>
        </p>
        <button type="button" className="btn btn--primary" onClick={() => void u.restart()}>
          <RefreshCw {...ico} />
          Restart now
        </button>
      </div>
    );
  } else if (st.kind === "error") {
    const install = u.failed === "install";
    line = <Line path={install && u.target ? `/releases/${u.target}` : latest} status={<span className="status fail">Failed</span>} />;
    body = (
      <>
        <p className="upd-err">{st.message}</p>
        <div className="about-upd-row">
          <button type="button" className="upd-link" onClick={() => void openUrl(`${RELEASES_URL}/latest`)}>
            Download from GitHub
            <ExternalLink {...ico} />
          </button>
          <button type="button" className="btn" onClick={() => void (install ? u.install() : u.check())}>
            Try again
          </button>
        </div>
      </>
    );
  } else if (st.kind === "current") {
    line = <Line path={latest} status={<span className="status redir">304 Not Modified</span>} />;
    body = (
      <div className="about-upd-row">
        <p className="about-upd-text">
          You're on the latest version.
          {u.checkedAt && <span className="sub">Checked {ago(u.checkedAt)}</span>}
        </p>
        {checkAgain}
      </div>
    );
  } else {
    // checking, or idle for the moment before the first check starts
    line = <Line path={latest} status={<Wait label="pending" />} />;
    body = (
      <div className="about-upd-row">
        <p className="about-upd-text">
          Looking for a new version…<span className="sub">github.com/jimmyfish/voidhttp</span>
        </p>
        {checkAgain}
      </div>
    );
  }

  return (
    <div className="about-res about-upd" aria-label="Updates" aria-live="polite">
      {line}
      <div className="about-upd-body">{body}</div>
    </div>
  );
}

/** Release notes: the first few changes, the rest behind "Show all n changes" in a list that scrolls. */
function Notes({ notes }: { notes?: string }) {
  const lines = noteLines(notes);
  const [open, setOpen] = useState(false);
  if (!lines.length) return null;
  const more = lines.length > NOTES_SHOWN;
  return (
    <div className="about-notes" data-open={open || undefined}>
      <ul className="upd-notes">
        {(open ? lines : lines.slice(0, NOTES_SHOWN)).map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      {more && (
        <button type="button" className="upd-link about-notes-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Show less" : `Show all ${lines.length} changes`}
          <ChevronDown {...ico} />
        </button>
      )}
    </div>
  );
}
