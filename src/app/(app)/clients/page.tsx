import Link from "next/link";
import { InlineAction } from "@/components/forms";
import { Card, cx, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { readParams, type SearchParams } from "@/lib/url";
import { deleteClient, saveClient } from "./actions";
import { ClientForm } from "./client-form";

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("clients.manage");
  const params = await readParams(searchParams);
  const clients = await db.client.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { projects: true } } } });
  const editing = params.id ? clients.find((c) => c.id === params.id) : undefined;

  return (
    <>
      <PageHeader title="Clients" subtitle="The companies your projects are for." />
      {params.error === "has-projects" && (
        <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          That client still has projects. Move or delete its projects first.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 text-right font-medium">Projects</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className={cx("border-b border-slate-100 last:border-0", editing?.id === c.id && "bg-brand-50")}>
                  <td className="px-3 py-2.5 font-medium">{c.name}</td>
                  <td className="px-3 py-2.5 text-slate-600">{c.contactName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{c.email ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{c.phone ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{c._count.projects}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Link href={`/clients?id=${c.id}`} className="rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100">
                        Edit
                      </Link>
                      {c._count.projects === 0 && (
                        <InlineAction action={deleteClient} hidden={{ id: c.id }} variant="ghost" confirm={`Delete ${c.name}?`}>
                          Delete
                        </InlineAction>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No clients yet. Add the first one on the right.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Card title={editing ? `Edit ${editing.name}` : "Add a client"} actions={editing && <Link href="/clients" className="text-xs text-slate-500 underline">Cancel</Link>}>
          <ClientForm key={editing?.id ?? "new"} action={saveClient.bind(null, editing?.id ?? null)} client={editing} />
        </Card>
      </div>
    </>
  );
}
