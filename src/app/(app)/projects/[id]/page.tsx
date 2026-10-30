import Link from "next/link";
import { notFound } from "next/navigation";
import { InlineAction } from "@/components/forms";
import { MonthPicker } from "@/components/month-picker";
import { Avatar, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeFinancials, formatINR, isMonthScoped } from "@/lib/finance";
import { formatDate, formatPct, monthLabel } from "@/lib/format";
import { BILLING_LABEL } from "@/lib/labels";
import { PORTFOLIO_STATUS_LABEL } from "@/lib/ops-portfolio";
import { canManageProject, canSeeProjectFinance, canViewProject, loadFinanceTotals } from "@/lib/projects";
import { readParams, withParams, type SearchParams } from "@/lib/url";
import { deleteProject } from "../actions";
import { navParams, ProjectNavigator, ProjectTile, readNavigator } from "../navigator";
import { ExpensesTab, MembersTab, OverviewTab, PLACEHOLDER_TABS, PlaceholderTab, TAB_LABEL, TABS, TasksTab, type Tab } from "../workspace-tabs";
import { WorkstreamDialog, WorkstreamIntro } from "../workspace-forms";

// Harmony project workspace: project list on the left; header (name, badges, client, start, managers, members),
// KPI strip, Workstreams band, tab bar and the active tab on the right.

export default async function ProjectWorkspacePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await readParams(searchParams);
  if (!(await canViewProject(user, id))) notFound();
  const project = await db.project.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      members: {
        orderBy: [{ role: "desc" }, { user: { name: "asc" } }],
        include: { user: { select: { id: true, name: true, designation: true, department: { select: { name: true } } } } },
      },
      workstreams: { orderBy: { createdAt: "asc" }, include: { _count: { select: { tasks: true, members: true } } } },
    },
  });
  if (!project) notFound();

  const { month } = readNavigator(sp);
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "overview";
  const [manage, showFinance] = await Promise.all([canManageProject(user, id), canSeeProjectFinance(user, id)]);
  const finance = showFinance ? computeFinancials({ value: Number(project.value), ...(await loadFinanceTotals(project, month)) }) : null;
  const managers = project.members.filter((m) => m.role === "MANAGER");
  const others = project.members.filter((m) => m.role === "MEMBER");
  const memberOptions = project.members.map((m) => ({ id: m.user.id, name: m.user.name }));

  const here = (o: Record<string, string | undefined>) => withParams(`/projects/${id}`, { ...navParams(sp), tab: sp.tab, ws: sp.ws }, o);

  return (
    <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
      <ProjectNavigator user={user} params={sp} selectedId={id} selectedName={project.name} />

      <div className="min-w-0 space-y-4">
        {/* Header, KPI strip and Workstreams band form one block, as in Harmony. */}
        <section className="overflow-hidden rounded-2xl border border-brand-100 bg-brand-50">
          <div className="p-5">
            <div className="flex flex-wrap items-start gap-4">
              <ProjectTile name={project.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{project.name}</h2>
                  <Pill tone={project.isBillable ? "slate" : "muted"}>{project.isBillable ? "Billable" : "Non-billable"}</Pill>
                  <Pill tone="brand">{BILLING_LABEL[project.billingType]}</Pill>
                  <Pill tone={project.status === "ACTIVE" ? "green" : project.status === "COMPLETED" ? "green" : "amber"}>
                    {project.status === "ACTIVE" ? "✓ " : ""}
                    {PORTFOLIO_STATUS_LABEL[project.status]}
                  </Pill>
                  {project.isPublic && <Pill tone="slate">Public</Pill>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                  <span>{project.client.name}</span>
                  <span className="text-slate-300">|</span>
                  <span>📅 Started {formatDate(project.startDate)}</span>
                  {project.code && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span className="font-mono text-xs">{project.code}</span>
                    </>
                  )}
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-2">
                    Managers <People names={managers.map((m) => m.user.name)} />
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  Members <People names={others.map((m) => m.user.name)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MonthPicker month={month} hrefFor={(m) => here({ month: m })} />
                <details className="relative">
                  <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-300 bg-white text-lg text-slate-600 hover:text-ink" aria-label="More actions">
                    ⋮
                  </summary>
                  <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-cream-200 bg-white p-1.5 text-sm shadow-lg">
                    {manage && <MenuLink href={`/projects/${id}/edit`}>Edit project</MenuLink>}
                    <MenuLink href={`/my-tasks/new?projectId=${id}`}>New task</MenuLink>
                    <MenuLink href={`/ops/pipeline?project=${id}&month=all`}>Open in Task Pipeline</MenuLink>
                    {manage && (
                      <div className="mt-1 border-t border-cream-200 px-1 pt-1.5">
                        <InlineAction action={deleteProject} hidden={{ id }} variant="danger" confirm={`Delete ${project.name} with all its tasks, time entries and expenses?`}>
                          Delete project
                        </InlineAction>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>

            {finance && (
              <>
                <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-brand-100 bg-brand-100 md:grid-cols-3 xl:grid-cols-6" style={{ gap: 1 }}>
                  <Kpi label={project.billingType === "RETAINER" ? "Project value / month" : project.billingType === "PAY_AS_YOU_GO" ? "Project value (estimate)" : "Project value"} value={formatINR(finance.value)} />
                  <Kpi label="Other income" value={formatINR(finance.otherIncome)} />
                  <Kpi label="Direct expenses" value={formatINR(finance.directExpenses)} />
                  <Kpi label="Ad-hoc expenses" value={formatINR(finance.adhocExpenses)} />
                  <Kpi label="Estimated profit" value={formatINR(finance.estimatedProfit)} hint={formatPct(finance.estimatedProfitPct)} tone={finance.estimatedProfit < 0 ? "red" : undefined} />
                  <Kpi label="Current profit" value="—" hint="Needs cost rates" muted />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {isMonthScoped(project.billingType) ? `${monthLabel(month)} · ` : "Whole project · "}
                  Estimated profit is before labour cost. Current profit needs people&apos;s cost rates, which BuildAtScaleOS doesn&apos;t store.
                  {finance.value === 0 && manage && (
                    <>
                      {" "}
                      <Link href={`/projects/${id}/edit`} className="text-brand-700 underline">
                        Set the project value
                      </Link>
                    </>
                  )}
                </p>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-ink px-5 py-4 text-white">
            <h3 className="font-display text-lg font-bold">Workstreams</h3>
            <span className="hidden h-6 w-px bg-zinc-700 sm:block" />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
              {project.workstreams.length === 0 ? (
                <span className="text-zinc-300">No workstreams yet. Split this project into areas such as SEO or Paid Media.</span>
              ) : (
                <>
                  <Link href={here({ ws: undefined })} className={cx("rounded-full border px-3 py-1", !sp.ws ? "border-accent text-accent" : "border-zinc-600 text-zinc-300 hover:text-white")}>
                    All
                  </Link>
                  {project.workstreams.map((w) => (
                    <Link
                      key={w.id}
                      href={here({ ws: w.id, tab: "tasks" })}
                      title={w.description ?? undefined}
                      className={cx("rounded-full border px-3 py-1", sp.ws === w.id ? "border-accent text-accent" : "border-zinc-600 text-zinc-300 hover:text-white")}
                    >
                      {w.name} <span className="text-xs opacity-70">· {w._count.tasks} tasks</span>
                    </Link>
                  ))}
                </>
              )}
            </div>
            {manage && (
              <WorkstreamDialog
                projectId={id}
                members={memberOptions}
                currentUserId={user.id}
                triggerClass="rounded-full bg-cream px-4 py-2 text-sm font-bold text-ink hover:bg-white"
              />
            )}
          </div>
        </section>

        <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-cream-200 bg-white p-1.5 text-sm" aria-label="Project sections">
          {TABS.map((t) => (
            <Link
              key={t}
              href={here({ tab: t === "overview" ? undefined : t })}
              aria-current={tab === t ? "page" : undefined}
              className={cx("rounded-xl px-4 py-2 whitespace-nowrap", tab === t ? "bg-brand-50 font-bold text-brand-700" : "text-slate-600 hover:text-ink", PLACEHOLDER_TABS[t] && tab !== t && "text-slate-400")}
            >
              {TAB_LABEL[t]}
            </Link>
          ))}
        </nav>

        {tab === "overview" && (
          <>
            {manage && project.workstreams.length === 0 && (
              <WorkstreamIntro projectId={id}>
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-cream-200 bg-white p-5 pr-12">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink font-display text-2xl font-bold text-accent">⋔</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg font-bold text-ink">Split this project into workstreams</div>
                    <p className="text-sm text-slate-500">Group tasks and people by area, such as SEO or Paid Media. Each workstream can be used to filter the project&apos;s tasks.</p>
                  </div>
                  <WorkstreamDialog projectId={id} members={memberOptions} currentUserId={user.id} trigger="+ Add workstream" />
                </div>
              </WorkstreamIntro>
            )}
            <OverviewTab project={project} month={month} />
          </>
        )}
        {tab === "tasks" && <TasksTab projectId={id} workstreams={project.workstreams} workstreamId={sp.ws} manage={manage} params={{ ...navParams(sp), tab: "tasks", ws: sp.ws }} />}
        {tab === "members" && <MembersTab projectId={id} members={project.members} manage={manage} />}
        {tab === "expenses" && <ExpensesTab project={project} month={month} showFinance={showFinance} manage={manage} />}
        {PLACEHOLDER_TABS[tab] && <PlaceholderTab tab={tab} />}
      </div>
    </div>
  );
}

function Pill({ tone, children }: { tone: "slate" | "muted" | "brand" | "green" | "amber"; children: React.ReactNode }) {
  const tones = {
    slate: "bg-white text-slate-700 border-cream-200",
    muted: "bg-slate-100 text-slate-500 border-slate-200",
    brand: "bg-white text-brand-700 border-brand-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
  };
  return <span className={cx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold", tones[tone])}>{children}</span>;
}

function People({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-slate-400">None</span>;
  return (
    <span className="flex items-center -space-x-1.5">
      {names.slice(0, 3).map((n) => (
        <span key={n} className="rounded-lg ring-2 ring-brand-50">
          <Avatar name={n} size="sm" />
        </span>
      ))}
      {names.length > 3 && <span className="pl-3 text-xs font-bold text-brand-700">+{names.length - 3}</span>}
    </span>
  );
}

function Kpi({ label, value, hint, tone, muted }: { label: string; value: string; hint?: string; tone?: "red"; muted?: boolean }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cx("font-display text-lg font-bold", muted ? "text-slate-400" : tone === "red" ? "text-rose-600" : "text-ink")}>{value}</span>
        {hint && <span className={cx("text-xs", muted ? "text-slate-400" : "text-slate-500")}>{hint}</span>}
      </div>
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-lg px-3 py-2 text-slate-700 hover:bg-cream">
      {children}
    </Link>
  );
}
