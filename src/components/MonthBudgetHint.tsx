"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useBook } from "@/components/BookProvider";
import { categoryBreakdown } from "@/lib/db/crud";
import { formatMoney } from "@/lib/format";
import { useBudgets, useCategories } from "@/lib/hooks/useLedgerData";
import type { Transaction } from "@/lib/types";

export function MonthBudgetHint({
  year,
  month,
  transactions,
}: {
  year: number;
  month: number;
  transactions: Transaction[];
}) {
  const { book } = useBook();
  const currency = book?.currency;
  const budgets = useBudgets(year, month);
  const categories = useCategories("expense");

  const items = useMemo(() => {
    const live = budgets.filter((row) => row.amount > 0);
    if (live.length === 0) return [];
    const spent = new Map(
      categoryBreakdown(transactions, categories, "expense").map((row) => [
        row.categoryId,
        row.amount,
      ]),
    );
    const names = new Map(categories.map((row) => [row.id, row.name]));
    const overallSpend = [...spent.values()].reduce((sum, amount) => sum + amount, 0);

    return live
      .map((budget) => {
        const used =
          budget.category_id == null
            ? overallSpend
            : (spent.get(budget.category_id) ?? 0);
        const left = budget.amount - used;
        const ratio = used / budget.amount;
        return {
          id: budget.id,
          name: budget.category_id
            ? (names.get(budget.category_id) ?? "分類")
            : "全部支出",
          used,
          left,
          amount: budget.amount,
          over: left < 0,
          tight: left >= 0 && ratio >= 0.8,
        };
      })
      .sort((a, b) => {
        if (a.over !== b.over) return a.over ? -1 : 1;
        if (a.tight !== b.tight) return a.tight ? -1 : 1;
        return a.left - b.left;
      })
      .slice(0, 3);
  }, [budgets, categories, transactions]);

  if (items.length === 0) return null;

  return (
    <Link
      href="/budgets"
      className="block rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-[var(--ink)]">本月預算</p>
        <p className="text-[11px] text-[var(--accent)]">設定 ›</p>
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-baseline justify-between gap-2 text-[11px] tabular-nums"
          >
            <span className="min-w-0 truncate text-[var(--muted)]">{item.name}</span>
            <span
              className={
                item.over
                  ? "font-medium text-rose-700"
                  : item.tight
                    ? "font-medium text-amber-800"
                    : "text-[var(--ink)]"
              }
            >
              {item.over
                ? `超支 ${formatMoney(-item.left, currency)}`
                : `還剩 ${formatMoney(item.left, currency)}`}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
