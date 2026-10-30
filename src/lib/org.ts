import "server-only";
import { db } from "./db";

export const TIME_ZONE = "Asia/Kolkata";

export async function getOrgSettings() {
  return db.orgSettings.upsert({ where: { id: "org" }, create: { id: "org" }, update: {} });
}

/** Today's calendar date in the org time zone, as UTC midnight. */
export function todayUtc(now = new Date()): Date {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
  return new Date(`${s}T00:00:00Z`);
}
