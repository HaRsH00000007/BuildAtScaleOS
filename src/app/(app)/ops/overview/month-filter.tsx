"use client";

/** Month filter for the Overview: a GET form that reloads the page as soon as the month changes, keeping the other filters. */
export function MonthFilter({ month, options, keep }: { month: string; options: { value: string; label: string }[]; keep: Record<string, string | undefined> }) {
  return (
    <form action="/ops/overview" className="flex items-center gap-2">
      {Object.entries(keep).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <label htmlFor="overview-month" className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        Month
      </label>
      <select
        id="overview-month"
        name="month"
        defaultValue={month}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <noscript>
        <button className="rounded-full bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">Apply</button>
      </noscript>
    </form>
  );
}
