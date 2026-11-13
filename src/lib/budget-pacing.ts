import { formatMoney, todayLocal, type MoneyCurrency } from "./format";

export interface YearTimeProgress {
  timeRatio: number;
  timePct: number;
  daysElapsed: number;
  totalDays: number;
}

export interface BudgetPacing {
  timeRatio: number;
  timePct: number;
  spentPctText: string;
  spentPct: number;
  remaining: number;
  isOver: boolean;
  statusText: string;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Calculates the portion of `year` that has elapsed as of `todayIso` (0 to 1).
 */
export function yearTimeProgress(
  year: number,
  todayIso = todayLocal(),
): YearTimeProgress {
  const currentYear = Number(todayIso.slice(0, 4));
  const totalDays = isLeapYear(year) ? 366 : 365;

  if (year < currentYear) {
    return {
      timeRatio: 1,
      timePct: 100,
      daysElapsed: totalDays,
      totalDays,
    };
  }

  if (year > currentYear) {
    return {
      timeRatio: 0,
      timePct: 0,
      daysElapsed: 0,
      totalDays,
    };
  }

  const startOfYear = new Date(year, 0, 1).getTime();
  const todayTime = new Date(`${todayIso}T12:00:00`).getTime();
  const dayOfYear = Math.floor((todayTime - startOfYear) / 86_400_000) + 1;
  const daysElapsed = Math.min(Math.max(dayOfYear, 1), totalDays);
  const timeRatio = Math.round((daysElapsed / totalDays) * 1000) / 1000;
  const timePct = Math.round(timeRatio * 100);

  return {
    timeRatio,
    timePct,
    daysElapsed,
    totalDays,
  };
}

/**
 * Formats usage percentage intuitively:
 * - 0% if 0 or no budget
 * - < 0.1% if tiny but > 0
 * - 1 decimal place (e.g. 0.5%) if < 10%
 * - rounded integer (e.g. 15%, 87%, 110%) if >= 10%
 */
export function formatPercentUsed(spent: number, budget: number): string {
  if (budget <= 0) return "0%";
  if (spent <= 0) return "0%";
  const pct = (spent / budget) * 100;
  if (pct < 0.1) return "< 0.1%";
  if (pct < 10) {
    const formatted = pct.toFixed(1);
    return formatted.endsWith(".0") ? `${Math.round(pct)}%` : `${formatted}%`;
  }
  return `${Math.round(pct)}%`;
}

/**
 * Simple, intuitive budget pacing:
 * shows spent percentage and actual remaining / over-budget amount.
 */
export function budgetPacing(
  spent: number,
  budget: number,
  timeRatio: number,
  currency: MoneyCurrency = "TWD",
): BudgetPacing {
  const timePct = Math.round(timeRatio * 100);
  const spentPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const spentPctText = formatPercentUsed(spent, budget);
  const remaining = budget - spent;
  const isOver = spent > budget;

  const statusText = isOver
    ? `超支 ${formatMoney(spent - budget, currency)}`
    : `還剩 ${formatMoney(remaining, currency)}`;

  return {
    timeRatio,
    timePct,
    spentPctText,
    spentPct,
    remaining,
    isOver,
    statusText,
  };
}
