import Link from "next/link";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2xl border border-cream-200 bg-white p-4 shadow-sm", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const buttonStyles = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  ghost: "text-slate-600 hover:bg-cream-200",
};

export type ButtonVariant = keyof typeof buttonStyles;

export function buttonClass(variant: ButtonVariant = "primary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-1 rounded-full font-bold transition disabled:opacity-50",
    size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm",
    buttonStyles[variant],
  );
}

export function LinkButton({ href, children, variant = "primary", size = "md" }: { href: string; children: ReactNode; variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <Link href={href} className={buttonClass(variant, size)}>
      {children}
    </Link>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "brand" | "green" | "amber" | "red" | "blue" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    brand: "bg-brand-100 text-brand-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-700",
    blue: "bg-sky-100 text-sky-700",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

const avatarColors = ["bg-fuchsia-500", "bg-lime-500", "bg-sky-500", "bg-orange-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500"];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const color = avatarColors[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % avatarColors.length];
  const sizes = { sm: "h-6 w-6 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-base" };
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-lg font-semibold text-white", color, sizes[size])} title={name}>
      {initials(name)}
    </span>
  );
}

/** Segmented control rendered as links (keeps state in the URL). */
export function Segmented({ items }: { items: { label: ReactNode; href: string; active: boolean }[] }) {
  return (
    <div className="flex rounded-full border border-cream-200 bg-cream-200 p-0.5 text-sm">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cx(
            "flex-1 rounded-full px-3 py-1.5 text-center whitespace-nowrap",
            item.active ? "bg-white font-medium text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-800",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export function ProgressBar({ pct }: { pct: number | null }) {
  const value = Math.max(0, Math.min(100, pct ?? 0));
  const color = value >= 100 ? "bg-rose-500" : value >= 75 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-200">
      <div className={cx("h-1.5 rounded-full", color)} style={{ width: `${value}%` }} />
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-cream-200 bg-white p-8 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "green" | "red" }) {
  return (
    <div className="rounded-xl bg-cream p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cx("mt-0.5 text-lg font-semibold", tone === "green" && "text-emerald-600", tone === "red" && "text-rose-600")}>{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
