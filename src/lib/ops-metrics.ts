// Ops Tracker rules (plan v2, page 6). The Ops Tracker is our own module, not part of the demo, so every rule here is
// an assumption (A) taken from the plan and the Google Sheets it replaces. Pure: callers pass "now" and the time zone.
import type { TaskStatus } from "./tasks";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

// The sheet's names for the shared task statuses (plan v2 status mapping). My Tasks keeps the demo's wording.
export const PIPELINE_STATUS_LABEL: Record<TaskStatus, string> = {
  PIPELINE: "Not started",
  IN_PROGRESS: "In progress",
  PENDING_APPROVAL: "Under review",
  COMPLETED: "Completed",
  ON_HOLD: "Blocked",
  REJECTED: "Returned",
  DECLINED: "Declined",
};
export const PIPELINE_STATUSES = Object.keys(PIPELINE_STATUS_LABEL) as TaskStatus[];

export const PRIORITY_LABEL: Record<Priority, string> = { URGENT: "Urgent", HIGH: "High", NORMAL: "Medium", LOW: "Low" };
export const PRIORITIES: Priority[] = ["URGENT", "HIGH", "NORMAL", "LOW"];
export const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

// Blocker reasons are a shared list in the BlockerType table (A): the four plan v2 reasons plus any a user adds.
// Picking this value in the blocker form means "add the name typed in newBlocker".
export const NEW_BLOCKER = "__new";
export const BLOCKER_NAME_MAX = 60;

/** Tidies a typed blocker name: trims and collapses inner whitespace. Names are unique ignoring case (A). */
export function normaliseBlockerName(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

export type MetricTask = {
  status: TaskStatus;
  deadline: Date | null; // stored as a calendar date (UTC midnight)
  completedDate: Date | null; // when the assignee finished (set on Complete)
  assignedDate: Date;
  startDate?: Date | null;
  underReviewAt?: Date | null;
};

/** Calendar day of an instant in the org's time zone, as YYYY-MM-DD. */
export const dayIn = (d: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
/** Calendar day of a date-only value (stored at UTC midnight). */
export const dateDay = (d: Date) => d.toISOString().slice(0, 10);
/** An instant shown as its calendar day in the org's time zone, dd-mm-yyyy (dates like deadlines use formatDate). */
export function formatDayIn(d: Date | null | undefined, timeZone: string): string {
  if (!d) return "—";
  const [y, m, day] = dayIn(d, timeZone).split("-");
  return `${day}-${m}-${y}`;
}
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Work is handed in once the assignee completes it (Under review or Completed). */
export const isFinished = (t: Pick<MetricTask, "status" | "completedDate">) => (t.status === "COMPLETED" || t.status === "PENDING_APPROVAL") && !!t.completedDate;
/** Still with the assignee: counts toward overdue and urgency. */
export const isOpen = (s: TaskStatus) => s === "PIPELINE" || s === "IN_PROGRESS" || s === "ON_HOLD" || s === "REJECTED";

export type Sla = "ON_TIME" | "LATE" | "OVERDUE" | "OPEN" | "NO_DUE_DATE" | "NOT_COUNTED";
// The sheet's SLA Delivery Status values (On Time, Late Completion, Overdue, No Deadline); "Open" = not yet due.
export const SLA_LABEL: Record<Sla, string> = { ON_TIME: "On time", LATE: "Late completion", OVERDUE: "Overdue", OPEN: "Open", NO_DUE_DATE: "No deadline", NOT_COUNTED: "—" };

/**
 * SLA: On Time if finished on or before the due day, Late Completion if finished after it, Overdue if still open after
 * it (A, sheet rule). Recalculated every time, so a reopened task is judged again at its next completion.
 */
export function slaStatus(t: MetricTask, now: Date, timeZone: string): Sla {
  if (t.status === "DECLINED") return "NOT_COUNTED";
  if (!t.deadline) return "NO_DUE_DATE";
  const due = dateDay(t.deadline);
  if (isFinished(t)) return dayIn(t.completedDate!, timeZone) <= due ? "ON_TIME" : "LATE";
  return dayIn(now, timeZone) > due ? "OVERDUE" : "OPEN";
}

export type Urgency = { label: string; tone: "red" | "amber" | "green" | "slate"; daysOverdue: number };

/** Urgency for open tasks only: Overdue (Xd), Due today, or On track (A, sheet's Urgency column). */
export function urgency(t: MetricTask, now: Date, timeZone: string): Urgency | null {
  if (!isOpen(t.status)) return null;
  if (!t.deadline) return { label: "No due date", tone: "slate", daysOverdue: 0 };
  const late = daysBetween(dateDay(t.deadline), dayIn(now, timeZone));
  if (late > 0) return { label: `Overdue (${late}d)`, tone: "red", daysOverdue: late };
  if (late === 0) return { label: "Due today", tone: "amber", daysOverdue: 0 };
  return { label: "On track", tone: "green", daysOverdue: 0 };
}

/** The sheet's Urgency column: urgency while open, otherwise where the work ended up (A: the sheet shows "Completed"). */
export function urgencyColumn(t: MetricTask, now: Date, timeZone: string): Urgency {
  const open = urgency(t, now, timeZone);
  if (open) return open;
  if (t.status === "COMPLETED") return { label: "Completed", tone: "green", daysOverdue: 0 };
  if (t.status === "PENDING_APPROVAL") return { label: "Under review", tone: "slate", daysOverdue: 0 };
  return { label: "Declined", tone: "slate", daysOverdue: 0 };
}

/**
 * The sheet's Month column: the month a task is due, so late work stays in the month it was promised for (seen in the
 * sheet: due 15 Jun, finished in Sep, listed under June). Tasks without a due date use the month they were assigned (A).
 */
export function taskMonth(t: Pick<MetricTask, "deadline" | "assignedDate">, timeZone: string): string {
  return (t.deadline ? dateDay(t.deadline) : dayIn(t.assignedDate, timeZone)).slice(0, 7);
}

/** A duration in hours as the sheet shows it: hours:minutes, e.g. 39:00 or 0:05. */
export function formatDuration(hours: number | null | undefined): string {
  if (hours == null) return "—";
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

const hoursBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 3_600_000);

/** Turnaround: from start (first In Progress, else assignment) to completion, in hours (A). */
export function turnaroundHours(t: MetricTask): number | null {
  if (!isFinished(t)) return null;
  return hoursBetween(t.startDate ?? t.assignedDate, t.completedDate!);
}

/** Review wait: from entering review to the decision, or to now while still waiting (A). */
export function reviewWaitHours(underReviewAt: Date | null | undefined, decidedAt: Date | null | undefined, now: Date): number | null {
  if (!underReviewAt) return null;
  return hoursBetween(underReviewAt, decidedAt ?? now);
}

/**
 * Review wait for the latest review round. `lastDecisionAt` is the latest approve/return; one from before the task last
 * entered review belongs to an earlier round. Null when the task never reached review or is back with the assignee.
 */
export function reviewWait(t: { status: TaskStatus; underReviewAt?: Date | null }, lastDecisionAt: Date | null | undefined, now: Date): number | null {
  if (!t.underReviewAt) return null;
  const decided = lastDecisionAt && lastDecisionAt >= t.underReviewAt ? lastDecisionAt : undefined;
  if (t.status !== "PENDING_APPROVAL" && !decided) return null;
  return reviewWaitHours(t.underReviewAt, t.status === "PENDING_APPROVAL" ? undefined : decided, now);
}

export type PipelineSummary = {
  total: number;
  byStatus: Record<TaskStatus, number>;
  overdueOpen: number;
  onTime: number;
  late: number;
  onTimeRate: number | null; // finished on time / finished with a due date
  blocked: number;
};

export function pipelineSummary(tasks: MetricTask[], now: Date, timeZone: string): PipelineSummary {
  const byStatus = Object.fromEntries(PIPELINE_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
  let overdueOpen = 0;
  let onTime = 0;
  let late = 0;
  for (const t of tasks) {
    byStatus[t.status]++;
    const sla = slaStatus(t, now, timeZone);
    if (isFinished(t)) {
      if (sla === "ON_TIME") onTime++;
      if (sla === "LATE") late++;
    } else if (sla === "OVERDUE") overdueOpen++;
  }
  return { total: tasks.length, byStatus, overdueOpen, onTime, late, onTimeRate: onTime + late ? (onTime / (onTime + late)) * 100 : null, blocked: byStatus.ON_HOLD };
}

/** Completed tasks / all tasks except declined ones (A, sheet's Completion Rate). */
export function completionPct(tasks: Pick<MetricTask, "status">[]): number | null {
  const counted = tasks.filter((t) => t.status !== "DECLINED");
  return counted.length ? (counted.filter((t) => t.status === "COMPLETED").length / counted.length) * 100 : null;
}

export type WorkflowState = { status: TaskStatus; startDate: Date | null; completedDate?: Date | null };

/**
 * Extra Ops Tracker fields a workflow action updates, on top of the status change My Tasks already makes (A).
 * Start/resume stamp the first start; entering review stamps underReviewAt; approve counts a review; reject counts a
 * revision; revert (reopen) counts a reopen. Leaving On Hold keeps the blocker category and note, as the sheet does, so
 * finished tasks still show what held them up; only the client's to-do is cleared.
 */
export function workflowEffects(action: string, before: WorkflowState, after: TaskStatus, now: Date) {
  const data: {
    startDate?: Date;
    underReviewAt?: Date | null;
    reviewCount?: { increment: number };
    revisionCount?: { increment: number };
    reopenCount?: { increment: number };
    clientAction?: null;
  } = {};
  if (after === "IN_PROGRESS" && !before.startDate) data.startDate = now;
  if (after === "PENDING_APPROVAL") data.underReviewAt = now;
  if (action === "approve") data.reviewCount = { increment: 1 };
  if (action === "reject") data.revisionCount = { increment: 1 };
  if (action === "revert") data.reopenCount = { increment: 1 };
  if (before.status === "ON_HOLD" && after !== "ON_HOLD") data.clientAction = null;
  return data;
}
