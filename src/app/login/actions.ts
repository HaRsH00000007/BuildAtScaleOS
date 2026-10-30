"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionState } from "@/lib/actions";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };

  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Same message for unknown email and wrong password.
  if (!user || user.status !== "ACTIVE" || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
