import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentMonth, formatDate } from "@/lib/format";
import { TASK_STATUS_LABEL } from "@/lib/labels";
import { availableScopes, monthWhere, scopeWhere } from "@/lib/task-query";

// Download icon on My Tasks (verified on the demo; file format unknown — CSV is ours). Columns follow the List view.
const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const scope = availableScopes(user).some((s) => s.key === url.searchParams.get("scope")) ? url.searchParams.get("scope")! : "mine";
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") ?? "") ? url.searchParams.get("month")! : currentMonth();
  const project = url.searchParams.get("project");
  const tasks = await db.task.findMany({
    where: { AND: [scopeWhere(user, scope), monthWhere(month)], ...(project ? { projectId: project } : {}) },
    orderBy: { deadline: "asc" },
    include: { project: true, assignee: true, assignedBy: true, taskType: true, timeEntries: { select: { hours: true } } },
  });
  const lines = [["Task Description", "Project", "Assigned to", "Assigned Date", "Deadline", "Completed Date", "Task Type", "Time Spent (h)", "Status", "Assigned By"].join(",")];
  for (const t of tasks) {
    lines.push(
      [t.title, t.project.name, t.assignee.name, formatDate(t.assignedDate), formatDate(t.deadline), formatDate(t.completedDate), t.taskType?.name ?? "", t.timeEntries.reduce((s, e) => s + Number(e.hours), 0), TASK_STATUS_LABEL[t.status], t.assignedBy.name]
        .map(csvCell)
        .join(","),
    );
  }
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="tasks-${month}.csv"` } });
}
