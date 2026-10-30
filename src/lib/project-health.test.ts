import { describe, expect, it } from "vitest";
import { elapsedPct, projectHealth, statusBreakdown } from "./project-health";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const base = { status: "ACTIVE" as const, startDate: d("2026-10-01"), endDate: d("2026-10-31"), overdueTasks: 0 };

describe("project health", () => {
  it("is On track when completion keeps up with the timeline", () => {
    const h = projectHealth({ ...base, now: d("2026-10-16"), counts: [{ status: "COMPLETED", count: 4 }, { status: "IN_PROGRESS", count: 6 }] });
    expect(h.label).toBe("On track"); // 40% done, 50% of time gone
    expect(h.completionPct).toBe(40);
  });
  it("is At risk with an overdue task, and Off track when far behind", () => {
    const counts = [{ status: "COMPLETED" as const, count: 1 }, { status: "PIPELINE" as const, count: 9 }];
    expect(projectHealth({ ...base, now: d("2026-10-07"), counts, overdueTasks: 1 }).label).toBe("At risk");
    expect(projectHealth({ ...base, now: d("2026-10-28"), counts }).label).toBe("Off track");
  });
  it("is Overdue from the day after the target date while work is left", () => {
    const counts = [{ status: "COMPLETED" as const, count: 9 }, { status: "PIPELINE" as const, count: 1 }];
    expect(projectHealth({ ...base, now: d("2026-10-31"), counts }).label).not.toBe("Overdue");
    expect(projectHealth({ ...base, now: d("2026-11-01"), counts }).label).toBe("Overdue");
  });
  it("shows the project status for finished or paused projects, and No tasks yet for an empty one", () => {
    expect(projectHealth({ ...base, status: "ON_HOLD", now: d("2026-10-10"), counts: [] }).label).toBe("On hold");
    expect(projectHealth({ ...base, now: d("2026-10-10"), counts: [] }).label).toBe("No tasks yet");
  });
  it("ignores declined tasks", () => {
    expect(projectHealth({ ...base, now: d("2026-11-20"), counts: [{ status: "COMPLETED", count: 2 }, { status: "DECLINED", count: 3 }] }).label).toBe("On track");
  });
});

describe("timeline and breakdown", () => {
  it("clamps elapsed time to 0–100 and has none without a target date", () => {
    expect(elapsedPct(d("2026-10-01"), d("2026-10-11"), d("2026-09-01"))).toBe(0);
    expect(elapsedPct(d("2026-10-01"), d("2026-10-11"), d("2026-10-06"))).toBe(50);
    expect(elapsedPct(d("2026-10-01"), null, d("2026-10-06"))).toBeNull();
  });
  it("lists every status in order with its count", () => {
    const b = statusBreakdown([{ status: "PIPELINE", count: 2 }, { status: "COMPLETED", count: 35 }]);
    expect(b.total).toBe(37);
    expect(b.rows[0]).toEqual({ status: "COMPLETED", count: 35 });
    expect(b.rows.find((r) => r.status === "PIPELINE")?.count).toBe(2);
  });
});
