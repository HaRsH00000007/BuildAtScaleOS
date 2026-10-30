import { describe, expect, it } from "vitest";
import { projectProgress, readPortfolioFilters, sortPortfolio } from "./ops-portfolio";

describe("project progress", () => {
  it("is completed / total, leaving declined tasks out", () => {
    const p = projectProgress([
      { status: "COMPLETED", count: 12 },
      { status: "IN_PROGRESS", count: 1 },
      { status: "DECLINED", count: 3 },
    ]);
    expect(p).toMatchObject({ total: 13, completed: 12 });
    expect(p.rate).toBeCloseTo(92.3, 1); // the sheet's PRJ-001 row
  });
  it("counts work under review as not yet completed", () => {
    expect(projectProgress([{ status: "PENDING_APPROVAL", count: 1 }, { status: "COMPLETED", count: 1 }]).rate).toBe(50);
  });
  it("shows a project with no tasks as 0%", () => {
    expect(projectProgress([])).toEqual({ total: 0, completed: 0, rate: 0 });
  });
});

describe("portfolio filters", () => {
  it("opens on All Months and ignores unknown values", () => {
    expect(readPortfolioFilters({})).toEqual({ month: "all", client: undefined, lead: undefined, status: undefined, sort: "code" });
    expect(readPortfolioFilters({ month: "June", status: "DONE", sort: "x" })).toMatchObject({ month: "all", status: undefined, sort: "code" });
    expect(readPortfolioFilters({ month: "2026-06", status: "COMPLETED", sort: "due" })).toMatchObject({ month: "2026-06", status: "COMPLETED", sort: "due" });
  });
});

describe("portfolio sorting", () => {
  const row = (code: string | null, end: string | null, rate: number, created = "2026-05-01") => ({
    code,
    endDate: end ? new Date(`${end}T00:00:00Z`) : null,
    progress: { total: 1, completed: 0, rate },
    createdAt: new Date(`${created}T00:00:00Z`),
  });
  it("orders Project IDs numerically and puts uncoded projects last", () => {
    expect(sortPortfolio([row("PRJ-010", null, 0), row(null, null, 0), row("PRJ-002", null, 0)], "code").map((r) => r.code)).toEqual(["PRJ-002", "PRJ-010", null]);
  });
  it("sorts by target due date (none last) and by completion, lowest first", () => {
    const rows = [row("PRJ-001", "2026-07-20", 92), row("PRJ-002", null, 50), row("PRJ-003", "2026-05-31", 100)];
    expect(sortPortfolio(rows, "due").map((r) => r.code)).toEqual(["PRJ-003", "PRJ-001", "PRJ-002"]);
    expect(sortPortfolio(rows, "completion").map((r) => r.code)).toEqual(["PRJ-002", "PRJ-001", "PRJ-003"]);
  });
});
