"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@/components/ui";

/** On small screens the project list collapses behind a toggle; from lg up it is always shown beside the workspace. */
export function NavigatorShell({ selectedName, children }: { selectedName?: string; children: ReactNode }) {
  const [open, setOpen] = useState(!selectedName);
  return (
    <div className="lg:sticky lg:top-0 lg:h-[calc(100vh-7.5rem)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-3 flex w-full items-center justify-between rounded-2xl border border-cream-200 bg-white px-4 py-3 text-sm font-bold text-ink lg:hidden"
      >
        <span className="truncate">{selectedName ? `Projects · ${selectedName}` : "Projects"}</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      <div className={cx("h-full", open ? "block" : "hidden lg:block")}>{children}</div>
    </div>
  );
}
