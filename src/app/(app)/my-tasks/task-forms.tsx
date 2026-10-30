"use client";

import { useMemo, useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import type { ActionState } from "@/lib/actions";
import { logTime } from "./actions";

type ProjectOption = { id: string; name: string; members: { id: string; name: string }[] };
type TaskTypeOption = { id: string; name: string; department: string };
type TaskValues = { title: string; description: string | null; projectId: string; assigneeId: string; taskTypeId: string | null; deadline: string; estimatedHours: string };

export function TaskForm({
  action,
  projects,
  taskTypes,
  task,
  defaultProjectId,
  currentUserId,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  projects: ProjectOption[];
  taskTypes: TaskTypeOption[];
  task?: TaskValues;
  defaultProjectId?: string;
  currentUserId: string;
}) {
  const [projectId, setProjectId] = useState(task?.projectId ?? defaultProjectId ?? projects[0]?.id ?? "");
  const members = useMemo(() => projects.find((p) => p.id === projectId)?.members ?? [], [projects, projectId]);
  return (
    <ActionForm action={action} className="max-w-2xl space-y-4">
      {(state) => {
        const err = state.fieldErrors ?? {};
        return (
          <>
            <Field label="Task description" name="title" error={err.title} required>
              <input id="title" name="title" defaultValue={task?.title} className="input" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project" name="projectId" error={err.projectId} required>
                <select id="projectId" name="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input">
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Assignee" name="assigneeId" error={err.assigneeId} required>
                <select id="assigneeId" name="assigneeId" key={projectId} defaultValue={task?.assigneeId ?? currentUserId} className="input">
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Task type" name="taskTypeId" error={err.taskTypeId}>
                <select id="taskTypeId" name="taskTypeId" defaultValue={task?.taskTypeId ?? ""} className="input">
                  <option value="">—</option>
                  {taskTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.department} · {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Deadline" name="deadline" error={err.deadline}>
                  <input id="deadline" name="deadline" type="date" defaultValue={task?.deadline} className="input" />
                </Field>
                <Field label="Estimate (h)" name="estimatedHours" error={err.estimatedHours}>
                  <input id="estimatedHours" name="estimatedHours" type="number" min={0} step={0.25} defaultValue={task?.estimatedHours} className="input" />
                </Field>
              </div>
            </div>
            <Field label="Details" name="description" error={err.description}>
              <textarea id="description" name="description" rows={4} defaultValue={task?.description ?? ""} className="input" />
            </Field>
            <SubmitButton>{task ? "Save changes" : "Create task"}</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}

export function LogTimeForm({ taskId, today }: { taskId: string; today: string }) {
  return (
    <ActionForm action={logTime.bind(null, taskId)}>
      {(state) => (
        <div className="grid items-end gap-2 sm:grid-cols-[150px_100px_1fr_auto]">
          <Field label="Date" name="date" error={state.fieldErrors?.date}>
            <input id="date" name="date" type="date" defaultValue={today} max={today} className="input" />
          </Field>
          <Field label="Hours" name="hours" error={state.fieldErrors?.hours}>
            <input id="hours" name="hours" type="number" min={0.25} step={0.25} className="input" />
          </Field>
          <Field label="Note" name="note" error={state.fieldErrors?.note}>
            <input id="note" name="note" className="input" />
          </Field>
          <SubmitButton>Log time</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
