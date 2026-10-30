// Ops Tracker › Portfolio rules (plan v2 + the client's "Project Portfolio" sheet). Our own module, so every rule here
// is an assumption (A). Pure: the page passes counted tasks in.
import type { TaskStatus } from "./tasks";

export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

// The sheet calls an active project "In Progress"; this app uses that label everywhere (the platform said "Active").
export const PORTFOLIO_STATUS_LABEL: Record<ProjectStatus, string> = { ACTIVE: "In progress", ON_HOLD: "On hold", COMPLETED: "Completed", CANCELLED: "Cancelled" };
export const PORTFOLIO_STATUSES = Object.keys(PORTFOLIO_STATUS_LABEL) as ProjectStatus[];

export type Progress = { total: number; completed: number; rate: number };

/**
 * Total Tasks, Completed Tasks and Completion Rate (Completed / Total, in %). Declined tasks are left out, as in the
 * pipeline's completion rate. A project with no tasks is 0%, as the sheet shows it.
 */
export function projectProgress(counts: { status: TaskStatus; count: number }[]): Progress {
  const counted = counts.filter((c) => c.status !== "DECLINED");
  const total = counted.reduce((s, c) => s + c.count, 0);
  const completed = counted.filter((c) => c.status === "COMPLETED").reduce((s, c) => s + c.count, 0);
  return { total, completed, rate: total ? (completed / total) * 100 : 0 };
}

export type PortfolioFilters = { month: string; client?: string; lead?: string; status?: ProjectStatus; sort: string };

// Default order is the Project ID, like the sheet's rows.
export const PORTFOLIO_SORTS = ["code", "due", "completion"] as const;

export function readPortfolioFilters(params: Record<string, string | undefined>): PortfolioFilters {
  return {
    month: /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : "all", // the sheet opens on All Months
    client: params.client || undefined,
    lead: params.lead || undefined,
    status: PORTFOLIO_STATUSES.includes(params.status as ProjectStatus) ? (params.status as ProjectStatus) : undefined,
    sort: PORTFOLIO_SORTS.includes(params.sort as (typeof PORTFOLIO_SORTS)[number]) ? params.sort! : "code",
  };
}

type SortableRow = { code: string | null; endDate: Date | null; progress: Progress; createdAt: Date };

/** Sorts rows: Project ID (uncoded last), target due date (none last), or completion rate (lowest first, to spot laggards). */
export function sortPortfolio<T extends SortableRow>(rows: T[], sort: string): T[] {
  const byCode = (a: T, b: T) => (a.code ?? "￿").localeCompare(b.code ?? "￿", undefined, { numeric: true }) || a.createdAt.getTime() - b.createdAt.getTime();
  const cmp: Record<string, (a: T, b: T) => number> = {
    code: byCode,
    due: (a, b) => (a.endDate?.getTime() ?? Infinity) - (b.endDate?.getTime() ?? Infinity) || byCode(a, b),
    completion: (a, b) => a.progress.rate - b.progress.rate || byCode(a, b),
  };
  return [...rows].sort(cmp[sort] ?? byCode);
}
