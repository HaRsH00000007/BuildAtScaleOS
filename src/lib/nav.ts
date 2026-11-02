// Sidebar of BuildAtScaleOS. Shared by the client sidebar and server pages, so it must not live in a
// "use client" file. Pages also enforce `perm` on the server.
export type NavItem = { label: string; href: string; perm?: string; section?: string };

export const NAV: NavItem[] = [
  { label: "Overview", href: "/ops/overview", perm: "ops.manage", section: "Ops Tracker" },
  { label: "Portfolio", href: "/ops/portfolio", perm: "ops.manage" },
  { label: "Projects", href: "/projects" },
  { label: "Task Pipeline", href: "/ops/pipeline", perm: "ops.view" },
  { label: "My Tasks", href: "/my-tasks" },
  { label: "Daily Desk", href: "/ops/daily-desk", perm: "ops.view" },
  { label: "Delivery Canvas", href: "/ops/delivery-canvas", perm: "ops.view" },
  { label: "Performance", href: "/ops/performance", perm: "ops.view" },
  { label: "Client RPA", href: "/ops/client-rpa", perm: "ops.rpa" },
  { label: "People", href: "/people", perm: "people.manage", section: "Admin" },
  { label: "Departments", href: "/departments", perm: "people.manage" },
  { label: "Clients", href: "/clients", perm: "clients.manage" },
  { label: "Settings", href: "/settings", perm: "settings.manage" },
];

// Sidebar of a pipeline-only deployment. Everyone can open some project in the full app, but here Projects is for the
// people who run them, so employees see only the Task Pipeline.
export const PIPELINE_ONLY_NAV: NavItem[] = [
  { label: "Task Pipeline", href: "/ops/pipeline", perm: "ops.view" },
  { label: "Projects", href: "/projects", perm: "projects.manage", section: "Admin" },
  { label: "People", href: "/people", perm: "people.manage" },
  { label: "Departments", href: "/departments", perm: "people.manage" },
  { label: "Clients", href: "/clients", perm: "clients.manage" },
  { label: "Settings", href: "/settings", perm: "settings.manage" },
];

/** Items the user may open. */
export function visibleNav(permissions: readonly string[], items: NavItem[] = NAV): NavItem[] {
  const visible = items.filter((i) => !i.perm || permissions.includes(i.perm));
  // Keep a section heading when its first item is hidden.
  return visible.map((i, n) => {
    const section = items.slice(0, items.indexOf(i) + 1).reverse().find((x) => x.section)?.section;
    const prev = visible[n - 1];
    const prevSection = prev ? items.slice(0, items.indexOf(prev) + 1).reverse().find((x) => x.section)?.section : undefined;
    return { ...i, section: section !== prevSection ? section : undefined };
  });
}
