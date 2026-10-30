import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { hasPermission, type Permission } from "./permissions";

export const SESSION_COOKIE = "wh_session";
const SESSION_DAYS = 14;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** The signed-in user with role permissions, or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { role: true, department: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    designation: user.designation,
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
    roleName: user.role.name,
    permissions: user.role.permissions,
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function can(user: CurrentUser, permission: Permission) {
  return hasPermission(user.permissions, permission);
}

/** For pages: signed-in user holding the permission, otherwise the forbidden page. */
export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user, permission)) redirect("/forbidden");
  return user;
}

export class AuthorizationError extends Error {}

/** For server actions: throws instead of redirecting so callers can report the failure. */
export async function assertPermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Not signed in");
  if (!can(user, permission)) throw new AuthorizationError("You do not have permission to do this");
  return user;
}
