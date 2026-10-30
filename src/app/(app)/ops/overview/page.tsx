import Link from "next/link";
import type { ReactNode } from "react";
import { Donut } from "@/components/charts";
import { Avatar, Badge, Card, cx, EmptyState, PageHeader, Segmented } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, monthLabel } from "@/lib/format";
import { PIPELINE_STATUS_LABEL, pipelineSummary, slaStatus } from "@/lib/ops-metrics";
import {
  countsByProject,
  daysUntil,
  ESCALATION_DAYS,
  HEALTH_LABELS,
  inRadarView,
  matchesProject,
  ON_TIME_TARGET,
  RADAR_VIEWS,
  readOverviewFilters,
  riskRadar,
  sortTracker,
  type RadarLevel,
  type RadarView,
} from "@/lib/ops-overview";
import { dueMonthWhere, monthOptions, projectMonthWhere } from "@/lib/ops-pipeline";
import { PORTFOLIO_STATUS_LABEL, PORTFOLIO_STATUSES, projectProgress, type ProjectStatus } from "@/lib/ops-portfolio";
import { TIME_ZONE, todayUtc } from "@/lib/org";
import { projectHealth, STATUS_COLOR, statusBreakdown, type HealthTone } from "@/lib/project-health";
import type { TaskStatus } from "@/lib/tasks";
import { readParams, withParams, type SearchParams } from "@/lib/url";
import { MonthFilter } from "./month-filter";

// Ops Tracker › Overview: the client's "Executive Operations Dashboard" sheet. Managers only (plan v2). Every figure is
// live from the Task Pipeline and uses its rules: the month filter keeps tasks due in that month (pipeline Month rule)
// and projects running in it (Portfolio rule), and drives the KPIs, the health tracker and the radar alike.

const STATUS_TONE: Record<ProjectStatus, "blue" | "amber" | "green" | "slate"> = { ACTIVE: "blue", ON_HOLD: "amber", COMPLETED: "green", CANCELLED: "slate" };
const HEALTH_BAR: Record<HealthTone, string> = { green: "bg-emerald-500", amber: "bg-amber-400", red: "bg-rose-500", slate: "bg-slate-300" };
const HEALTH_DOT: Record<HealthTone, string> = { green: "bg-emerald-500", amber: "bg-amber-400", red: "bg-rose-500", slate: "bg-slate-400" };
const LEVEL_STYLE: Record<RadarLevel, { label: string; rail: string; badge: "red" | "amber" | "slate" }> = {
  critical: { label: "Critical", rail: "bg-rose-500", badge: "red" },
  overdue: { label: "Overdue", rail: "bg-amber-400", badge: "amber" },
  blocked: { label: "Blocked", rail: "bg-slate-400", badge: "slate" },
};
const RADAR_LABEL: Record<RadarView, string> = { all: "All at risk", critical: `Critical (>${ESCALATION_DAYS}d)`, overdue: "Overdue", blocked: "Blocked" };
const selectClass = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm";
const th = "px-4 py-2.5 font-medium";
const td = "px-4 py-3";

export default async function OpsOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("ops.manage");
  const params = await readParams(searchParams);
  const f = readOverviewFilters(params);
  const href = (o: Record<string, string | undefined>, hash = "") => withParams("/ops/overview", params, o) + hash;
  const now = new Date();
  const today = todayUtc(now);
  const all = f.month === "all";

  const [tasks, projects, clients, leads] = await Promise.all([
    db.task.findMany({
      where: all ? {} : dueMonthWhere(f.month),
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        deadline: true,
        completedDate: true,
        assignedDate: true,
        projectId: true,
        blockerNote: true,
        project: { select: { name: true } },
        assignee: { select: { name: true } },
        reviewer: { select: { name: true } },
        blockerType: { select: { name: true } },
      },
    }),
    db.project.findMany({
      where: all ? {} : projectMonthWhere(f.month),
      include: { client: { select: { id: true, name: true } }, members: { where: { role: "MANAGER" }, select: { user: { select: { id: true, name: true } } } } },
    }),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { projectMembers: { some: { role: "MANAGER" } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // KPIs: the same summary the Task Pipeline's chips use.
  const summary = pipelineSummary(tasks, now, TIME_ZONE);
  const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;
  const openTasks = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "DECLINED").length;

  // Project Health & Milestone Tracker: Portfolio completion plus the workspace's health rule, over the month's tasks.
  const countsFor = countsByProject(tasks);
  const overdueBy = new Map<string, number>();
  for (const t of tasks) if (slaStatus(t, now, TIME_ZONE) === "OVERDUE") overdueBy.set(t.projectId, (overdueBy.get(t.projectId) ?? 0) + 1);
  const rows = projects.map((p) => {
    const counts = countsFor(p.id);
    const overdue = overdueBy.get(p.id) ?? 0;
    const health = projectHealth({ status: p.status, startDate: p.startDate, endDate: p.endDate, counts, overdueTasks: overdue, now: today });
    return { ...p, clientName: p.client.name, leads: p.members.map((m) => m.user.name), leadIds: p.members.map((m) => m.user.id), progress: projectProgress(counts), overdue, health: health.label, healthTone: health.tone };
  });
  const healthMix = HEALTH_LABELS.map((label) => ({ label, rows: rows.filter((r) => r.health === label) })).filter((h) => h.rows.length > 0);
  const tracker = sortTracker(
    rows.filter(
      (r) =>
        matchesProject(r, f.q) &&
        (!f.client || r.client.id === f.client) &&
        (!f.lead || r.leadIds.includes(f.lead)) &&
        (!f.status || r.status === f.status) &&
        (!f.health || r.health === f.health),
    ),
    f.sort,
  );
  const trackerFiltered = !!(f.q || f.client || f.lead || f.status || f.health);

  // At-Risk Escalation Radar.
  const radar = riskRadar(tasks, now, TIME_ZONE);
  const radarRows = radar.filter((i) => inRadarView(i, f.radar));
  const critical = radar.filter((i) => i.level === "critical").length;

  const breakdown = statusBreakdown(statusCounts(tasks));
  const pipelineHref = (o: Record<string, string | undefined> = {}) => withParams("/ops/pipeline", { month: f.month, ...o }, {});
  const scope = all ? "All months" : monthLabel(f.month);
  const sortHeader = (key: string, label: string) => (
    <Link href={href({ sort: key === "code" ? undefined : key }, "#tracker")} className={cx("hover:text-slate-900", f.sort === key && "font-semibold text-slate-900")}>
      {label}
      {f.sort === key ? " ↓" : ""}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Executive view of delivery health across every project, live from the Task Pipeline."
        actions={<MonthFilter month={f.month} options={monthOptions()} keep={{ q: f.q, client: f.client, lead: f.lead, status: f.status, health: f.health, sort: f.sort === "code" ? undefined : f.sort, radar: f.radar === "all" ? undefined : f.radar }} />}
      />

      {/* Executive KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          href={withParams("/ops/portfolio", { month: all ? undefined : f.month, status: "ACTIVE" }, {})}
          label="Active projects"
          value={activeProjects}
          hint={`${projects.length} ${projects.length === 1 ? "project" : "projects"} in ${all ? "the portfolio" : scope}`}
          accent="bg-brand-600"
        />
        <Kpi href={pipelineHref()} label="Pipeline tasks" value={tasks.length} hint={`${openTasks} open · ${summary.byStatus.COMPLETED} completed`} accent="bg-sky-500" />
        <OnTimeKpi href={pipelineHref()} rate={summary.onTimeRate} onTime={summary.onTime} late={summary.late} />
        <Kpi
          href={pipelineHref({ overdue: "1" })}
          label="Overdue tasks"
          value={summary.overdueOpen}
          hint={summary.overdueOpen ? `${critical} past ${ESCALATION_DAYS} days · needs manager review` : "Nothing is past its due date"}
          accent={summary.overdueOpen ? "bg-rose-500" : "bg-emerald-500"}
          valueClass={summary.overdueOpen ? "text-rose-600" : undefined}
        />
      </div>

      {/* Visual summaries */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Task status" actions={<span className="text-xs text-slate-500">{scope}</span>}>
          {breakdown.total === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No tasks {all ? "yet" : "due this month"}.</p>
          ) : (
            <div className="flex items-center gap-5">
              <Donut label={`${breakdown.total} tasks by status`} size={128} thickness={14} slices={breakdown.rows.map((r) => ({ label: PIPELINE_STATUS_LABEL[r.status], value: r.count, color: STATUS_COLOR[r.status] }))}>
                <span className="text-2xl font-bold text-ink tabular-nums">{breakdown.total}</span>
                <span className="text-[11px] text-slate-500">tasks</span>
              </Donut>
              <ul className="min-w-0 flex-1 space-y-1 text-sm">
                {breakdown.rows
                  .filter((r) => r.count > 0)
                  .map((r) => (
                    <li key={r.status} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLOR[r.status] }} />
                      <Link href={pipelineHref({ status: r.status })} className="truncate text-slate-600 hover:text-brand-700">
                        {PIPELINE_STATUS_LABEL[r.status]}
                      </Link>
                      <span className="ml-auto font-medium text-slate-800 tabular-nums">{r.count}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Delivery SLA" actions={<span className="text-xs text-slate-500">due-dated tasks</span>}>
          <SlaBreakdown onTime={summary.onTime} late={summary.late} overdue={summary.overdueOpen} />
        </Card>

        <Card title="Project health" actions={<span className="text-xs text-slate-500">{rows.length} projects</span>}>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No projects in this period.</p>
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Projects by health">
                {healthMix.map((h) => (
                  <div key={h.label} className={HEALTH_BAR[h.rows[0]!.healthTone]} style={{ width: `${(h.rows.length / rows.length) * 100}%` }} title={`${h.label}: ${h.rows.length}`} />
                ))}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {healthMix.map((h) => (
                  <li key={h.label}>
                    <Link href={href({ health: f.health === h.label ? undefined : h.label }, "#tracker")} className={cx("flex items-center gap-2 rounded-md px-1 hover:bg-slate-50", f.health === h.label && "bg-brand-50")}>
                      <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", HEALTH_DOT[h.rows[0]!.healthTone])} />
                      <span className="truncate text-slate-600">{h.label}</span>
                      <span className="ml-auto font-medium text-slate-800 tabular-nums">{h.rows.length}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* Project Health & Milestone Tracker */}
      <section id="tracker" className="mt-6 scroll-mt-4">
        <SectionTitle title="Project health & milestones" subtitle="Completion counts the month's tasks; declined tasks are not counted. Open a project for its workspace." />
        <form action="/ops/overview#tracker" className="mb-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="month" value={f.month} />
          {f.sort !== "code" && <input type="hidden" name="sort" value={f.sort} />}
          {f.radar !== "all" && <input type="hidden" name="radar" value={f.radar} />}
          <input name="q" defaultValue={f.q} placeholder="Search project, ID, client or lead…" className={cx(selectClass, "w-64")} aria-label="Search projects" />
          <select name="client" defaultValue={f.client ?? ""} className={selectClass} aria-label="Client">
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="lead" defaultValue={f.lead ?? ""} className={selectClass} aria-label="Project lead">
            <option value="">Any lead</option>
            {leads.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={f.status ?? ""} className={selectClass} aria-label="Status">
            <option value="">Any status</option>
            {PORTFOLIO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PORTFOLIO_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select name="health" defaultValue={f.health ?? ""} className={selectClass} aria-label="Health">
            <option value="">Any health</option>
            {HEALTH_LABELS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
          {trackerFiltered && (
            <Link href={withParams("/ops/overview", { month: params.month, sort: params.sort, radar: params.radar }, {}) + "#tracker"} className="text-sm text-slate-500 underline">
              Clear filters
            </Link>
          )}
        </form>

        {tracker.length === 0 ? (
          <EmptyState title={rows.length ? "No projects match these filters" : "No projects in this period"}>
            {rows.length ? "Try another search or clear the filters." : "Pick another month, or add a project from Projects."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-cream-200 bg-white shadow-sm">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs whitespace-nowrap text-slate-500">
                <tr>
                  <th className={th}>{sortHeader("code", "Project")}</th>
                  <th className={th}>Client</th>
                  <th className={th}>Project lead</th>
                  <th className={th}>{sortHeader("due", "Target due date")}</th>
                  <th className={th}>Status</th>
                  <th className={th}>{sortHeader("risk", "Health")}</th>
                  <th className={cx(th, "w-56")}>{sortHeader("completion", "Completion")}</th>
                </tr>
              </thead>
              <tbody>
                {tracker.map((p) => (
                  <tr key={p.id} className="group border-b border-slate-100 last:border-0 hover:bg-brand-50/40">
                    <td className={td}>
                      <Link href={`/projects/${p.id}`} className="block" title="Open the project workspace">
                        <span className="font-mono text-[11px] text-slate-400">{p.code ?? "—"}</span>
                        <span className="block font-semibold text-slate-900 group-hover:text-brand-700">{p.name}</span>
                      </Link>
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>{p.clientName}</td>
                    <td className={td}>
                      {p.leads.length ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Avatar name={p.leads[0]!} size="sm" />
                          <span className="text-slate-700">{p.leads.join(", ")}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={cx(td, "whitespace-nowrap")}>
                      <div className="text-slate-700">{formatDate(p.endDate)}</div>
                      <DueHint end={p.endDate} today={today} status={p.status} />
                    </td>
                    <td className={td}>
                      <Badge tone={STATUS_TONE[p.status]}>{PORTFOLIO_STATUS_LABEL[p.status]}</Badge>
                    </td>
                    <td className={cx(td, "whitespace-nowrap")}>
                      <span className="inline-flex items-center gap-1.5 text-slate-700">
                        <span className={cx("h-2 w-2 rounded-full", HEALTH_DOT[p.healthTone])} />
                        {p.health}
                      </span>
                      {p.overdue > 0 && (
                        <Link href={pipelineHref({ project: p.id, overdue: "1" })} className="block text-xs text-rose-600 hover:underline">
                          {p.overdue} overdue {p.overdue === 1 ? "task" : "tasks"}
                        </Link>
                      )}
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${p.progress.rate.toFixed(1)}% complete`}>
                          <div className={cx("h-full rounded-full", p.progress.rate >= 100 ? "bg-emerald-500" : "bg-brand-600")} style={{ width: `${Math.min(100, p.progress.rate)}%` }} />
                        </div>
                        <span className="w-12 text-right font-semibold text-slate-800 tabular-nums">{p.progress.rate.toFixed(1)}%</span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                        {p.progress.completed} of {p.progress.total} tasks
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Showing {tracker.length} of {rows.length} {rows.length === 1 ? "project" : "projects"} · {all ? "all tasks counted" : `counting tasks due in ${scope}`}
        </p>
      </section>

      {/* At-Risk Escalation Radar */}
      <section id="radar" className="mt-6 scroll-mt-4">
        <SectionTitle title="At-risk escalation radar" subtitle={`Open tasks past their due date or blocked, oldest first. Overdue by more than ${ESCALATION_DAYS} days is critical.`} />
        <div className="mb-3 max-w-xl">
          <Segmented
            items={RADAR_VIEWS.map((v) => ({
              label: (
                <>
                  {RADAR_LABEL[v]} <span className="ml-0.5 text-xs tabular-nums opacity-70">{radar.filter((i) => inRadarView(i, v)).length}</span>
                </>
              ),
              href: href({ radar: v === "all" ? undefined : v }, "#radar"),
              active: f.radar === v,
            }))}
          />
        </div>
        {radarRows.length === 0 ? (
          <EmptyState title={radar.length ? "Nothing in this view" : "No tasks need escalation"}>
            {radar.length ? "Pick another view above." : `Every open task ${all ? "" : `due in ${scope} `}is on schedule and unblocked.`}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-cream-200 bg-white shadow-sm">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs whitespace-nowrap text-slate-500">
                <tr>
                  <th className={cx(th, "pl-5")}>Task</th>
                  <th className={th}>Project</th>
                  <th className={th}>Assignee</th>
                  <th className={th}>Due date</th>
                  <th className={th}>Urgency</th>
                  <th className={th}>Blocker category</th>
                  <th className={th}>Reviewer</th>
                </tr>
              </thead>
              <tbody>
                {radarRows.map(({ task: t, level, daysOverdue, blocked }) => (
                  <tr key={t.id} className="group relative border-b border-slate-100 last:border-0 hover:bg-brand-50/40">
                    <td className={cx(td, "relative pl-5")}>
                      <span className={cx("absolute inset-y-2 left-1.5 w-1 rounded-full", LEVEL_STYLE[level].rail)} aria-hidden />
                      <Link href={pipelineHref({ task: t.id })} className="block" title="Open in the Task Pipeline">
                        <span className="font-mono text-[11px] text-slate-400">{t.code}</span>
                        <span className="block max-w-[320px] truncate font-medium text-slate-900 group-hover:text-brand-700">{t.title}</span>
                      </Link>
                    </td>
                    <td className={cx(td, "max-w-[220px] truncate text-slate-600")}>
                      <Link href={`/projects/${t.projectId}`} className="hover:text-brand-700 hover:underline">
                        {t.project.name}
                      </Link>
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={t.assignee.name} size="sm" />
                        <span className="text-slate-700">{t.assignee.name}</span>
                      </div>
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>{formatDate(t.deadline)}</td>
                    <td className={cx(td, "whitespace-nowrap")}>
                      <Badge tone={LEVEL_STYLE[level].badge}>{daysOverdue > 0 ? `Overdue (${daysOverdue}d)` : LEVEL_STYLE[level].label}</Badge>
                      {blocked && daysOverdue > 0 && <span className="ml-1 text-xs text-slate-500">· blocked</span>}
                    </td>
                    <td className={cx(td, "text-slate-600")}>
                      {t.blockerType ? <span title={t.blockerNote ?? undefined}>{t.blockerType.name}</span> : <span className="text-slate-400">{blocked ? "No reason given" : "None"}</span>}
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>{t.reviewer?.name ?? <span className="text-slate-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function statusCounts(tasks: { status: TaskStatus }[]) {
  const m = new Map<TaskStatus, number>();
  for (const t of tasks) m.set(t.status, (m.get(t.status) ?? 0) + 1);
  return [...m].map(([status, count]) => ({ status, count }));
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function KpiShell({ href, label, accent, children }: { href: string; label: string; accent: string; children: ReactNode }) {
  return (
    <Link href={href} className="group relative overflow-hidden rounded-2xl border border-cream-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <span className={cx("absolute inset-x-0 top-0 h-1", accent)} aria-hidden />
      <div className="flex items-center justify-between text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
        <span className="text-slate-300 transition group-hover:text-brand-600" aria-hidden>
          →
        </span>
      </div>
      {children}
    </Link>
  );
}

function Kpi({ href, label, value, hint, accent, valueClass }: { href: string; label: string; value: number; hint: string; accent: string; valueClass?: string }) {
  return (
    <KpiShell href={href} label={label} accent={accent}>
      <div className={cx("mt-2 text-4xl font-bold tracking-tight text-ink tabular-nums", valueClass)}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </KpiShell>
  );
}

/** On-time rate against the 85% benchmark: green at or above it, amber within 10 points, red below that (A). */
function OnTimeKpi({ href, rate, onTime, late }: { href: string; rate: number | null; onTime: number; late: number }) {
  const tone = rate == null ? "slate" : rate >= ON_TIME_TARGET ? "green" : rate >= ON_TIME_TARGET - 10 ? "amber" : "red";
  const text = { green: "text-emerald-600", amber: "text-amber-600", red: "text-rose-600", slate: "text-slate-400" }[tone];
  const bar = { green: "bg-emerald-500", amber: "bg-amber-400", red: "bg-rose-500", slate: "bg-slate-300" }[tone];
  return (
    <KpiShell href={href} label="Org on-time rate" accent={bar}>
      <div className={cx("mt-2 text-4xl font-bold tracking-tight tabular-nums", text)}>{rate == null ? "—" : `${rate.toFixed(1)}%`}</div>
      <div className="relative mt-3 h-1.5 rounded-full bg-slate-100" role="img" aria-label={`On-time rate ${rate == null ? "not available" : `${rate.toFixed(1)}%`}, target ${ON_TIME_TARGET}%`}>
        <div className={cx("h-full rounded-full", bar)} style={{ width: `${Math.min(100, rate ?? 0)}%` }} />
        <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-ink" style={{ left: `${ON_TIME_TARGET}%` }} title={`Target ${ON_TIME_TARGET}%`} />
      </div>
      <div className="mt-1.5 text-xs text-slate-500">{rate == null ? "No finished tasks with a due date yet" : `Target ≥ ${ON_TIME_TARGET}% · ${onTime} on time, ${late} late`}</div>
    </KpiShell>
  );
}

function SlaBreakdown({ onTime, late, overdue }: { onTime: number; late: number; overdue: number }) {
  const parts = [
    { label: "On time", value: onTime, color: "bg-emerald-500" },
    { label: "Late completion", value: late, color: "bg-amber-400" },
    { label: "Overdue (open)", value: overdue, color: "bg-rose-500" },
  ];
  const total = onTime + late + overdue;
  if (!total) return <p className="py-6 text-center text-sm text-slate-500">No finished or overdue tasks with a due date yet.</p>;
  return (
    <>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Delivery against due dates">
        {parts.map((p) => p.value > 0 && <div key={p.label} className={p.color} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.value}`} />)}
      </div>
      <ul className="mt-4 space-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={cx("h-2.5 w-2.5 rounded-full", p.color)} />
            <span className="text-slate-600">{p.label}</span>
            <span className="ml-auto font-medium text-slate-800 tabular-nums">{p.value}</span>
            <span className="w-12 text-right text-xs text-slate-400 tabular-nums">{((p.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Countdown under the target due date for projects still running. */
function DueHint({ end, today, status }: { end: Date | null; today: Date; status: ProjectStatus }) {
  if (!end || status === "COMPLETED" || status === "CANCELLED") return null;
  const d = daysUntil(end, today);
  if (d < 0) return <div className="text-xs text-rose-600">{-d}d past target</div>;
  if (d === 0) return <div className="text-xs text-amber-600">Due today</div>;
  return <div className={cx("text-xs", d <= 14 ? "text-amber-600" : "text-slate-400")}>in {d}d</div>;
}
