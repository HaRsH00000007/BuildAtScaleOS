// Permission keys checked by pages and server actions. Roles and their permissions are editable in Settings › Roles;
// changes take effect on the next request (permissions are read from the role row).
// Project/task keys and role names come from the OpsCentral platform this app was split from; the ops.* keys and
// defaults are assumptions from the Ops Tracker plan (A).

export const PERMISSIONS = {
  "people.manage": "Add, edit and deactivate people; manage departments and task types",
  "clients.manage": "Add and edit clients",
  "projects.view_all": "See all projects, not just own",
  "projects.manage": "Create and edit projects and their members",
  "tasks.view_all": "See tasks across the organisation on My Tasks",
  "tasks.manage": "Assign and edit tasks on any project",
  "settings.manage": "Manage roles and task settings",
  "ops.view": "Open the Ops Tracker: every task in the Task Pipeline, Daily Desk, Delivery Canvas and Performance",
  "ops.manage": "See all Ops Tracker tasks and projects, the Overview and Portfolio; manage SOP checkpoints",
  "ops.performance": "See every employee's Performance scorecard",
  "ops.rpa": "Generate and export Weekly Client RPA reports",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const DEFAULT_ROLES: Record<string, { description: string; permissions: Permission[] }> = {
  Management: { description: "Full access", permissions: ALL_PERMISSIONS },
  Operations: {
    description: "Runs delivery across projects",
    permissions: ["people.manage", "clients.manage", "projects.view_all", "projects.manage", "tasks.view_all", "tasks.manage", "ops.view", "ops.manage", "ops.rpa"],
  },
  HR: { description: "People operations", permissions: ["people.manage", "ops.view", "ops.performance"] },
  Manager: { description: "Manages projects and a team", permissions: ["projects.manage", "tasks.manage", "ops.view", "ops.manage", "ops.rpa"] },
  "Team Lead": { description: "Leads a team", permissions: ["tasks.manage", "ops.view", "ops.manage"] },
  Employee: { description: "Default role", permissions: ["ops.view"] },
};

export function hasPermission(userPermissions: readonly string[], permission: Permission): boolean {
  return userPermissions.includes(permission);
}

/** Validates a permission list coming from the role editor. */
export function sanitizePermissions(input: string[]): Permission[] {
  return [...new Set(input)].filter((p): p is Permission => p in PERMISSIONS);
}
