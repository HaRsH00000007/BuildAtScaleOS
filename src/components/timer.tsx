"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** "Started at Mon, 19 Oct • 01:09 AM" with a running hh:mm:ss clock, as on the demo's In Progress cards. */
export function RunningTimer({ startedAt }: { startedAt: string }) {
  const start = new Date(startedAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.floor((now - start.getTime()) / 1000));
  const label = `${start.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })} • ${start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  return (
    <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-center text-xs text-emerald-700">
      <div>Started at {label}</div>
      <div className="font-mono text-sm font-semibold" suppressHydrationWarning>
        {pad(Math.floor(secs / 3600))}:{pad(Math.floor((secs % 3600) / 60))}:{pad(secs % 60)}
      </div>
    </div>
  );
}
