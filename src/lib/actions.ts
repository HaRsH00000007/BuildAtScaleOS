import type { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AuthorizationError } from "./auth";

export type ActionState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

export function fromZod(error: ZodError): ActionState {
  return { error: "Please fix the highlighted fields.", fieldErrors: error.flatten().fieldErrors as ActionState["fieldErrors"] };
}

/** Map expected failures to a user-facing message; rethrow everything else (incl. Next redirects). */
export function toActionError(err: unknown): ActionState {
  if (err instanceof AuthorizationError) return { error: err.message };
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return { error: `A record with this ${String((err.meta?.target as string[] | undefined)?.join(", ") ?? "value")} already exists.` };
    if (err.code === "P2003") return { error: "This record is still referenced by other records." };
    if (err.code === "P2025") return { error: "The record no longer exists." };
  }
  throw err;
}

/** FormData → plain object with empty strings turned into undefined (so optional zod fields work). */
export function formObject(formData: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value.trim() === "" ? undefined : value.trim();
  }
  return out;
}
