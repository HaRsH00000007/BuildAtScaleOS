import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { NEW_BLOCKER, normaliseBlockerName } from "./ops-metrics";

// Ops Tracker blocker reasons: a shared list anyone blocking a task can add to (A).

export function listBlockerTypes() {
  return db.blockerType.findMany({ orderBy: [{ createdAt: "asc" }, { name: "asc" }], select: { id: true, name: true } });
}

const findByName = (name: string) => db.blockerType.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true, name: true } });

/**
 * Turns the blocker form's choice into a BlockerType: an existing id, or NEW_BLOCKER plus a typed name. A typed name
 * that matches an existing reason (ignoring case) reuses it instead of adding a near-duplicate. Returns null for an unknown id.
 */
export async function resolveBlockerType(choice: string, newName: string | undefined, userId: string) {
  if (choice !== NEW_BLOCKER) return db.blockerType.findUnique({ where: { id: choice }, select: { id: true, name: true } });
  const name = normaliseBlockerName(newName ?? "");
  const existing = await findByName(name);
  if (existing) return existing;
  try {
    return await db.blockerType.create({ data: { name, createdById: userId }, select: { id: true, name: true } });
  } catch (err) {
    // Someone added the same name a moment ago.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return findByName(name);
    throw err;
  }
}
