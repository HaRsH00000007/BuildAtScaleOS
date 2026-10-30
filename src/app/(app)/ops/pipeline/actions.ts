"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/lib/auth";
import { db } from "@/lib/db";
import { formObject, fromZod, toActionError, type ActionState } from "@/lib/actions";
import { resolveBlockerType } from "@/lib/blocker-types";
import { BLOCKER_NAME_MAX, NEW_BLOCKER, normaliseBlockerName, PRIORITIES, PRIORITY_LABEL } from "@/lib/ops-metrics";
import { isTaskAssigner } from "@/lib/task-access";
import { runTaskAction } from "@/lib/task-workflow";
import type { TaskAction } from "@/lib/tasks";

// Task Pipeline actions. Status changes go through the shared workflow (same rules as My Tasks); priority and
// reviewer are assigner rights; the blocker can be edited by the assignee or an assigner. Whoever sets a blocker can
// also add a new reason to the shared list (A).

function refresh() {
  revalidatePath("/ops/pipeline");
  revalidatePath("/my-tasks");
  revalidatePath("/projects");
}

const SIMPLE_ACTIONS = ["start", "deny", "resume", "complete", "approve", "reject", "revert"] as const;

export async function moveTask(formData: FormData) {
  const user = await assertPermission("ops.view");
  const action = z.enum(SIMPLE_ACTIONS).safeParse(formData.get("action"));
  if (!action.success) throw new AuthorizationError("Unknown action");
  await runTaskAction(user, String(formData.get("id")), action.data as TaskAction);
  refresh();
}

const blockerSchema = z
  .object({
    blockerTypeId: z.string({ message: "Choose why it is blocked" }).min(1, "Choose why it is blocked"),
    newBlocker: z.string().transform(normaliseBlockerName).optional(),
    blockerNote: z.string().max(1000).optional(),
    clientAction: z.string().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.blockerTypeId !== NEW_BLOCKER) return;
    if (!v.newBlocker) ctx.addIssue({ code: "custom", path: ["newBlocker"], message: "Type the new blocker" });
    else if (v.newBlocker.length > BLOCKER_NAME_MAX) ctx.addIssue({ code: "custom", path: ["newBlocker"], message: `Keep it under ${BLOCKER_NAME_MAX} characters` });
  });

/** Validates the blocker form and resolves (or adds) its reason. */
async function readBlocker(formData: FormData, userId: string) {
  const parsed = blockerSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: fromZod(parsed.error) };
  const type = await resolveBlockerType(parsed.data.blockerTypeId, parsed.data.newBlocker, userId);
  if (!type) return { error: { error: "Please fix the highlighted fields.", fieldErrors: { blockerTypeId: ["Choose why it is blocked"] } } satisfies ActionState };
  return { type, blocker: { blockerTypeId: type.id, blockerNote: parsed.data.blockerNote || undefined, clientAction: parsed.data.clientAction || undefined } };
}

/** Block = the workflow's Hold, with the reason captured. */
export async function blockTask(taskId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("ops.view");
    const read = await readBlocker(formData, user.id);
    if (read.error) return read.error;
    await runTaskAction(user, taskId, "hold", read.blocker);
  } catch (err) {
    return toActionError(err);
  }
  refresh();
  return {};
}

export async function updateBlocker(taskId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("ops.view");
    const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
    if (task.status !== "ON_HOLD") return { error: "Only blocked tasks have a blocker." };
    if (task.assigneeId !== user.id && !(await isTaskAssigner(user, task))) throw new AuthorizationError("Only the assignee or whoever assigned the task can change the blocker");
    const read = await readBlocker(formData, user.id);
    if (read.error) return read.error;
    const data = { blockerTypeId: read.type.id, blockerNote: read.blocker.blockerNote ?? null, clientAction: read.blocker.clientAction ?? null };
    await db.task.update({ where: { id: taskId }, data: { ...data, events: { create: { userId: user.id, kind: "BLOCKER", note: [read.type.name, data.blockerNote].filter(Boolean).join(": ") } } } });
  } catch (err) {
    return toActionError(err);
  }
  refresh();
  return {};
}

const notesSchema = z.object({ notes: z.string().max(2000, "Keep notes under 2000 characters").optional() });

/** The sheet's Notes / Remarks. The assignee, whoever assigned the task, or its reviewer can edit them (A). */
export async function updateNotes(taskId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("ops.view");
    const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
    if (task.assigneeId !== user.id && task.reviewerId !== user.id && !(await isTaskAssigner(user, task))) throw new AuthorizationError("Only the assignee, the reviewer or whoever assigned the task can edit its notes");
    const parsed = notesSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    await db.task.update({ where: { id: taskId }, data: { notes: parsed.data.notes?.trim() || null } });
  } catch (err) {
    return toActionError(err);
  }
  refresh();
  return {};
}

export async function setPriority(formData: FormData) {
  const user = await assertPermission("ops.view");
  const priority = z.enum(PRIORITIES as [string, ...string[]]).parse(formData.get("priority")) as (typeof PRIORITIES)[number];
  const task = await db.task.findUniqueOrThrow({ where: { id: String(formData.get("id")) } });
  if (!(await isTaskAssigner(user, task))) throw new AuthorizationError("Only whoever assigned the task or a project manager can change its priority");
  if (task.priority === priority) return;
  await db.task.update({ where: { id: task.id }, data: { priority, events: { create: { userId: user.id, kind: "PRIORITY", note: `${PRIORITY_LABEL[task.priority]} → ${PRIORITY_LABEL[priority]}` } } } });
  refresh();
}

export async function setReviewer(formData: FormData) {
  const user = await assertPermission("ops.view");
  const task = await db.task.findUniqueOrThrow({ where: { id: String(formData.get("id")) } });
  if (!(await isTaskAssigner(user, task))) throw new AuthorizationError("Only whoever assigned the task or a project manager can choose the reviewer");
  const raw = String(formData.get("reviewerId") ?? "");
  const reviewer = raw ? await db.user.findFirst({ where: { id: raw, status: "ACTIVE" }, select: { id: true, name: true } }) : null;
  if (raw && !reviewer) throw new AuthorizationError("Choose an active team member");
  if (reviewer?.id === task.assigneeId) throw new AuthorizationError("The assignee cannot review their own task");
  if ((reviewer?.id ?? null) === task.reviewerId) return;
  await db.task.update({
    where: { id: task.id },
    data: { reviewerId: reviewer?.id ?? null, events: { create: { userId: user.id, kind: "REVIEWER", note: reviewer ? `Reviewer: ${reviewer.name}` : "Reviewer removed" } } },
  });
  refresh();
}
