import { describe, expect, it } from "vitest";
import {
  commitmentVarianceDays,
  completionPct,
  formatDuration,
  formatHoursDecimal,
  formatVariance,
  netTurnaroundHours,
  normaliseBlockerName,
  pipelineSummary,
  reviewWait,
  reviewWaitHours,
  sheetSla,
  slaStatus,
  taskMonth,
  totalReviewWaitHours,
  turnaroundHours,
  urgency,
  urgencyColumn,
  workflowEffects,
  type MetricTask,
  type SheetTask,
} from "./ops-metrics";
import type { TaskStatus } from "./tasks";

const tz = "Asia/Kolkata";
const day = (s: string) => new Date(`${s}T00:00:00Z`); // date-only values are stored at UTC midnight
const at = (s: string) => new Date(s);
const now = at("2026-10-25T10:00:00+05:30");
const task = (o: Partial<MetricTask>): MetricTask => ({ status: "IN_PROGRESS", deadline: day("2026-10-25"), completedDate: null, assignedDate: at("2026-10-20T09:00:00+05:30"), ...o });

describe("sheet KPI columns (Creatives Task Tracker examples)", () => {
  const sheetNow = at("2026-11-02T12:00:00+05:30");
  const tsk1 = task({ status: "COMPLETED", assignedDate: at("2026-10-31T00:00:00+05:30"), deadline: day("2026-11-01"), deadlineTime: "15:00", committedDate: day("2026-10-31"), committedTime: "21:00", firstSubmittedDate: day("2026-11-01"), firstSubmittedTime: "09:00" } as Partial<SheetTask>) as SheetTask;
  const tsk2 = task({ status: "PENDING_APPROVAL", assignedDate: at("2026-10-31T00:00:00+05:30"), deadline: day("2026-11-01"), deadlineTime: "18:00" } as Partial<SheetTask>) as SheetTask;
  const tsk3 = task({ status: "COMPLETED", assignedDate: at("2026-11-01T00:00:00+05:30"), deadline: day("2026-11-02"), deadlineTime: "03:30", committedDate: day("2026-11-02"), committedTime: "05:00", firstSubmittedDate: day("2026-11-02"), firstSubmittedTime: "06:00" } as Partial<SheetTask>) as SheetTask;

  it("Net Turnaround = 1st submission − assigned", () => {
    expect(formatHoursDecimal(netTurnaroundHours(tsk1, tz))).toBe("33.0h");
    expect(formatHoursDecimal(netTurnaroundHours(tsk3, tz))).toBe("30.0h");
  });
  it("Commitment Variance = (committed − deadline) / 24 h, signed", () => {
    expect(formatVariance(commitmentVarianceDays(tsk1, tz))).toBe("-0.75");
    expect(formatVariance(commitmentVarianceDays(tsk3, tz))).toBe("+0.06");
    expect(commitmentVarianceDays(tsk2, tz)).toBeNull();
  });
  it("SLA compares the 1st submission with the deadline date & time", () => {
    expect(sheetSla(tsk1, sheetNow, tz)).toBe("ON_TIME");
    expect(sheetSla(tsk2, sheetNow, tz)).toBe("OVERDUE");
    expect(sheetSla(tsk3, sheetNow, tz)).toBe("LATE");
    expect(sheetSla({ ...tsk2, deadlineTime: null, deadline: day("2026-11-02") }, sheetNow, tz)).toBe("OPEN"); // no time: due at end of day
  });
  it("Review Wait adds up every stretch Under review", () => {
    const ev = (s: string, fromStatus: TaskStatus, toStatus: TaskStatus) => ({ createdAt: at(s), fromStatus, toStatus });
    const events = [
      ev("2026-11-01T09:00:00+05:30", "IN_PROGRESS", "PENDING_APPROVAL"),
      ev("2026-11-01T12:00:00+05:30", "PENDING_APPROVAL", "REJECTED"),
      ev("2026-11-01T15:00:00+05:30", "IN_PROGRESS", "PENDING_APPROVAL"),
      ev("2026-11-01T17:00:00+05:30", "PENDING_APPROVAL", "COMPLETED"),
    ];
    expect(totalReviewWaitHours(events, sheetNow)).toBe(5);
    expect(totalReviewWaitHours(events.slice(0, 3), at("2026-11-01T16:00:00+05:30"))).toBe(4); // still waiting
    expect(totalReviewWaitHours([], sheetNow)).toBeNull();
  });
});

describe("SLA status", () => {
  it("is on time when finished on the due day (in IST), a late completion when finished after it", () => {
    expect(slaStatus(task({ status: "COMPLETED", completedDate: at("2026-10-25T23:30:00+05:30") }), now, tz)).toBe("ON_TIME");
    expect(slaStatus(task({ status: "COMPLETED", completedDate: at("2026-10-26T00:10:00+05:30") }), now, tz)).toBe("LATE");
  });
  it("counts work under review by when the assignee finished", () => {
    expect(slaStatus(task({ status: "PENDING_APPROVAL", completedDate: at("2026-10-24T18:00:00+05:30") }), now, tz)).toBe("ON_TIME");
  });
  it("marks open tasks overdue only after the due day has passed", () => {
    expect(slaStatus(task({}), now, tz)).toBe("OPEN");
    expect(slaStatus(task({ deadline: day("2026-10-24") }), now, tz)).toBe("OVERDUE");
  });
  it("handles missing due dates and declined tasks", () => {
    expect(slaStatus(task({ deadline: null }), now, tz)).toBe("NO_DUE_DATE");
    expect(slaStatus(task({ status: "DECLINED", deadline: day("2026-01-01") }), now, tz)).toBe("NOT_COUNTED");
  });
  it("judges a reopened task again (it is open, not finished)", () => {
    expect(slaStatus(task({ status: "IN_PROGRESS", completedDate: null, deadline: day("2026-10-20") }), now, tz)).toBe("OVERDUE");
  });
});

describe("urgency", () => {
  it("labels open tasks by days past due", () => {
    expect(urgency(task({ deadline: day("2026-10-21") }), now, tz)).toEqual({ label: "Overdue (4d)", tone: "red", daysOverdue: 4 });
    expect(urgency(task({}), now, tz)!.label).toBe("Due today");
    expect(urgency(task({ deadline: day("2026-10-30") }), now, tz)!.label).toBe("On track");
    expect(urgency(task({ deadline: null }), now, tz)!.label).toBe("No due date");
  });
  it("uses the IST calendar day, not the UTC one", () => {
    const lateEvening = at("2026-10-25T23:50:00+05:30"); // still 25 Oct in IST
    expect(urgency(task({}), lateEvening, tz)!.label).toBe("Due today");
    const justAfterMidnight = at("2026-10-26T00:20:00+05:30"); // 25 Oct in UTC, 26 Oct in IST
    expect(urgency(task({}), justAfterMidnight, tz)!.label).toBe("Overdue (1d)");
  });
  it("is not shown for work handed in or closed", () => {
    for (const status of ["PENDING_APPROVAL", "COMPLETED", "DECLINED"] as const) expect(urgency(task({ status }), now, tz)).toBeNull();
  });
});

describe("durations", () => {
  it("measures turnaround from the first start, else from assignment", () => {
    const done = { status: "COMPLETED" as const, completedDate: at("2026-10-22T09:00:00+05:30") };
    expect(turnaroundHours(task({ ...done, startDate: at("2026-10-21T09:00:00+05:30") }))).toBe(24);
    expect(turnaroundHours(task(done))).toBe(48);
    expect(turnaroundHours(task({}))).toBeNull();
  });
  it("measures review wait to the decision, or to now while waiting", () => {
    expect(reviewWaitHours(at("2026-10-25T08:00:00+05:30"), at("2026-10-25T09:30:00+05:30"), now)).toBe(1.5);
    expect(reviewWaitHours(at("2026-10-25T08:00:00+05:30"), null, now)).toBe(2);
    expect(reviewWaitHours(null, null, now)).toBeNull();
  });
  it("measures the latest review round only", () => {
    const entered = at("2026-10-25T08:00:00+05:30");
    expect(reviewWait({ status: "COMPLETED", underReviewAt: entered }, at("2026-10-25T09:00:00+05:30"), now)).toBe(1);
    expect(reviewWait({ status: "PENDING_APPROVAL", underReviewAt: entered }, at("2026-10-24T09:00:00+05:30"), now)).toBe(2); // old decision: still waiting
    expect(reviewWait({ status: "IN_PROGRESS", underReviewAt: entered }, at("2026-10-24T09:00:00+05:30"), now)).toBeNull();
    expect(reviewWait({ status: "PIPELINE", underReviewAt: null }, null, now)).toBeNull();
  });
  it("shows durations as hours:minutes like the sheet", () => {
    expect(formatDuration(39)).toBe("39:00");
    expect(formatDuration(0.0833)).toBe("0:05");
    expect(formatDuration(null)).toBe("—");
  });
});

describe("sheet columns", () => {
  it("files a task under the month it is due, else the month it was assigned (IST)", () => {
    expect(taskMonth({ deadline: day("2026-06-15"), assignedDate: at("2026-09-01T10:00:00+05:30") }, tz)).toBe("2026-06");
    expect(taskMonth({ deadline: null, assignedDate: at("2026-06-30T23:30:00+05:30") }, tz)).toBe("2026-06");
  });
  it("shows where finished work ended up in the Urgency column", () => {
    expect(urgencyColumn(task({ status: "COMPLETED", completedDate: now }), now, tz).label).toBe("Completed");
    expect(urgencyColumn(task({ status: "PENDING_APPROVAL", completedDate: now }), now, tz).label).toBe("Under review");
    expect(urgencyColumn(task({ deadline: day("2026-10-20") }), now, tz).label).toBe("Overdue (5d)");
  });
});

describe("summary and completion", () => {
  it("counts statuses, open overdue work and the on-time rate", () => {
    const s = pipelineSummary(
      [
        task({ status: "COMPLETED", completedDate: at("2026-10-24T10:00:00+05:30") }),
        task({ status: "COMPLETED", completedDate: at("2026-10-27T10:00:00+05:30") }),
        task({ deadline: day("2026-10-20") }),
        task({ status: "ON_HOLD" }),
        task({ status: "DECLINED" }),
      ],
      now,
      tz,
    );
    expect(s).toMatchObject({ total: 5, overdueOpen: 1, onTime: 1, late: 1, onTimeRate: 50, blocked: 1 });
    expect(s.byStatus.COMPLETED).toBe(2);
  });
  it("leaves declined tasks out of completion %", () => {
    expect(completionPct([{ status: "COMPLETED" }, { status: "IN_PROGRESS" }, { status: "DECLINED" }])).toBe(50);
    expect(completionPct([])).toBeNull();
  });
});

describe("workflow effects", () => {
  const t0 = at("2026-10-25T10:00:00+05:30");
  it("stamps the first start only", () => {
    expect(workflowEffects("start", { status: "PIPELINE", startDate: null }, "IN_PROGRESS", t0)).toEqual({ startDate: t0 });
    expect(workflowEffects("resume", { status: "REJECTED", startDate: at("2026-10-20T10:00:00Z") }, "IN_PROGRESS", t0)).toEqual({});
  });
  it("stamps review entry and counts reviews, revisions and reopens", () => {
    expect(workflowEffects("complete", { status: "IN_PROGRESS", startDate: t0 }, "PENDING_APPROVAL", t0)).toEqual({ underReviewAt: t0 });
    expect(workflowEffects("approve", { status: "PENDING_APPROVAL", startDate: t0 }, "COMPLETED", t0)).toEqual({ reviewCount: { increment: 1 } });
    expect(workflowEffects("reject", { status: "PENDING_APPROVAL", startDate: t0 }, "REJECTED", t0)).toEqual({ revisionCount: { increment: 1 } });
    expect(workflowEffects("revert", { status: "COMPLETED", startDate: t0 }, "IN_PROGRESS", t0)).toEqual({ reopenCount: { increment: 1 } });
  });
  it("stamps the 1st submission on the first Complete only, as an IST day and half-hour slot", () => {
    const late = at("2026-10-25T23:47:00+05:30");
    expect(workflowEffects("complete", { status: "IN_PROGRESS", startDate: t0 }, "PENDING_APPROVAL", late, tz)).toEqual({ underReviewAt: late, firstSubmittedDate: day("2026-10-25"), firstSubmittedTime: "23:30" });
    expect(workflowEffects("complete", { status: "REJECTED", startDate: t0, firstSubmittedDate: day("2026-10-20") }, "PENDING_APPROVAL", late, tz)).toEqual({ underReviewAt: late });
  });
  it("keeps the blocker category and note when a task leaves On Hold, clearing only the client's to-do", () => {
    expect(workflowEffects("resume", { status: "ON_HOLD", startDate: t0 }, "IN_PROGRESS", t0)).toEqual({ clientAction: null });
  });
});

describe("blocker names", () => {
  it("trims and collapses whitespace so near-duplicates match", () => {
    expect(normaliseBlockerName("  Waiting on   legal  sign-off ")).toBe("Waiting on legal sign-off");
    expect(normaliseBlockerName(" \t ")).toBe("");
  });
});
