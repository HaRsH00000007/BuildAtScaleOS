import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { updatePerson } from "../../actions";
import { PersonForm } from "../../person-form";

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("people.manage");
  const { id } = await params;
  const [person, roles, departments, managers] = await Promise.all([
    db.user.findUnique({ where: { id } }),
    db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { status: "ACTIVE", id: { not: id } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!person) notFound();
  return (
    <>
      <PageHeader title={person.name} subtitle={person.email} />
      <PersonForm
        action={updatePerson.bind(null, id)}
        roles={roles}
        departments={departments}
        managers={managers}
        person={{ ...person, joinDate: person.joinDate?.toISOString().slice(0, 10) ?? "" }}
      />
    </>
  );
}
