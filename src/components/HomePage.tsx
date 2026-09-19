"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { MonthSummary } from "@/components/MonthSummary";
import { NetWorthCard } from "@/components/NetWorthCard";
import { QuickAddFab } from "@/components/QuickAddFab";
import { QuickTemplateBar } from "@/components/QuickTemplateBar";
import { TransactionEditor } from "@/components/TransactionEditor";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionList } from "@/components/TransactionList";
import { useToast } from "@/components/ToastProvider";
import { createTemplateFromTransaction } from "@/lib/db/crud";
import { formatMoney } from "@/lib/format";
import {
  useAccounts,
  useCategories,
  useMonthTransactions,
  useSeedReady,
} from "@/lib/hooks/useLedgerData";
import { runSync } from "@/lib/sync/engine";
import type { BookCurrency, Transaction } from "@/lib/types";

const TYPE_LABEL: Record<Transaction["type"], string> = {
  income: "收入",
  expense: "支出",
  transfer: "轉帳",
};

/** Bottom sheet that names a template built from an existing transaction. */
function SaveTemplateSheet({
  transaction,
  defaultName,
  currency,
  onClose,
  onSaved,
}: {
  transaction: Transaction;
  defaultName: string;
  currency?: BookCurrency;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("請輸入範本名稱");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createTemplateFromTransaction(transaction.id, trimmed);
      void runSync();
      onSaved(trimmed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="關閉"
        className="absolute inset-0 bg-[var(--ink)]/40"
        onClick={onClose}
      />
      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-lg rounded-t-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-lg sm:mx-4 sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--ink)]">存為範本</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-2 text-sm text-[var(--muted)]"
          >
            關閉
          </button>
        </div>
        <p className="mb-3 text-xs text-[var(--muted)]">
          金額 {formatMoney(transaction.amount, currency)}
        </p>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">名稱</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            autoFocus
          />
        </label>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-4">
          <button
            type="submit"
            disabled={saving}
            className="min-h-12 w-full rounded-xl bg-[var(--ink)] px-4 text-sm font-medium text-[var(--paper)] disabled:opacity-60"
          >
            {saving ? "儲存中…" : "存為範本"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function HomePage() {
  const ready = useSeedReady();
  const { book } = useBook();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [templateSource, setTemplateSource] = useState<Transaction | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">(
    "all",
  );
  const { show } = useToast();

  const accounts = useAccounts();
  const categories = useCategories();
  const transactions = useMonthTransactions(year, month);

  const visibleTransactions = useMemo(
    () =>
      typeFilter === "all"
        ? transactions
        : transactions.filter((tx) => tx.type === typeFilter),
    [transactions, typeFilter],
  );

  function shiftMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
  }

  function defaultTemplateName(transaction: Transaction) {
    const category = categories.find(
      (item) => item.id === transaction.category_id,
    );
    return (
      category?.name || transaction.note.trim() || TYPE_LABEL[transaction.type]
    );
  }

  return (
    <AppShell title="本月記帳">
      {!ready ? (
        <p className="text-sm text-[var(--muted)]">載入本機資料…</p>
      ) : (
        <div className="space-y-3 pb-16">
          <MonthSummary
            year={year}
            month={month}
            transactions={transactions}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
          />
          <NetWorthCard />
          <QuickTemplateBar />
          <div id="quick-add" className="scroll-mt-4">
            <TransactionForm accounts={accounts} categories={categories} />
          </div>
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-[var(--ink)]">本月明細</h2>
              <span className="text-xs tabular-nums text-[var(--muted)]">
                {visibleTransactions.length} 筆
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ["all", "全部"],
                  ["expense", "支出"],
                  ["income", "收入"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={typeFilter === id}
                  onClick={() => setTypeFilter(id)}
                  className={[
                    "min-h-10 rounded-xl text-xs font-medium",
                    typeFilter === id
                      ? "bg-[var(--ink)] text-[var(--paper)]"
                      : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)]",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
            <TransactionList
              transactions={visibleTransactions}
              accounts={accounts}
              categories={categories}
              onEdit={setEditing}
              onSaveTemplate={setTemplateSource}
              groupByDay
              emptyMessage={
                typeFilter === "all"
                  ? "這個月還沒有紀錄，記一筆開始。"
                  : "這個篩選目前沒有紀錄"
              }
            />
          </section>
        </div>
      )}
      {editing ? (
        <TransactionEditor
          transaction={editing}
          accounts={accounts}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {templateSource ? (
        <SaveTemplateSheet
          transaction={templateSource}
          defaultName={defaultTemplateName(templateSource)}
          currency={book?.currency}
          onClose={() => setTemplateSource(null)}
          onSaved={(name) => {
            setTemplateSource(null);
            show(`已存為範本「${name}」`, { variant: "success" });
          }}
        />
      ) : null}
      <QuickAddFab />
    </AppShell>
  );
}
