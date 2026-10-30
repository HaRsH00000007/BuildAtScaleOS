import { describe, expect, it } from "vitest";
import { DEFAULT_ROLES } from "./permissions";
import { visibleNav } from "./nav";

describe("visibleNav", () => {
  it("shows an employee the shared Ops screens without admin or manager screens", () => {
    const labels = visibleNav(DEFAULT_ROLES.Employee!.permissions).map((i) => i.label);
    expect(labels).toEqual(["Projects", "Task Pipeline", "My Tasks", "Daily Desk", "Delivery Canvas", "Performance"]);
  });
  it("moves a section heading to the first visible item", () => {
    const items = visibleNav(DEFAULT_ROLES.Employee!.permissions);
    expect(items[0]!.section).toBe("Ops Tracker");
    expect(items.slice(1).every((i) => !i.section)).toBe(true);
  });
  it("gives Management every item with both headings", () => {
    const items = visibleNav(DEFAULT_ROLES.Management!.permissions);
    expect(items).toHaveLength(13);
    expect(items.filter((i) => i.section).map((i) => i.section)).toEqual(["Ops Tracker", "Admin"]);
  });
});
