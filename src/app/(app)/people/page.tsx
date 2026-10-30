import Link from "next/link";
import { Avatar, Badge, cx, LinkButton, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { readParams, withParams, type SearchParams } from "@/lib/url";

export default async function PeoplePage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("people.manage");
  const params = await readParams(searchParams);
  const showExited = params.status === "exited";
  const people = await db.user.findMany({
    where: { status: showExited ? "EXITED" : "ACTIVE" },
    orderBy: { name: "asc" },
    include: { role: { select: { name: true } }, department: { select: { name: true } }, manager: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader title="People" subtitle="Everyone who signs in to BuildAtScaleOS." actions={<LinkButton href="/people/new">Add person</LinkButton>} />
      <div className="mb-3 flex rounded-lg bg-slate-100 p-0.5 text-sm w-fit">
        {(["active", "exited"] as const).map((s) => (
          <Link key={s} href={withParams("/people", params, { status: s === "active" ? undefined : s })} className={cx("rounded-md px-3 py-1.5", (s === "exited") === showExited ? "bg-white font-medium text-brand-700 shadow-sm" : "text-slate-500")}>
            {s === "active" ? "Active" : "Deactivated"}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Designation</th>
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Reports to</th>
              <th className="px-3 py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/people/${p.id}/edit`} className="flex items-center gap-2 hover:underline">
                    <Avatar name={p.name} size="sm" />
                    <span>
                      <span className="block font-medium">{p.name}</span>
                      <span className="block text-xs text-slate-500">{p.email}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{p.empCode ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">{p.designation ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">{p.department?.name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">{p.manager?.name ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge>{p.role.name}</Badge>
                </td>
              </tr>
            ))}
            {people.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Nobody here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
