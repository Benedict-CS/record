"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useBook } from "@/components/BookProvider";
import { monthSummary } from "@/lib/db/crud";
import { formatMoney, throughToday } from "@/lib/format";
import { useYearTransactions } from "@/lib/hooks/useLedgerData";
import { periodBalance, periodSpend } from "@/lib/summary-display";

/** Compact year spending snapshot above the month block. */
export function YearSpendCard({ year }: { year: number }) {
  const { book } = useBook();
  const currency = book?.currency;
  const transactions = useYearTransactions(year);
  const counted = useMemo(() => throughToday(transactions), [transactions]);
  const later = transactions.length - counted.length;
  const summary = useMemo(() => monthSummary(counted), [counted]);

  return (
    <Link
      href="/reports"
      className="block rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 active:bg-[rgba(28,43,36,0.04)] sm:px-4"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-[var(--muted)]">{year} 年</p>
        <span className="shrink-0 text-xs text-[var(--accent)]">報表 ›</span>
      </div>
      {later > 0 ? (
        <p className="mb-2 text-[11px] text-[var(--muted)]">
          不含今天之後先入帳的 {later} 筆
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="min-w-0">
          <p className="text-[11px] text-[var(--muted)]">支出</p>
          <p className="truncate text-sm font-semibold tabular-nums text-rose-700">
            {formatMoney(periodSpend(summary), currency)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-[var(--muted)]">收入</p>
          <p className="truncate text-sm font-semibold tabular-nums text-emerald-800">
            {formatMoney(summary.income, currency)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-[var(--muted)]">結餘</p>
          <p className="truncate text-sm font-semibold tabular-nums text-[var(--ink)]">
            {formatMoney(periodBalance(summary), currency)}
          </p>
        </div>
      </div>
    </Link>
  );
}
