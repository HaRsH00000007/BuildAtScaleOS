import Link from "next/link";
import { notFound } from "next/navigation";
import { InlineAction } from "@/components/forms";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatHours } from "@/lib/format";
import { TASK_STATUS_LABEL } from "@/lib/labels";
import { canViewProject } from "@/lib/projects";
import { isTaskAssigner } from "@/lib/task-access";
import { ACTION_LABEL, allowedActions, canDeleteTask, canEditTask, canReassignTask, LOGGABLE } from "@/lib/tasks";
import { RunningTimer } from "@/components/timer";
import { deleteTask, deleteTimeEntry, transitionTask } from "../actions";
import { LogTimeForm } from "../task-forms";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const task = await db.task.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { name: true } },
      assignedBy: { select: { name: true } },
      taskType: { include: { department: { select: { name: true } } } },
      timeEntries: { orderBy: { date: "desc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!task) notFound();
  const isAssignee = task.assigneeId === user.id;
  if (!isAssignee && !(await canViewProject(user, task.projectId))) notFound();
  const isAssigner = await isTaskAssigner(user, task);
  const ctx = { isAssignee, isAssigner };
  const actions = allowedActions(task.status, ctx);
  const total = task.timeEntries.reduce((s, e) => s + Number(e.hours), 0);

  return (
    <>
      <PageHeader
        title={task.title}
        subtitle={task.project.name}
        actions={
          <>
            {actions.map((a) => (
              <InlineAction key={a} action={transitionTask} hidden={{ id: task.id, action: a }} variant={a === "approve" || a === "complete" ? "primary" : "secondary"}>
                {ACTION_LABEL[a]}
              </InlineAction>
            ))}
            {(canEditTask(task.status, ctx) || canReassignTask(task.status, ctx)) && (
              <LinkButton href={`/my-tasks/${task.id}/edit`} variant="secondary" size="sm">
                {canEditTask(task.status, ctx) ? "Edit" : "Reassign"}
              </LinkButton>
            )}
            {canDeleteTask(task.status, ctx) && (
              <InlineAction action={deleteTask} hidden={{ id: task.id }} variant="danger" confirm="Delete this task and its time entries?">
                Delete
              </InlineAction>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card title={`Time log · ${formatHours(total)}`}>
          {task.status === "IN_PROGRESS" && task.startedAt && (
            <div className="mb-4 max-w-xs">
              <RunningTimer startedAt={task.startedAt.toISOString()} />
            </div>
          )}
          {isAssignee && LOGGABLE.includes(task.status) && (
            <div className="mb-4">
              <LogTimeForm taskId={task.id} today={new Date().toISOString().slice(0, 10)} />
            </div>
          )}
          {isAssignee && !LOGGABLE.includes(task.status) && <p className="mb-3 text-sm text-slate-500">Time can be logged while the task is in progress, on hold, rejected or pending approval.</p>}
          {task.timeEntries.length === 0 ? (
            <p className="text-sm text-slate-500">No time logged.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Hours</th>
                  <th>By</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {task.timeEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2">{formatDate(e.date)}</td>
                    <td>{formatHours(Number(e.hours))}</td>
                    <td>{e.user.name}</td>
                    <td className="text-slate-500">{e.note}</td>
                    <td className="text-right">
                      {e.userId === user.id && (
                        <InlineAction action={deleteTimeEntry} hidden={{ id: e.id }} variant="ghost" confirm="Delete this time entry?">
                          Delete
                        </InlineAction>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Details">
          <dl className="space-y-2 text-sm">
            <Row label="Status" value={<Badge>{TASK_STATUS_LABEL[task.status]}</Badge>} />
            <Row label="Project" value={<Link className="hover:underline" href={`/projects/${task.project.id}`}>{task.project.name}</Link>} />
            <Row label="Assignee" value={task.assignee.name} />
            <Row label="Assigned by" value={task.assignedBy.name} />
            <Row label="Task type" value={task.taskType ? `${task.taskType.department.name} · ${task.taskType.name}` : "—"} />
            <Row label="Assigned date" value={formatDate(task.assignedDate)} />
            <Row label="Deadline" value={formatDate(task.deadline)} />
            <Row label="Completed date" value={formatDate(task.completedDate)} />
            <Row label="Estimate" value={task.estimatedHours ? formatHours(Number(task.estimatedHours)) : "—"} />
          </dl>
          {task.description && <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{task.description}</p>}
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
