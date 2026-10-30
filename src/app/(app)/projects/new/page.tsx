import { can, requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayUtc } from "@/lib/org";
import { readParams, withParams, type SearchParams } from "@/lib/url";
import { navParams } from "../navigator";
import { ProjectWizard } from "../project-wizard";

export default async function NewProjectPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("projects.manage");
  const params = await readParams(searchParams);
  const [clients, people, departments] = await Promise.all([
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, departmentId: true, designation: true } }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <ProjectWizard
      clients={clients}
      people={people}
      departments={departments}
      canAddClient={can(user, "clients.manage")}
      currentUserId={user.id}
      today={todayUtc().toISOString().slice(0, 10)}
      cancelHref={withParams("/projects", navParams(params), {})}
    />
  );
}
