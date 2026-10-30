"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthorizationError, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formObject, fromZod, toActionError, type ActionState } from "@/lib/actions";
import { canManageProject } from "@/lib/projects";

// Workstreams, as in the platform (REA ev_edc3df40, New workstream dialog): Name* ("e.g. Design, SEO, Launch
// campaign"), Description (optional), Members ("Just you, until you add others"). Managing them is a project-manager
// action (A).

async function manager(projectId: string) {
  const user = await getCurrentUser();
  if (!user || !(await canManageProject(user, projectId))) throw new AuthorizationError("Only project managers can change workstreams");
  return user;
}

const workstreamSchema = z.object({
  name: z.string({ required_error: "Name is required" }).min(2, "At least 2 characters").max(60),
  description: z.string().max(300).optional(),
});

export type WorkstreamState = ActionState & { savedAt?: number };

export async function createWorkstream(projectId: string, _: WorkstreamState, formData: FormData): Promise<WorkstreamState> {
  try {
    const user = await manager(projectId);
    const parsed = workstreamSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const memberIds = formData.getAll("memberIds").map(String).filter(Boolean);
    const projectMembers = new Set((await db.projectMember.findMany({ where: { projectId }, select: { userId: true } })).map((m) => m.userId));
    const members = [...new Set([user.id, ...memberIds])].filter((id) => id === user.id || projectMembers.has(id));
    await db.workstream.create({
      data: { projectId, name: parsed.data.name, description: parsed.data.description ?? null, members: { create: members.map((userId) => ({ userId })) } },
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/projects", "layout");
  return { savedAt: Date.now() };
}

export async function deleteWorkstream(formData: FormData) {
  const ws = await db.workstream.findUniqueOrThrow({ where: { id: String(formData.get("id")) } });
  await manager(ws.projectId);
  // Tasks stay on the project; only the grouping is removed.
  await db.workstream.delete({ where: { id: ws.id } });
  revalidatePath("/projects", "layout");
}

export async function setTaskWorkstream(formData: FormData) {
  const task = await db.task.findUniqueOrThrow({ where: { id: String(formData.get("taskId")) } });
  await manager(task.projectId);
  const workstreamId = String(formData.get("workstreamId") ?? "") || null;
  if (workstreamId) {
    const ws = await db.workstream.findUnique({ where: { id: workstreamId } });
    if (ws?.projectId !== task.projectId) throw new AuthorizationError("That workstream belongs to another project");
  }
  await db.task.update({ where: { id: task.id }, data: { workstreamId } });
  revalidatePath("/projects", "layout");
}
