import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPerson } from "../actions";
import { PersonForm } from "../person-form";

export default async function NewPersonPage() {
  await requirePermission("people.manage");
  const [roles, departments, managers] = await Promise.all([
    db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Add person" subtitle="They sign in with this email and the first password you set." />
      <PersonForm action={createPerson} roles={roles} departments={departments} managers={managers} defaultRoleId={roles.find((r) => r.name === "Employee")?.id} />
    </>
  );
}
