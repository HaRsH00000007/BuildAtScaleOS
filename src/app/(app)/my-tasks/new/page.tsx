import { EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { taskFormOptions } from "@/lib/task-options";
import { readParams, type SearchParams } from "@/lib/url";
import { createTask } from "../actions";
import { TaskForm } from "../task-forms";

export default async function NewTaskPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await readParams(searchParams);
  const { projects, taskTypes } = await taskFormOptions(user);
  return (
    <>
      <PageHeader title="New task" />
      {projects.length === 0 ? (
        <EmptyState title="You are not a member of any active project" />
      ) : (
        <TaskForm action={createTask} projects={projects} taskTypes={taskTypes} defaultProjectId={params.projectId} currentUserId={user.id} />
      )}
    </>
  );
}
