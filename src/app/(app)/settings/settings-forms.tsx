"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import type { ActionState } from "@/lib/actions";

type Org = { name: string; taskApprovalRequired: boolean; autoApproveTasks: boolean; autoApproveMaxHours: string };

export function OrgSettingsForm({ action, org }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; org: Org }) {
  return (
    <ActionForm action={action} className="space-y-3">
      {(state) => {
        const err = state.fieldErrors ?? {};
        return (
          <>
            <Field label="Organisation name (shown in the sidebar)" name="name" error={err.name} required>
              <input id="name" name="name" defaultValue={org.name} className="input" required />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="taskApprovalRequired" defaultChecked={org.taskApprovalRequired} /> Completed tasks need a reviewer&apos;s approval
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="autoApproveTasks" defaultChecked={org.autoApproveTasks} /> Auto-approve short tasks
            </label>
            <Field label="Auto-approve tasks with time spent up to (hours)" name="autoApproveMaxHours" error={err.autoApproveMaxHours}>
              <input id="autoApproveMaxHours" name="autoApproveMaxHours" type="number" min={0} step={0.25} defaultValue={org.autoApproveMaxHours} className="input max-w-32" />
            </Field>
            <SubmitButton>Save settings</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}

type Role = { name: string; description: string | null; permissions: string[] };

export function RoleForm({
  action,
  role,
  permissions,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  role?: Role;
  permissions: { key: string; label: string }[];
}) {
  return (
    <ActionForm action={action} className="space-y-3">
      {(state) => {
        const err = state.fieldErrors ?? {};
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Role name" name="name" error={err.name} required>
                <input id="name" name="name" defaultValue={role?.name} className="input" required />
              </Field>
              <Field label="Description" name="description" error={err.description}>
                <input id="description" name="description" defaultValue={role?.description ?? ""} className="input" />
              </Field>
            </div>
            <fieldset className="grid gap-1.5 sm:grid-cols-2">
              <legend className="label">Permissions</legend>
              {permissions.map((p) => (
                <label key={p.key} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="permissions" value={p.key} defaultChecked={role?.permissions.includes(p.key)} className="mt-1" />
                  <span>
                    <span className="font-mono text-xs text-slate-500">{p.key}</span>
                    <span className="block text-slate-700">{p.label}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <SubmitButton>{role ? "Save role" : "Create role"}</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
