"use client";

import { useId, useMemo, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { useBook } from "@/components/BookProvider";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionList } from "@/components/TransactionList";
import { useToast } from "@/components/ToastProvider";
import { formatDayHeading, formatMoney } from "@/lib/format";
import { expenseDisplayAmount } from "@/lib/reimbursement";
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
  const { book } = useBook();
  const currency = book?.currency;
  const [addOpen, setAddOpen] = useState(false);
  const { show } = useToast();

  const totals = useMemo(() => {
    let expense = 0;
    let income = 0;
    let held = 0;
    for (const tx of transactions) {
      if (tx.type === "expense") expense += expenseDisplayAmount(tx);
      else if (tx.type === "income") income += tx.amount;
      else if (tx.type === "hold") held += tx.amount;
    }
    return { expense, income, held };
  }, [transactions]);

  if (!date) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">
        點選日期查看當日明細
      </p>
    );
  }

  return (
    <section
      id="day-panel"
      className="space-y-3"
      aria-labelledby={headingId}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-semibold text-[var(--ink)]">
            {formatDayHeading(date)} 明細
          </h2>
          {transactions.length > 0 ? (
            <p className="mt-0.5 text-xs text-[var(--muted)] tabular-nums">
              {totals.expense > 0 ? (
                <span className="text-rose-700">
                  支出 {formatMoney(totals.expense, currency)}
                </span>
              ) : null}
              {totals.expense > 0 && totals.income > 0 ? <span> · </span> : null}
              {totals.income > 0 ? (
                <span className="text-emerald-700">
                  收入 {formatMoney(totals.income, currency)}
                </span>
              ) : null}
              {totals.held > 0 ? (
                <span>
                  {" "}
                  ·{" "}
                  <span className="text-amber-800 dark:text-amber-300">
                    扣住 {formatMoney(totals.held, currency)}
                  </span>
                </span>
              ) : null}
              <span className="ml-1 text-[var(--muted)]">
                （{transactions.length} 筆）
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-[var(--muted)]">這天還沒有紀錄</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-[var(--ink)] px-3 text-xs font-medium text-[var(--paper)] transition active:scale-95"
        >
          <span aria-hidden className="text-sm leading-none">
            +
          </span>
          記一筆
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-8 text-center">
          <p className="text-sm text-[var(--muted)]">這天還沒有紀錄</p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-2.5 inline-flex min-h-9 items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-xs font-medium text-[var(--accent)] hover:border-[var(--accent)]"
          >
            + 立即新增這天的記帳
          </button>
        </div>
      ) : (
        <TransactionList
          transactions={transactions}
          accounts={accounts}
          categories={categories}
          onEdit={onEdit}
          framed
          emptyMessage="這天還沒有紀錄"
        />
      )}

      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={`${formatDayHeading(date)} 記一筆`}
      >
        <TransactionForm
          key={`${addOpen ? "open" : "closed"}-${date}`}
          bare
          defaultDate={date}
          accounts={accounts}
          categories={categories}
          onSaved={() => {
            setAddOpen(false);
            show("已記一筆", { variant: "success" });
          }}
        />
      </BottomSheet>
    </section>
  );
}
