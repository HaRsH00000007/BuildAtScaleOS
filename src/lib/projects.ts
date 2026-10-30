import "server-only";
import type { Prisma, ProjectStatus } from "@prisma/client";
import { can, type CurrentUser } from "./auth";
import { db } from "./db";
import { isMonthScoped, sumEntries, type BillingType } from "./finance";
import { monthRange } from "./format";

export type ProjectScope = "my" | "all";
export type Billability = "all" | "billable" | "non-billable";

/** "All projects" is everything for projects.view_all holders, and their own plus public projects for everyone else (A). */
export function effectiveScope(requested: string | undefined): ProjectScope {
  return requested === "all" ? "all" : "my";
}

export function projectWhere(
  user: CurrentUser,
  scope: ProjectScope,
  q?: string,
  filters: { billability?: Billability; clientId?: string; status?: ProjectStatus } = {},
): Prisma.ProjectWhereInput {
  const and: Prisma.ProjectWhereInput[] = [];
  if (scope === "my") and.push({ members: { some: { userId: user.id } } });
  else if (!can(user, "projects.view_all")) and.push({ OR: [{ isPublic: true }, { members: { some: { userId: user.id } } }] });
  if (q) and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { client: { name: { contains: q, mode: "insensitive" } } }] });
  if (filters.billability === "billable") and.push({ isBillable: true });
  if (filters.billability === "non-billable") and.push({ isBillable: false });
  if (filters.clientId) and.push({ clientId: filters.clientId });
  if (filters.status) and.push({ status: filters.status });
  return { AND: and };
}

/** Can this user see the project at all? Members, public projects, and projects.view_all holders. */
export async function canViewProject(user: CurrentUser, projectId: string) {
  if (can(user, "projects.view_all")) return true;
  const project = await db.project.findUnique({ where: { id: projectId }, select: { isPublic: true, members: { where: { userId: user.id }, select: { id: true } } } });
  return !!project && (project.isPublic || project.members.length > 0);
}

export async function canManageProject(user: CurrentUser, projectId: string) {
  if (can(user, "projects.view_all") && can(user, "projects.manage")) return true;
  if (!can(user, "projects.manage")) return false;
  const member = await db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: user.id } } });
  return member?.role === "MANAGER";
}

/** Project money is shown to the project's managers and to ops.manage holders (who already see Portfolio), not to every member (A). */
export async function canSeeProjectFinance(user: CurrentUser, projectId: string) {
  return can(user, "ops.manage") || (await canManageProject(user, projectId));
}

/** Other income and expenses for the KPI strip: the selected month for retainers, lifetime otherwise. */
export async function loadFinanceTotals(project: { id: string; billingType: BillingType }, month: string) {
  const { start, end } = monthRange(month);
  const rows = await db.projectFinanceEntry.groupBy({
    by: ["kind"],
    where: { projectId: project.id, ...(isMonthScoped(project.billingType) ? { date: { gte: start, lt: end } } : {}) },
    _sum: { amount: true },
  });
  return sumEntries(rows.map((r) => ({ kind: r.kind, amount: Number(r._sum.amount ?? 0) })));
}
