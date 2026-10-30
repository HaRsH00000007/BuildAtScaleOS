"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";
import { PRODUCT_NAME, Wordmark } from "./brand";
import { cx } from "./ui";

export function Sidebar({ items, orgName }: { items: NavItem[]; orgName: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  return (
    <aside className="flex w-56 shrink-0 flex-col bg-ink text-white">
      <div className="px-3 pt-4 pb-4">
        <div className="rounded-2xl bg-cream px-4 py-3 text-center">
          <Wordmark tone="light" className="text-lg" />
        </div>
      </div>
      {orgName !== PRODUCT_NAME && <div className="-mt-2 px-5 pb-3 text-xs text-zinc-400">{orgName}</div>}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {items.map((item) => (
          <div key={item.href}>
            {item.section && <div className="px-3 pt-4 pb-1 text-[11px] font-bold tracking-wider text-zinc-500 uppercase">{item.section}</div>}
            <Link
              href={item.href}
              className={cx(
                "flex items-center rounded-full px-3 py-2 text-sm",
                isActive(item.href) ? "bg-brand-600 font-bold text-white" : "text-zinc-300 hover:bg-ink-700 hover:text-accent",
              )}
            >
              {item.label}
            </Link>
          </div>
        ))}
      </nav>
    </aside>
  );
}
