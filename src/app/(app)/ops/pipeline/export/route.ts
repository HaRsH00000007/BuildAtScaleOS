import { can, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, monthLabel } from "@/lib/format";
import { formatDayIn, formatDuration, PIPELINE_STATUS_LABEL, PRIORITY_LABEL, reviewWait, SLA_LABEL, slaStatus, taskMonth, turnaroundHours, urgencyColumn } from "@/lib/ops-metrics";
import { PIPELINE_SORTS, pipelineWhere, readPipelineFilters } from "@/lib/ops-pipeline";
import { TIME_ZONE } from "@/lib/org";

// Task Pipeline CSV with the same filters as the screen. Columns follow the Google Sheet's Task Pipeline tab.
const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!can(user, "ops.view")) return new Response("Forbidden", { status: 403 });
  const f = readPipelineFilters(Object.fromEntries(new URL(request.url).searchParams));
  const tasks = await db.task.findMany({
    where: pipelineWhere(f),
    orderBy: PIPELINE_SORTS[f.sort]!.orderBy,
    include: {
      project: { include: { client: true } },
      assignee: true,
      reviewer: true,
      blockerType: true,
      events: { where: { action: { in: ["approve", "reject"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  const now = new Date();
  // The sheet's 20 columns in its order, then fields the sheet does not have.
  const header = ["Task ID", "Task Name", "Project Name", "Client", "Assignee", "Priority", "Start Date", "Due Date", "Completed Date", "Status", "Task Completion Time", "Notes / Remarks", "SLA Delivery Status", "Month", "Urgency", "Blocker Category", "Reviewer", "Revision Count", "Under Review Date", "Review Wait Time", "Blocker Note", "Client Action", "Reopen Count"];
  const lines = [header.join(",")];
  for (const t of tasks) {
    lines.push(
      [
        t.code,
        t.title,
        t.project.name,
        t.project.client.name,
        t.assignee.name,
        PRIORITY_LABEL[t.priority],
        formatDayIn(t.startDate, TIME_ZONE),
        formatDate(t.deadline),
        formatDayIn(t.completedDate, TIME_ZONE),
        PIPELINE_STATUS_LABEL[t.status],
        formatDuration(turnaroundHours(t)),
        t.notes ?? "",
        SLA_LABEL[slaStatus(t, now, TIME_ZONE)],
        monthLabel(taskMonth(t, TIME_ZONE)),
        urgencyColumn(t, now, TIME_ZONE).label,
        t.blockerType?.name ?? "None",
        t.reviewer?.name ?? "",
        t.revisionCount,
        formatDayIn(t.underReviewAt, TIME_ZONE),
        formatDuration(reviewWait(t, t.events[0]?.createdAt, now)),
        t.blockerNote ?? "",
        t.clientAction ?? "",
        t.reopenCount,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="task-pipeline-${f.month}.csv"` } });
}
