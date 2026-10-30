import "server-only";
import type { Prisma } from "@prisma/client";
import { can, type CurrentUser } from "./auth";
import { monthRange } from "./format";

// Scope tabs as on the demo's My Tasks page (verified labels, REA ev_9cab6242).
export const TASK_SCOPES = [
  { key: "mine", label: "Assigned to me" },
  { key: "by-me", label: "Assigned by me" },
  { key: "my-projects", label: "My Projects" },
  { key: "team", label: "My Team" },
  { key: "reportees", label: "My Reportees" },
  { key: "org", label: "Org Tasks" },
] as const;

export function availableScopes(user: CurrentUser) {
  return TASK_SCOPES.filter((s) => s.key !== "org" || can(user, "tasks.view_all"));
}

export function scopeWhere(user: CurrentUser, scope: string): Prisma.TaskWhereInput {
  switch (scope) {
    case "by-me":
      return { assignedById: user.id };
    case "my-projects":
      return { project: { members: { some: { userId: user.id } } } };
    case "team": // assumption: "team" = same department
      return user.departmentId ? { assignee: { departmentId: user.departmentId } } : { id: "none" };
    case "reportees":
      return { assignee: { managerId: user.id } };
    case "org":
      return {};
    default:
      return { assigneeId: user.id };
  }
}

/** Tasks relevant to the month: assigned before it ended and not approved before it began (assumption). */
export function monthWhere(month: string): Prisma.TaskWhereInput {
  const { start, end } = monthRange(month);
  return { assignedDate: { lt: end }, OR: [{ status: { not: "COMPLETED" } }, { completedDate: { gte: start } }] };
}

// Sortable list columns (verified: Task Description, Assigned to, Assigned Date, Deadline, Completed Date, Time Spent, Status).
export const SORTS: Record<string, Prisma.TaskOrderByWithRelationInput> = {
  title: { title: "asc" },
  assignee: { assignee: { name: "asc" } },
  assigned: { assignedDate: "desc" },
  deadline: { deadline: "asc" },
  completed: { completedDate: "desc" },
  status: { status: "asc" },
};
