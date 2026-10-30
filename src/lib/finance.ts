// Project money for the workspace KPI strip and the creation wizard's Summary. Pure, so the rules are unit-tested.
//
// Labels are verified on Harmony (V). Profit % is of the Total Project Value (value + other income − direct expenses):
// the wizard shows ₹80,000 + ₹15,000 − ₹20,000 as "₹75,000 (100.0%)", and the header's ₹1,75,250 on ₹2,90,000 is
// 60.43% (no income or expenses there, so both bases agree). BuildAtScaleOS has no salary or department cost rates, so labour cost
// cannot be subtracted: estimated profit here is before labour, and current profit (actual hours × cost) is not
// available (A).

export type BillingType = "RETAINER" | "PROJECT" | "PAY_AS_YOU_GO";

/** Retainer money is monthly, so its finance entries are read for the selected month; other types are lifetime (V, platform rule). */
export const isMonthScoped = (billingType: BillingType) => billingType === "RETAINER";

export interface FinanceTotals {
  value: number;
  otherIncome: number;
  directExpenses: number;
  adhocExpenses: number;
}

export interface Financials extends FinanceTotals {
  /** Wizard "Total Project Value": value + other income − direct expenses. */
  totalValue: number;
  estimatedProfit: number;
  estimatedProfitPct: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export const pctOf = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : null);

export function computeFinancials(t: FinanceTotals): Financials {
  const totalValue = round2(t.value + t.otherIncome - t.directExpenses);
  const estimatedProfit = round2(totalValue - t.adhocExpenses);
  return { ...t, totalValue, estimatedProfit, estimatedProfitPct: pctOf(estimatedProfit, totalValue) };
}

/** Sums grouped ProjectFinanceEntry rows into the three KPI buckets. */
export function sumEntries(rows: { kind: "OTHER_INCOME" | "DIRECT_EXPENSE" | "ADHOC_EXPENSE"; amount: number }[]) {
  const by = (k: string) => round2(rows.filter((r) => r.kind === k).reduce((s, r) => s + r.amount, 0));
  return { otherIncome: by("OTHER_INCOME"), directExpenses: by("DIRECT_EXPENSE"), adhocExpenses: by("ADHOC_EXPENSE") };
}

/** "₹80,000" / "80000" / "80,000.50" → 80000.5; blank → 0; anything else → NaN (shown as a field error). */
export function parseAmount(raw: string | null | undefined): number {
  const s = (raw ?? "").replace(/[₹,\s]/g, "");
  if (s === "") return 0;
  return /^\d+(\.\d{0,2})?$/.test(s) ? Number(s) : NaN;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** ₹2,90,000 (Indian grouping, no paise), as Harmony shows money. */
export function formatINR(amount: number): string {
  return inr.format(Math.round(amount));
}
