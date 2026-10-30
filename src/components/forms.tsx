"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "./ui";
import type { ActionState } from "@/lib/actions";

/** Form bound to a server action returning ActionState; shows the form-level error. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: (state: ActionState) => ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {state.error && (
        <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      )}
      {children(state)}
    </form>
  );
}

export function SubmitButton({ children, variant = "primary", size = "md" }: { children: ReactNode; variant?: ButtonVariant; size?: "sm" | "md" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, size)}>
      {pending ? "Saving…" : children}
    </button>
  );
}

export function Field({
  label,
  name,
  error,
  children,
  required,
}: {
  label: string;
  name: string;
  error?: string[];
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
      {error?.[0] && <p className="mt-1 text-xs text-rose-600">{error[0]}</p>}
    </div>
  );
}

/** Small inline form for one-click server actions (status changes, deletes). */
export function InlineAction({
  action,
  children,
  variant = "secondary",
  confirm,
  hidden,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  variant?: ButtonVariant;
  confirm?: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton variant={variant} size="sm">
        {children}
      </SubmitButton>
    </form>
  );
}
