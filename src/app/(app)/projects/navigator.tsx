import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { MonthPicker } from "@/components/month-picker";
import { Badge, cx, EmptyState, LinkButton } from "@/components/ui";
import { can, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentMonth, formatHours, monthLabel, monthRange } from "@/lib/format";
import { BILLING_LABEL } from "@/lib/labels";
import { PORTFOLIO_STATUS_LABEL, PORTFOLIO_STATUSES, projectProgress } from "@/lib/ops-portfolio";
import { effectiveScope, projectWhere, type Billability } from "@/lib/projects";
import { withParams } from "@/lib/url";
import { NavigatorShell } from "./navigator-shell";

// Harmony's Projects column: month, Add Project, My/All Projects, search + filter, Projects/Clients, All/Billable/
// Non-billable, then one card per project. Harmony's card bar is consumed ÷ allocated hours; BuildAtScaleOS has no
// allocations, so the bar is task completion and the hours are those logged in the selected month (A).

// Navigator state lives in the URL so it survives moving between projects. Tab and workstream are per project.
const KEEP = ["month", "scope", "bill", "q", "client", "status", "view"] as const;
export const navParams = (params: Record<string, string | undefined>) => Object.fromEntries(KEEP.map((k) => [k, params[k]]));

export function readNavigator(params: Record<string, string | undefined>) {
  return {
    month: /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : currentMonth(),
    scope: effectiveScope(params.scope),
    billability: (["billable", "non-billable"].includes(params.bill ?? "") ? params.bill : "all") as Billability,
    q: params.q?.trim() || undefined,
    clientId: params.client || undefined,
    status: PORTFOLIO_STATUSES.includes(params.status as ProjectStatus) ? (params.status as ProjectStatus) : undefined,
    view: params.view === "clients" ? ("clients" as const) : ("projects" as const),
  };
}

export async function navigatorProjects(user: CurrentUser, params: Record<string, string | undefined>) {
  const n = readNavigator(params);
  return db.project.findMany({
    where: projectWhere(user, n.scope, n.q, { billability: n.billability, clientId: n.clientId, status: n.status }),
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true, billingType: true, isBillable: true, client: { select: { name: true } } },
  });
}

export async function ProjectNavigator({ user, params, selectedId, selectedName }: { user: CurrentUser; params: Record<string, string | undefined>; selectedId?: string; selectedName?: string }) {
  const n = readNavigator(params);
  const nav = navParams(params);
  const href = (o: Record<string, string | undefined>) => withParams(selectedId ? `/projects/${selectedId}` : "/projects", nav, o);
  const { start, end } = monthRange(n.month);

  const [projects, myCount, allCount, clients] = await Promise.all([
    navigatorProjects(user, params),
    db.project.count({ where: projectWhere(user, "my") }),
    db.project.count({ where: projectWhere(user, "all") }),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, _count: { select: { projects: { where: projectWhere(user, n.scope) } } } } }),
  ]);
  const ids = projects.map((p) => p.id);
  const [taskCounts, hours] = await Promise.all([
    db.task.groupBy({ by: ["projectId", "status"], where: { projectId: { in: ids } }, _count: { _all: true } }),
    db.timeEntry.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, date: { gte: start, lt: end } }, _sum: { hours: true } }),
  ]);
  const progress = (id: string) => projectProgress(taskCounts.filter((c) => c.projectId === id).map((c) => ({ status: c.status, count: c._count._all })));
  const logged = (id: string) => Number(hours.find((h) => h.projectId === id)?._sum.hours ?? 0);
  const filtersActive = !!(n.clientId || n.status);

  return (
    <NavigatorShell selectedName={selectedName}>
      <div className="flex h-full flex-col rounded-2xl border border-cream-200 bg-white">
        <div className="space-y-3 border-b border-cream-200 p-4">
          <h1 className="text-xl font-bold tracking-tight text-ink">Projects</h1>
          <div className="flex items-center justify-between gap-2">
            <MonthPicker month={n.month} hrefFor={(m) => href({ month: m })} />
            {can(user, "projects.manage") && (
              <LinkButton href={withParams("/projects/new", nav, {})} size="md">
                + Add Project
              </LinkButton>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-cream-200 text-sm">
          {(["my", "all"] as const).map((s) => (
            <Link
              key={s}
              href={href({ scope: s === "my" ? undefined : s })}
              className={cx("-mb-px border-b-2 px-3 py-2.5 text-center", n.scope === s ? "border-brand-600 font-bold text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}
            >
              {s === "my" ? `My Projects (${myCount})` : `All Projects (${allCount})`}
            </Link>
          ))}
        </div>

        <div className="space-y-2 p-3">
          <form action={selectedId ? `/projects/${selectedId}` : "/projects"} className="flex gap-2">
            {Object.entries(nav)
              .filter(([k, v]) => k !== "q" && v)
              .map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
            <input name="q" defaultValue={n.q} placeholder="Search" aria-label="Search projects" className="input" />
            <details className="relative">
              <summary
                className={cx("flex h-full cursor-pointer list-none items-center rounded-lg px-3 text-sm font-bold", filtersActive ? "bg-brand-600 text-white" : "bg-ink text-white")}
                aria-label="Filters"
                title="Filters"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4z" />
                </svg>
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-64 space-y-2 rounded-xl border border-cream-200 bg-white p-3 shadow-lg">
                <label className="label" htmlFor="nav-client">
                  Client
                </label>
                <select id="nav-client" name="client" defaultValue={n.clientId ?? ""} className="input">
                  <option value="">All clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <label className="label" htmlFor="nav-status">
                  Status
                </label>
                <select id="nav-status" name="status" defaultValue={n.status ?? ""} className="input">
                  <option value="">Any status</option>
                  {PORTFOLIO_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PORTFOLIO_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between pt-1">
                  <button className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">Apply</button>
                  {filtersActive && (
                    <Link href={href({ client: undefined, status: undefined })} className="text-xs text-slate-500 underline">
                      Clear
                    </Link>
                  )}
                </div>
              </div>
            </details>
          </form>

          <div className="flex rounded-full bg-cream-200 p-0.5 text-sm">
            {(["projects", "clients"] as const).map((v) => (
              <Link
                key={v}
                href={href({ view: v === "projects" ? undefined : v })}
                className={cx("flex-1 rounded-full px-3 py-1.5 text-center", n.view === v ? "bg-white font-bold text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-800")}
              >
                {v === "projects" ? "Projects" : "Clients"}
              </Link>
            ))}
          </div>
        </div>

        {n.view === "clients" ? (
          <div className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
            {clients.length === 0 && <EmptyState title="No clients yet" />}
            {clients.map((c) => (
              <Link
                key={c.id}
                href={href({ view: undefined, client: c.id })}
                className="flex items-center justify-between rounded-xl border border-cream-200 px-3 py-2.5 text-sm hover:border-brand-300"
                title={`Show ${c.name}'s projects`}
              >
                <span className="truncate font-bold text-ink">{c.name}</span>
                <Badge>{c._count.projects}</Badge>
              </Link>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 border-b border-cream-200 text-sm">
              {(["all", "billable", "non-billable"] as const).map((b) => (
                <Link
                  key={b}
                  href={href({ bill: b === "all" ? undefined : b })}
                  className={cx("-mb-px border-b-2 px-2 py-2 text-center", n.billability === b ? "border-brand-600 font-bold text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}
                >
                  {b === "all" ? "All" : b === "billable" ? "Billable" : "Non-billable"}
                </Link>
              ))}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {projects.length === 0 && (
                <EmptyState title="No projects found">{n.scope === "my" ? "You are not on any matching project." : "Try another search or filter."}</EmptyState>
              )}
              {projects.map((p) => {
                const pr = progress(p.id);
                const selected = p.id === selectedId;
                return (
                  <Link
                    key={p.id}
                    href={withParams(`/projects/${p.id}`, nav, {})}
                    aria-current={selected ? "page" : undefined}
                    className={cx("block rounded-2xl border bg-white transition", selected ? "border-brand-600 ring-2 ring-brand-100" : "border-cream-200 hover:border-brand-300")}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <ProjectTile name={p.name} />
                      <div className="min-w-0 flex-1">
                        <div className={cx("truncate font-bold", selected ? "text-brand-700" : "text-ink")}>{p.name}</div>
                        <div className="truncate text-xs text-slate-500">{p.client.name}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="rounded-full border border-cream-200 bg-cream px-2 py-0.5 text-[11px] text-slate-600">{BILLING_LABEL[p.billingType]}</span>
                        {p.status !== "ACTIVE" && <span className="text-[11px] text-amber-700">{PORTFOLIO_STATUS_LABEL[p.status]}</span>}
                      </div>
                    </div>
                    <div className="border-t border-cream-200 px-3 pt-2 pb-3">
                      <div className="h-1.5 w-full rounded-full bg-slate-200">
                        <div className={cx("h-1.5 rounded-full", pr.rate >= 100 ? "bg-emerald-500" : "bg-brand-600")} style={{ width: `${Math.min(100, pr.rate)}%` }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-xs text-slate-500">
                        <span title={`Hours logged in ${monthLabel(n.month)}`}>
                          {formatHours(logged(p.id))} · {pr.completed}/{pr.total} tasks
                        </span>
                        <span className="font-bold text-ink">{Math.round(pr.rate)}%</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </NavigatorShell>
  );
}

const tileColors = ["bg-emerald-500", "bg-cyan-500", "bg-sky-500", "bg-brand-600", "bg-amber-500", "bg-rose-500", "bg-violet-500"];

/** Coloured initials tile, as Harmony shows projects ("BN"). */
export function ProjectTile({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const color = tileColors[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % tileColors.length];
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-xl font-display font-bold text-white", color, size === "lg" ? "h-16 w-16 text-2xl" : "h-10 w-10 text-sm")}>
      {letters}
    </span>
  );
}
