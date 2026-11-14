import { formatMoney, type MoneyCurrency } from "./format";
import type { Budget } from "./types";

export type BudgetSource =
  | "explicit"
  | "derived_from_year"
  | "derived_from_month"
  | "category_sum"
  | "none";

export interface EffectiveBudget {
  amount: number;
  source: BudgetSource;
  isFallback: boolean;
  sourceAmount?: number;
  badgeText?: string;
  noteText?: string;
}

export interface MonthlyAllowanceInfo {
  baseMonthly: number;
  remainingMonths: number;
  remainingBudget: number;
  remainingMonthly: number | null;
  text: string;
}

/**
 * Resolves the effective monthly budget for a category (or overall):
 * 1. Explicit monthly budget (if set)
 * 2. Fallback: derived from annual budget (annual / 12)
 * 3. Fallback for overall: sum of effective category monthly budgets
 */
export function resolveEffectiveMonthBudget(params: {
  categoryId: string | null;
  monthBudgets: Budget[];
  yearBudgets: Budget[];
  categoryBudgetsSum?: number;
  currency?: MoneyCurrency;
}): EffectiveBudget {
  const { categoryId, monthBudgets, yearBudgets, categoryBudgetsSum, currency } = params;

  // 1. Explicit monthly budget
  const explicit = monthBudgets.find(
    (b) => b.category_id === categoryId && b.amount > 0,
  );
  if (explicit) {
    return {
      amount: explicit.amount,
      source: "explicit",
      isFallback: false,
      noteText: `折合整年約 ${formatMoney(explicit.amount * 12, currency)}`,
    };
  }

  // 2. Fallback from annual budget
  const annual = yearBudgets.find(
    (b) => b.category_id === categoryId && b.amount > 0,
  );
  if (annual) {
    const derived = Math.round(annual.amount / 12);
    return {
      amount: derived,
      source: "derived_from_year",
      isFallback: true,
      sourceAmount: annual.amount,
      badgeText: "年折算",
      noteText: `由年預算 ${formatMoney(annual.amount, currency)} 折算（平均 $${formatMoney(derived, currency)}/月）`,
    };
  }

  // 3. Fallback for overall: category sum
  if (categoryId === null && categoryBudgetsSum && categoryBudgetsSum > 0) {
    return {
      amount: categoryBudgetsSum,
      source: "category_sum",
      isFallback: true,
      badgeText: "分類加總",
      noteText: `由各分類月預算加總`,
    };
  }

  return {
    amount: 0,
    source: "none",
    isFallback: false,
  };
}

/**
 * Resolves the effective annual budget for a category (or overall):
 * 1. Explicit annual budget (month = 0)
 * 2. Fallback: annualized from monthly budget(s) in that year
 * 3. Fallback for overall: sum of effective category annual budgets
 */
export function resolveEffectiveYearBudget(params: {
  categoryId: string | null;
  yearBudgets: Budget[];
  allMonthBudgets: Budget[];
  categoryBudgetsSum?: number;
  currency?: MoneyCurrency;
}): EffectiveBudget {
  const { categoryId, yearBudgets, allMonthBudgets, categoryBudgetsSum, currency } = params;

  // 1. Explicit annual budget
  const explicit = yearBudgets.find(
    (b) => b.category_id === categoryId && b.amount > 0,
  );
  if (explicit) {
    return {
      amount: explicit.amount,
      source: "explicit",
      isFallback: false,
    };
  }

  // 2. For overall budget (categoryId === null): category sum takes precedence over annualized monthly total
  if (categoryId === null && categoryBudgetsSum && categoryBudgetsSum > 0) {
    return {
      amount: categoryBudgetsSum,
      source: "category_sum",
      isFallback: true,
      badgeText: "分類加總",
      noteText: `由各分類年預算加總`,
    };
  }

  // 3. Fallback from monthly budgets in this year
  const catMonthBudgets = allMonthBudgets.filter(
    (b) => b.category_id === categoryId && b.amount > 0,
  );
  if (catMonthBudgets.length > 0) {
    const sum = catMonthBudgets.reduce((total, b) => total + b.amount, 0);
    const avg = sum / catMonthBudgets.length;
    const derived =
      catMonthBudgets.length === 12 ? sum : Math.round(avg * 12);
    const avgMonthly = Math.round(derived / 12);
    return {
      amount: derived,
      source: "derived_from_month",
      isFallback: true,
      sourceAmount: avgMonthly,
      badgeText: "月推算",
      noteText: `由月預算推算（平均 ${formatMoney(avgMonthly, currency)}/月 × 12）`,
    };
  }

  return {
    amount: 0,
    source: "none",
    isFallback: false,
  };
}

/**
 * Calculates monthly allowance and remaining monthly pace for annual budget.
 */
export function calculateMonthlyAllowance(params: {
  annualBudgetAmount: number;
  spentSoFar: number;
  year: number;
  currentYear: number;
  currentMonth: number;
  currency?: MoneyCurrency;
}): MonthlyAllowanceInfo | null {
  const { annualBudgetAmount, spentSoFar, year, currentYear, currentMonth, currency } = params;

  if (annualBudgetAmount <= 0) return null;

  const baseMonthly = Math.round(annualBudgetAmount / 12);
  const remainingBudget = annualBudgetAmount - spentSoFar;

  if (year !== currentYear) {
    return {
      baseMonthly,
      remainingMonths: 0,
      remainingBudget,
      remainingMonthly: null,
      text: `折合每月約 ${formatMoney(baseMonthly, currency)}`,
    };
  }

  const remainingMonths = Math.max(1, 12 - currentMonth + 1);

  if (remainingBudget > 0) {
    const remainingMonthly = Math.round(remainingBudget / remainingMonths);
    const monthLabel =
      remainingMonths === 1 ? "本月可花" : `今年剩 ${remainingMonths} 個月，平均可花`;
    return {
      baseMonthly,
      remainingMonths,
      remainingBudget,
      remainingMonthly,
      text: `折合每月約 ${formatMoney(baseMonthly, currency)} · ${monthLabel} ${formatMoney(remainingMonthly, currency)}/月`,
    };
  }

  return {
    baseMonthly,
    remainingMonths,
    remainingBudget,
    remainingMonthly: 0,
    text: `折合每月約 ${formatMoney(baseMonthly, currency)} · 年度已超支，無剩餘月配額`,
  };
}
