"use client";

import { useBook } from "@/components/BookProvider";
import { monthSummary } from "@/lib/db/crud";
import { formatMoney } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export function MonthSummary({
  year,
  month,
  transactions,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  transactions: Transaction[];
  onPrev: () => void;
  onNext: () => void;
}) {
  const { book } = useBook();
  const summary = monthSummary(transactions);

  return (
    <section className="rounded-2xl bg-[var(--ink)] px-3 py-3 text-[var(--paper)] sm:px-4 sm:py-4">
      <div className="mb-2.5 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={onPrev}
          className="touch-target inline-flex items-center justify-center rounded-md px-2 text-sm opacity-80 active:opacity-100"
        >
          上月
        </button>
        <p className="text-sm font-medium tracking-wide tabular-nums">
          {year} 年 {month} 月
        </p>
        <button
          type="button"
          onClick={onNext}
          className="touch-target inline-flex items-center justify-center rounded-md px-2 text-sm opacity-80 active:opacity-100"
        >
          下月
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center sm:gap-2">
        <div className="min-w-0">
          <p className="text-[11px] opacity-70">收入</p>
          <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-emerald-300">
            {formatMoney(summary.income, book?.currency)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] opacity-70">支出</p>
          <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-rose-300">
            {formatMoney(summary.expense, book?.currency)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] opacity-70">結餘</p>
          <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">
            {formatMoney(summary.net, book?.currency)}
          </p>
        </div>
      </div>
    </section>
  );
}
