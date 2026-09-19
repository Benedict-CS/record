"use client";

import { useId } from "react";
import { TransactionList } from "@/components/TransactionList";
import type { Account, Category, Transaction } from "@/lib/types";

export function DayTransactionPanel({
  date,
  transactions,
  accounts,
  categories,
  onEdit,
}: {
  date: string | null;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onEdit?: (transaction: Transaction) => void;
}) {
  const headingId = useId();

  if (!date) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
        點選日期查看當日明細
      </p>
    );
  }

  const label = formatDateLabel(date);

  return (
    <section
      className="space-y-2"
      aria-labelledby={headingId}
      aria-live="polite"
    >
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 id={headingId} className="text-sm font-medium text-[var(--ink)]">
          {label} 明細
        </h2>
        <span className="text-xs text-[var(--muted)] tabular-nums">
          {transactions.length} 筆
        </span>
      </div>
      {transactions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          這天還沒有紀錄
        </p>
      ) : (
        <TransactionList
          transactions={transactions}
          accounts={accounts}
          categories={categories}
          onEdit={onEdit}
          emptyMessage="這天還沒有紀錄"
        />
      )}
    </section>
  );
}

function formatDateLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return `${y} 年 ${m} 月 ${d} 日`;
}
