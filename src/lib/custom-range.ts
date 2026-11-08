import { dayAfter, LEDGER_START_YEAR } from "@/lib/period-jump";
import {
  expenseDisplayAmount,
  holdRefundIncomeIds,
  isHoldRefundIncome,
} from "@/lib/reimbursement";
import type { Transaction } from "@/lib/types";

export type RangeMode = "month" | "year" | "date";

export type CustomRange = {
  mode: RangeMode;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  dateFrom: string;
  dateTo: string;
};

export type RangeMonthTotal = {
  year: number;
  month: number;
  label: string;
  income: number;
  expense: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function defaultCustomRange(now = new Date()): CustomRange {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const iso = `${y}-${pad2(m)}-${pad2(now.getDate())}`;
  return {
    mode: "month",
    startYear: y,
    startMonth: 1,
    endYear: y,
    endMonth: m,
    dateFrom: `${y}-01-01`,
    dateTo: iso,
  };
}

export function normalizeRange(range: CustomRange): CustomRange {
  if (range.mode === "month") {
    const startVal = range.startYear * 12 + range.startMonth;
    const endVal = range.endYear * 12 + range.endMonth;
    if (startVal > endVal) {
      return {
        ...range,
        startYear: range.endYear,
        startMonth: range.endMonth,
        endYear: range.startYear,
        endMonth: range.startMonth,
      };
    }
  } else if (range.mode === "year") {
    if (range.startYear > range.endYear) {
      return {
        ...range,
        startYear: range.endYear,
        endYear: range.startYear,
      };
    }
  } else if (range.mode === "date") {
    if (range.dateFrom && range.dateTo && range.dateFrom > range.dateTo) {
      return {
        ...range,
        dateFrom: range.dateTo,
        dateTo: range.dateFrom,
      };
    }
  }
  return range;
}

export function getRangeBounds(range: CustomRange): {
  start: string;
  endExclusive: string;
  label: string;
} {
  const norm = normalizeRange(range);

  if (norm.mode === "month") {
    const start = `${norm.startYear}-${pad2(norm.startMonth)}-01`;
    let endExclusive: string;
    if (norm.endMonth === 12) {
      endExclusive = `${norm.endYear + 1}-01-01`;
    } else {
      endExclusive = `${norm.endYear}-${pad2(norm.endMonth + 1)}-01`;
    }
    let label: string;
    if (norm.startYear === norm.endYear) {
      if (norm.startMonth === norm.endMonth) {
        label = `${norm.startYear} 年 ${norm.startMonth} 月`;
      } else {
        label = `${norm.startYear} 年 ${norm.startMonth}–${norm.endMonth} 月`;
      }
    } else {
      label = `${norm.startYear} 年 ${norm.startMonth} 月 – ${norm.endYear} 年 ${norm.endMonth} 月`;
    }
    return { start, endExclusive, label };
  }

  if (norm.mode === "year") {
    const start = `${norm.startYear}-01-01`;
    const endExclusive = `${norm.endYear + 1}-01-01`;
    const label =
      norm.startYear === norm.endYear
        ? `${norm.startYear} 年`
        : `${norm.startYear}–${norm.endYear} 年`;
    return { start, endExclusive, label };
  }

  // mode === "date"
  const start = norm.dateFrom || `${LEDGER_START_YEAR}-01-01`;
  const endExclusive = norm.dateTo ? dayAfter(norm.dateTo) : "2100-01-01";
  const label =
    norm.dateFrom && norm.dateTo
      ? `${norm.dateFrom} – ${norm.dateTo}`
      : norm.dateFrom
        ? `${norm.dateFrom} 至今`
        : `至 ${norm.dateTo}`;
  return { start, endExclusive, label };
}

export function monthlyTotalsForRange(
  transactions: Transaction[],
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
): RangeMonthTotal[] {
  const isMultiYear = startYear !== endYear;
  const list: RangeMonthTotal[] = [];
  let curY = startYear;
  let curM = startMonth;

  while (curY < endYear || (curY === endYear && curM <= endMonth)) {
    const label = isMultiYear ? `${curY}/${curM}月` : `${curM}月`;
    list.push({
      year: curY,
      month: curM,
      label,
      income: 0,
      expense: 0,
    });
    curM += 1;
    if (curM > 12) {
      curM = 1;
      curY += 1;
    }
  }

  const map = new Map<string, RangeMonthTotal>();
  for (const item of list) {
    map.set(`${item.year}-${pad2(item.month)}`, item);
  }

  const refundIds = holdRefundIncomeIds(transactions);
  for (const tx of transactions) {
    const key = tx.date.slice(0, 7);
    const row = map.get(key);
    if (!row) continue;
    if (tx.type === "income" && !isHoldRefundIncome(tx, refundIds)) {
      row.income += tx.amount;
    } else if (tx.type === "expense") {
      row.expense += expenseDisplayAmount(tx);
    }
  }

  return list;
}
