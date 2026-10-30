import { describe, expect, it } from "vitest";
import { computeFinancials, formatINR, parseAmount, sumEntries } from "./finance";

describe("project financials", () => {
  it("matches the Harmony wizard summary: ₹80,000 + ₹15,000 − ₹20,000 = ₹75,000", () => {
    const f = computeFinancials({ value: 80000, otherIncome: 15000, directExpenses: 20000, adhocExpenses: 0 });
    expect(f.totalValue).toBe(75000);
    expect(f.estimatedProfit).toBe(75000);
    expect(f.estimatedProfitPct).toBe(100); // "₹75,000 (100.0%)"
  });
  it("takes ad-hoc expenses off the estimated profit and gives profit % of the total value", () => {
    const f = computeFinancials({ value: 290000, otherIncome: 0, directExpenses: 0, adhocExpenses: 114750 });
    expect(f.estimatedProfit).toBe(175250);
    expect(f.estimatedProfitPct).toBe(60.43); // Harmony's Bharat Network header
  });
  it("has no profit % without a positive total value", () => {
    expect(computeFinancials({ value: 0, otherIncome: 0, directExpenses: 0, adhocExpenses: 0 }).estimatedProfitPct).toBeNull();
    expect(computeFinancials({ value: 100, otherIncome: 0, directExpenses: 300, adhocExpenses: 0 }).estimatedProfitPct).toBeNull();
  });
  it("sums entries by kind", () => {
    expect(
      sumEntries([
        { kind: "OTHER_INCOME", amount: 100 },
        { kind: "DIRECT_EXPENSE", amount: 40.5 },
        { kind: "DIRECT_EXPENSE", amount: 9.5 },
        { kind: "ADHOC_EXPENSE", amount: 7 },
      ]),
    ).toEqual({ otherIncome: 100, directExpenses: 50, adhocExpenses: 7 });
  });
});

describe("amounts", () => {
  it("reads typed rupee amounts", () => {
    expect(parseAmount("₹80,000")).toBe(80000);
    expect(parseAmount("1500.50")).toBe(1500.5);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("12abc")).toBeNaN();
    expect(parseAmount("-5")).toBeNaN();
  });
  it("formats with Indian grouping", () => {
    expect(formatINR(290000)).toBe("₹2,90,000");
  });
});
