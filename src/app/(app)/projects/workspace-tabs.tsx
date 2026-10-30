import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Donut } from "@/components/charts";
import { InlineAction } from "@/components/forms";
import { Avatar, Badge, Card, cx, EmptyState, LinkButton, Stat } from "@/components/ui";
import { db } from "@/lib/db";
import { formatINR, isMonthScoped, type BillingType } from "@/lib/finance";
import { formatDate, formatHours, monthLabel, monthRange } from "@/lib/format";
import { FINANCE_KIND_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";
import { todayUtc } from "@/lib/org";
import { projectHealth, STATUS_COLOR, statusBreakdown } from "@/lib/project-health";
import type { ProjectStatus } from "@/lib/ops-portfolio";
import { withParams } from "@/lib/url";
import { AutoSubmitSelect } from "../ops/pipeline/pipeline-forms";
import { addMember, deleteFinanceEntry, removeMember } from "./actions";
import { setTaskWorkstream } from "./workspace-actions";
import { FinanceEntryForm } from "./workspace-forms";

// Workspace tabs (Harmony order): Overview, Tasks, Files, Members, Deliverables, Expenses, Notes, Discussion, Invoices.
// Overview, Tasks, Members and Expenses work on real data; the other five are not part of BuildAtScaleOS yet and say so.
export const TABS = ["overview", "tasks", "files", "members", "deliverables", "expenses", "notes", "discussion", "invoices"] as const;
export type Tab = (typeof TABS)[number];
export const TAB_LABEL: Record<Tab, string> = {
  overview: "Overview",
  tasks: "Tasks",
  files: "Files",
  members: "Members",
  deliverables: "Deliverables",
  expenses: "Expenses",
  notes: "Notes",
  discussion: "Discussion",
  invoices: "Invoices",
};
export const PLACEHOLDER_TABS: Partial<Record<Tab, string>> = {
  files: "Share files and folders with the project team.",
  deliverables: "Track what you promised the client, with due dates and approvals.",
  notes: "Keep project notes and checklists everyone on the project can see.",
  discussion: "Talk about the project in one thread instead of scattered chats.",
  invoices: "Raise invoices against the project and see booked, billed and left to bill.",
};

const OPEN: Prisma.EnumTaskStatusFilter = { notIn: ["COMPLETED", "DECLINED"] };
const DAY = 86_400_000;

type OverviewProject = { id: string; status: ProjectStatus; startDate: Date; endDate: Date | null; description: string | null };

export async function OverviewTab({ project, month }: { project: OverviewProject; month: string }) {
  const today = todayUtc();
  const { start, end } = monthRange(month);
  const [counts, overdue, dueSoon, monthHours, lifetimeHours] = await Promise.all([
    db.task.groupBy({ by: ["status"], where: { projectId: project.id }, _count: { _all: true } }),
    db.task.count({ where: { projectId: project.id, status: OPEN, deadline: { lt: today } } }),
    db.task.count({ where: { projectId: project.id, status: OPEN, deadline: { gte: today, lt: new Date(today.getTime() + 7 * DAY) } } }),
    db.timeEntry.aggregate({ where: { projectId: project.id, date: { gte: start, lt: end } }, _sum: { hours: true } }),
    db.timeEntry.aggregate({ where: { projectId: project.id }, _sum: { hours: true } }),
  ]);
  const c = counts.map((x) => ({ status: x.status, count: x._count._all }));
  const health = projectHealth({ status: project.status, startDate: project.startDate, endDate: project.endDate, counts: c, overdueTasks: overdue, now: today });
  const breakdown = statusBreakdown(c);
  const open = breakdown.rows.filter((r) => r.status !== "COMPLETED" && r.status !== "DECLINED").reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={<span className="text-lg">Project Health</span>}>
          <div className="flex flex-wrap items-center gap-5">
            <Donut
              label={`${Math.round(health.completionPct)}% of tasks completed`}
              slices={[
                { label: "Completed", value: health.completed, color: health.tone === "red" ? "#f43f5e" : health.tone === "amber" ? "#f59e0b" : "#2584fc" },
                { label: "Not completed", value: health.total - health.completed, color: "#27272a" },
              ]}
            >
              <span className="font-display text-2xl font-bold text-ink">{Math.round(health.completionPct)}%</span>
            </Donut>
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              <Badge tone={health.tone}>{health.label}</Badge>
              <div className="font-bold text-ink">
                {health.completed} / {health.total} tasks completed
              </div>
              <div className="text-slate-600">
                {health.elapsedPct == null ? "No target due date set" : `${Math.round(health.elapsedPct)}% of the timeline has passed`}
                <div className="text-xs text-slate-500">
                  {formatDate(project.startDate)} → {formatDate(project.endDate)}
                </div>
              </div>
              <div className="text-slate-600">{formatHours(Number(lifetimeHours._sum.hours ?? 0))} logged in total</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Health compares task completion with time passed. Declined tasks are not counted.</p>
        </Card>

        <Card title={<span className="text-lg">Tasks Status</span>}>
          {breakdown.total === 0 ? (
            <EmptyState title="No tasks yet">
              <Link href={`/my-tasks/new?projectId=${project.id}`} className="text-brand-600 underline">
                Add the first task
              </Link>
            </EmptyState>
          ) : (
            <div className="flex flex-wrap items-center gap-5">
              <Donut label={`${breakdown.total} tasks by status`} slices={breakdown.rows.map((r) => ({ label: TASK_STATUS_LABEL[r.status], value: r.count, color: STATUS_COLOR[r.status] }))}>
                <span className="font-display text-2xl font-bold text-ink">{breakdown.total}</span>
                <span className="text-[11px] text-slate-500">Total Tasks</span>
              </Donut>
              <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                {breakdown.rows.map((r) => (
                  <li key={r.status} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[r.status] }} />
                    <span className="flex-1 text-slate-600">{TASK_STATUS_LABEL[r.status]}</span>
                    <span className="font-bold text-ink tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open tasks" value={open} />
        <Stat label="Overdue tasks" value={overdue} tone={overdue > 0 ? "red" : undefined} />
        <Stat label="Due in the next 7 days" value={dueSoon} />
        <Stat label={`Hours logged in ${monthLabel(month)}`} value={formatHours(Number(monthHours._sum.hours ?? 0))} />
      </div>

      {project.description && (
        <Card title="About this project">
          <p className="text-sm whitespace-pre-wrap text-slate-700">{project.description}</p>
        </Card>
      )}
    </div>
  );
}

export async function TasksTab({
  projectId,
  workstreams,
  workstreamId,
  manage,
  params,
}: {
  projectId: string;
  workstreams: { id: string; name: string }[];
  workstreamId?: string;
  manage: boolean;
  params: Record<string, string | undefined>;
}) {
  const active = workstreams.find((w) => w.id === workstreamId);
  const tasks = await db.task.findMany({
    where: { projectId, ...(active ? { workstreamId: active.id } : {}) },
    orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: { assignee: { select: { name: true } }, workstream: { select: { name: true } } },
  });
  return (
    <Card
      title={active ? `Tasks in ${active.name} (${tasks.length})` : `Tasks (${tasks.length})`}
      actions={
        <div className="flex flex-wrap gap-2">
          {active && (
            <Link href={withParams(`/projects/${projectId}`, params, { ws: undefined })} className="self-center text-xs text-slate-500 underline">
              Show all tasks
            </Link>
          )}
          <LinkButton href={`/ops/pipeline?project=${projectId}&month=all`} variant="secondary" size="sm">
            Open in Task Pipeline
          </LinkButton>
          <LinkButton href={`/my-tasks/new?projectId=${projectId}`} size="sm">
            + New task
          </LinkButton>
        </div>
      }
    >
      {tasks.length === 0 ? (
        <EmptyState title={active ? "No tasks in this workstream yet" : "No tasks yet"}>{active ? "Move tasks here from the Workstream column." : "Create the first task for this project."}</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-cream-200 text-left text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Task</th>
                <th className="pr-3 font-medium">Assignee</th>
                <th className="pr-3 font-medium">Due</th>
                <th className="pr-3 font-medium">Status</th>
                <th className="font-medium">Workstream</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200">
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 pr-3">
                    <span className="mr-2 font-mono text-xs text-slate-400">{t.code}</span>
                    <Link href={`/my-tasks/${t.id}`} className="hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="pr-3 whitespace-nowrap text-slate-600">{t.assignee.name}</td>
                  <td className="pr-3 whitespace-nowrap text-slate-600">{formatDate(t.deadline)}</td>
                  <td className="pr-3">
                    <Badge tone={t.status === "COMPLETED" ? "green" : t.status === "REJECTED" ? "red" : t.status === "IN_PROGRESS" ? "amber" : "slate"}>{TASK_STATUS_LABEL[t.status]}</Badge>
                  </td>
                  <td>
                    {manage && workstreams.length > 0 ? (
                      <AutoSubmitSelect
                        action={setTaskWorkstream}
                        hidden={{ taskId: t.id }}
                        name="workstreamId"
                        value={t.workstreamId ?? ""}
                        label={`Workstream of ${t.code}`}
                        options={[{ value: "", label: "—" }, ...workstreams.map((w) => ({ value: w.id, label: w.name }))]}
                      />
                    ) : (
                      <span className="text-slate-500">{t.workstream?.name ?? "—"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

type Member = { id: string; role: "MEMBER" | "MANAGER"; user: { id: string; name: string; designation: string | null; department: { name: string } | null } };

export async function MembersTab({ projectId, members, manage }: { projectId: string; members: Member[]; manage: boolean }) {
  const people = manage
    ? await db.user.findMany({ where: { status: "ACTIVE", projectMembers: { none: { projectId } } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];
  return (
    <Card title={`Members (${members.length})`}>
      <ul className="divide-y divide-cream-200 text-sm">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <Avatar name={m.user.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-ink">{m.user.name}</span>
              <span className="block truncate text-xs text-slate-500">{[m.user.designation, m.user.department?.name].filter(Boolean).join(" · ") || "—"}</span>
            </span>
            <Badge tone={m.role === "MANAGER" ? "brand" : "slate"}>{m.role === "MANAGER" ? "Manager" : "Member"}</Badge>
            {manage && (
              <InlineAction action={removeMember} hidden={{ projectId, userId: m.user.id }} variant="ghost" confirm={`Remove ${m.user.name} from this project?`}>
                Remove
              </InlineAction>
            )}
          </li>
        ))}
      </ul>
      {manage && people.length > 0 && (
        <form action={addMember} className="mt-4 flex flex-wrap gap-2 border-t border-cream-200 pt-4">
          <input type="hidden" name="projectId" value={projectId} />
          <select name="userId" className="input max-w-xs" aria-label="Person" required>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select name="role" className="input max-w-[180px]" aria-label="Role on project" defaultValue="MEMBER">
            <option value="MEMBER">Member</option>
            <option value="MANAGER">Manager</option>
          </select>
          <button className="rounded-full bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700">Add member</button>
        </form>
      )}
    </Card>
  );
}

export async function ExpensesTab({ project, month, showFinance, manage }: { project: { id: string; billingType: BillingType }; month: string; showFinance: boolean; manage: boolean }) {
  if (!showFinance) return <EmptyState title="Project finances are private">Only the project&apos;s managers and operations managers can see income and expenses.</EmptyState>;
  const scoped = isMonthScoped(project.billingType);
  const { start, end } = monthRange(month);
  const entries = await db.projectFinanceEntry.findMany({
    where: { projectId: project.id, ...(scoped ? { date: { gte: start, lt: end } } : {}) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { name: true } } },
  });
  const total = (kind: string) => entries.filter((e) => e.kind === kind).reduce((s, e) => s + Number(e.amount), 0);
  const today = todayUtc().toISOString().slice(0, 10);
  return (
    <Card title={`Income and expenses · ${scoped ? monthLabel(month) : "whole project"}`}>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Other income" value={formatINR(total("OTHER_INCOME"))} />
        <Stat label="Direct expenses" value={formatINR(total("DIRECT_EXPENSE"))} />
        <Stat label="Ad-hoc expenses" value={formatINR(total("ADHOC_EXPENSE"))} />
      </div>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nothing recorded {scoped ? `in ${monthLabel(month)}` : "yet"}.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-cream-200 text-left text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="pr-3 font-medium">Type</th>
                <th className="pr-3 font-medium">Description</th>
                <th className="pr-3 font-medium">Added by</th>
                <th className="pr-3 text-right font-medium">Amount</th>
                {manage && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(e.date)}</td>
                  <td className="pr-3">
                    <Badge tone={e.kind === "OTHER_INCOME" ? "green" : "amber"}>{FINANCE_KIND_LABEL[e.kind]}</Badge>
                  </td>
                  <td className="pr-3 text-slate-700">{e.description}</td>
                  <td className="pr-3 text-slate-500">{e.createdBy.name}</td>
                  <td className={cx("pr-3 text-right font-bold tabular-nums", e.kind === "OTHER_INCOME" ? "text-emerald-700" : "text-ink")}>{formatINR(Number(e.amount))}</td>
                  {manage && (
                    <td className="text-right">
                      <InlineAction action={deleteFinanceEntry} hidden={{ id: e.id }} variant="ghost" confirm="Remove this entry?">
                        Remove
                      </InlineAction>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {scoped && <p className="mt-2 text-xs text-slate-500">Retainer: entries are shown for the month picked above.</p>}
      {manage && <FinanceEntryForm projectId={project.id} defaultDate={today} />}
    </Card>
  );
}

export function PlaceholderTab({ tab }: { tab: Tab }) {
  return (
    <div className="rounded-2xl border border-dashed border-cream-200 bg-white p-10 text-center">
      <div className="font-display text-lg font-bold text-ink">{TAB_LABEL[tab]} isn&apos;t in BuildAtScaleOS yet</div>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        In Harmony this tab lets you {PLACEHOLDER_TABS[tab]!.charAt(0).toLowerCase() + PLACEHOLDER_TABS[tab]!.slice(1)} Nothing is stored here yet, so nothing is shown.
      </p>
    </div>
  );
}
