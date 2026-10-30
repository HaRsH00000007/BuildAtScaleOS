import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, DEFAULT_ROLES, hasPermission, sanitizePermissions } from "./permissions";

describe("permissions", () => {
  it("defines the six default role names", () => {
    expect(Object.keys(DEFAULT_ROLES).sort()).toEqual(["Employee", "HR", "Management", "Manager", "Operations", "Team Lead"]);
  });
  it("gives Management everything and Employee no management rights", () => {
    expect(DEFAULT_ROLES.Management!.permissions).toEqual(ALL_PERMISSIONS);
    for (const p of ["settings.manage", "people.manage", "projects.manage", "tasks.manage"] as const) {
      expect(hasPermission(DEFAULT_ROLES.Employee!.permissions, p)).toBe(false);
    }
  });
  it("opens the Ops Tracker to every role but keeps team-wide screens to leads", () => {
    for (const r of Object.values(DEFAULT_ROLES)) expect(hasPermission(r.permissions, "ops.view")).toBe(true);
    for (const p of ["ops.manage", "ops.performance", "ops.rpa"] as const) {
      expect(hasPermission(DEFAULT_ROLES.Employee!.permissions, p)).toBe(false);
    }
    expect(DEFAULT_ROLES.HR!.permissions).toContain("ops.performance");
  });
  it("only references known permission keys", () => {
    for (const r of Object.values(DEFAULT_ROLES)) expect(sanitizePermissions(r.permissions)).toEqual(r.permissions);
  });
  it("drops unknown keys and duplicates from editor input", () => {
    expect(sanitizePermissions(["ops.view", "ops.view", "root.everything"])).toEqual(["ops.view"]);
  });
});
