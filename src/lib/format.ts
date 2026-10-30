/** 117.75 → "117 h 45 m" (demo's hour format). */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(Math.abs(totalMinutes) / 60);
  const m = Math.abs(totalMinutes) % 60;
  return `${totalMinutes < 0 ? "-" : ""}${h} h ${String(m).padStart(2, "0")} m`;
}

export function formatPct(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(2)}%`;
}

/** dd-mm-yyyy, as in the demo's "Started 01-07-2025". */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${d}-${m}-${date.getUTCFullYear()}`;
}

/** "2026-10" → first and first-of-next month (UTC), used for month-scoped queries. */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const { start } = monthRange(month);
  return start.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function shiftMonth(month: string, delta: number): string {
  const { start } = monthRange(month);
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
