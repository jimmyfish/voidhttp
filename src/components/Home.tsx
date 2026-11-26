import "./Home.css";
import { Fragment, useRef, useState } from "react";
import { useStore } from "../store";
import type { HistoryEntry, ProjectMeta } from "../types";
import { countRequests, entryStatus, methodLabel } from "../lib/model";
import { ago, startOfDay } from "../lib/time";
import { ProjectTile, tileStyle } from "./ProjectIcon";
import { Braces, Ellipsis, FileText, Folder, Import, Pencil, Plus, Trash2, ico, icoLg } from "./Icon";
import { RowMenu, openAtPointer, type MenuItem, type MenuState } from "./RowMenu";

const DAY = 86_400_000;

/** "/v1/transfers" from "https://api.x.com/v1/transfers?a=1" or "{{baseUrl}}/v1/transfers" */
const pathOf = (url: string) => {
  const path = url.replace(/^(https?:\/\/[^/]+|\{\{[^}]+\}\}|[^/{]+(?=\/))/, "");
  // cut at the first ? or #: a search, not /[?#].*$/, which rescans to a line end from every ? and # in a long URL
  const cut = path.search(/[?#]/);
  return (cut === -1 ? path : path.slice(0, cut)) || "/";
};

/** "api.x.com" from "https://api.x.com/v1", "{{baseUrl}}" from "{{baseUrl}}/v1"; "" when the address has no path (a gRPC target) */
const hostOf = (url: string) => url.match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/?#]+)(?=\/)/i)?.[1] ?? "";

const greeting = (h: number) => (h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

type Bucket = "2xx" | "3xx" | "4xx" | "5xx" | "err";
const BUCKETS: { k: Bucket; name: string }[] = [
  { k: "2xx", name: "2xx and OK" },
  { k: "3xx", name: "3xx" },
  { k: "4xx", name: "4xx" },
  { k: "5xx", name: "5xx" },
  { k: "err", name: "Failed" },
];
/** HTTP statuses by class; gRPC, Kafka, MQTT and Pub/Sub are OK or Failed; no answer at all is Failed */
const bucketOf = (h: HistoryEntry): Bucket => {
  const s = entryStatus(h);
  if (h.status === undefined) return "err";
  if (!/^\d{3}$/.test(s.text) || h.request.method === "GRPC") return s.ok ? "2xx" : "err";
  const c = Math.floor(h.status / 100);
  return c <= 2 ? "2xx" : c === 3 ? "3xx" : c === 4 ? "4xx" : "5xx";
};

/** The tiles on the first-run "New project" panel: the New project dialog's own picks, icon + one of the 6 colours. */
const FIRST_RUN_PICKS: [string, number][] = [
  ["landmark", 1],
  ["store", 4],
  ["rocket", 3],
  ["cloud", 5],
  ["package", 6],
  ["user-round", 2],
];

type Entry = HistoryEntry & { project: ProjectMeta };

/** Home: your projects, and what you did with them. Every figure is computed from local history. */
export function Home() {
  const projects = useStore((s) => s.projects);
  // re-render when any project's data changes
  useStore((s) => s.stash);
  useStore((s) => s.history);
  useStore((s) => s.collections);
  useStore((s) => s.environments);
  const st = useStore.getState(); // actions only

  const rows = projects.map((p) => ({ meta: p, data: st.projectData(p.id) }));
  // creation order: cards keep their place instead of jumping each time a project is opened
  const byCreated = [...rows].sort((a, b) => a.meta.createdAt - b.meta.createdAt);

  // at most 200 entries per project: cheap enough to recompute on every render
  const all: Entry[] = rows.flatMap(({ meta, data }) => data.history.map((h) => ({ ...h, project: meta }))).sort((a, b) => b.at - a.at);

  const from = startOfDay(Date.now()) - 6 * DAY;
  const dayOf = (at: number) => Math.floor((at - from) / DAY);
  const week = (() => {
    const inWeek = all.filter((h) => h.at >= from);
    const days = Array.from({ length: 7 }, (_, i) => {
      const inDay = inWeek.filter((h) => dayOf(h.at) === i);
      const label = i === 6 ? "Today" : new Date(from + i * DAY).toLocaleDateString(undefined, { weekday: "short" });
      return { label, count: inDay.length, failed: inDay.filter((h) => !entryStatus(h).ok).length };
    });
    const ok = inWeek.filter((h) => entryStatus(h).ok).length;
    const times = inWeek.map((h) => h.elapsedMs).filter((t): t is number => t !== undefined).sort((a, b) => a - b);
    const median = times.length ? times[Math.floor(times.length / 2)] : null;
    const tally = new Map<string, { method: string; path: string; n: number }>();
    for (const h of inWeek) {
      const key = `${h.request.method} ${pathOf(h.request.url)}`;
      const t = tally.get(key) ?? { method: h.request.method, path: pathOf(h.request.url), n: 0 };
      t.n++;
      tally.set(key, t);
    }
    const top = [...tally.values()].sort((a, b) => b.n - a.n)[0];
    const mix = BUCKETS.map((b) => ({ ...b, n: inWeek.filter((h) => bucketOf(h) === b.k).length }));
    return { list: inWeek, days, sent: inWeek.length, rate: inWeek.length ? ok / inWeek.length : null, median, top, mix };
  })();

  const max = Math.max(1, ...week.days.map((d) => d.count));
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const first = projects.length === 0;

  const remove = (id: string, name: string) =>
    st.openModal({
      kind: "confirm",
      title: `Delete “${name}”?`,
      message: "Its collections, environments, history and open tabs are deleted. This cannot be undone.",
      onConfirm: () => st.deleteProject(id),
    });

  /** a recent send opens in its project, from history (the stored response is shown when it was kept) */
  const reopen = (h: Entry) => {
    st.openProject(h.project.id);
    void useStore.getState().openHistory(h.id);
  };

  return (
    <main className="home">
      <div className="home-inner">
        <header className="hm-hero">
          <div>
            <h1>{first ? "Welcome to voidHTTP" : greeting(new Date().getHours())}</h1>
            <p className="hm-sub">
              {first ? (
                `${date}. Make a project to keep collections, environments and history together.`
              ) : week.sent ? (
                <>
                  {date}. <strong>{week.sent.toLocaleString()}</strong> {week.sent === 1 ? "request" : "requests"} this week, <strong>{pct(week.rate!)}</strong> came back OK.
                </>
              ) : (
                `${date}. Nothing sent this week yet.`
              )}
            </p>
          </div>
          {!first && (
            <div className="home-actions">
              <button type="button" className="btn" onClick={() => st.openModal({ kind: "import" })}>
                <Import {...ico} />
                Import
              </button>
              <button type="button" className="btn btn--primary" onClick={() => st.openModal({ kind: "project" })}>
                <Plus {...ico} />
                New project
              </button>
            </div>
          )}
        </header>

        {first ? (
          <section className="hm-start" aria-label="Get started">
            <button type="button" className="hm-way" onClick={() => st.openModal({ kind: "project" })}>
              <span className="hm-picks" aria-hidden="true">
                {FIRST_RUN_PICKS.map(([icon, color]) => (
                  <ProjectTile key={icon} icon={icon} color={color} />
                ))}
              </span>
              <strong>New project</strong>
              <span>Pick an icon and a colour, then add collections, environments and requests.</span>
            </button>
            <button type="button" className="hm-way hm-way--import" onClick={() => st.openModal({ kind: "import" })}>
              <span className="hm-formats" aria-hidden="true">
                {["Postman", "OpenAPI", "Swagger", "HAR", "cURL"].map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </span>
              <strong>Import</strong>
              <span>Bring requests over from Postman, OpenAPI or Swagger, HAR, cURL or a voidHTTP export. Or drop a file anywhere on the window.</span>
            </button>
          </section>
        ) : (
          <>
            <section aria-labelledby="h-projects">
              <div className="hm-sec-head">
                <h2 id="h-projects">Projects</h2>
                <span className="hm-count">{projects.length}</span>
              </div>
              <div className="projects">
                {byCreated.map(({ meta, data }) => {
                  const mine = week.list.filter((h) => h.project.id === meta.id);
                  return (
                    <ProjectCard
                      key={meta.id}
                      meta={meta}
                      collections={data.collections.map((c) => c.name)}
                      requests={data.collections.reduce((n, c) => n + countRequests(c.children), 0)}
                      environments={data.environments.length}
                      spark={Array.from({ length: 7 }, (_, i) => mine.filter((h) => dayOf(h.at) === i).length)}
                      sent={mine.length}
                      ok={mine.filter((h) => entryStatus(h).ok).length}
                      onOpen={() => st.openProject(meta.id)}
                      onEdit={() => st.openModal({ kind: "project", projectId: meta.id })}
                      onDelete={() => remove(meta.id, meta.name)}
                    />
                  );
                })}
                <button type="button" className="project-card project-card--new" onClick={() => st.openModal({ kind: "project" })}>
                  <Plus {...icoLg} />
                  <span>New project</span>
                </button>
              </div>
            </section>

            <div className="home-grid">
              <section className="panel-box" aria-labelledby="h-week">
                <div className="hm-sec-head">
                  <h2 id="h-week">Last 7 days</h2>
                  <span className="hm-aside">All projects</span>
                </div>
                <dl className="stats">
                  <div>
                    <dt>Requests sent</dt>
                    <dd>{week.sent.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Success rate</dt>
                    {week.rate === null ? <dd className="none">None yet</dd> : <dd>{pct(week.rate)}</dd>}
                  </div>
                  <div>
                    <dt>Median response</dt>
                    {week.median === null ? (
                      <dd className="none">None yet</dd>
                    ) : (
                      <dd>
                        {week.median.toLocaleString()}
                        <small>ms</small>
                      </dd>
                    )}
                  </div>
                  <div>
                    <dt>Most called</dt>
                    {week.top ? (
                      <dd className="stat-text">
                        <span className={`m m-${week.top.method}`}>{methodLabel(week.top.method)}</span>
                        <code title={week.top.path}>{week.top.path}</code>
                        <small>{plural(week.top.n, "time", "times")}</small>
                      </dd>
                    ) : (
                      <dd className="none">None yet</dd>
                    )}
                  </div>
                </dl>

                <figure className="bars" aria-labelledby="h-week-chart">
                  <div className="bars-head">
                    <span id="h-week-chart">Requests per day</span>
                    <span className="key">
                      <i />
                      OK
                    </span>
                    <span className="key fail">
                      <i />
                      Failed
                    </span>
                  </div>
                  <div className="bars-plot" aria-hidden="true">
                    {week.days.map((d, i) => (
                      <div key={i} className="bar-col">
                        <span className={`bar${i === 6 ? " bar--today" : ""}`} style={{ "--h": `${(d.count / max) * 100}%` } as React.CSSProperties} data-tip={d.count.toLocaleString()}>
                          <i style={{ "--part": `${d.count ? ((d.count - d.failed) / d.count) * 100 : 100}%` } as React.CSSProperties} />
                          {d.failed > 0 && <i className="fail" style={{ "--part": `${(d.failed / d.count) * 100}%` } as React.CSSProperties} />}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bar-days" aria-hidden="true">
                    {week.days.map((d, i) => (
                      <span key={i} className={i === 6 ? "today" : undefined}>
                        {d.label}
                      </span>
                    ))}
                  </div>
                  <table className="visually-hidden">
                    <caption>Requests per day</caption>
                    <tbody>
                      {week.days.map((d, i) => (
                        <tr key={i}>
                          <th>{d.label}</th>
                          <td>{d.count}</td>
                          <td>{d.failed} failed</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </figure>

                {week.sent > 0 && (
                  <div className="mix">
                    <div
                      className="mix-bar"
                      role="img"
                      aria-label={`Status mix: ${week.mix
                        .filter((m) => m.n)
                        .map((m) => `${m.n} ${m.name}`)
                        .join(", ")}`}
                    >
                      {week.mix
                        .filter((m) => m.n)
                        .map((m) => (
                          <i key={m.k} className={`s-${m.k}`} style={{ "--n": m.n } as React.CSSProperties} />
                        ))}
                    </div>
                    <ul className="mix-legend">
                      {week.mix.map((m) => (
                        <li key={m.k}>
                          <i className={`s-${m.k}`} />
                          {m.name} <b>{m.n.toLocaleString()}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              <section className="panel-box" aria-labelledby="h-recent">
                <div className="hm-sec-head">
                  <h2 id="h-recent">Recent requests</h2>
                </div>
                {all.length === 0 ? (
                  <div className="hm-empty">
                    <strong>Nothing sent yet</strong>
                    <span>Open a project and press ⌘ Enter on a request.</span>
                  </div>
                ) : (
                  <ol className="hm-recent">
                    {all.slice(0, 7).map((h) => {
                      const s = entryStatus(h);
                      const host = hostOf(h.request.url);
                      return (
                        <li key={h.id}>
                          <button type="button" title={`Open in ${h.project.name}: ${h.request.url}`} onClick={() => reopen(h)}>
                            <span className={`m m-${h.request.method}`}>{methodLabel(h.request.method)}</span>
                            <span className="r-path">{pathOf(h.request.url)}</span>
                            <span className={`r-status ${s.ok ? "ok" : "fail"}`}>{s.text}</span>
                            <span className="r-meta">
                              <span className="r-proj">
                                <ProjectTile icon={h.project.icon} color={h.project.color} small />
                                {h.project.name}
                              </span>
                              {host && <span className="host">{host}</span>}
                              {h.elapsedMs !== undefined && <span>{h.elapsedMs.toLocaleString()} ms</span>}
                            </span>
                            <span className="r-when">{ago(h.at)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/** One project: open it from anywhere on the card; Edit and Delete live in its "…" menu. */
function ProjectCard(p: {
  meta: ProjectMeta;
  collections: string[];
  requests: number;
  environments: number;
  /** sends per day over the last 7 days, today last */
  spark: number[];
  sent: number;
  ok: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const moreRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<MenuState>(false);
  const items: MenuItem[] = [
    { label: "Edit project…", icon: <Pencil {...ico} />, run: p.onEdit },
    "sep",
    { label: "Delete…", icon: <Trash2 {...ico} />, run: p.onDelete, danger: true },
  ];
  const peak = Math.max(1, ...p.spark);
  const names = p.collections.join(", ");
  return (
    <Fragment>
      <div className="project-card" style={tileStyle(p.meta.color)} onContextMenu={openAtPointer(setMenu)}>
        <button type="button" className="project-open" aria-label={`Open ${p.meta.name}`} onClick={p.onOpen} />
        <div className="pc-top">
          <ProjectTile icon={p.meta.icon} color={p.meta.color} />
          <span className="pc-title">
            <span className="proj-name">{p.meta.name}</span>
            <span className="proj-when">Opened {ago(p.meta.openedAt)}</span>
          </span>
        </div>
        <button
          ref={moreRef}
          type="button"
          className="icon-btn card-more"
          title="More actions"
          aria-label={`More actions for ${p.meta.name}`}
          aria-haspopup="menu"
          aria-expanded={!!menu}
          onClick={() => setMenu(!menu)}
        >
          <Ellipsis {...ico} />
        </button>
        <span className="proj-cols" title={names || undefined}>
          {names || "No collections yet"}
        </span>
        <div className="pc-week">
          <span className="pc-spark" aria-hidden="true">
            {p.spark.map((n, i) => (
              <i key={i} style={{ "--h": `${(n / peak) * 100}%` } as React.CSSProperties} />
            ))}
          </span>
          <span className="pc-week-n">
            {p.sent ? (
              <>
                <strong>{p.sent.toLocaleString()}</strong> sent this week
              </>
            ) : (
              "Nothing sent this week"
            )}
          </span>
          {p.sent > 0 && (
            <span className="pc-week-ok" title="Came back OK">
              {Math.round((p.ok / p.sent) * 100)}% OK
            </span>
          )}
        </div>
        <div className="proj-facts">
          <span title="Collections">
            <Folder {...ico} />
            <b>{p.collections.length}</b>
          </span>
          <span title="Requests">
            <FileText {...ico} />
            <b>{p.requests}</b>
          </span>
          <span title="Environments">
            <Braces {...ico} />
            <b>{p.environments}</b>
          </span>
        </div>
      </div>
      {menu && <RowMenu anchor={moreRef} label={`${p.meta.name} actions`} items={items} onClose={() => setMenu(false)} at={menu} />}
    </Fragment>
  );
}
