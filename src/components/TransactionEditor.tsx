"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AmountKeypad } from "@/components/AmountKeypad";
import { useBook } from "@/components/BookProvider";
import { formatCalcNumber } from "@/lib/calculator";
import { updateTransaction } from "@/lib/db/crud";
import { formatMoney } from "@/lib/format";
import { runSync } from "@/lib/sync/engine";
import type {
  Account,
  Category,
  Transaction,
  TransactionType,
} from "@/lib/types";

/**
 * Bottom-sheet editor for an existing transaction.
 *
 * HomePage integration (mobile-ux / parent agent):
 * 1. `const [editing, setEditing] = useState<Transaction | null>(null)`
 * 2. Pass `onEdit={setEditing}` to `<TransactionList … />`
 * 3. When `editing` is set, render:
 *    `<TransactionEditor
 *       transaction={editing}
 *       accounts={accounts}
 *       categories={categories}
 *       onClose={() => setEditing(null)}
 *     />`
 */
export function TransactionEditor({
  transaction,
  accounts,
  categories,
  onClose,
}: {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
}) {
  const { book } = useBook();
  const [type, setType] = useState<TransactionType>(transaction.type);
  const [amount, setAmount] = useState<number | null>(
    transaction.amount > 0 ? transaction.amount : null,
  );
  const [date, setDate] = useState(transaction.date);
  const [note, setNote] = useState(transaction.note);
  const [accountId, setAccountId] = useState(transaction.account_id);
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? "");
  const [transferAccountId, setTransferAccountId] = useState(
    transaction.transfer_account_id ?? "",
  );
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the fields when a different transaction is passed in. Done during
  // render (React's "adjust state when a prop changes" pattern) rather than
  // from an effect, since the parent owns the prop and cannot be re-keyed here.
  const [seededFrom, setSeededFrom] = useState(transaction);

  if (seededFrom !== transaction) {
    setSeededFrom(transaction);
    setType(transaction.type);
    setAmount(transaction.amount > 0 ? transaction.amount : null);
    setDate(transaction.date);
    setNote(transaction.note);
    setAccountId(transaction.account_id);
    setCategoryId(transaction.category_id ?? "");
    setTransferAccountId(transaction.transfer_account_id ?? "");
    setError(null);
  }

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const filteredCategories = useMemo(
    () =>
      categories.filter((category) =>
        type === "transfer" ? false : category.kind === type,
      ),
    [categories, type],
  );

  const effectiveAccountId = accountId || accounts[0]?.id || "";
  const effectiveCategoryId =
    categoryId ||
    filteredCategories[0]?.id ||
    (type === "transfer" ? null : "");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      setError("請輸入有效金額");
      return;
    }
    if (!effectiveAccountId) {
      setError("請先建立帳戶");
      return;
    }
    if (type !== "transfer" && !effectiveCategoryId) {
      setError("請選擇分類");
      return;
    }
    if (type === "transfer" && !transferAccountId) {
      setError("請選擇轉入帳戶");
      return;
    }

    setSaving(true);
    try {
      await updateTransaction(transaction.id, {
        type,
        amount,
        date,
        note,
        account_id: effectiveAccountId,
        category_id: type === "transfer" ? null : String(effectiveCategoryId),
        transfer_account_id: type === "transfer" ? transferAccountId : null,
      });
      void runSync();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  const amountLabel =
    amount === null
      ? "點擊輸入金額"
      : formatMoney(amount, book?.currency);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
        <button
          type="button"
          aria-label="關閉"
          className="absolute inset-0 bg-[var(--ink)]/40"
          onClick={onClose}
        />
        <form
          onSubmit={onSubmit}
          className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-lg sm:mx-4 sm:rounded-2xl"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--ink)]">編輯交易</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              關閉
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["expense", "支出"],
                  ["income", "收入"],
                  ["transfer", "轉帳"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setType(value);
                    setCategoryId("");
                  }}
                  className={[
                    "rounded-md px-2 py-2 text-sm",
                    type === value
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--paper)] text-[var(--muted)]",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">金額</span>
              <button
                type="button"
                onClick={() => setKeypadOpen(true)}
                className={[
                  "flex min-h-14 w-full items-center justify-between rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-left outline-none focus:border-[var(--accent)]",
                  amount === null ? "text-[var(--muted)]" : "text-[var(--ink)]",
                ].join(" ")}
              >
                <span className="text-2xl font-semibold tabular-nums">
                  {amountLabel}
                </span>
                <span className="text-xs text-[var(--muted)]">計算機</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--muted)]">日期</span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--muted)]">
                  {type === "transfer" ? "轉出帳戶" : "帳戶"}
                </span>
                <select
                  value={effectiveAccountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {type === "transfer" ? (
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--muted)]">
                  轉入帳戶
                </span>
                <select
                  value={transferAccountId}
                  onChange={(event) => setTransferAccountId(event.target.value)}
                  className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  <option value="">選擇帳戶</option>
                  {accounts
                    .filter((account) => account.id !== effectiveAccountId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--muted)]">分類</span>
                <select
                  value={effectiveCategoryId ?? ""}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  {filteredCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">備註</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="可選"
                className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--paper)] disabled:opacity-60"
            >
              {saving ? "儲存中…" : "儲存變更"}
            </button>
          </div>
        </form>
      </div>

      <AmountKeypad
        open={keypadOpen}
        initialExpression={amount !== null ? formatCalcNumber(amount) : ""}
        onClose={() => setKeypadOpen(false)}
        onConfirm={(value) => {
          setAmount(value);
          setKeypadOpen(false);
        }}
      />
    </>
  );
}
