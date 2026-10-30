import Link from "next/link";
import { InlineAction } from "@/components/forms";
import { Badge, Card, cx, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/org";
import { PERMISSIONS } from "@/lib/permissions";
import { readParams, type SearchParams } from "@/lib/url";
import { deleteRole, saveOrgSettings, saveRole } from "./actions";
import { OrgSettingsForm, RoleForm } from "./settings-forms";

const PERMISSION_LIST = Object.entries(PERMISSIONS).map(([key, label]) => ({ key, label }));

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("settings.manage");
  const params = await readParams(searchParams);
  const [org, roles] = await Promise.all([getOrgSettings(), db.role.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } })]);
  const editing = params.role === "new" ? null : roles.find((r) => r.id === params.role);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Card title="Organisation and tasks">
          <OrgSettingsForm action={saveOrgSettings} org={{ ...org, autoApproveMaxHours: org.autoApproveMaxHours.toString() }} />
        </Card>
        <Card title="Roles" actions={<Link href="/settings?role=new" className="text-xs text-brand-600 hover:underline">New role</Link>}>
          <ul className="mb-4 divide-y divide-slate-100 text-sm">
            {roles.map((r) => (
              <li key={r.id} className={cx("flex flex-wrap items-center gap-2 py-2", editing?.id === r.id && "bg-brand-50")}>
                <Link href={`/settings?role=${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                <span className="text-xs text-slate-500">{r.description}</span>
                <span className="ml-auto text-xs text-slate-500">
                  {r._count.users} {r._count.users === 1 ? "person" : "people"} · {r.permissions.length} permissions
                </span>
                {r.isSystem ? (
                  <Badge>Built-in</Badge>
                ) : (
                  r._count.users === 0 && (
                    <InlineAction action={deleteRole} hidden={{ id: r.id }} variant="ghost" confirm={`Delete the role ${r.name}?`}>
                      Delete
                    </InlineAction>
                  )
                )}
              </li>
            ))}
          </ul>
          {(editing || params.role === "new") && (
            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-3 text-sm font-semibold">{editing ? `Edit ${editing.name}` : "New role"}</h3>
              <RoleForm key={editing?.id ?? "new"} action={saveRole.bind(null, editing?.id ?? null)} role={editing ?? undefined} permissions={PERMISSION_LIST} />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
