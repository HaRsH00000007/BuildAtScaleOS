import "server-only";
import { can, type CurrentUser } from "./auth";
import { canManageProject } from "./projects";

/** Assigner rights: the person who assigned it, a project manager, or anyone with tasks.manage. */
export async function isTaskAssigner(user: CurrentUser, task: { assignedById: string; projectId: string }) {
  return task.assignedById === user.id || can(user, "tasks.manage") || (await canManageProject(user, task.projectId));
}
