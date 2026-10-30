"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { cx } from "@/components/ui";
import type { ActionState } from "@/lib/actions";

// Edit project. New projects use the Harmony wizard (project-wizard.tsx); members, income and expenses are edited
// from the workspace's Members and Expenses tabs.

type ProjectValues = {
  name: string;
  code: string | null;
  clientId: string;
  startDate: string;
  endDate: string;
  status: string;
  description: string | null;
  billingType: string;
  isBillable: boolean;
  isPublic: boolean;
  value: string;
};

export function ProjectForm({
  action,
  clients,
  project,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  clients: { id: string; name: string }[];
  project: ProjectValues;
}) {
  const [billable, setBillable] = useState(project.isBillable);
  const [isPublic, setPublic] = useState(project.isPublic);
  return (
    <ActionForm action={action} className="max-w-3xl space-y-5 rounded-2xl border border-cream-200 bg-white p-6">
      {(state) => {
        const err = state.fieldErrors ?? {};
        return (
          <>
            <h2 className="text-lg font-bold text-ink">Project details</h2>
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="Project name" name="name" error={err.name} required>
                <input id="name" name="name" defaultValue={project.name} className="input" required />
              </Field>
              <Field label="Project ID" name="code" error={err.code}>
                <input id="code" name="code" defaultValue={project.code ?? ""} className="input" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client" name="clientId" error={err.clientId} required>
                <select id="clientId" name="clientId" defaultValue={project.clientId} className="input" required>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Project type" name="billingType" error={err.billingType} required>
                <select id="billingType" name="billingType" defaultValue={project.billingType} className="input" required>
                  <option value="RETAINER">Retainer</option>
                  <option value="PROJECT">Project</option>
                  <option value="PAY_AS_YOU_GO">Pay as you go</option>
                </select>
              </Field>
              <Field label="Status" name="status" error={err.status}>
                <select id="status" name="status" defaultValue={project.status} className="input">
                  <option value="ACTIVE">In progress</option>
                  <option value="ON_HOLD">On hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </Field>
              <Field label="Project value (₹, monthly for retainers)" name="value" error={err.value}>
                <input id="value" name="value" inputMode="decimal" defaultValue={project.value} className="input" />
              </Field>
              <Field label="Start date" name="startDate" error={err.startDate} required>
                <input id="startDate" name="startDate" type="date" defaultValue={project.startDate} className="input" required />
              </Field>
              <Field label="Target due date" name="endDate" error={err.endDate}>
                <input id="endDate" name="endDate" type="date" defaultValue={project.endDate} className="input" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Switch label="Billable" checked={billable} onChange={setBillable} />
              <Switch label="Public project" hint="Everyone who signs in can open it" checked={isPublic} onChange={setPublic} />
              <input type="hidden" name="isBillable" value={String(billable)} />
              <input type="hidden" name="isPublic" value={String(isPublic)} />
            </div>
            <Field label="Description" name="description" error={err.description}>
              <textarea id="description" name="description" rows={3} defaultValue={project.description ?? ""} className="input" />
            </Field>
            <SubmitButton>Save changes</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}

function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-cream-200 px-4 py-3">
      <div>
        <div className="text-sm text-ink">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx("relative h-7 w-12 rounded-full transition", checked ? "bg-brand-300" : "bg-slate-200")}>
        <span className={cx("absolute top-1 h-5 w-5 rounded-full shadow transition-all", checked ? "left-6 bg-brand-700" : "left-1 bg-white")} />
      </button>
    </div>
  );
}
