import { useStore } from "../store";
import type { HistoryEntry } from "../types";
import { countRequests, entryStatus, methodLabel } from "../lib/model";
import { ago, startOfDay } from "../lib/time";
import { ProjectTile } from "./ProjectIcon";
import { Import, Pencil, Plus, X, ico, icoLg } from "./Icon";

const DAY = 86_400_000;

/** "/v1/transfers" from "https://api.x.com/v1/transfers?a=1" or "{{baseUrl}}/v1/transfers" */
const pathOf = (url: string) => {
  const path = url.replace(/^(https?:\/\/[^/]+|\{\{[^}]+\}\}|[^/{]+(?=\/))/, "");
  // cut at the first ? or #: a search, not /[?#].*$/, which rescans to a line end from every ? and # in a long URL
  const cut = path.search(/[?#]/);
  return (cut === -1 ? path : path.slice(0, cut)) || "/";
};

const greeting = (h: number) => (h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");

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
  const all = rows.flatMap(({ meta, data }) => data.history.map((h) => ({ ...h, project: meta }))).sort((a, b) => b.at - a.at);

  const week = (() => {
    const now = Date.now();
    const from = startOfDay(now) - 6 * DAY;
    const inWeek = all.filter((h) => h.at >= from);
    const days = Array.from({ length: 7 }, (_, i) => {
      const start = from + i * DAY;
      const label = i === 6 ? "Today" : new Date(start).toLocaleDateString(undefined, { weekday: "short" });
      return { label, count: inWeek.filter((h) => h.at >= start && h.at < start + DAY).length };
    });
    const answered = inWeek.filter((h) => h.status !== undefined);
    const ok = answered.filter((h) => entryStatus(h).ok).length;
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
    return { days, sent: inWeek.length, rate: inWeek.length ? ok / inWeek.length : null, median, top };
  })();

  const max = Math.max(1, ...week.days.map((d) => d.count));

  const remove = (id: string, name: string) =>
    st.openModal({
      kind: "confirm",
      title: `Delete “${name}”?`,
      message: "Its collections, environments, history and open tabs are deleted. This cannot be undone.",
      onConfirm: () => st.deleteProject(id),
    });

  return (
    <main className="home">
      <div className="home-inner">
        <header className="home-head">
          <div>
            <h1>{greeting(new Date().getHours())}</h1>
            <p className="muted">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
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
        </header>

        <section aria-labelledby="h-projects">
          <h2 id="h-projects">Projects</h2>
          <div className="projects">
            {byCreated.map(({ meta, data }) => (
              <div key={meta.id} className="project-card">
                <button type="button" className="project-open" aria-label={`Open ${meta.name}`} onClick={() => st.openProject(meta.id)} />
                <ProjectTile icon={meta.icon} color={meta.color} />
                <span className="proj-name">{meta.name}</span>
                <span className="proj-cols">{data.collections.map((c) => c.name).join(", ") || "No collections yet"}</span>
                <dl className="proj-facts">
                  <div>
                    <dt>Collections</dt>
                    <dd>{data.collections.length}</dd>
                  </div>
                  <div>
                    <dt>Requests</dt>
                    <dd>{data.collections.reduce((n, c) => n + countRequests(c.children), 0)}</dd>
                  </div>
                  <div>
                    <dt>Environments</dt>
                    <dd>{data.environments.length}</dd>
                  </div>
                </dl>
                <span className="proj-when">Opened {ago(meta.openedAt)}</span>
                <span className="card-actions">
                  <button type="button" className="icon-btn" title="Edit project" aria-label={`Edit ${meta.name}`} onClick={() => st.openModal({ kind: "project", projectId: meta.id })}>
                    <Pencil {...ico} />
                  </button>
                  <button type="button" className="icon-btn" title="Delete project" aria-label={`Delete ${meta.name}`} onClick={() => remove(meta.id, meta.name)}>
                    <X {...ico} />
                  </button>
                </span>
              </div>
            ))}
            <button type="button" className="project-card project-card--new" onClick={() => st.openModal({ kind: "project" })}>
              <Plus {...icoLg} />
              <span>New project</span>
            </button>
          </div>
        </section>

        <div className="home-grid">
          <section className="panel-box" aria-labelledby="h-week">
            <h2 id="h-week">Last 7 days</h2>
            <dl className="stats">
              <div>
                <dt>Requests sent</dt>
                <dd>{week.sent.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Success rate</dt>
                <dd>{week.rate === null ? "None yet" : `${(week.rate * 100).toFixed(1)}%`}</dd>
              </div>
              <div>
                <dt>Median response</dt>
                <dd>{week.median === null ? "None yet" : `${week.median.toLocaleString()} ms`}</dd>
              </div>
              <div>
                <dt>Most called</dt>
                <dd className="stat-text">
                  {week.top ? (
                    <>
                      <span className={`m m-${week.top.method}`}>{methodLabel(week.top.method)}</span>
                      <span title={week.top.path}>{week.top.path}</span>
                    </>
                  ) : (
                    "None yet"
                  )}
                </dd>
              </div>
            </dl>
            <figure className="bars" aria-labelledby="h-week-chart">
              <figcaption id="h-week-chart" className="muted">
                Requests sent per day
              </figcaption>
              <div className="bars-plot" aria-hidden="true">
                {week.days.map((d, i) => (
                  <div key={i} className="bar-col">
                    <span
                      className={`bar${i === 6 ? " bar--today" : ""}`}
                      style={{ "--h": `${(d.count / max) * 100}%` } as React.CSSProperties}
                      data-tip={`${d.count.toLocaleString()} ${d.count === 1 ? "request" : "requests"}`}
                    />
                    <span className="bar-day">{d.label}</span>
                  </div>
                ))}
              </div>
              <table className="visually-hidden">
                <caption>Requests sent per day</caption>
                <tbody>
                  {week.days.map((d, i) => (
                    <tr key={i}>
                      <th>{d.label}</th>
                      <td>{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </figure>
          </section>

          <section className="panel-box" aria-labelledby="h-recent">
            <h2 id="h-recent">Recent requests</h2>
            {all.length === 0 ? (
              <div className="empty">
                <strong>Nothing sent yet</strong>
                <span>Open a project and press ⌘ Enter on a request.</span>
              </div>
            ) : (
              <table className="recent">
                <thead>
                  <tr>
                    <th>
                      <span className="visually-hidden">Method</span>
                    </th>
                    <th>Path</th>
                    <th>Project</th>
                    <th>Status</th>
                    <th>
                      <span className="visually-hidden">When</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {all.slice(0, 6).map((h: HistoryEntry & { project: (typeof projects)[number] }) => (
                    <tr key={h.id}>
                      <td>
                        <span className={`m m-${h.request.method}`}>{methodLabel(h.request.method)}</span>
                      </td>
                      <td className="url" title={h.request.url}>
                        {pathOf(h.request.url)}
                      </td>
                      <td className="muted">
                        <span className="recent-proj">
                          <ProjectTile icon={h.project.icon} color={h.project.color} small />
                          {h.project.name}
                        </span>
                      </td>
                      <td>
                        <span className={`hstatus ${entryStatus(h).ok ? "ok" : "fail"}`}>{entryStatus(h).text}</span>
                      </td>
                      <td className="muted when">{ago(h.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
