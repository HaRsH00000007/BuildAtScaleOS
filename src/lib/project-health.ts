// Project Health and Tasks Status for the workspace Overview. Pure, so the rules are unit-tested.
//
// Harmony's health ring is consumed ÷ allocated hours. BuildAtScaleOS has no hour allocations, so health here compares
// task completion with how much of the timeline has passed (A):
//   completed / on hold / cancelled projects show that status; no tasks → "No tasks yet";
//   past the target due date with work left → Overdue;
//   completion within 15 points of time elapsed (and no overdue tasks) → On track; within 35 → At risk; else Off track.
import { projectProgress, type ProjectStatus } from "./ops-portfolio";
import type { TaskStatus } from "./tasks";

export type HealthLabel = "On track" | "At risk" | "Off track" | "Overdue" | "No tasks yet" | "Completed" | "On hold" | "Cancelled";
export type HealthTone = "green" | "amber" | "red" | "slate";

export interface Health {
  label: HealthLabel;
  tone: HealthTone;
  completionPct: number;
  /** Share of start → target due date already passed (0–100), null without a target date. */
  elapsedPct: number | null;
  total: number;
  completed: number;
}

const DAY = 86_400_000;

export function elapsedPct(start: Date, end: Date | null, now: Date): number | null {
  if (!end) return null;
  const span = end.getTime() - start.getTime();
  if (span <= 0) return now >= end ? 100 : 0;
  return Math.max(0, Math.min(100, ((now.getTime() - start.getTime()) / span) * 100));
}

export function projectHealth(input: {
  status: ProjectStatus;
  startDate: Date;
  endDate: Date | null;
  counts: { status: TaskStatus; count: number }[];
  overdueTasks: number;
  now: Date;
}): Health {
  const p = projectProgress(input.counts);
  const elapsed = elapsedPct(input.startDate, input.endDate, input.now);
  const base = { completionPct: p.rate, elapsedPct: elapsed, total: p.total, completed: p.completed };
  if (input.status === "COMPLETED") return { ...base, label: "Completed", tone: "green" };
  if (input.status === "ON_HOLD") return { ...base, label: "On hold", tone: "slate" };
  if (input.status === "CANCELLED") return { ...base, label: "Cancelled", tone: "slate" };
  if (p.total === 0) return { ...base, label: "No tasks yet", tone: "slate" };
  if (p.completed === p.total) return { ...base, label: "On track", tone: "green" };
  // The target date is a calendar day: overdue from the day after it.
  if (input.endDate && input.now.getTime() >= input.endDate.getTime() + DAY) return { ...base, label: "Overdue", tone: "red" };
  const gap = (elapsed ?? 0) - p.rate;
  if (gap <= 15 && input.overdueTasks === 0) return { ...base, label: "On track", tone: "green" };
  if (gap <= 35) return { ...base, label: "At risk", tone: "amber" };
  return { ...base, label: "Off track", tone: "red" };
}

// Tasks Status ring: one slice per status, in workflow order. Colours are the app's status colours.
export const STATUS_ORDER: TaskStatus[] = ["COMPLETED", "IN_PROGRESS", "PENDING_APPROVAL", "PIPELINE", "ON_HOLD", "REJECTED", "DECLINED"];
export const STATUS_COLOR: Record<TaskStatus, string> = {
  COMPLETED: "#10b981",
  IN_PROGRESS: "#f59e0b",
  PENDING_APPROVAL: "#38bdf8",
  PIPELINE: "#2584fc",
  ON_HOLD: "#a1a1aa",
  REJECTED: "#f43f5e",
  DECLINED: "#52525b",
};

export function statusBreakdown(counts: { status: TaskStatus; count: number }[]) {
  const total = counts.reduce((s, c) => s + c.count, 0);
  return {
    total,
    rows: STATUS_ORDER.map((status) => ({ status, count: counts.filter((c) => c.status === status).reduce((s, c) => s + c.count, 0) })),
  };
}
