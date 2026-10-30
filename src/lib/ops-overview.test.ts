import { describe, expect, it } from "vitest";
import type { MetricTask } from "./ops-metrics";
import { countsByProject, daysUntil, inRadarView, matchesProject, readOverviewFilters, riskRadar, sortTracker, type TrackerRow } from "./ops-overview";

const tz = "Asia/Kolkata";
const day = (s: string) => new Date(`${s}T00:00:00Z`); // date-only values are stored at UTC midnight
const now = new Date("2026-10-25T10:00:00+05:30");
const task = (code: string, o: Partial<MetricTask>) => ({ code, status: "IN_PROGRESS", deadline: day("2026-10-25"), completedDate: null, assignedDate: day("2026-10-01"), ...o }) as MetricTask & { code: string };

describe("overview filters", () => {
  it("opens on All Months, sorted by Project ID, with the whole radar", () => {
    expect(readOverviewFilters({})).toMatchObject({ month: "all", sort: "code", radar: "all", q: undefined, health: undefined });
  });
  it("accepts the risk sort, a health label and a radar view, and ignores unknown values", () => {
    expect(readOverviewFilters({ month: "2026-06", sort: "risk", health: "At risk", radar: "blocked", q: "  asf " })).toMatchObject({ month: "2026-06", sort: "risk", health: "At risk", radar: "blocked", q: "asf" });
    expect(readOverviewFilters({ sort: "x", health: "Great", radar: "soon" })).toMatchObject({ sort: "code", health: undefined, radar: "all" });
  });
});

describe("escalation radar", () => {
  const tasks = [
    task("TSK-001", { deadline: day("2026-10-24") }), // 1 day overdue
    task("TSK-002", { deadline: day("2026-06-01") }), // 146 days overdue
    task("TSK-003", { status: "ON_HOLD", deadline: day("2026-11-10") }), // blocked, not yet due
    task("TSK-004", {}), // due today: not at risk
    task("TSK-005", { status: "COMPLETED", deadline: day("2026-01-01"), completedDate: day("2026-02-01") }), // finished late: not open
    task("TSK-006", { status: "PENDING_APPROVAL", deadline: day("2026-10-01"), completedDate: day("2026-10-02") }), // under review: not with the assignee
    task("TSK-007", { status: "ON_HOLD", deadline: day("2026-10-10") }), // blocked and 15 days overdue
    task("TSK-008", { deadline: day("2026-10-18") }), // exactly 7 days overdue: not yet critical
  ];
  const radar = riskRadar(tasks, now, tz);

  it("lists open tasks that are overdue or blocked, oldest first", () => {
    expect(radar.map((i) => i.task.code)).toEqual(["TSK-002", "TSK-007", "TSK-008", "TSK-001", "TSK-003"]);
  });
  it("marks more than 7 days overdue as critical", () => {
    expect(radar.map((i) => [i.task.code, i.level, i.daysOverdue])).toEqual([
      ["TSK-002", "critical", 146],
      ["TSK-007", "critical", 15],
      ["TSK-008", "overdue", 7],
      ["TSK-001", "overdue", 1],
      ["TSK-003", "blocked", 0],
    ]);
  });
  it("filters by view; a blocked overdue task shows under both Overdue and Blocked", () => {
    const view = (v: Parameters<typeof inRadarView>[1]) => radar.filter((i) => inRadarView(i, v)).map((i) => i.task.code);
    expect(view("critical")).toEqual(["TSK-002", "TSK-007"]);
    expect(view("overdue")).toEqual(["TSK-002", "TSK-007", "TSK-008", "TSK-001"]);
    expect(view("blocked")).toEqual(["TSK-007", "TSK-003"]);
    expect(view("all")).toHaveLength(5);
  });
});

describe("project tracker", () => {
  const row = (o: Partial<TrackerRow>): TrackerRow => ({
    code: "PRJ-001",
    name: "ASF CRM & Automation",
    clientName: "ASF",
    leads: ["Sam"],
    endDate: day("2026-07-20"),
    createdAt: day("2026-01-01"),
    progress: { total: 10, completed: 5, rate: 50 },
    overdue: 0,
    health: "On track",
    ...o,
  });

  it("searches Project ID, name, client and lead, ignoring case", () => {
    expect(matchesProject(row({}), "prj-001")).toBe(true);
    expect(matchesProject(row({}), "crm")).toBe(true);
    expect(matchesProject(row({}), "asf")).toBe(true);
    expect(matchesProject(row({}), "sam")).toBe(true);
    expect(matchesProject(row({}), "bioarc")).toBe(false);
    expect(matchesProject(row({}), undefined)).toBe(true);
  });
  it("sorts by risk: most overdue tasks first, then least complete", () => {
    const rows = [
      row({ code: "PRJ-001", overdue: 0, progress: { total: 2, completed: 0, rate: 0 } }),
      row({ code: "PRJ-002", overdue: 2, progress: { total: 2, completed: 1, rate: 50 } }),
      row({ code: "PRJ-003", overdue: 2, progress: { total: 4, completed: 1, rate: 25 } }),
    ];
    expect(sortTracker(rows, "risk").map((r) => r.code)).toEqual(["PRJ-003", "PRJ-002", "PRJ-001"]);
    expect(sortTracker(rows, "completion").map((r) => r.code)).toEqual(["PRJ-001", "PRJ-003", "PRJ-002"]);
  });
  it("counts tasks per project and status", () => {
    const counts = countsByProject([
      { projectId: "a", status: "COMPLETED" },
      { projectId: "a", status: "COMPLETED" },
      { projectId: "a", status: "IN_PROGRESS" },
      { projectId: "b", status: "PIPELINE" },
    ]);
    expect(counts("a")).toEqual([
      { status: "COMPLETED", count: 2 },
      { status: "IN_PROGRESS", count: 1 },
    ]);
    expect(counts("missing")).toEqual([]);
  });
  it("counts days to a target date", () => {
    expect(daysUntil(day("2026-10-30"), day("2026-10-25"))).toBe(5);
    expect(daysUntil(day("2026-10-20"), day("2026-10-25"))).toBe(-5);
  });
});
