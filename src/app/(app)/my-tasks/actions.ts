"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthorizationError, can, getCurrentUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formObject, fromZod, toActionError, type ActionState } from "@/lib/actions";
import { canManageProject, canViewProject } from "@/lib/projects";
import { isTaskAssigner } from "@/lib/task-access";
import { canDeleteTask, canEditTask, canReassignTask, LOGGABLE, type TaskAction } from "@/lib/tasks";
import { runTaskAction } from "@/lib/task-workflow";

async function signedIn() {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Not signed in");
  return user;
}

const taskSchema = z.object({
  title: z.string({ required_error: "Describe the task" }).min(3, "At least 3 characters").max(200),
  description: z.string().max(4000).optional(),
  projectId: z.string({ required_error: "Choose a project" }),
  assigneeId: z.string({ required_error: "Choose an assignee" }),
  taskTypeId: z.string().optional(),
  deadline: z.coerce.date().optional(),
  estimatedHours: z.coerce.number().min(0).max(1000).optional(),
});

async function checkTaskInput(user: CurrentUser, data: z.infer<typeof taskSchema>) {
  if (!(await canViewProject(user, data.projectId))) throw new AuthorizationError("You are not on this project");
  const member = await db.projectMember.findUnique({ where: { projectId_userId: { projectId: data.projectId, userId: data.assigneeId } } });
  if (!member) return { fieldErrors: { assigneeId: ["The assignee must be a member of the project"] }, error: "Please fix the highlighted fields." } satisfies ActionState;
  if (data.assigneeId !== user.id && !(await canManageProject(user, data.projectId)) && !can(user, "tasks.manage")) {
    throw new AuthorizationError("Only project managers can assign tasks to others");
  }
  return null;
}

export async function createTask(_: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    const user = await signedIn();
    const parsed = taskSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const problem = await checkTaskInput(user, parsed.data);
    if (problem) return problem;
    const task = await db.task.create({ data: { ...parsed.data, assignedById: user.id } });
    id = task.id;
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/my-tasks");
  redirect(`/my-tasks/${id}`);
}

export async function updateTask(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await signedIn();
    const task = await db.task.findUniqueOrThrow({ where: { id } });
    const ctx = { isAssignee: task.assigneeId === user.id, isAssigner: await isTaskAssigner(user, task) };
    const parsed = taskSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const reassigned = parsed.data.assigneeId !== task.assigneeId;
    if (reassigned && !canReassignTask(task.status, ctx)) return { error: "This task cannot be reassigned in its current state." };
    if (!reassigned && !canEditTask(task.status, ctx)) return { error: "This task cannot be edited in its current state." };
    const problem = await checkTaskInput(user, parsed.data);
    if (problem) return problem;
    await db.task.update({
      where: { id },
      data: {
        ...(reassigned ? { events: { create: { userId: user.id, kind: "STATUS", action: "reassign", fromStatus: task.status, toStatus: "PIPELINE" } } } : {}),
        ...parsed.data,
        taskTypeId: parsed.data.taskTypeId ?? null,
        deadline: parsed.data.deadline ?? null,
        // Reassigned (incl. Declined) tasks go back to the new assignee's pipeline.
        ...(reassigned ? { status: "PIPELINE", startedAt: null } : {}),
      },
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/my-tasks");
  redirect(`/my-tasks/${id}`);
}

export async function transitionTask(formData: FormData) {
  const user = await signedIn();
  await runTaskAction(user, String(formData.get("id")), String(formData.get("action")) as TaskAction);
  revalidatePath("/my-tasks");
  revalidatePath("/projects");
  revalidatePath("/ops/pipeline");
}

export async function deleteTask(formData: FormData) {
  const user = await signedIn();
  const task = await db.task.findUniqueOrThrow({ where: { id: String(formData.get("id")) } });
  const ctx = { isAssignee: task.assigneeId === user.id, isAssigner: await isTaskAssigner(user, task) };
  if (!canDeleteTask(task.status, ctx)) throw new AuthorizationError("This task cannot be deleted by you in its current state");
  await db.task.delete({ where: { id: task.id } });
  revalidatePath("/my-tasks");
  redirect("/my-tasks");
}

const timeSchema = z.object({
  date: z.coerce.date({ errorMap: () => ({ message: "Enter a date" }) }).refine((d) => d <= new Date(), "Time cannot be logged in the future"),
  hours: z.coerce.number({ invalid_type_error: "Enter hours" }).gt(0, "More than 0").max(24, "At most 24 hours a day"),
  note: z.string().max(500).optional(),
});

export async function logTime(taskId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await signedIn();
    const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
    if (task.assigneeId !== user.id) throw new AuthorizationError("Only the assignee can log time on this task");
    if (!LOGGABLE.includes(task.status)) return { error: "Start the task before logging time." };
    const parsed = timeSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const dayStart = new Date(Date.UTC(parsed.data.date.getUTCFullYear(), parsed.data.date.getUTCMonth(), parsed.data.date.getUTCDate()));
    const dayTotal = await db.timeEntry.aggregate({ where: { userId: user.id, date: dayStart }, _sum: { hours: true } });
    if (Number(dayTotal._sum.hours ?? 0) + parsed.data.hours > 24) return { fieldErrors: { hours: ["More than 24 hours logged for this day"] }, error: "Please fix the highlighted fields." };
    await db.timeEntry.create({
      data: { userId: user.id, projectId: task.projectId, taskId, date: dayStart, hours: parsed.data.hours, note: parsed.data.note },
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath(`/my-tasks/${taskId}`);
  revalidatePath("/projects");
  return {};
}

export async function deleteTimeEntry(formData: FormData) {
  const user = await signedIn();
  const entry = await db.timeEntry.findUniqueOrThrow({ where: { id: String(formData.get("id")) } });
  if (entry.userId !== user.id) throw new AuthorizationError("You can only delete your own time");
  await db.timeEntry.delete({ where: { id: entry.id } });
  revalidatePath("/my-tasks");
  revalidatePath("/projects");
}
