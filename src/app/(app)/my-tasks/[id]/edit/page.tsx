import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isTaskAssigner } from "@/lib/task-access";
import { taskFormOptions } from "@/lib/task-options";
import { updateTask } from "../../actions";
import { TaskForm } from "../../task-forms";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const task = await db.task.findUnique({ where: { id } });
  if (!task) notFound();
  if (!(await isTaskAssigner(user, task))) redirect("/forbidden");
  const { projects, taskTypes } = await taskFormOptions(user);
  return (
    <>
      <PageHeader title="Edit task" subtitle="Changing the assignee moves the task back to In Pipeline." />
      <TaskForm
        action={updateTask.bind(null, id)}
        projects={projects}
        taskTypes={taskTypes}
        currentUserId={user.id}
        task={{
          title: task.title,
          description: task.description,
          projectId: task.projectId,
          assigneeId: task.assigneeId,
          taskTypeId: task.taskTypeId,
          deadline: task.deadline?.toISOString().slice(0, 10) ?? "",
          estimatedHours: task.estimatedHours?.toString() ?? "",
        }}
      />
    </>
  );
}
