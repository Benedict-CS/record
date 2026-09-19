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
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 sm:px-4 sm:py-4">
      <div className="mb-2.5 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label="上一個月"
          className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)] active:scale-[0.98]"
        >
          ‹
        </button>
        <p className="text-sm font-semibold tracking-wide tabular-nums text-[var(--ink)]">
          {year} 年 {month} 月
        </p>
        <button
          type="button"
          onClick={onNext}
          aria-label="下一個月"
          className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)] active:scale-[0.98]"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center sm:gap-2">
        <div className="min-w-0 rounded-xl bg-[var(--paper)] px-1.5 py-2">
          <p className="text-[11px] text-[var(--muted)]">收入</p>
          <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-emerald-700">
            {formatMoney(summary.income, book?.currency)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl bg-[var(--paper)] px-1.5 py-2">
          <p className="text-[11px] text-[var(--muted)]">支出</p>
          <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-rose-700">
            {formatMoney(summary.expense, book?.currency)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl bg-[var(--paper)] px-1.5 py-2">
          <p className="text-[11px] text-[var(--muted)]">結餘</p>
          <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-[var(--ink)]">
            {formatMoney(summary.net, book?.currency)}
          </p>
        </div>
      </div>
    </section>
  );
}
