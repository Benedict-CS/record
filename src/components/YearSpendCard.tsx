"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useBook } from "@/components/BookProvider";
import { monthSummary } from "@/lib/db/crud";
import { formatMoney } from "@/lib/format";
import { useYearTransactions } from "@/lib/hooks/useLedgerData";

/** Compact year spending snapshot above the month block. */
export function YearSpendCard({ year }: { year: number }) {
  const { book } = useBook();
  const currency = book?.currency;
  const transactions = useYearTransactions(year);
  const summary = useMemo(
    () => monthSummary(transactions),
    [transactions],
  );

  return (
    <Link
      href="/reports"
      className="block rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 active:bg-[rgba(28,43,36,0.04)] sm:px-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-[var(--muted)]">{year} 年花費</p>
          <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-[var(--ink)]">
            {formatMoney(summary.outflow, currency)}
          </p>
        </div>
        <span className="shrink-0 pt-0.5 text-xs text-[var(--accent)]">
          報表 ›
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
        <p className="min-w-0 text-[var(--muted)]">
          實際花掉{" "}
          <span className="font-medium tabular-nums text-rose-700">
            {formatMoney(summary.selfPay, currency)}
          </span>
        </p>
        <p className="min-w-0 text-[var(--muted)]">
          被扣住{" "}
          <span className="font-medium tabular-nums text-amber-800">
            {formatMoney(summary.held, currency)}
          </span>
        </p>
      </div>
    </Link>
  );
}
