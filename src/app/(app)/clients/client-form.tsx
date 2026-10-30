"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import type { ActionState } from "@/lib/actions";

type ClientValues = { name: string; contactName: string | null; email: string | null; phone: string | null; notes: string | null };

export function ClientForm({ action, client }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; client?: ClientValues }) {
  return (
    <ActionForm action={action} className="space-y-3">
      {(state) => {
        const err = state.fieldErrors ?? {};
        return (
          <>
            <Field label="Client name" name="name" error={err.name} required>
              <input id="name" name="name" defaultValue={client?.name} className="input" required />
            </Field>
            <Field label="Contact person" name="contactName" error={err.contactName}>
              <input id="contactName" name="contactName" defaultValue={client?.contactName ?? ""} className="input" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email" name="email" error={err.email}>
                <input id="email" name="email" type="email" defaultValue={client?.email ?? ""} className="input" />
              </Field>
              <Field label="Phone" name="phone" error={err.phone}>
                <input id="phone" name="phone" defaultValue={client?.phone ?? ""} className="input" />
              </Field>
            </div>
            <Field label="Notes" name="notes" error={err.notes}>
              <textarea id="notes" name="notes" rows={2} defaultValue={client?.notes ?? ""} className="input" />
            </Field>
            <SubmitButton>{client ? "Save client" : "Add client"}</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
