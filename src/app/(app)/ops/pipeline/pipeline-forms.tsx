"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
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
  tones,
  links,
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
  /** Optional colours per option value (Tailwind bg + text classes): the select becomes a coloured pill. */
  tones?: Record<string, string>;
  /** Options that open a page instead of saving (e.g. Blocked, which needs a reason first). */
  links?: Record<string, string>;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState(value); // colour follows the choice straight away, before the save lands
  const [saved, setSaved] = useState(value);
  if (saved !== value) {
    setSaved(value);
    setPicked(value);
  }
  return (
    <form action={action} className={tones ? cx("relative inline-flex rounded-full focus-within:ring-2 focus-within:ring-brand-500", tones[picked]) : undefined}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <select
        key={value}
        name={name}
        defaultValue={value}
        aria-label={label}
        onChange={(e) => {
          const link = links?.[e.currentTarget.value];
          if (link) {
            e.currentTarget.value = value; // nothing saved yet; the linked page takes it from here
            router.push(link, { scroll: false });
            return;
          }
          setPicked(e.currentTarget.value);
          e.currentTarget.form?.requestSubmit();
        }}
        className={cx(
          tones
            ? "cursor-pointer appearance-none rounded-full border-0 bg-transparent py-0.5 pl-2.5 pr-6 text-xs font-medium text-inherit outline-none"
            : "rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand-500",
          className,
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-white text-slate-900">
            {o.label}
          </option>
        ))}
      </select>
      {tones && (
        <svg aria-hidden viewBox="0 0 10 6" className="pointer-events-none absolute right-2 top-1/2 size-2 -translate-y-1/2 fill-current">
          <path d="M0 0h10L5 6z" />
        </svg>
      )}
    </form>
  );
}

/** A date box that saves as soon as a day is picked (or cleared). Keyed on the saved value, like AutoSubmitSelect. */
export function AutoSubmitDate({
  action,
  hidden,
  name,
  value,
  label,
  required,
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  name: string;
  value: string;
  label: string;
  required?: boolean;
}) {
  return (
    <form action={action}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        key={value}
        type="date"
        name={name}
        defaultValue={value}
        aria-label={label}
        required={required}
        onChange={(e) => {
          if (required && !e.currentTarget.value) return; // cleared a required date: keep the saved one
          e.currentTarget.form?.requestSubmit();
        }}
        className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700 outline-none focus:border-brand-500"
      />
    </form>
  );
}

/** The Preview Link cell: the link, plus an edit box (saves on Enter or when it loses focus; Esc cancels). */
export function PreviewLinkCell({ action, link, canEdit }: { action: (state: ActionState, formData: FormData) => Promise<ActionState>; link: string | null; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(link);
  if (saved !== link) {
    setSaved(link);
    setEditing(false); // the save landed
  }
  if (editing) {
    return (
      <form action={formAction} className="w-[220px]">
        <input
          name="previewLink"
          type="url"
          defaultValue={link ?? ""}
          autoFocus
          disabled={pending}
          placeholder="https://…"
          aria-label="Preview link"
          onBlur={(e) => (e.currentTarget.value.trim() === (link ?? "") ? setEditing(false) : e.currentTarget.form?.requestSubmit())}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          className="w-full rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand-500"
        />
        {state.error && <p className="mt-0.5 text-xs whitespace-normal text-rose-600">{state.error}</p>}
      </form>
    );
  }
  return (
    <span className="flex max-w-[220px] items-center gap-1.5">
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="truncate text-brand-700 hover:underline" title={link}>
          {link.replace(/^https?:\/\/(www\.)?/, "")}
        </a>
      ) : (
        <span className="text-slate-300">—</span>
      )}
      {canEdit && (
        <button type="button" onClick={() => setEditing(true)} className="text-slate-400 hover:text-slate-700" aria-label={link ? "Edit preview link" : "Add preview link"}>
          ✎
        </button>
      )}
    </span>
  );
}

/** The Notes / Remarks cell: the note cut short, plus a box to edit it in place (Enter or clicking away saves,
 * Shift+Enter adds a line, Esc cancels). Same rights and action as the task panel's notes editor. */
export function NotesCell({ action, notes, canEdit }: { action: (state: ActionState, formData: FormData) => Promise<ActionState>; notes: string | null; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(notes);
  if (saved !== notes) {
    setSaved(notes);
    setEditing(false); // the save landed
  }
  if (editing) {
    return (
      <form action={formAction} className="w-[260px]">
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={notes ?? ""}
          autoFocus
          disabled={pending}
          placeholder="Progress, decisions, anything the team should know"
          aria-label="Notes / Remarks"
          onBlur={(e) => (e.currentTarget.value.trim() === (notes ?? "") ? setEditing(false) : e.currentTarget.form?.requestSubmit())}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
            else if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="w-full resize-y rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs not-italic outline-none focus:border-brand-500"
        />
        {state.error && <p className="mt-0.5 text-xs whitespace-normal text-rose-600 not-italic">{state.error}</p>}
      </form>
    );
  }
  return (
    <span className="flex max-w-[260px] items-center gap-1.5">
      {notes ? (
        <span className="truncate" title={notes}>
          {notes}
        </span>
      ) : (
        <span className="text-slate-300 not-italic">—</span>
      )}
      {canEdit && (
        <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-slate-400 not-italic hover:text-slate-700" aria-label={notes ? "Edit notes" : "Add notes"}>
          ✎
        </button>
      )}
    </span>
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
