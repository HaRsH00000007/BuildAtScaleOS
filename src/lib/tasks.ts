// Task workflow, from the demo's My Tasks board (REA ev_9cab6242 "Assigned to me", ev_49bd5a9c "Assigned by me").
// Verified buttons per column:
//   assignee  — Pipeline: Start, Complete, Deny · In Progress: Hold, Complete · On Hold: Resume
//   assigner  — Pipeline: Complete, Edit, Delete, Reassign · In Progress: Complete, Edit, Delete
//               Pending Approval: Approve, Reject · Completed: Revert · On Hold: Edit, Delete · Declined: Reassign
// Assumed: Rejected tasks go back to the assignee via Resume; Complete always goes to Pending Approval.

export type TaskStatus = "PIPELINE" | "IN_PROGRESS" | "PENDING_APPROVAL" | "COMPLETED" | "ON_HOLD" | "REJECTED" | "DECLINED";
export type TaskAction = "start" | "deny" | "hold" | "complete" | "approve" | "reject" | "revert" | "resume";
export type TaskCommand = TaskAction | "edit" | "delete" | "reassign";
type Actor = "assignee" | "assigner" | "either";

const TRANSITIONS: Record<TaskAction, { from: TaskStatus[]; to: TaskStatus; by: Actor; label: string }> = {
  start: { from: ["PIPELINE"], to: "IN_PROGRESS", by: "assignee", label: "Start" },
  deny: { from: ["PIPELINE"], to: "DECLINED", by: "assignee", label: "Deny" },
  hold: { from: ["IN_PROGRESS"], to: "ON_HOLD", by: "assignee", label: "Hold" },
  resume: { from: ["ON_HOLD", "REJECTED"], to: "IN_PROGRESS", by: "assignee", label: "Resume" },
  complete: { from: ["PIPELINE", "IN_PROGRESS"], to: "PENDING_APPROVAL", by: "either", label: "Complete" },
  approve: { from: ["PENDING_APPROVAL"], to: "COMPLETED", by: "assigner", label: "Approve" },
  reject: { from: ["PENDING_APPROVAL"], to: "REJECTED", by: "assigner", label: "Reject" },
  revert: { from: ["COMPLETED"], to: "IN_PROGRESS", by: "assigner", label: "Revert" },
};

/** Non-status commands available to the assigner, per column (verified). */
const ASSIGNER_COMMANDS: Record<TaskStatus, ("edit" | "delete" | "reassign")[]> = {
  PIPELINE: ["edit", "delete", "reassign"],
  IN_PROGRESS: ["edit", "delete"],
  PENDING_APPROVAL: [],
  COMPLETED: [],
  ON_HOLD: ["edit", "delete"],
  REJECTED: ["edit", "delete"],
  DECLINED: ["reassign"],
};

export const COMMAND_LABEL: Record<TaskCommand, string> = {
  ...(Object.fromEntries(Object.entries(TRANSITIONS).map(([k, v]) => [k, v.label])) as Record<TaskAction, string>),
  edit: "Edit",
  delete: "Delete",
  reassign: "Reassign",
};
export const ACTION_LABEL = COMMAND_LABEL;

export interface TaskActorContext {
  isAssignee: boolean;
  isAssigner: boolean; // includes project managers and users with tasks.manage
}

const permitted = (by: Actor, ctx: TaskActorContext) => (by === "either" ? ctx.isAssignee || ctx.isAssigner : by === "assignee" ? ctx.isAssignee : ctx.isAssigner);

export function allowedActions(status: TaskStatus, ctx: TaskActorContext): TaskAction[] {
  return (Object.keys(TRANSITIONS) as TaskAction[]).filter((a) => TRANSITIONS[a].from.includes(status) && permitted(TRANSITIONS[a].by, ctx));
}

/** The status an action moves a task to. */
export const actionTarget = (action: TaskAction): TaskStatus => TRANSITIONS[action].to;

export function allowedCommands(status: TaskStatus, ctx: TaskActorContext): TaskCommand[] {
  return [...allowedActions(status, ctx), ...(ctx.isAssigner ? ASSIGNER_COMMANDS[status] : [])];
}

export const canEditTask = (status: TaskStatus, ctx: TaskActorContext) => ctx.isAssigner && ASSIGNER_COMMANDS[status].includes("edit");
export const canDeleteTask = (status: TaskStatus, ctx: TaskActorContext) => ctx.isAssigner && ASSIGNER_COMMANDS[status].includes("delete");
export const canReassignTask = (status: TaskStatus, ctx: TaskActorContext) => ctx.isAssigner && ASSIGNER_COMMANDS[status].includes("reassign");

/** Next status, or an error message when the transition is not allowed. */
export function applyAction(status: TaskStatus, action: TaskAction, ctx: TaskActorContext): { status: TaskStatus } | { error: string } {
  const t = TRANSITIONS[action];
  if (!t) return { error: "Unknown action" };
  if (!t.from.includes(status)) return { error: `Cannot ${t.label.toLowerCase()} a task that is ${status.replace("_", " ").toLowerCase()}` };
  if (!permitted(t.by, ctx)) return { error: t.by === "assignee" ? "Only the assignee can do this" : "Only the person who assigned the task can do this" };
  return { status: t.to };
}

/** The timer runs while a task is In Progress (demo shows "Started at …" with a running clock). */
export const TIMER_STARTS: TaskAction[] = ["start", "resume", "revert"];
export const TIMER_STOPS: TaskAction[] = ["hold", "complete"];

/** Hours between two instants, rounded to the minute and capped at 24 h per stint. */
export function elapsedHours(from: Date, to: Date): number {
  const minutes = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
  return Math.min(24, minutes / 60);
}

/** Time can be logged manually while work is happening (assumption). */
export const LOGGABLE: TaskStatus[] = ["IN_PROGRESS", "PENDING_APPROVAL", "ON_HOLD", "REJECTED"];

/**
 * Status after "Complete" under Other Settings › Tasks (verified wording): without "Need Approval for Tasks" a task is
 * completed at once; with "Auto Approve Completed Tasks", "a task that took 2 hours or less is approved the moment it
 * is marked complete … measured on the hours logged against the task, not the clock".
 */
export function completionStatus(loggedHours: number, rules: { approvalRequired: boolean; autoApprove: boolean; autoApproveMaxHours: number }): TaskStatus {
  if (!rules.approvalRequired) return "COMPLETED";
  if (rules.autoApprove && loggedHours <= rules.autoApproveMaxHours) return "COMPLETED";
  return "PENDING_APPROVAL";
}
