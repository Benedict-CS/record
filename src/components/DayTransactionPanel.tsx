"use client";

import { useId, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionList } from "@/components/TransactionList";
import { useToast } from "@/components/ToastProvider";
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
  const [addOpen, setAddOpen] = useState(false);
  const { show } = useToast();

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
      className="space-y-2"
      aria-labelledby={headingId}
      aria-live="polite"
    >
      <div className="flex items-center justify-end">
        <h2 id={headingId} className="sr-only">
          當日明細
        </h2>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-[var(--ink)] px-3.5 text-sm font-medium text-[var(--paper)]"
        >
          <span aria-hidden className="text-base leading-none">
            +
          </span>
          記一筆
        </button>
      </div>

      {transactions.length === 0 ? null : (
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
        title="記一筆"
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
