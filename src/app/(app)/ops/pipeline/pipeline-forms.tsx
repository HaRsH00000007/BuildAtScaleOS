"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { cx } from "@/components/ui";
import type { ActionState } from "@/lib/actions";
import { BLOCKER_NAME_MAX, NEW_BLOCKER } from "@/lib/ops-metrics";

/** A select that saves as soon as it changes (priority, reviewer). Keyed on the saved value: React resets the form after the action, so it remounts with the new value. */
export function AutoSubmitSelect({
  action,
  hidden,
  name,
  value,
  options,
  label,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <form action={action}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <select
        key={value}
        name={name}
        defaultValue={value}
        aria-label={label}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={cx("rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand-500", className)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}

/** Blocker reason form, used both to block a task and to edit the blocker of a blocked task. "Add a new blocker" reveals a
 * text box; the typed reason is saved to the shared list for everyone. */
export function BlockerForm({
  action,
  blockerTypes,
  initial,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  blockerTypes: { id: string; name: string }[];
  initial?: { blockerTypeId?: string | null; blockerNote?: string | null; clientAction?: string | null };
  submitLabel: string;
}) {
  const [choice, setChoice] = useState(initial?.blockerTypeId ?? "");
  const [newName, setNewName] = useState(""); // controlled so a failed save keeps what was typed
  return (
    <ActionForm action={action} className="space-y-3">
      {(state) => (
        <>
          <Field label="Why is it blocked?" name="blockerTypeId" error={state.fieldErrors?.blockerTypeId} required>
            <select id="blockerTypeId" name="blockerTypeId" className="input" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Choose…</option>
              {blockerTypes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              <option value={NEW_BLOCKER}>+ Add a new blocker…</option>
            </select>
          </Field>
          {choice === NEW_BLOCKER && (
            <Field label="New blocker" name="newBlocker" error={state.fieldErrors?.newBlocker} required>
              <input id="newBlocker" name="newBlocker" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={BLOCKER_NAME_MAX} autoFocus placeholder="e.g. Waiting on legal sign-off" />
            </Field>
          )}
          <Field label="Note" name="blockerNote" error={state.fieldErrors?.blockerNote}>
            <textarea id="blockerNote" name="blockerNote" rows={2} className="input" defaultValue={initial?.blockerNote ?? ""} placeholder="What exactly is missing or stuck?" />
          </Field>
          <Field label="What the client must do (if anything)" name="clientAction" error={state.fieldErrors?.clientAction}>
            <textarea id="clientAction" name="clientAction" rows={2} className="input" defaultValue={initial?.clientAction ?? ""} placeholder="e.g. Share the DNS login" />
          </Field>
          <SubmitButton size="sm">{submitLabel}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/** Notes / Remarks editor in the task panel. */
export function NotesForm({ action, notes }: { action: (state: ActionState, formData: FormData) => Promise<ActionState>; notes: string | null }) {
  const [value, setValue] = useState(notes ?? ""); // controlled so a failed save keeps what was typed
  return (
    <ActionForm action={action} className="space-y-2">
      {(state) => (
        <>
          <Field label="Notes / Remarks" name="notes" error={state.fieldErrors?.notes}>
            <textarea id="notes" name="notes" rows={3} className="input" value={value} onChange={(e) => setValue(e.target.value)} maxLength={2000} placeholder="Progress, decisions, anything the team should know" />
          </Field>
          <SubmitButton size="sm" variant="secondary">
            Save notes
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
