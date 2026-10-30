"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/lib/auth";
import { db } from "@/lib/db";
import { PORTFOLIO_STATUSES } from "@/lib/ops-portfolio";
import { canManageProject } from "@/lib/projects";

// Portfolio status dropdown (the sheet's Status column). Same right as editing the project in Projects (A).

export async function setProjectStatus(formData: FormData) {
  const user = await assertPermission("ops.manage");
  const status = z.enum(PORTFOLIO_STATUSES as [string, ...string[]]).parse(formData.get("status")) as (typeof PORTFOLIO_STATUSES)[number];
  const projectId = String(formData.get("id"));
  if (!(await canManageProject(user, projectId))) throw new AuthorizationError("Only the project's manager can change its status");
  await db.project.update({ where: { id: projectId }, data: { status } });
  revalidatePath("/ops/portfolio");
  revalidatePath("/projects");
}
