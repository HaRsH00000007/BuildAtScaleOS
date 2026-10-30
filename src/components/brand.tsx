import { cx } from "./ui";

export const PRODUCT_NAME = "BuildAtScaleOS";

/** Wordmark in the buildatscale.com style: tight lowercase-heavy logotype with the "OS" picked out in cyan or blue. */
export function Wordmark({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <span className={cx("font-display font-bold tracking-tight", tone === "dark" ? "text-white" : "text-ink", className)}>
      buildatscale<span className={tone === "dark" ? "text-accent" : "text-brand-600"}>OS</span>
    </span>
  );
}
