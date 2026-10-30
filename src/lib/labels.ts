// Display labels. Task states use the platform's wording (verified on the Work In Harmony demo).
export const TASK_STATUS_LABEL = {
  PIPELINE: "In Pipeline",
  IN_PROGRESS: "In Progress",
  PENDING_APPROVAL: "Pending Approval",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
  REJECTED: "Rejected",
  DECLINED: "Declined",
} as const;

// Harmony's project type and finance wording (V, from the platform's labels).
export const BILLING_LABEL = { RETAINER: "Retainer", PROJECT: "Project", PAY_AS_YOU_GO: "Pay as you go" } as const;
export const FINANCE_KIND_LABEL = { OTHER_INCOME: "Other income", DIRECT_EXPENSE: "Direct expense", ADHOC_EXPENSE: "Ad-hoc expense" } as const;
