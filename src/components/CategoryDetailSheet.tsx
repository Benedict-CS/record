"use client";

import { useEffect, useId, useMemo } from "react";
import { formatMoney, type MoneyCurrency } from "@/lib/format";
import type { Transaction } from "@/lib/types";

type Props = {
  categoryId: string | null;
  categoryName: string;
  color: string;
  /** Transactions for the selected period; rows are filtered locally. */
  transactions: Transaction[];
  currency?: MoneyCurrency;
  /** Optional period caption, e.g. "2026 年 9 月". */
  periodLabel?: string;
  onClose: () => void;
};

export function CategoryDetailSheet({
  categoryId,
  categoryName,
  color,
  transactions,
  currency,
  periodLabel,
  onClose,
}: Props) {
  const titleId = useId();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const rows = useMemo(() => {
    return transactions
      .filter(
        (tx) => tx.type !== "transfer" && (tx.category_id ?? null) === categoryId,
      )
      .sort((a, b) => {
        if (a.date === b.date) {
          return b.updated_at.localeCompare(a.updated_at);
        }
        return b.date.localeCompare(a.date);
      });
  }, [transactions, categoryId]);

  const total = rows.reduce((sum, tx) => sum + tx.amount, 0);
  const average = rows.length > 0 ? total / rows.length : 0;
  const isIncome = rows[0]?.type === "income";
  const amountColor = isIncome ? "text-emerald-700" : "text-rose-700";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="關閉"
        className="absolute inset-0 bg-[var(--ink)]/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <div className="min-w-0">
              <h2
                id={titleId}
                className="truncate text-lg font-semibold text-[var(--ink)]"
              >
                {categoryName}
              </h2>
              {periodLabel ? (
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {periodLabel}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 shrink-0 rounded-full text-sm text-[var(--muted)] hover:bg-[var(--paper)]"
          >
            關閉
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b border-[var(--line)] px-4 py-3 text-center">
          <div>
            <p className="text-[11px] text-[var(--muted)]">合計</p>
            <p
              className={`mt-1 text-sm font-semibold tabular-nums ${amountColor}`}
            >
              {formatMoney(total, currency)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--muted)]">筆數</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--ink)]">
              {rows.length}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--muted)]">平均</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--ink)]">
              {formatMoney(average, currency)}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              此期間沒有這個分類的紀錄
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium tabular-nums text-[var(--ink)]">
                      {tx.date}
                    </p>
                    {tx.note ? (
                      <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                        {tx.note}
                      </p>
                    ) : null}
                  </div>
                  <p
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      tx.type === "income"
                        ? "text-emerald-700"
                        : "text-rose-700"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatMoney(tx.amount, currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
