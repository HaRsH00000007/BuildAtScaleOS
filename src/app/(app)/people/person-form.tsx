"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import type { ActionState } from "@/lib/actions";

type Option = { id: string; name: string };
type PersonValues = {
  name: string;
  email: string;
  empCode: string | null;
  designation: string | null;
  phone: string | null;
  joinDate: string;
  roleId: string;
  departmentId: string | null;
  managerId: string | null;
  status: string;
};

export function PersonForm({
  action,
  roles,
  departments,
  managers,
  person,
  defaultRoleId,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  roles: Option[];
  departments: Option[];
  managers: Option[];
  person?: PersonValues;
  defaultRoleId?: string;
}) {
  return (
    <ActionForm action={action} className="max-w-2xl space-y-4">
      {(state) => {
        const err = state.fieldErrors ?? {};
        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name="name" error={err.name} required>
                <input id="name" name="name" defaultValue={person?.name} className="input" required />
              </Field>
              <Field label="Work email (sign-in)" name="email" error={err.email} required>
                <input id="email" name="email" type="email" defaultValue={person?.email} className="input" required />
              </Field>
              <Field label={person ? "New password (leave blank to keep)" : "First password"} name="password" error={err.password} required={!person}>
                <input id="password" name="password" type="password" autoComplete="new-password" className="input" required={!person} />
              </Field>
              <Field label="Employee code" name="empCode" error={err.empCode}>
                <input id="empCode" name="empCode" defaultValue={person?.empCode ?? ""} className="input" />
              </Field>
              <Field label="Designation" name="designation" error={err.designation}>
                <input id="designation" name="designation" defaultValue={person?.designation ?? ""} className="input" />
              </Field>
              <Field label="Phone" name="phone" error={err.phone}>
                <input id="phone" name="phone" defaultValue={person?.phone ?? ""} className="input" />
              </Field>
              <Field label="Joining date" name="joinDate" error={err.joinDate}>
                <input id="joinDate" name="joinDate" type="date" defaultValue={person?.joinDate} className="input" />
              </Field>
              <Field label="Role" name="roleId" error={err.roleId} required>
                <select id="roleId" name="roleId" defaultValue={person?.roleId ?? defaultRoleId} className="input">
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Department" name="departmentId" error={err.departmentId}>
                <select id="departmentId" name="departmentId" defaultValue={person?.departmentId ?? ""} className="input">
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reporting manager" name="managerId" error={err.managerId}>
                <select id="managerId" name="managerId" defaultValue={person?.managerId ?? ""} className="input">
                  <option value="">—</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              {person && (
                <Field label="Status" name="status" error={err.status}>
                  <select id="status" name="status" defaultValue={person.status} className="input">
                    <option value="ACTIVE">Active</option>
                    <option value="EXITED">Deactivated (cannot sign in)</option>
                  </select>
                </Field>
              )}
            </div>
            <SubmitButton>{person ? "Save changes" : "Add person"}</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
