import "server-only";
import { AuthorizationError, type CurrentUser } from "./auth";
import { db } from "./db";
import { workflowEffects } from "./ops-metrics";
import { getOrgSettings, TIME_ZONE } from "./org";
import { isTaskAssigner } from "./task-access";
import { applyAction, completionStatus, elapsedHours, TIMER_STARTS, TIMER_STOPS, type TaskAction } from "./tasks";

export type Blocker = { blockerTypeId: string; blockerNote?: string; clientAction?: string };

/**
 * The one place task status changes happen, shared by My Tasks and the Ops Tracker Task Pipeline.
 * Applies the verified My Tasks workflow (timer, auto-approval), then the Ops Tracker fields and a TaskEvent row.
 */
export async function runTaskAction(user: CurrentUser, taskId: string, action: TaskAction, blocker?: Blocker) {
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  const result = applyAction(task.status, action, {
    isAssignee: task.assigneeId === user.id,
    isAssigner: await isTaskAssigner(user, task),
  });
  if ("error" in result) throw new AuthorizationError(result.error);
  const now = new Date();
  const org = action === "complete" ? await getOrgSettings() : null;
  await db.$transaction(async (tx) => {
    let status = result.status;
    // Stopping the timer saves the stint as time spent by the assignee.
    if (TIMER_STOPS.includes(action) && task.startedAt) {
      const hours = elapsedHours(task.startedAt, now);
      if (hours > 0) {
        await tx.timeEntry.create({
          data: {
            userId: task.assigneeId,
            projectId: task.projectId,
            taskId: task.id,
            date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
            hours,
            note: "Timer",
          },
        });
      }
    }
    if (org) {
      const logged = await tx.timeEntry.aggregate({ where: { taskId: task.id }, _sum: { hours: true } });
      status = completionStatus(Number(logged._sum.hours ?? 0), {
        approvalRequired: org.taskApprovalRequired,
        autoApprove: org.autoApproveTasks,
        autoApproveMaxHours: Number(org.autoApproveMaxHours),
      });
    }
    await tx.task.update({
      where: { id: task.id },
      data: {
        status,
        // "Completed" date is when the assignee finished (shown on Pending Approval cards in the demo).
        completedDate: action === "complete" ? now : action === "revert" || action === "reject" ? null : task.completedDate,
        startedAt: TIMER_STARTS.includes(action) ? now : TIMER_STOPS.includes(action) ? null : task.startedAt,
        ...workflowEffects(action, task, status, now, TIME_ZONE),
        ...(status === "ON_HOLD" && blocker ? { blockerTypeId: blocker.blockerTypeId, blockerNote: blocker.blockerNote ?? null, clientAction: blocker.clientAction ?? null } : {}),
      },
    });
    await tx.taskEvent.create({
      data: { taskId: task.id, userId: user.id, kind: "STATUS", action, fromStatus: task.status, toStatus: status, note: blocker?.blockerNote },
    });
  });
}
