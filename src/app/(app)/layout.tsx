import { Sidebar } from "@/components/sidebar";
import { Avatar } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { visibleNav } from "@/lib/nav";
import { getOrgSettings } from "@/lib/org";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const org = await getOrgSettings();
  return (
    <div className="flex h-screen">
      <Sidebar items={visibleNav(user.permissions)} orgName={org.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-ink-800 bg-ink px-6 py-3 text-white">
          <div className="text-right">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs text-zinc-400">{user.roleName}</div>
          </div>
          <Avatar name={user.name} />
          <form action={logout}>
            <button className="rounded-full bg-cream px-3 py-1 text-sm font-bold text-ink hover:bg-white">Sign out</button>
          </form>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
