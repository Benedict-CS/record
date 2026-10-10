"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { ReminderNudge } from "@/components/ReminderNudge";
import { monthSummary } from "@/lib/db/crud";
import { formatDayHeading, formatMoney, todayLocal } from "@/lib/format";
import {
  useCategories,
  useCategoriesMap,
  useDateTransactions,
  useSeedReady,
} from "@/lib/hooks/useLedgerData";
import { periodBalance, periodSpend } from "@/lib/summary-display";
import type { Transaction } from "@/lib/types";

function rowLabel(
  tx: Transaction,
  categoryName: string | undefined,
): string {
  const note = tx.note.trim();
  if (note) return note;
  if (categoryName) return categoryName;
  if (tx.type === "hold") return "扣住";
  if (tx.type === "income") return "收入";
  if (tx.type === "invest") return "定期定額";
  return "支出";
}

export function TodayPage() {
  const ready = useSeedReady();
  const { book } = useBook();
  const currency = book?.currency;
  const today = todayLocal();
  const transactions = useDateTransactions(today);
  const categories = useCategories();
  const categoryMap = useCategoriesMap(categories);
  const summary = useMemo(() => monthSummary(transactions), [transactions]);

  return (
    <AppShell title="今天">
      {!ready ? (
        <p className="text-sm text-[var(--muted)]">載入本機資料…</p>
      ) : (
        <div className="space-y-3">
          <ReminderNudge />

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <h2 className="text-sm font-medium text-[var(--ink)]">
              {formatDayHeading(today)}
            </h2>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <div className="min-w-0 rounded-xl bg-[var(--paper)] px-2 py-2">
                <p className="text-[11px] text-[var(--muted)]">支出</p>
                <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-rose-700">
                  {formatMoney(periodSpend(summary), currency)}
                </p>
              </div>
              <div className="min-w-0 rounded-xl bg-[var(--paper)] px-2 py-2">
                <p className="text-[11px] text-[var(--muted)]">收入</p>
                <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-emerald-800">
                  {formatMoney(summary.income, currency)}
                </p>
              </div>
              <div className="min-w-0 rounded-xl bg-[var(--paper)] px-2 py-2">
                <p className="text-[11px] text-[var(--muted)]">結餘</p>
                <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-[var(--ink)]">
                  {formatMoney(periodBalance(summary), currency)}
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/#quick-add"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--surface)] active:scale-[0.98]"
            >
              記一筆
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--accent)]"
            >
              開首頁
            </Link>
          </div>

          {transactions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
              今天還沒記
            </p>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              {transactions.map((tx, index) => {
                const category = tx.category_id
                  ? categoryMap[tx.category_id]
                  : undefined;
                const income = tx.type === "income";
                const hold = tx.type === "hold";
                return (
                  <li
                    key={tx.id}
                    className={[
                      "flex min-h-11 items-center justify-between gap-3 px-3 py-1.5",
                      index > 0 ? "border-t border-[var(--line)]" : "",
                    ].join(" ")}
                  >
                    <span className="min-w-0 truncate text-sm text-[var(--ink)]">
                      {rowLabel(tx, category?.name)}
                    </span>
                    <span
                      className={[
                        "shrink-0 text-sm font-semibold tabular-nums",
                        income
                          ? "text-emerald-800"
                          : hold
                            ? "text-amber-800"
                            : "text-rose-700",
                      ].join(" ")}
                    >
                      {income ? "" : "−"}
                      {formatMoney(tx.amount, currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-xs text-muted text-[var(--muted)]">
            把這頁加到主畫面就有一個今天小工具。iPhone 沒有真的桌面 widget。
          </p>
        </div>
      )}
    </AppShell>
  );
}
