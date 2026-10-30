import { notFound, redirect } from "next/navigation";
import { LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageProject } from "@/lib/projects";
import { updateProject } from "../../actions";
import { ProjectForm } from "../../project-form";

const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? "";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) notFound();
  if (!(await canManageProject(user, id))) redirect("/forbidden");
  const clients = await db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader
        title="Edit project"
        subtitle={`${project.code ?? ""} ${project.name}`.trim()}
        actions={
          <LinkButton href={`/projects/${id}`} variant="secondary">
            Back to project
          </LinkButton>
        }
      />
      <ProjectForm
        action={updateProject.bind(null, id)}
        clients={clients}
        project={{ ...project, startDate: day(project.startDate), endDate: day(project.endDate), value: String(Number(project.value)) }}
      />
    </>
  );
}
