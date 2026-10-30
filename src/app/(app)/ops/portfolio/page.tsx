import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge, cx, EmptyState, PageHeader } from "@/components/ui";
import { can, requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { dueMonthWhere, monthOptions, projectMonthWhere } from "@/lib/ops-pipeline";
import { PORTFOLIO_STATUS_LABEL, PORTFOLIO_STATUSES, projectProgress, readPortfolioFilters, sortPortfolio, type ProjectStatus } from "@/lib/ops-portfolio";
import type { TaskStatus } from "@/lib/tasks";
import { readParams, withParams, type SearchParams } from "@/lib/url";
import { AutoSubmitSelect } from "../pipeline/pipeline-forms";
import { setProjectStatus } from "./actions";

// Ops Tracker › Portfolio: the client's "Project Portfolio" sheet. Managers only (plan v2). Task counts are live from
// the Task Pipeline; the month filter counts the tasks of that month, using the pipeline's Month rule.

const STATUS_TONE: Record<ProjectStatus, "blue" | "amber" | "green" | "slate"> = { ACTIVE: "blue", ON_HOLD: "amber", COMPLETED: "green", CANCELLED: "slate" };
const selectClass = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm";
const th = "px-3 py-2 font-medium";
const td = "px-3 py-2.5";

export default async function OpsPortfolioPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("ops.manage");
  const params = await readParams(searchParams);
  const f = readPortfolioFilters(params);
  const href = (o: Record<string, string | undefined>) => withParams("/ops/portfolio", params, o);

  const and: Prisma.ProjectWhereInput[] = [];
  if (f.month !== "all") and.push(projectMonthWhere(f.month));
  if (f.client) and.push({ clientId: f.client });
  if (f.lead) and.push({ members: { some: { userId: f.lead, role: "MANAGER" } } });
  if (f.status) and.push({ status: f.status });

  const [projects, counts, clients, leads, managed] = await Promise.all([
    db.project.findMany({
      where: { AND: and },
      include: { client: { select: { name: true } }, members: { where: { role: "MANAGER" }, select: { user: { select: { name: true } } } } },
    }),
    db.task.groupBy({ by: ["projectId", "status"], where: f.month !== "all" ? dueMonthWhere(f.month) : {}, _count: { _all: true } }),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { projectMembers: { some: { role: "MANAGER" } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // Same rule as canManageProject, loaded once for the whole table.
    can(user, "projects.manage") && !can(user, "projects.view_all")
      ? db.projectMember.findMany({ where: { userId: user.id, role: "MANAGER" }, select: { projectId: true } }).then((m) => new Set(m.map((x) => x.projectId)))
      : null,
  ]);
  const canEdit = (projectId: string) => can(user, "projects.manage") && (managed ? managed.has(projectId) : can(user, "projects.view_all"));

  const byProject = new Map<string, { status: TaskStatus; count: number }[]>();
  for (const c of counts) byProject.set(c.projectId, [...(byProject.get(c.projectId) ?? []), { status: c.status, count: c._count._all }]);
  const rows = sortPortfolio(
    projects.map((p) => ({ ...p, progress: projectProgress(byProject.get(p.id) ?? []) })),
    f.sort,
  );
  const active = rows.filter((r) => r.status === "ACTIVE").length;
  const done = rows.filter((r) => r.status === "COMPLETED").length;
  const filtersActive = !!(f.client || f.lead || f.status);

  const sortHeader = (key: string, label: string) => (
    <Link href={href({ sort: key === "code" ? undefined : key })} className={cx("hover:text-slate-900", f.sort === key && "font-semibold text-slate-900")}>
      {label}
      {f.sort === key ? " ↓" : ""}
    </Link>
  );

  return (
    <>
      <PageHeader title="Portfolio" subtitle="Every project's timeline, status and task completion, counted live from the Task Pipeline." />

      <form action="/ops/portfolio" className="mb-3 flex flex-wrap items-center gap-2">
        <select name="month" defaultValue={f.month} className={selectClass} aria-label="Filter month">
          {monthOptions().map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
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
        {f.sort !== "code" && <input type="hidden" name="sort" value={f.sort} />}
        <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
        {filtersActive && (
          <Link href={withParams("/ops/portfolio", { month: params.month }, {})} className="text-sm text-slate-500 underline">
            Clear filters
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No projects match these filters">Try another month or clear the filters.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs whitespace-nowrap text-slate-500">
              <tr>
                <th className={th}>{sortHeader("code", "Project ID")}</th>
                <th className={th}>Project Name</th>
                <th className={th}>Client</th>
                <th className={th}>Project Lead</th>
                <th className={th}>Start Date</th>
                <th className={th}>{sortHeader("due", "Target Due Date")}</th>
                <th className={th}>Status</th>
                <th className={cx(th, "text-right")}>Total Tasks</th>
                <th className={cx(th, "text-right")}>Completed Tasks</th>
                <th className={cx(th, "text-right")}>{sortHeader("completion", "Completion Rate")}</th>
                <th className={cx(th, "w-48")}>Progress Bar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className={cx(td, "font-mono text-xs whitespace-nowrap text-slate-500")}>{p.code ?? "—"}</td>
                  <td className={td}>
                    <Link href={withParams("/ops/pipeline", { project: p.id, month: f.month }, {})} className="font-medium text-slate-900 hover:text-brand-700 hover:underline" title="Open this project's tasks in the Task Pipeline">
                      {p.name}
                    </Link>
                  </td>
                  <td className={cx(td, "whitespace-nowrap text-slate-600")}>{p.client.name}</td>
                  <td className={cx(td, "whitespace-nowrap text-slate-600")}>{p.members.map((m) => m.user.name).join(", ") || <span className="text-slate-400">—</span>}</td>
                  <td className={cx(td, "whitespace-nowrap text-slate-600")}>{formatDate(p.startDate)}</td>
                  <td className={cx(td, "whitespace-nowrap text-slate-600")}>{formatDate(p.endDate)}</td>
                  <td className={td}>
                    {canEdit(p.id) ? (
                      <AutoSubmitSelect action={setProjectStatus} hidden={{ id: p.id }} name="status" value={p.status} label={`Status of ${p.code ?? p.name}`} options={PORTFOLIO_STATUSES.map((s) => ({ value: s, label: PORTFOLIO_STATUS_LABEL[s] }))} />
                    ) : (
                      <Badge tone={STATUS_TONE[p.status]}>{PORTFOLIO_STATUS_LABEL[p.status]}</Badge>
                    )}
                  </td>
                  <td className={cx(td, "text-right text-slate-600 tabular-nums")}>{p.progress.total}</td>
                  <td className={cx(td, "text-right text-slate-600 tabular-nums")}>{p.progress.completed}</td>
                  <td className={cx(td, "text-right font-semibold text-slate-800 tabular-nums")}>{p.progress.rate.toFixed(1)}%</td>
                  <td className={td}>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${p.progress.rate.toFixed(1)}% complete`}>
                      <div className={cx("h-full rounded-full", p.progress.rate >= 100 ? "bg-emerald-500" : "bg-brand-600")} style={{ width: `${Math.min(100, p.progress.rate)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        {rows.length} {rows.length === 1 ? "project" : "projects"} · {active} in progress · {done} completed ·{" "}
        {f.month === "all" ? "all tasks counted" : "counting tasks due in the selected month"} · declined tasks are not counted
      </p>
    </>
  );
}
