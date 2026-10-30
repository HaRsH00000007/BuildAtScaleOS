"use client";

import { buttonClass } from "@/components/ui";

// Shown when the Overview can't load (for example, the database is unreachable). The rest of the app keeps working.
export default function OverviewError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <p className="text-lg font-semibold text-slate-800">The Overview couldn't load</p>
      <p className="mt-1 text-sm text-slate-500">Something went wrong while counting projects and tasks. Try again in a moment; if it keeps happening, check that the database is running.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-slate-400">Reference: {error.digest}</p>}
      <button onClick={reset} className={`${buttonClass("primary")} mt-5`}>
        Try again
      </button>
    </div>
  );
}
