import type { PeriodSummary } from "@/lib/types";

/** Money the person actually spent: expenses after received reimbursements. */
export function periodSpend(summary: Pick<PeriodSummary, "selfPay">): number {
  return summary.selfPay;
}

/**
 * Shown balance: income minus spend.
 * `PeriodSummary.net` stays income minus full cash expense so salary is not double-counted.
 */
export function periodBalance(
  summary: Pick<PeriodSummary, "income" | "selfPay">,
): number {
  return summary.income - summary.selfPay;
}

/** Portion of cash expense already removed from spend by 銷帳. */
export function reimbursedAmount(
  summary: Pick<PeriodSummary, "expense" | "selfPay">,
): number {
  return Math.max(0, summary.expense - summary.selfPay);
}
