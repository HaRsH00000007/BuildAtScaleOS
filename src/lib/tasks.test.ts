import { describe, expect, it } from "vitest";
import { allowedActions, allowedCommands, applyAction, completionStatus, elapsedHours } from "./tasks";

const assignee = { isAssignee: true, isAssigner: false };
const assigner = { isAssignee: false, isAssigner: true };

describe("task workflow (matches demo board buttons)", () => {
  it("assignee buttons per column", () => {
    expect(allowedCommands("PIPELINE", assignee)).toEqual(["start", "deny", "complete"]);
    expect(allowedCommands("IN_PROGRESS", assignee)).toEqual(["hold", "complete"]);
    expect(allowedCommands("ON_HOLD", assignee)).toEqual(["resume"]);
    expect(allowedCommands("PENDING_APPROVAL", assignee)).toEqual([]);
  });

  it("assigner buttons per column", () => {
    expect(allowedCommands("PIPELINE", assigner)).toEqual(["complete", "edit", "delete", "reassign"]);
    expect(allowedCommands("IN_PROGRESS", assigner)).toEqual(["complete", "edit", "delete"]);
    expect(allowedCommands("PENDING_APPROVAL", assigner)).toEqual(["approve", "reject"]);
    expect(allowedCommands("COMPLETED", assigner)).toEqual(["revert"]);
    expect(allowedCommands("ON_HOLD", assigner)).toEqual(["edit", "delete"]);
    expect(allowedCommands("DECLINED", assigner)).toEqual(["reassign"]);
  });

  it("applies transitions and enforces the actor", () => {
    expect(applyAction("PIPELINE", "complete", assignee)).toEqual({ status: "PENDING_APPROVAL" });
    expect(applyAction("PENDING_APPROVAL", "approve", assigner)).toEqual({ status: "COMPLETED" });
    expect(applyAction("PENDING_APPROVAL", "approve", assignee)).toHaveProperty("error");
    expect(applyAction("COMPLETED", "start", assignee)).toHaveProperty("error");
    expect(allowedActions("REJECTED", assignee)).toEqual(["resume"]);
  });

  it("measures timer stints in hours, capped at 24", () => {
    const t0 = new Date("2026-10-19T10:00:00Z");
    expect(elapsedHours(t0, new Date("2026-10-19T11:30:00Z"))).toBe(1.5);
    expect(elapsedHours(t0, new Date("2026-10-21T10:00:00Z"))).toBe(24);
    expect(elapsedHours(t0, new Date("2026-10-19T09:00:00Z"))).toBe(0);
  });
});

describe("completion rules", () => {
  const rules = { approvalRequired: true, autoApprove: true, autoApproveMaxHours: 2 };
  it("auto-approves tasks with 2 h or less logged and waits for approval otherwise", () => {
    expect(completionStatus(2, rules)).toBe("COMPLETED");
    expect(completionStatus(2.01, rules)).toBe("PENDING_APPROVAL");
    expect(completionStatus(0.5, { ...rules, autoApprove: false })).toBe("PENDING_APPROVAL");
    expect(completionStatus(10, { ...rules, approvalRequired: false })).toBe("COMPLETED");
  });
});
