import Link from "next/link";
import type { ReactNode } from "react";
import { InlineAction } from "@/components/forms";
import { Avatar, Badge, cx, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { requirePermission, type CurrentUser } from "@/lib/auth";
import { listBlockerTypes } from "@/lib/blocker-types";
import { db } from "@/lib/db";
import { formatDate, formatHours, formatPct, monthLabel } from "@/lib/format";
import {
  commitmentVarianceDays,
  dateDay,
  dayIn,
  formatDayIn,
  formatDuration,
  formatHoursDecimal,
  formatTimeSlot,
  formatVariance,
  netTurnaroundHours,
  sheetSla,
  totalReviewWaitHours,
  TIME_SLOTS,
  PIPELINE_STATUS_LABEL,
  PIPELINE_STATUSES,
  PRIORITIES,
  PRIORITY_LABEL,
  pipelineSummary,
  SLA_LABEL,
  taskMonth,
  turnaroundHours,
  urgency,
  type Priority,
  type Sla,
} from "@/lib/ops-metrics";
import { monthOptions, PIPELINE_SORTS, pipelineWhere, readPipelineFilters } from "@/lib/ops-pipeline";
import { TIME_ZONE } from "@/lib/org";
import { isTaskAssigner } from "@/lib/task-access";
import { actionTarget, allowedActions, type TaskAction, type TaskStatus } from "@/lib/tasks";
import { readParams, withParams, type SearchParams } from "@/lib/url";
import { blockTask, moveTask, setCommitment, setDeadlineTime, setFirstSubmission, setPreviewLink, setTaskDates, setPriority, setReviewer, updateBlocker, updateNotes } from "./actions";
import { AutoSubmitDate, AutoSubmitSelect, BlockerForm, NotesCell, NotesForm, PreviewLinkCell } from "./pipeline-forms";

// Ops Tracker › Task Pipeline: every task in the company in one ledger (plan v2: open to everyone with ops.view).
// Statuses use the sheet's names; changes run through the same workflow as My Tasks.

// Sheet-style coloured chips for the Status and Priority columns (dropdown and read-only alike).
const STATUS_PILL: Record<TaskStatus, string> = {
  PIPELINE: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  PENDING_APPROVAL: "bg-violet-100 text-violet-700",
  COMPLETED: "bg-green-100 text-green-800",
  ON_HOLD: "bg-red-600 text-white",
  REJECTED: "bg-orange-100 text-orange-800",
  DECLINED: "bg-slate-200 text-slate-700",
};
const PRIORITY_PILL: Record<Priority, string> = { URGENT: "bg-red-600 text-white", HIGH: "bg-red-100 text-red-700", NORMAL: "bg-amber-100 text-amber-800", LOW: "bg-blue-100 text-blue-700" };
const pill = "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium";
// The sheet's red KPI columns: calculated, never typed in, so they get their own tint.
const kpiTh = "bg-red-50 text-red-800";
const kpiTd = "bg-red-50/40 whitespace-nowrap text-slate-700 tabular-nums";
const SLA_PILL: Partial<Record<Sla, string>> = { ON_TIME: "bg-green-100 text-green-800", OVERDUE: "bg-red-100 text-red-700", LATE: "bg-orange-100 text-orange-800" };
const SHEET_SLA_LABEL: Record<Sla, string> = { ...SLA_LABEL, ON_TIME: "On Time", LATE: "Late Completion" };
const ACTION_LABEL: Record<TaskAction, string> = { start: "Start", deny: "Decline", hold: "Block", resume: "Resume", complete: "Complete", approve: "Approve", reject: "Return", revert: "Reopen" };
const ACTION_HISTORY: Record<string, string> = { start: "Started", deny: "Declined", hold: "Blocked", resume: "Resumed", complete: "Completed", approve: "Approved", reject: "Returned for changes", revert: "Reopened", reassign: "Reassigned" };
const PRIMARY: TaskAction[] = ["start", "complete", "approve"];
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

/** Status chip; a dropdown of the statuses this user may move the task to next. Blocked opens the reason form first. */
function StatusSelect({ id, code, status, actions, blockHref }: { id: string; code: string; status: TaskStatus; actions: TaskAction[]; blockHref: string }) {
  if (!actions.length) return <span className={cx(pill, STATUS_PILL[status])}>{PIPELINE_STATUS_LABEL[status]}</span>;
  const tones: Record<string, string> = { "": STATUS_PILL[status] };
  for (const a of actions) tones[a] = STATUS_PILL[actionTarget(a)];
  return (
    <AutoSubmitSelect
      key={status} // fresh dropdown once the move lands
      action={moveTask}
      hidden={{ id }}
      name="action"
      value=""
      label={`Status of ${code}`}
      options={[{ value: "", label: PIPELINE_STATUS_LABEL[status] }, ...actions.map((a) => ({ value: a, label: PIPELINE_STATUS_LABEL[actionTarget(a)] }))]}
      tones={tones}
      links={actions.includes("hold") ? { hold: blockHref } : undefined}
    />
  );
}

// The sheet's grey time chips: half-hour slots, or blank.
const TIME_OPTIONS = [{ value: "", label: "—" }, ...TIME_SLOTS.map((s) => ({ value: s, label: formatTimeSlot(s) }))];
const TIME_TONES = Object.fromEntries(TIME_OPTIONS.map((o) => [o.value, "bg-slate-100 text-slate-700"]));

function TimeSelect({ action, id, name, value, label }: { action: (formData: FormData) => Promise<void>; id: string; name: string; value: string | null; label: string }) {
  return <AutoSubmitSelect action={action} hidden={{ id }} name={name} value={value ?? ""} label={label} options={TIME_OPTIONS} tones={TIME_TONES} />;
}

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
      // Moves into and out of review, for the Review Wait Time column.
      include: {
        ...taskInclude,
        events: { where: { kind: "STATUS", OR: [{ toStatus: "PENDING_APPROVAL" }, { fromStatus: "PENDING_APPROVAL" }] }, orderBy: { createdAt: "asc" }, select: { createdAt: true, fromStatus: true, toStatus: true } },
      },
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
                <th className={th}>{sortHeader("status", "Status")}</th>
                <th className={th}>Assigned Date</th>
                <th className={th}>{sortHeader("due", "Assigned Deadline (date)")}</th>
                <th className={th}>Assigned Deadline (time)</th>
                <th className={th}>Editor Committed (date)</th>
                <th className={th}>Editor Committed (time)</th>
                <th className={th}>Preview Link</th>
                <th className={th} title="Filled in the first time the task is completed; can be corrected">
                  1st Submission Date
                </th>
                <th className={th}>1st Submission Time</th>
                <th className={th}>Notes / Remarks</th>
                <th className={cx(th, kpiTh)} title="Calculated: 1st Submission Date & Time − Assigned Date & Time">
                  Net Turnaround (Hrs)
                </th>
                <th className={cx(th, kpiTh)} title="Calculated: total time spent Under review">
                  Review Wait Time (Hrs)
                </th>
                <th className={cx(th, kpiTh)} title="Calculated: times a reviewer returned the task">
                  Revision Count
                </th>
                <th className={cx(th, kpiTh)} title="Calculated: (Editor Committed − Assigned Deadline) ÷ 24 h. Negative = committed early">
                  Commitment Variance (Days)
                </th>
                <th className={cx(th, kpiTh)} title="Calculated: 1st submission vs the deadline date & time">
                  SLA Delivery Status
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const r = rights.get(t.id)!;
                const sla = sheetSla(t, now, TIME_ZONE);
                const variance = commitmentVarianceDays(t, TIME_ZONE);
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
                        <AutoSubmitSelect action={setPriority} hidden={{ id: t.id }} name="priority" value={t.priority} label={`Priority of ${t.code}`} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} tones={PRIORITY_PILL} />
                      ) : (
                        <span className={cx(pill, PRIORITY_PILL[t.priority])}>{PRIORITY_LABEL[t.priority]}</span>
                      )}
                    </td>
                    <td className={cx(td, "whitespace-nowrap")}>
                      <StatusSelect id={t.id} code={t.code} status={t.status} actions={r.actions} blockHref={href({ task: t.id, block: "1" })} />
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>
                      {r.isAssigner ? (
                        <AutoSubmitDate action={setTaskDates} hidden={{ id: t.id }} name="assignedDate" value={dayIn(t.assignedDate, TIME_ZONE)} label={`Assigned date of ${t.code}`} required />
                      ) : (
                        formatDayIn(t.assignedDate, TIME_ZONE)
                      )}
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>
                      {r.isAssigner ? (
                        <AutoSubmitDate action={setTaskDates} hidden={{ id: t.id }} name="deadline" value={t.deadline ? dateDay(t.deadline) : ""} label={`Deadline of ${t.code}`} />
                      ) : (
                        formatDate(t.deadline)
                      )}
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>
                      {r.isAssigner ? <TimeSelect action={setDeadlineTime} id={t.id} name="deadlineTime" value={t.deadlineTime} label={`Deadline time of ${t.code}`} /> : formatTimeSlot(t.deadlineTime)}
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>
                      {r.isAssignee || r.isAssigner ? (
                        <AutoSubmitDate action={setCommitment} hidden={{ id: t.id }} name="committedDate" value={t.committedDate ? dateDay(t.committedDate) : ""} label={`Editor committed date of ${t.code}`} />
                      ) : (
                        formatDate(t.committedDate)
                      )}
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>
                      {r.isAssignee || r.isAssigner ? <TimeSelect action={setCommitment} id={t.id} name="committedTime" value={t.committedTime} label={`Editor committed time of ${t.code}`} /> : formatTimeSlot(t.committedTime)}
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>
                      <PreviewLinkCell key={t.previewLink ?? ""} action={setPreviewLink.bind(null, t.id)} link={t.previewLink} canEdit={r.isAssignee || r.isAssigner || t.reviewerId === user.id} />
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>
                      {r.isAssignee || r.isAssigner ? (
                        <AutoSubmitDate action={setFirstSubmission} hidden={{ id: t.id }} name="firstSubmittedDate" value={t.firstSubmittedDate ? dateDay(t.firstSubmittedDate) : ""} label={`1st submission date of ${t.code}`} />
                      ) : (
                        formatDate(t.firstSubmittedDate)
                      )}
                    </td>
                    <td className={cx(td, "whitespace-nowrap text-slate-600")}>
                      {r.isAssignee || r.isAssigner ? <TimeSelect action={setFirstSubmission} id={t.id} name="firstSubmittedTime" value={t.firstSubmittedTime} label={`1st submission time of ${t.code}`} /> : formatTimeSlot(t.firstSubmittedTime)}
                    </td>
                    <td className={cx(td, "text-xs text-slate-600 italic")}>
                      <NotesCell key={t.notes ?? ""} action={updateNotes.bind(null, t.id)} notes={t.notes} canEdit={r.isAssignee || r.isAssigner || t.reviewerId === user.id} />
                    </td>
                    <td className={cx(td, kpiTd, "text-right")}>{formatHoursDecimal(netTurnaroundHours(t, TIME_ZONE))}</td>
                    <td className={cx(td, kpiTd, "text-right")}>{formatHoursDecimal(totalReviewWaitHours(t.events, now))}</td>
                    <td className={cx(td, kpiTd, "text-right")}>{t.revisionCount}</td>
                    <td className={cx(td, kpiTd, "text-right font-semibold", variance == null ? "text-slate-300" : variance > 0 ? "text-red-700" : "text-green-700")}>{formatVariance(variance)}</td>
                    <td className={cx(td, kpiTd, "text-center")}>
                      {SLA_PILL[sla] ? <span className={cx(pill, "font-semibold", SLA_PILL[sla])}>{SHEET_SLA_LABEL[sla]}</span> : <span className="text-slate-400">{SHEET_SLA_LABEL[sla]}</span>}
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
  const sla = sheetSla(t, now, TIME_ZONE);
  const logged = t.timeEntries.reduce((s, e) => s + Number(e.hours), 0);
  const wait = totalReviewWaitHours(t.events, now); // the panel loads the latest 50 events, plenty for a task's review rounds
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
          <span className={cx(pill, STATUS_PILL[t.status])}>{PIPELINE_STATUS_LABEL[t.status]}</span>
          <span className={cx(pill, PRIORITY_PILL[t.priority])}>{PRIORITY_LABEL[t.priority]} priority</span>
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
              <AutoSubmitSelect action={setPriority} hidden={{ id: t.id }} name="priority" value={t.priority} label="Priority" options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} tones={PRIORITY_PILL} />
            ) : (
              <span className={cx(pill, PRIORITY_PILL[t.priority])}>{PRIORITY_LABEL[t.priority]}</span>
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
          {fact("Net turnaround", formatHoursDecimal(netTurnaroundHours(t, TIME_ZONE)))}
          {fact("Review wait time", formatHoursDecimal(wait))}
          {fact("Commitment variance (days)", formatVariance(commitmentVarianceDays(t, TIME_ZONE)))}
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
