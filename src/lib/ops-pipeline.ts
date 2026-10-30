import "server-only";
import type { Prisma } from "@prisma/client";
import { currentMonth, monthLabel, monthRange, shiftMonth } from "./format";
import { isOpen, PIPELINE_STATUSES, PRIORITIES, type Priority } from "./ops-metrics";
import { todayUtc } from "./org";
import type { TaskStatus } from "./tasks";

// Filters for the Ops Tracker Task Pipeline, read from the URL so views can be shared and exported as CSV.
// Plan v2: everyone with ops.view sees every task, so there is no scope filter.

export type PipelineFilters = {
  month: string; // YYYY-MM or "all"
  q?: string;
  client?: string;
  project?: string;
  assignee?: string;
  reviewer?: string;
  priority?: Priority;
  blocker?: string; // BlockerType id
  status?: TaskStatus;
  overdue: boolean;
  sort: string;
};

export const PIPELINE_SORTS: Record<string, { label: string; orderBy: Prisma.TaskOrderByWithRelationInput[] }> = {
  due: { label: "Due date", orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { code: "asc" }] },
  code: { label: "Task ID", orderBy: [{ code: "asc" }] },
  priority: { label: "Priority", orderBy: [{ priority: "desc" }, { deadline: { sort: "asc", nulls: "last" } }] },
  status: { label: "Status", orderBy: [{ status: "asc" }, { deadline: { sort: "asc", nulls: "last" } }] },
  assignee: { label: "Assignee", orderBy: [{ assignee: { name: "asc" } }, { deadline: { sort: "asc", nulls: "last" } }] },
  updated: { label: "Last updated", orderBy: [{ updatedAt: "desc" }] },
};

const oneOf = <T extends string>(list: readonly T[], v: string | undefined) => (list.includes(v as T) ? (v as T) : undefined);

export function readPipelineFilters(params: Record<string, string | undefined>): PipelineFilters {
  return {
    month: params.month === "all" ? "all" : /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : currentMonth(),
    q: params.q?.trim() || undefined,
    client: params.client || undefined,
    project: params.project || undefined,
    assignee: params.assignee || undefined,
    reviewer: params.reviewer || undefined,
    priority: oneOf(PRIORITIES, params.priority),
    blocker: params.blocker || undefined,
    status: oneOf(PIPELINE_STATUSES, params.status),
    overdue: params.overdue === "1",
    sort: params.sort && PIPELINE_SORTS[params.sort] ? params.sort : "due",
  };
}

/**
 * Tasks whose sheet Month (see taskMonth) is the given month: due in it, or assigned in it when there is no due date (A).
 * Assigned dates are compared at UTC month boundaries, so an undated task assigned in the first 5.5 hours of a month (IST)
 * is filtered into the previous month.
 */
export function dueMonthWhere(month: string): Prisma.TaskWhereInput {
  const { start, end } = monthRange(month);
  return { OR: [{ deadline: { gte: start, lt: end } }, { deadline: null, assignedDate: { gte: start, lt: end } }] };
}

/** Projects in a month (Portfolio, Overview): running in it (start..target overlaps) or with tasks due in it (A). */
export function projectMonthWhere(month: string): Prisma.ProjectWhereInput {
  const { start, end } = monthRange(month);
  return { OR: [{ tasks: { some: dueMonthWhere(month) } }, { AND: [{ startDate: { lt: end } }, { OR: [{ endDate: null }, { endDate: { gte: start } }] }] }] };
}

/** Prisma filter for the pipeline. `withStatus: false` leaves out the status/overdue chips (used for their counts). */
export function pipelineWhere(f: PipelineFilters, { withStatus = true } = {}): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [];
  if (f.month !== "all") and.push(dueMonthWhere(f.month));
  if (f.q) and.push({ OR: [{ title: { contains: f.q, mode: "insensitive" } }, { code: { contains: f.q, mode: "insensitive" } }, { description: { contains: f.q, mode: "insensitive" } }] });
  if (f.client) and.push({ project: { clientId: f.client } });
  if (f.project) and.push({ projectId: f.project });
  if (f.assignee) and.push({ assigneeId: f.assignee });
  if (f.reviewer) and.push({ reviewerId: f.reviewer });
  if (f.priority) and.push({ priority: f.priority });
  if (f.blocker) and.push({ blockerTypeId: f.blocker });
  if (withStatus && f.status) and.push({ status: f.status });
  // Overdue = still with the assignee and past the due day (same rule as slaStatus for open tasks).
  if (withStatus && f.overdue) and.push({ status: { in: PIPELINE_STATUSES.filter(isOpen) }, deadline: { lt: todayUtc() } });
  return { AND: and };
}

/** "All months" plus the last 12 months and next month, newest first. */
export function monthOptions(now = currentMonth()) {
  return [{ value: "all", label: "All months" }, ...Array.from({ length: 14 }, (_, i) => shiftMonth(now, 1 - i)).map((m) => ({ value: m, label: monthLabel(m) }))];
}
