"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { login } from "./actions";

export function LoginForm() {
  return (
    <ActionForm action={login} className="space-y-4">
      {() => (
        <>
          <Field label="Email" name="email">
            <input id="email" name="email" type="email" autoComplete="username" required className="input" />
          </Field>
          <Field label="Password" name="password">
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </Field>
          <SubmitButton>Sign in</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
