import "server-only";
import { can, type CurrentUser } from "./auth";
import { db } from "./db";

/** Projects the user may create tasks on, with members as assignee options. */
export async function taskFormOptions(user: CurrentUser) {
  const [projects, taskTypes] = await Promise.all([
    db.project.findMany({
      where: { status: "ACTIVE", ...(can(user, "tasks.manage") ? {} : { members: { some: { userId: user.id } } }) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, members: { select: { user: { select: { id: true, name: true } } } } },
    }),
    db.taskType.findMany({ orderBy: [{ department: { name: "asc" } }, { name: "asc" }], include: { department: { select: { name: true } } } }),
  ]);
  return {
    projects: projects.map((p) => ({ id: p.id, name: p.name, members: p.members.map((m) => m.user) })),
    taskTypes: taskTypes.map((t) => ({ id: t.id, name: t.name, department: t.department.name })),
  };
}
