"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useBook } from "@/components/BookProvider";
import { monthSummary } from "@/lib/db/crud";
import { formatMoney, throughToday } from "@/lib/format";
import { useYearTransactions } from "@/lib/hooks/useLedgerData";
import { periodBalance, periodSpend } from "@/lib/summary-display";

/** One line of this year's totals, sitting under the month being viewed. */
export function YearSpendCard({ year }: { year: number }) {
  const { book } = useBook();
  const currency = book?.currency;
  const transactions = useYearTransactions(year);
  const counted = useMemo(() => throughToday(transactions), [transactions]);
  const later = transactions.length - counted.length;
  const summary = useMemo(() => monthSummary(counted), [counted]);

  return (
    <div>
      <Link
        href="/reports"
        className="flex min-h-10 items-center gap-2 text-xs"
      >
        <span className="shrink-0 font-medium text-[var(--ink)]">{year} 年</span>
        <span className="min-w-0 flex-1 truncate tabular-nums text-[var(--muted)]">
          <span className="text-rose-700">
            支出 {formatMoney(periodSpend(summary), currency)}
          </span>
          <span aria-hidden> · </span>
          <span className="text-emerald-800">
            收入 {formatMoney(summary.income, currency)}
          </span>
          <span aria-hidden> · </span>
          <span className="text-[var(--ink)]">
            結餘 {formatMoney(periodBalance(summary), currency)}
          </span>
        </span>
        <span className="shrink-0 text-[var(--accent)]">報表 ›</span>
      </Link>
      {later > 0 ? (
        <p className="text-[11px] text-[var(--muted)]">
          不含今天之後先入帳的 {later} 筆
        </p>
      ) : null}
    </div>
  );
}
