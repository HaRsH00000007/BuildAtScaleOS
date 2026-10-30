import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { InlineAction } from "@/components/forms";
import { MonthPicker } from "@/components/month-picker";
import { RunningTimer } from "@/components/timer";
import { Avatar, Badge, cx, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentMonth, formatDate, formatHours } from "@/lib/format";
import { TASK_STATUS_LABEL } from "@/lib/labels";
import { isTaskAssigner } from "@/lib/task-access";
import { availableScopes, monthWhere, scopeWhere, SORTS } from "@/lib/task-query";
import { allowedCommands, COMMAND_LABEL, type TaskStatus } from "@/lib/tasks";
import { readParams, withParams, type SearchParams } from "@/lib/url";
import { deleteTask, transitionTask } from "./actions";

const COLUMNS: TaskStatus[] = ["PIPELINE", "IN_PROGRESS", "PENDING_APPROVAL", "COMPLETED", "ON_HOLD", "REJECTED", "DECLINED"];
const COLUMN_TINT: Record<TaskStatus, string> = {
  PIPELINE: "bg-slate-50",
  IN_PROGRESS: "bg-amber-50",
  PENDING_APPROVAL: "bg-sky-50",
  COMPLETED: "bg-emerald-50",
  ON_HOLD: "bg-orange-50",
  REJECTED: "bg-rose-50",
  DECLINED: "bg-zinc-100",
};
const shortDate = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—");
const longDate = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

export default async function MyTasksPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await readParams(searchParams);
  const scopes = availableScopes(user);
  const scope = scopes.some((s) => s.key === params.scope) ? params.scope! : "mine";
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : currentMonth();
  const view = params.view === "list" ? "list" : "board";
  const sort = params.sort && SORTS[params.sort] ? params.sort : "deadline";
  const href = (o: Record<string, string | undefined>) => withParams("/my-tasks", params, o);

  const base: Prisma.TaskWhereInput = { AND: [scopeWhere(user, scope), monthWhere(month)] };
  const [tasks, perProject] = await Promise.all([
    db.task.findMany({
      where: { ...base, ...(params.project ? { projectId: params.project } : {}) },
      orderBy: [SORTS[sort]!, { createdAt: "asc" }],
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { name: true } },
        assignedBy: { select: { name: true } },
        taskType: { select: { name: true } },
        timeEntries: { select: { hours: true } },
      },
    }),
    db.task.groupBy({ by: ["projectId"], where: base, _count: true }),
  ]);
  const projectNames = await db.project.findMany({ where: { id: { in: perProject.map((p) => p.projectId) } }, select: { id: true, name: true } });
  const commands = new Map(
    await Promise.all(tasks.map(async (t) => [t.id, allowedCommands(t.status, { isAssignee: t.assigneeId === user.id, isAssigner: await isTaskAssigner(user, t) })] as const)),
  );
  const spent = (t: (typeof tasks)[number]) => t.timeEntries.reduce((s, e) => s + Number(e.hours), 0);
  if (sort === "spent") tasks.sort((a, b) => spent(b) - spent(a));

  const card = (t: (typeof tasks)[number]) => (
    <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <div className="truncate font-semibold">{t.project.name}</div>
      <div className="truncate text-xs text-slate-500">{t.taskType?.name ?? "—"}</div>
      <Link href={`/my-tasks/${t.id}`} className="mt-1 line-clamp-2 block hover:underline">
        {t.title}
      </Link>
      {t.status === "IN_PROGRESS" && t.startedAt ? (
        <RunningTimer startedAt={t.startedAt.toISOString()} />
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
          {t.status === "PENDING_APPROVAL" || t.status === "COMPLETED" ? (
            <Chip label="Completed" value={shortDate(t.completedDate)} />
          ) : (
            <Chip label="Assigned" value={shortDate(t.assignedDate)} />
          )}
          <Chip label="Deadline" value={shortDate(t.deadline)} warn={!!t.deadline && t.deadline < new Date() && ["PIPELINE", "IN_PROGRESS", "ON_HOLD"].includes(t.status)} />
        </div>
      )}
      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
        <Avatar name={t.assignee.name} size="sm" /> <span className="truncate">{t.assignee.name}</span>
        <span className="ml-auto text-slate-400">{formatHours(spent(t))}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {commands.get(t.id)!.map((c) =>
          c === "edit" || c === "reassign" ? (
            <LinkButton key={c} href={`/my-tasks/${t.id}/edit`} variant="secondary" size="sm">
              {COMMAND_LABEL[c]}
            </LinkButton>
          ) : c === "delete" ? (
            <InlineAction key={c} action={deleteTask} hidden={{ id: t.id }} variant="danger" confirm="Delete this task?">
              Delete
            </InlineAction>
          ) : (
            <InlineAction key={c} action={transitionTask} hidden={{ id: t.id, action: c }} variant={c === "approve" || c === "complete" || c === "start" ? "primary" : "secondary"}>
              {COMMAND_LABEL[c]}
            </InlineAction>
          ),
        )}
      </div>
    </div>
  );

  const sortHeader = (key: string, label: string) => (
    <Link href={href({ sort: key })} className={cx("hover:text-slate-900", sort === key && "font-semibold text-slate-900")}>
      {label}
      {sort === key ? " ↓" : ""}
    </Link>
  );

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-6 py-2">
        <nav className="flex flex-wrap gap-1 text-sm">
          {scopes.map((s) => (
            <Link key={s.key} href={href({ scope: s.key === "mine" ? undefined : s.key, project: undefined })} className={cx("border-b-2 px-3 py-2", s.key === scope ? "border-brand-600 font-semibold text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
              {s.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
            {(["board", "list"] as const).map((v) => (
              <Link key={v} href={href({ view: v === "board" ? undefined : v })} className={cx("rounded-md px-3 py-1.5 capitalize", v === view ? "bg-white font-medium text-brand-700 shadow-sm" : "text-slate-500")}>
                {v}
              </Link>
            ))}
          </div>
          <a href={withParams("/my-tasks/report", { scope, month, project: params.project }, {})} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm" title="Download report">
            ⬇
          </a>
          <MonthPicker month={month} hrefFor={(m) => href({ month: m })} />
          <LinkButton href={`/my-tasks/new${params.project ? `?projectId=${params.project}` : ""}`}>New task</LinkButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
          <div className="px-4 py-3 text-sm font-semibold">Projects</div>
          <Link href={href({ project: undefined })} className={cx("flex items-center gap-2 px-4 py-2.5 text-sm", !params.project ? "bg-brand-50 font-medium text-brand-700" : "hover:bg-slate-50")}>
            All Projects
          </Link>
          {projectNames.map((p) => (
            <Link key={p.id} href={href({ project: p.id })} className={cx("flex items-center gap-2 px-4 py-2", params.project === p.id ? "bg-brand-50" : "hover:bg-slate-50")}>
              <Avatar name={p.name} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm">{p.name}</span>
                <span className="text-xs text-slate-500">{perProject.find((x) => x.projectId === p.id)?._count ?? 0} tasks</span>
              </span>
            </Link>
          ))}
        </aside>

        <div className="min-w-0 flex-1 overflow-auto p-4">
          {view === "board" ? (
            <div className="flex gap-3">
              {COLUMNS.map((status) => {
                const items = tasks.filter((t) => t.status === status);
                return (
                  <div key={status} className={cx("w-60 shrink-0 rounded-xl p-2", COLUMN_TINT[status])}>
                    <div className="mb-2 flex items-center justify-between px-1 font-semibold">
                      {TASK_STATUS_LABEL[status]} <Badge>{items.length}</Badge>
                    </div>
                    <div className="space-y-2">{items.map(card)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="px-4 py-3 text-sm">
                <span className="font-semibold">Tasks ({tasks.length})</span> <span className="text-slate-500">Showing 1-{tasks.length} of {tasks.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">{sortHeader("title", "Task Description")}</th>
                      <th>Project</th>
                      <th>{sortHeader("assignee", "Assigned to")}</th>
                      <th>{sortHeader("assigned", "Assigned Date")}</th>
                      <th>{sortHeader("deadline", "Deadline")}</th>
                      <th>{sortHeader("completed", "Completed Date")}</th>
                      <th>Task Type</th>
                      <th>{sortHeader("spent", "Time Spent")}</th>
                      <th>{sortHeader("status", "Status")}</th>
                      <th>Assigned By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tasks.map((t) => (
                      <tr key={t.id}>
                        <td className="px-3 py-2">
                          <Link href={`/my-tasks/${t.id}`} className="font-medium hover:underline">
                            {t.title}
                          </Link>
                        </td>
                        <td>{t.project.name}</td>
                        <td>{t.assignee.name}</td>
                        <td>{longDate(t.assignedDate)}</td>
                        <td>{formatDate(t.deadline)}</td>
                        <td>{longDate(t.completedDate)}</td>
                        <td>{t.taskType?.name ?? "—"}</td>
                        <td>{formatHours(spent(t))}</td>
                        <td>
                          <Badge>{TASK_STATUS_LABEL[t.status]}</Badge>
                        </td>
                        <td>{t.assignedBy.name}</td>
                      </tr>
                    ))}
                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                          No tasks.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cx("rounded-md border px-1.5 py-1", warn ? "border-rose-200 text-rose-600" : "border-slate-200 text-slate-600")}>
      <div className="text-[10px] text-slate-400">{label}</div>
      {value}
    </div>
  );
}
