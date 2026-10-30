import Link from "next/link";
import { InlineAction } from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { TASK_STATUS_LABEL } from "@/lib/labels";
import { transitionTask } from "../actions";

// Quick Actions › Complete Task: the signed-in user's open tasks (Pipeline / In Progress) with a Complete button.
// The demo's dialog was not opened; this list is our equivalent (assumed). Completion follows Settings › Organisation and tasks.
export default async function CompleteTaskPage() {
  const user = await requireUser();
  const tasks = await db.task.findMany({
    where: { assigneeId: user.id, status: { in: ["PIPELINE", "IN_PROGRESS"] } },
    orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
    include: { project: { select: { name: true } } },
  });
  return (
    <>
      <PageHeader title="Complete Task" subtitle="Your open tasks. Completing stops a running timer and sends the task for approval when required." />
      {tasks.length === 0 ? (
        <EmptyState title="Nothing to complete">You have no tasks in progress or in your pipeline.</EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/my-tasks/${t.id}`} className="font-medium hover:underline">
                    {t.title}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {t.project.name} · Deadline {formatDate(t.deadline)}
                  </div>
                </div>
                <Badge>{TASK_STATUS_LABEL[t.status]}</Badge>
                <InlineAction action={transitionTask} hidden={{ id: t.id, action: "complete" }} variant="primary">
                  Complete
                </InlineAction>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
