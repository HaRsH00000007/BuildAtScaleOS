"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { buttonClass, cx } from "@/components/ui";
import { addFinanceEntry } from "./actions";
import { createWorkstream, type WorkstreamState } from "./workspace-actions";

/** Centered dialog with a dimmed backdrop; Escape or the backdrop closes it. */
export function Dialog({ title, onClose, children, width = "max-w-lg" }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div role="dialog" aria-modal="true" className={cx("relative max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl", width)}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-slate-400 hover:text-ink">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** "New Workstream" button and dialog (Name*, Description, Members — the platform's verified dialog). */
export function WorkstreamDialog({
  projectId,
  members,
  currentUserId,
  trigger = "+ New Workstream",
  triggerClass,
}: {
  projectId: string;
  members: { id: string; name: string }[];
  currentUserId: string;
  trigger?: string;
  triggerClass?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClass ?? buttonClass("secondary")}>
        {trigger}
      </button>
      {open && (
        <Dialog title="New workstream" onClose={() => setOpen(false)}>
          <WorkstreamForm projectId={projectId} members={members} currentUserId={currentUserId} onSaved={() => setOpen(false)} />
        </Dialog>
      )}
    </>
  );
}

function WorkstreamForm({ projectId, members, currentUserId, onSaved }: { projectId: string; members: { id: string; name: string }[]; currentUserId: string; onSaved: () => void }) {
  const [state, formAction] = useActionState<WorkstreamState, FormData>(createWorkstream.bind(null, projectId), {});
  useEffect(() => {
    if (state.savedAt) onSaved();
  }, [state.savedAt, onSaved]);
  const err = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      )}
      <p className="text-sm text-slate-500">Group related tasks and people inside this project, such as SEO or Paid Media.</p>
      <Field label="Name" name="ws-name" error={err.name} required>
        <input id="ws-name" name="name" placeholder="e.g. Design, SEO, Launch campaign" className="input" required autoFocus />
      </Field>
      <Field label="Description" name="ws-description" error={err.description}>
        <input id="ws-description" name="description" placeholder="Optional" className="input" />
      </Field>
      <fieldset>
        <legend className="label">Members</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-1.5">
              <input type="checkbox" name="memberIds" value={m.id} defaultChecked={m.id === currentUserId} disabled={m.id === currentUserId} />
              {m.name}
              {m.id === currentUserId && " (you)"}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">Just you, until you add others. Only project members can be added.</p>
      </fieldset>
      <div className="flex justify-end">
        <SubmitButton>Create workstream</SubmitButton>
      </div>
    </form>
  );
}

/** Overview's "Split this project into workstreams" panel; closing it is remembered in this browser only. */
export function WorkstreamIntro({ projectId, children }: { projectId: string; children: ReactNode }) {
  const key = `bas:ws-intro-hidden:${projectId}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);
  if (hidden) return null;
  return (
    <div className="relative">
      {children}
      <button
        type="button"
        aria-label="Hide this tip"
        onClick={() => {
          setHidden(true);
          try {
            window.localStorage.setItem(key, "1");
          } catch {
            // Private mode: hidden until the page reloads.
          }
        }}
        className="absolute top-4 right-4 text-xl leading-none text-slate-400 hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}

export function FinanceEntryForm({ projectId, defaultDate }: { projectId: string; defaultDate: string }) {
  return (
    <ActionForm action={addFinanceEntry.bind(null, projectId)} className="mt-4 border-t border-cream-200 pt-4">
      {(state) => (
        <div className="grid items-start gap-3 md:grid-cols-[160px_150px_1fr_140px_auto]">
          <Field label="Type" name="fe-kind" error={state.fieldErrors?.kind}>
            <select id="fe-kind" name="kind" className="input">
              <option value="DIRECT_EXPENSE">Direct expense</option>
              <option value="ADHOC_EXPENSE">Ad-hoc expense</option>
              <option value="OTHER_INCOME">Other income</option>
            </select>
          </Field>
          <Field label="Date" name="fe-date" error={state.fieldErrors?.date}>
            <input id="fe-date" name="date" type="date" defaultValue={defaultDate} className="input" required />
          </Field>
          <Field label="Description" name="fe-description" error={state.fieldErrors?.description}>
            <input id="fe-description" name="description" className="input" required />
          </Field>
          <Field label="Amount (₹)" name="fe-amount" error={state.fieldErrors?.amount}>
            <input id="fe-amount" name="amount" inputMode="decimal" placeholder="₹0" className="input" required />
          </Field>
          <div className="md:pt-5">
            <SubmitButton>Add</SubmitButton>
          </div>
        </div>
      )}
    </ActionForm>
  );
}
