// Ops Tracker › Overview rules (plan v2: "4 KPI cards, project health table, at-risk escalation radar"). Our own
// module, so every rule here is an assumption (A). Pure: the page passes tasks, projects, "now" and the time zone in.
// The figures reuse the pipeline and portfolio rules, so the Overview always agrees with those screens.
import { urgency, type MetricTask } from "./ops-metrics";
import { readPortfolioFilters, sortPortfolio, type PortfolioFilters, type Progress } from "./ops-portfolio";
import type { HealthLabel } from "./project-health";
import type { TaskStatus } from "./tasks";

/** Org on-time rate benchmark (the sheet's "Target: ≥ 85.0% delivery SLA"). */
export const ON_TIME_TARGET = 85;
/** Plan v2 escalation radar: open tasks overdue by more than this many days are escalated. */
export const ESCALATION_DAYS = 7;

export const HEALTH_LABELS: HealthLabel[] = ["Overdue", "Off track", "At risk", "On track", "No tasks yet", "On hold", "Completed", "Cancelled"];

// Tracker sorts: the portfolio's three plus "risk" (most overdue tasks first, then least complete).
export const OVERVIEW_SORTS = ["code", "due", "completion", "risk"] as const;
export type RadarView = "all" | "critical" | "overdue" | "blocked";
export const RADAR_VIEWS: RadarView[] = ["all", "critical", "overdue", "blocked"];

export type OverviewFilters = PortfolioFilters & { q?: string; health?: HealthLabel; radar: RadarView };

export function readOverviewFilters(params: Record<string, string | undefined>): OverviewFilters {
  return {
    ...readPortfolioFilters(params), // month opens on All Months, like the sheet's filter cell
    sort: OVERVIEW_SORTS.includes(params.sort as (typeof OVERVIEW_SORTS)[number]) ? params.sort! : "code",
    q: params.q?.trim() || undefined,
    health: HEALTH_LABELS.includes(params.health as HealthLabel) ? (params.health as HealthLabel) : undefined,
    radar: RADAR_VIEWS.includes(params.radar as RadarView) ? (params.radar as RadarView) : "all",
  };
}

export type RadarLevel = "critical" | "overdue" | "blocked";
export type RadarTask = MetricTask & { code: string };
export type RadarItem<T extends RadarTask> = { task: T; level: RadarLevel; daysOverdue: number; blocked: boolean };

/**
 * At-risk tasks: still with the assignee and either past their due day or Blocked (A). Overdue by more than
 * ESCALATION_DAYS is critical (plan v2). Oldest first, then blocked work by due date, then Task ID.
 */
export function riskRadar<T extends RadarTask>(tasks: T[], now: Date, timeZone: string): RadarItem<T>[] {
  const items: RadarItem<T>[] = [];
  for (const task of tasks) {
    const u = urgency(task, now, timeZone);
    if (!u) continue; // not open
    const blocked = task.status === "ON_HOLD";
    if (u.daysOverdue === 0 && !blocked) continue;
    const level: RadarLevel = u.daysOverdue > ESCALATION_DAYS ? "critical" : u.daysOverdue > 0 ? "overdue" : "blocked";
    items.push({ task, level, daysOverdue: u.daysOverdue, blocked });
  }
  return items.sort(
    (a, b) =>
      b.daysOverdue - a.daysOverdue ||
      (a.task.deadline?.getTime() ?? Infinity) - (b.task.deadline?.getTime() ?? Infinity) ||
      a.task.code.localeCompare(b.task.code, undefined, { numeric: true }),
  );
}

export function inRadarView(item: RadarItem<RadarTask>, view: RadarView): boolean {
  if (view === "critical") return item.level === "critical";
  if (view === "overdue") return item.daysOverdue > 0;
  if (view === "blocked") return item.blocked;
  return true;
}

export type TrackerRow = {
  code: string | null;
  name: string;
  clientName: string;
  leads: string[];
  endDate: Date | null;
  createdAt: Date;
  progress: Progress;
  overdue: number;
  health: HealthLabel;
};

/** Case-insensitive search over Project ID, name, client and lead. */
export function matchesProject(row: Pick<TrackerRow, "code" | "name" | "clientName" | "leads">, q: string | undefined): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [row.code ?? "", row.name, row.clientName, ...row.leads].some((s) => s.toLowerCase().includes(needle));
}

export function sortTracker<T extends TrackerRow>(rows: T[], sort: string): T[] {
  if (sort !== "risk") return sortPortfolio(rows, sort);
  return sortPortfolio(rows, "code").sort((a, b) => b.overdue - a.overdue || a.progress.rate - b.progress.rate);
}

/** Days from today to a calendar date (negative once it has passed). Both are UTC-midnight dates. */
export function daysUntil(date: Date, today: Date): number {
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

/** Task counts per project and status, in the shape projectProgress and projectHealth take. */
export function countsByProject(tasks: { projectId: string; status: TaskStatus }[]) {
  const map = new Map<string, Map<TaskStatus, number>>();
  for (const t of tasks) {
    const m = map.get(t.projectId) ?? new Map<TaskStatus, number>();
    m.set(t.status, (m.get(t.status) ?? 0) + 1);
    map.set(t.projectId, m);
  }
  return (projectId: string) => [...(map.get(projectId) ?? [])].map(([status, count]) => ({ status, count }));
}
