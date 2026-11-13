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
  spentPct: number;
  expectedSpend: number;
  diff: number;
  isAhead: boolean;
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
 * Compares current spend against the time-proportional expected budget.
 */
export function budgetPacing(
  spent: number,
  budget: number,
  timeRatio: number,
  currency: MoneyCurrency = "TWD",
  isPastYear = false,
): BudgetPacing {
  const timePct = Math.round(timeRatio * 100);
  const spentPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;

  if (isPastYear) {
    const diff = budget - spent;
    const isAhead = diff >= 0;
    return {
      timeRatio: 1,
      timePct: 100,
      spentPct,
      expectedSpend: budget,
      diff,
      isAhead,
      statusText: isAhead
        ? `全年度未超支（節省 ${formatMoney(diff, currency)}）`
        : `全年度超支 ${formatMoney(Math.abs(diff), currency)}`,
    };
  }

  const expectedSpend = Math.round(budget * timeRatio);
  const diff = expectedSpend - spent;
  const isAhead = diff >= 0;

  let statusText = "";
  if (isAhead) {
    statusText = `進度良好 · 較預期省下 ${formatMoney(diff, currency)}`;
  } else {
    statusText = `支出超前 · 較預期多花 ${formatMoney(Math.abs(diff), currency)}`;
  }

  return {
    timeRatio,
    timePct,
    spentPct,
    expectedSpend,
    diff,
    isAhead,
    statusText,
  };
}
