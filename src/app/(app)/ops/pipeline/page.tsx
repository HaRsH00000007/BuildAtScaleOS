import Link from "next/link";
import type { ReactNode } from "react";
import { InlineAction } from "@/components/forms";
import { Avatar, Badge, cx, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { requirePermission, type CurrentUser } from "@/lib/auth";
import { listBlockerTypes } from "@/lib/blocker-types";
import { db } from "@/lib/db";
import { formatDate, formatHours, formatPct, monthLabel } from "@/lib/format";
import {
  formatDayIn,
  formatDuration,
  PIPELINE_STATUS_LABEL,
  PIPELINE_STATUSES,
  PRIORITIES,
  PRIORITY_LABEL,
  pipelineSummary,
  reviewWait,
  SLA_LABEL,
  slaStatus,
  taskMonth,
  turnaroundHours,
  urgency,
  urgencyColumn,
  type Priority,
  type Sla,
} from "@/lib/ops-metrics";
import { monthOptions, PIPELINE_SORTS, pipelineWhere, readPipelineFilters } from "@/lib/ops-pipeline";
import { TIME_ZONE } from "@/lib/org";
import { isTaskAssigner } from "@/lib/task-access";
import { allowedActions, type TaskAction, type TaskStatus } from "@/lib/tasks";
import { readParams, withParams, type SearchParams } from "@/lib/url";
import { blockTask, moveTask, setPriority, setReviewer, updateBlocker, updateNotes } from "./actions";
import { AutoSubmitSelect, BlockerForm, NotesForm } from "./pipeline-forms";

// Ops Tracker › Task Pipeline: every task in the company in one ledger (plan v2: open to everyone with ops.view).
// Statuses use the sheet's names; changes run through the same workflow as My Tasks.

type Tone = "slate" | "brand" | "green" | "amber" | "red" | "blue";
const STATUS_TONE: Record<TaskStatus, Tone> = { PIPELINE: "slate", IN_PROGRESS: "blue", PENDING_APPROVAL: "brand", COMPLETED: "green", ON_HOLD: "red", REJECTED: "amber", DECLINED: "slate" };
const PRIORITY_TONE: Record<Priority, Tone> = { URGENT: "red", HIGH: "amber", NORMAL: "slate", LOW: "slate" };
const ACTION_LABEL: Record<TaskAction, string> = { start: "Start", deny: "Decline", hold: "Block", resume: "Resume", complete: "Complete", approve: "Approve", reject: "Return", revert: "Reopen" };
const ACTION_HISTORY: Record<string, string> = { start: "Started", deny: "Declined", hold: "Blocked", resume: "Resumed", complete: "Completed", approve: "Approved", reject: "Returned for changes", revert: "Reopened", reassign: "Reassigned" };
const PRIMARY: TaskAction[] = ["start", "complete", "approve"];
const SLA_TONE: Partial<Record<Sla, Tone>> = { ON_TIME: "green", LATE: "amber", OVERDUE: "red" };
const selectClass = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm";
// Table cells. Task ID and Task Name stay pinned while the sheet's other columns scroll sideways.
// The header row is pinned too; the inset shadow stands in for its bottom border, which collapsed borders don't keep while sticky.
const th = "sticky top-0 z-20 bg-slate-50 px-3 py-2 font-medium shadow-[inset_0_-1px_0_#e2e8f0]";
const td = "px-3 py-2.5";
const stickyId = "sticky left-0 z-10 w-[88px] min-w-[88px]";
const stickyName = "sticky left-[88px] z-10 min-w-[260px] max-w-[260px] border-r border-slate-200";

const taskInclude = {
  project: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
  assignee: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
  blockerType: { select: { id: true, name: true } },
} as const;

async function rightsFor(user: CurrentUser, t: { status: TaskStatus; assigneeId: string; assignedById: string; projectId: string }) {
  const ctx = { isAssignee: t.assigneeId === user.id, isAssigner: await isTaskAssigner(user, t) };
  return { ...ctx, actions: allowedActions(t.status, ctx) };
}

export default async function TaskPipelinePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("ops.view");
  const params = await readParams(searchParams);
  const f = readPipelineFilters(params);
  const href = (o: Record<string, string | undefined>) => withParams("/ops/pipeline", params, o);
  const now = new Date();

  const [tasks, chipBase, clients, projects, people, blockerTypes] = await Promise.all([
    db.task.findMany({
      where: pipelineWhere(f),
      orderBy: PIPELINE_SORTS[f.sort]!.orderBy,
      // Latest approve/return, for the Review Wait Time column.
      include: { ...taskInclude, events: { where: { action: { in: ["approve", "reject"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
    }),
    db.task.findMany({ where: pipelineWhere(f, { withStatus: false }), select: { status: true, deadline: true, completedDate: true, assignedDate: true } }),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ where: f.client ? { clientId: f.client } : {}, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listBlockerTypes(),
  ]);
  const summary = pipelineSummary(chipBase, now, TIME_ZONE);
  const rights = new Map(await Promise.all(tasks.map(async (t) => [t.id, await rightsFor(user, t)] as const)));

  const chip = (label: string, count: number, o: Record<string, string | undefined>, active: boolean, tone?: "red") => (
    <Link
      key={label}
      href={href({ ...o, task: undefined })}
      className={cx(
        "rounded-full border px-3 py-1 text-sm",
        active ? "border-brand-600 bg-brand-600 text-white" : tone === "red" && count > 0 ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400",
      )}
    >
      {label} <span className={cx("ml-1 font-semibold", active ? "text-white" : "text-slate-800")}>{count}</span>
    </Link>
  );
  const sortHeader = (key: string, label: string) => (
    <Link href={href({ sort: key === "due" ? undefined : key, task: undefined })} className={cx("hover:text-slate-900", f.sort === key && "font-semibold text-slate-900")}>
      {label}
      {f.sort === key ? " ↓" : ""}
    </Link>
  );
  const filtersActive = !!(f.q || f.client || f.project || f.assignee || f.priority || f.blocker || f.reviewer);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Task Pipeline"
        subtitle="Every task in the company in one ledger. Statuses, SLA and urgency update automatically."
        actions={
          <>
            <a href={withParams("/ops/pipeline/export", params, { task: undefined, block: undefined })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Export CSV
            </a>
            <LinkButton href="/my-tasks/new">New task</LinkButton>
          </>
        }
      />

      <form action="/ops/pipeline" className="mb-3 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={f.q} placeholder="Search ID or title…" className={cx(selectClass, "w-48")} />
        <select name="month" defaultValue={f.month} className={selectClass} aria-label="Month">
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
        <select name="project" defaultValue={f.project ?? ""} className={selectClass} aria-label="Project">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="assignee" defaultValue={f.assignee ?? ""} className={selectClass} aria-label="Assignee">
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="priority" defaultValue={f.priority ?? ""} className={selectClass} aria-label="Priority">
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <select name="blocker" defaultValue={f.blocker ?? ""} className={selectClass} aria-label="Blocker">
          <option value="">Any blocker</option>
          {blockerTypes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {f.status && <input type="hidden" name="status" value={f.status} />}
        {f.overdue && <input type="hidden" name="overdue" value="1" />}
        {f.sort !== "due" && <input type="hidden" name="sort" value={f.sort} />}
        <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
        {filtersActive && (
          <Link href={withParams("/ops/pipeline", { month: params.month }, {})} className="text-sm text-slate-500 underline">
            Clear filters
          </Link>
        )}
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {chip("All", summary.total, { status: undefined, overdue: undefined }, !f.status && !f.overdue)}
        {PIPELINE_STATUSES.map((s) => chip(PIPELINE_STATUS_LABEL[s], summary.byStatus[s], { status: s, overdue: undefined }, f.status === s))}
        {chip("Overdue", summary.overdueOpen, { overdue: "1", status: undefined }, f.overdue, "red")}
        <span className="ml-auto text-sm text-slate-500" title="Finished on or before the due day, out of finished tasks with a due date">
          On-time rate <b className="text-slate-800">{formatPct(summary.onTimeRate)}</b> ({summary.onTime} of {summary.onTime + summary.late})
        </span>
      </div>

      {tasks.length === 0 ? (
        <EmptyState title="No tasks match these filters">Try another month or clear the filters.</EmptyState>
      ) : (
        // The table scrolls inside the remaining height, so the header, filters and chips stay in view.
        <div className="min-h-[300px] flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[2700px] text-sm">
            <thead className="text-left text-xs whitespace-nowrap text-slate-500">
              <tr>
                <th className={cx(th, stickyId, "z-30")}>{sortHeader("code", "Task ID")}</th>
                <th className={cx(th, stickyName, "z-30")}>Task Name</th>
                <th className={th}>Project Name</th>
                <th className={th}>Client</th>
                <th className={th}>{sortHeader("assignee", "Assignee")}</th>
                <th className={th}>{sortHeader("priority", "Priority")}</th>
                <th className={th}>Start Date</th>
                <th className={th}>{sortHeader("due", "Due Date")}</th>
                <th className={th}>Completed Date</th>
                <th className={th}>{sortHeader("status", "Status")}</th>
                <th className={th} title="From the first start (else assignment) to completion, hours:minutes">
                  Task Completion Time
                </th>
                <th className={th}>Notes / Remarks</th>
                <th className={th}>SLA Delivery Status</th>
                <th className={th} title="The month the task is due (assigned month if it has no due date)">
                  Month
                </th>
                <th className={th}>Urgency</th>
                <th className={th}>Blocker Category</th>
                <th className={th}>Reviewer</th>
                <th className={th} title="Times a reviewer returned the task">
                  Revision Count
                </th>
                <th className={th}>Under Review Date</th>
                <th className={th} title="Time the latest review took, or has taken so far, hours:minutes">
                  Review Wait Time
                </th>
                <th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const r = rights.get(t.id)!;
                const sla = slaStatus(t, now, TIME_ZONE);
                const urg = urgencyColumn(t, now, TIME_ZONE);
                const selected = params.task === t.id;
                const stickyBg = selected ? "bg-brand-50" : "bg-white";
                return (
                  <tr key={t.id} className={cx("border-b border-slate-100 align-top last:border-0", selected && "bg-brand-50")}>
                    <td className={cx(td, stickyId, stickyBg, "font-mono text-xs whitespace-nowrap text-slate-500")}>{t.code}</td>
                    <td className={cx(td, stickyName, stickyBg)}>
                      <Link href={href({ task: t.id, block: undefined })} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        {t.title}
                      </Link>
                    </td>
                    <td className={cx(td, "max-w-[200px] truncate text-slate-600")} title={t.project.name}>
                      {t.project.name}
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>{t.project.client.name}</td>
                    <td className={td}>
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <Avatar name={t.assignee.name} size="sm" /> {t.assignee.name}
                      </span>
                    </td>
                    <td className={td}>
                      {r.isAssigner ? (
                        <AutoSubmitSelect action={setPriority} hidden={{ id: t.id }} name="priority" value={t.priority} label={`Priority of ${t.code}`} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
                      ) : (
                        <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                      )}
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>{formatDayIn(t.startDate, TIME_ZONE)}</td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>{formatDate(t.deadline)}</td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>{formatDayIn(t.completedDate, TIME_ZONE)}</td>
                    <td className={cx(td, "whitespace-nowrap")}>
                      <Badge tone={STATUS_TONE[t.status]}>{PIPELINE_STATUS_LABEL[t.status]}</Badge>
                    </td>
                    <td className={cx(td, "text-right whitespace-nowrap text-slate-600 tabular-nums")}>{formatDuration(turnaroundHours(t))}</td>
                    <td className={cx(td, "max-w-[240px] truncate text-xs text-slate-600 italic")} title={t.notes ?? undefined}>
                      {t.notes ?? <span className="text-slate-300 not-italic">—</span>}
                    </td>
                    <td className={cx(td, "whitespace-nowrap")}>{SLA_TONE[sla] ? <Badge tone={SLA_TONE[sla]}>{SLA_LABEL[sla]}</Badge> : <span className="text-slate-400">{SLA_LABEL[sla]}</span>}</td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>{monthLabel(taskMonth(t, TIME_ZONE))}</td>
                    <td className={cx(td, "whitespace-nowrap")}>
                      <Badge tone={urg.tone}>{urg.label}</Badge>
                    </td>
                    <td className={cx(td, "max-w-[180px] text-xs text-slate-600")}>
                      {t.blockerType ? t.blockerType.name : <span className="text-slate-400">{t.status === "ON_HOLD" ? "No reason given" : "None"}</span>}
                      {t.status === "ON_HOLD" && t.clientAction && <div className="text-rose-600">Waiting on client</div>}
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>{t.reviewer?.name ?? <span className="text-slate-400">—</span>}</td>
                    <td className={cx(td, "text-center text-slate-600")}>{t.revisionCount || <span className="text-slate-300">0</span>}</td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>{formatDayIn(t.underReviewAt, TIME_ZONE)}</td>
                    <td className={cx(td, "text-right whitespace-nowrap text-slate-600 tabular-nums")}>{formatDuration(reviewWait(t, t.events[0]?.createdAt, now))}</td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1">
                        {r.actions.map((a) =>
                          a === "hold" ? (
                            <LinkButton key={a} href={href({ task: t.id, block: "1" })} variant="secondary" size="sm">
                              {ACTION_LABEL[a]}
                            </LinkButton>
                          ) : (
                            <InlineAction key={a} action={moveTask} hidden={{ id: t.id, action: a }} variant={PRIMARY.includes(a) ? "primary" : "secondary"}>
                              {ACTION_LABEL[a]}
                            </InlineAction>
                          ),
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        {tasks.length} {tasks.length === 1 ? "task" : "tasks"} · {f.month === "all" ? "all months" : "tasks due in the selected month (assigned in it, if no due date)"} · dates in IST
      </p>

      {params.task && <TaskDrawer user={user} taskId={params.task} blockMode={params.block === "1"} closeHref={href({ task: undefined, block: undefined })} people={people} blockerTypes={blockerTypes} />}
    </div>
  );
}

async function TaskDrawer({
  user,
  taskId,
  blockMode,
  closeHref,
  people,
  blockerTypes,
}: {
  user: CurrentUser;
  taskId: string;
  blockMode: boolean;
  closeHref: string;
  people: { id: string; name: string }[];
  blockerTypes: { id: string; name: string }[];
}) {
  const t = await db.task.findUnique({
    where: { id: taskId },
    include: {
      ...taskInclude,
      assignedBy: { select: { name: true } },
      taskType: { select: { name: true } },
      timeEntries: { select: { hours: true } },
      events: { orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } },
    },
  });
  if (!t) return null;
  const now = new Date();
  const r = await rightsFor(user, t);
  const urg = urgency(t, now, TIME_ZONE);
  const sla = slaStatus(t, now, TIME_ZONE);
  const logged = t.timeEntries.reduce((s, e) => s + Number(e.hours), 0);
  const wait = reviewWait(t, t.events.find((e) => e.action === "approve" || e.action === "reject")?.createdAt, now);
  const canEditBlocker = t.status === "ON_HOLD" && (r.isAssignee || r.isAssigner);
  const canEditNotes = r.isAssignee || r.isAssigner || t.reviewerId === user.id;
  const blocking = blockMode && r.actions.includes("hold"); // the block form replaces the buttons until submitted
  const fact = (label: string, value: ReactNode) => (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  );
  const when = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Link href={closeHref} className="absolute inset-0 bg-slate-900/30" aria-label="Close task details" scroll={false} />
      <aside className="relative z-10 h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs text-slate-500">{t.code}</div>
            <h2 className="text-lg font-semibold text-slate-900">{t.title}</h2>
            <div className="text-sm text-slate-500">
              {t.project.name} · {t.project.client.name}
              {t.taskType && ` · ${t.taskType.name}`}
            </div>
          </div>
          <Link href={closeHref} scroll={false} className="text-xl leading-none text-slate-400 hover:text-slate-700" aria-label="Close">
            ×
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone={STATUS_TONE[t.status]}>{PIPELINE_STATUS_LABEL[t.status]}</Badge>
          <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]} priority</Badge>
          {urg && <Badge tone={urg.tone}>{urg.label}</Badge>}
          {!urg && (sla === "ON_TIME" || sla === "LATE") && <Badge tone={sla === "ON_TIME" ? "green" : "amber"}>{sla === "ON_TIME" ? "Delivered on time" : "Late completion"}</Badge>}
        </div>
        {t.description && <p className="mt-3 text-sm whitespace-pre-line text-slate-700">{t.description}</p>}
        <section className="mt-4">
          {canEditNotes ? (
            <NotesForm key={t.notes ?? ""} action={updateNotes.bind(null, t.id)} notes={t.notes} />
          ) : (
            <dl>{fact("Notes / Remarks", t.notes ? <span className="whitespace-pre-line">{t.notes}</span> : "—")}</dl>
          )}
        </section>

        {r.actions.length > 0 && !blocking && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {r.actions.map((a) =>
              a === "hold" ? (
                <LinkButton key={a} href={`${closeHref}${closeHref.includes("?") ? "&" : "?"}task=${t.id}&block=1`} variant="secondary" size="sm">
                  {ACTION_LABEL[a]}
                </LinkButton>
              ) : (
                <InlineAction key={a} action={moveTask} hidden={{ id: t.id, action: a }} variant={PRIMARY.includes(a) ? "primary" : "secondary"}>
                  {ACTION_LABEL[a]}
                </InlineAction>
              ),
            )}
          </div>
        )}

        {blocking && (
          <section className="mt-4 rounded-xl border border-rose-200 bg-rose-50/40 p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Block this task</h3>
            <BlockerForm action={blockTask.bind(null, t.id)} blockerTypes={blockerTypes} submitLabel="Block task" />
          </section>
        )}

        {t.status === "ON_HOLD" && (
          <section className="mt-4 rounded-xl border border-slate-200 p-3">
            <h3 className="mb-1 text-sm font-semibold text-slate-800">Blocker</h3>
            {canEditBlocker ? (
              <BlockerForm
                key={t.blockerTypeId} // remount after a save so the select shows the saved (possibly new) reason
                action={updateBlocker.bind(null, t.id)}
                blockerTypes={blockerTypes}
                initial={{ blockerTypeId: t.blockerTypeId, blockerNote: t.blockerNote, clientAction: t.clientAction }}
                submitLabel="Save blocker"
              />
            ) : (
              <dl className="space-y-1 text-sm">
                {fact("Why", t.blockerType?.name ?? "No reason given")}
                {t.blockerNote && fact("Note", t.blockerNote)}
                {t.clientAction && fact("Client must", t.clientAction)}
              </dl>
            )}
          </section>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {fact("Assignee", t.assignee.name)}
          {fact("Assigned by", t.assignedBy.name)}
          {fact(
            "Reviewer",
            r.isAssigner ? (
              <AutoSubmitSelect
                action={setReviewer}
                hidden={{ id: t.id }}
                name="reviewerId"
                value={t.reviewerId ?? ""}
                label="Reviewer"
                className="mt-0.5 w-full py-1 text-sm"
                options={[{ value: "", label: "No reviewer" }, ...people.filter((p) => p.id !== t.assigneeId).map((p) => ({ value: p.id, label: p.name }))]}
              />
            ) : (
              t.reviewer?.name ?? "—"
            ),
          )}
          {fact(
            "Priority",
            r.isAssigner ? (
              <AutoSubmitSelect action={setPriority} hidden={{ id: t.id }} name="priority" value={t.priority} label="Priority" className="mt-0.5 w-full py-1 text-sm" options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
            ) : (
              PRIORITY_LABEL[t.priority]
            ),
          )}
          {fact("Assigned", formatDayIn(t.assignedDate, TIME_ZONE))}
          {fact("Started", formatDayIn(t.startDate, TIME_ZONE))}
          {fact("Due", formatDate(t.deadline))}
          {fact("Completed", formatDayIn(t.completedDate, TIME_ZONE))}
          {fact("Task completion time", formatDuration(turnaroundHours(t)))}
          {fact("Time logged", formatHours(logged))}
          {fact("Month", monthLabel(taskMonth(t, TIME_ZONE)))}
          {fact("Under review since", formatDayIn(t.underReviewAt, TIME_ZONE))}
          {fact("Review wait time", formatDuration(wait))}
          {fact("Reviews · revisions · reopens", `${t.reviewCount} · ${t.revisionCount} · ${t.reopenCount}`)}
        </dl>

        <h3 className="mt-6 mb-2 text-sm font-semibold text-slate-800">History</h3>
        {t.events.length === 0 ? (
          <p className="text-sm text-slate-500">No changes recorded yet. History is kept from 25 Oct 2026 onwards.</p>
        ) : (
          <ol className="space-y-2 border-l-2 border-brand-200 pl-3 text-sm">
            {t.events.map((e) => (
              <li key={e.id}>
                <div className="text-slate-800">
                  {e.kind === "STATUS" ? (ACTION_HISTORY[e.action ?? ""] ?? e.action) : e.kind === "PRIORITY" ? `Priority ${e.note}` : e.kind === "REVIEWER" ? e.note : `Blocker updated: ${e.note}`}
                  {e.kind === "STATUS" && e.fromStatus && e.toStatus && (
                    <span className="text-slate-500">
                      {" "}
                      ({PIPELINE_STATUS_LABEL[e.fromStatus]} → {PIPELINE_STATUS_LABEL[e.toStatus]})
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {e.user.name} · {when(e.createdAt)}
                  {e.kind === "STATUS" && e.note && ` · ${e.note}`}
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-6">
          <LinkButton href={`/my-tasks/${t.id}`} variant="secondary" size="sm">
            Open in My Tasks (timer, time log, edit)
          </LinkButton>
        </div>
      </aside>
    </div>
  );
}
