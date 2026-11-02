import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { taskFormOptions } from "@/lib/task-options";
import { readParams, type SearchParams } from "@/lib/url";
import { createTask } from "../actions";
import { TaskForm } from "../task-forms";

export default async function NewTaskPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await readParams(searchParams);
  const { projects, taskTypes } = await taskFormOptions(user);
  const canAddProject = can(user, "projects.manage");
  return (
    <>
      <PageHeader title="New task" actions={canAddProject && projects.length > 0 && <LinkButton href="/projects/new" variant="secondary">New project</LinkButton>} />
      {projects.length === 0 ? (
        canAddProject ? (
          <EmptyState title="Every task belongs to a project, so create a project first">
            <div className="mt-3">
              <LinkButton href="/projects/new">New project</LinkButton>
            </div>
          </EmptyState>
        ) : (
          <EmptyState title="You are not a member of any active project">Ask a manager to add you to one.</EmptyState>
        )
      ) : (
        <TaskForm action={createTask} projects={projects} taskTypes={taskTypes} defaultProjectId={params.projectId} currentUserId={user.id} />
      )}
    </>
  );
}
