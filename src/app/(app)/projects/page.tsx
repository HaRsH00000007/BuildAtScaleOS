import { redirect } from "next/navigation";
import { EmptyState, LinkButton } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { PIPELINE_HOME, pipelineOnly } from "@/lib/deploy";
import { readParams, withParams, type SearchParams } from "@/lib/url";
import { navigatorProjects, navParams, ProjectNavigator, readNavigator } from "./navigator";

// Projects opens on the first project in the list, as in Harmony. The cross-project table lives in Ops › Portfolio.
export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (pipelineOnly() && !can(user, "projects.manage")) redirect(PIPELINE_HOME);
  const params = await readParams(searchParams);
  const n = readNavigator(params);
  if (n.view === "projects") {
    const [first] = await navigatorProjects(user, params);
    if (first) redirect(withParams(`/projects/${first.id}`, navParams(params), {}));
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
      <ProjectNavigator user={user} params={params} />
      <EmptyState title={n.view === "clients" ? "Pick a client to see its projects" : n.scope === "my" ? "You are not on any project yet" : "No projects match"}>
        {can(user, "projects.manage") && n.view === "projects" && (
          <div className="mt-3">
            <LinkButton href="/projects/new">+ Add Project</LinkButton>
          </div>
        )}
      </EmptyState>
    </div>
  );
}
