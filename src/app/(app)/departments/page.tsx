import { InlineAction } from "@/components/forms";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { readParams, type SearchParams } from "@/lib/url";
import { addDepartment, addTaskType, deleteDepartment, deleteTaskType } from "./actions";

const ERRORS: Record<string, string> = { name: "Names need 2 to 80 characters.", duplicate: "That name is already used." };
const inputClass = "min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm";
const addClass = "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700";

export default async function DepartmentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("people.manage");
  const params = await readParams(searchParams);
  const departments = await db.department.findMany({
    orderBy: { name: "asc" },
    include: { taskTypes: { orderBy: { name: "asc" } }, _count: { select: { members: true } } },
  });

  return (
    <>
      <PageHeader title="Departments" subtitle="Teams and the task types each team works on. Task types appear on the task form." />
      {params.error && ERRORS[params.error] && (
        <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {ERRORS[params.error]}
        </div>
      )}
      <form action={addDepartment} className="mb-4 flex max-w-md gap-2">
        <input name="name" placeholder="New department name" className={inputClass} required aria-label="New department name" />
        <button className={addClass}>Add department</button>
      </form>
      {departments.length === 0 ? (
        <EmptyState title="No departments yet" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((d) => (
            <Card
              key={d.id}
              title={`${d.name} · ${d._count.members} ${d._count.members === 1 ? "person" : "people"}`}
              actions={
                <InlineAction action={deleteDepartment} hidden={{ id: d.id }} variant="ghost" confirm={`Delete ${d.name}? Its people stay, without a department.`}>
                  Delete
                </InlineAction>
              }
            >
              <ul className="mb-3 space-y-1 text-sm">
                {d.taskTypes.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    {t.name}
                    <InlineAction action={deleteTaskType} hidden={{ id: t.id }} variant="ghost" confirm={`Remove the task type ${t.name}?`}>
                      Remove
                    </InlineAction>
                  </li>
                ))}
                {d.taskTypes.length === 0 && <li className="text-slate-500">No task types yet.</li>}
              </ul>
              <form action={addTaskType} className="flex gap-2">
                <input type="hidden" name="departmentId" value={d.id} />
                <input name="name" placeholder="New task type" className={inputClass} required aria-label={`New task type for ${d.name}`} />
                <button className={addClass}>Add</button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
