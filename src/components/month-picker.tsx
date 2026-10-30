import Link from "next/link";
import { monthLabel, shiftMonth } from "@/lib/format";

/** ‹ Oct 2026 › — month navigation kept in the URL (`month=YYYY-MM`). */
export function MonthPicker({ month, hrefFor }: { month: string; hrefFor: (month: string) => string }) {
  return (
    <div className="flex items-center rounded-lg border border-slate-300 bg-white text-sm">
      <Link href={hrefFor(shiftMonth(month, -1))} className="px-2 py-1.5 text-slate-500 hover:text-slate-900" aria-label="Previous month">
        ‹
      </Link>
      <span className="px-1 font-medium">{monthLabel(month)}</span>
      <Link href={hrefFor(shiftMonth(month, 1))} className="px-2 py-1.5 text-slate-500 hover:text-slate-900" aria-label="Next month">
        ›
      </Link>
    </div>
  );
}
