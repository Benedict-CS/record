"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AmountKeypad } from "@/components/AmountKeypad";
import { useBook } from "@/components/BookProvider";
import { createTransaction, updateTransaction } from "@/lib/db/crud";
import { formatCalcNumber } from "@/lib/calculator";
import { formatMoney, todayLocal } from "@/lib/format";
import { runSync } from "@/lib/sync/engine";
import type { Account, Category, Transaction, TransactionType } from "@/lib/types";

export function TransactionForm({
  accounts,
  categories,
  initial,
  onSaved,
}: {
  accounts: Account[];
  categories: Category[];
  initial?: Transaction | null;
  onSaved?: () => void;
}) {
  const { book, bookId } = useBook();
  const isEdit = Boolean(initial?.id);

  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [amount, setAmount] = useState<number | null>(
    initial?.amount && initial.amount > 0 ? initial.amount : null,
  );
  const [date, setDate] = useState(initial?.date ?? todayLocal);
  const [note, setNote] = useState(initial?.note ?? "");
  const [accountId, setAccountId] = useState(
    initial?.account_id ?? accounts[0]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [transferAccountId, setTransferAccountId] = useState(
    initial?.transfer_account_id ?? "",
  );
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the fields when the caller hands us a different transaction. This is
  // done during render (React's "adjust state when a prop changes" pattern)
  // instead of from an effect so no cascading render is scheduled.
  const [seededFrom, setSeededFrom] = useState(initial);

  if (seededFrom !== initial) {
    setSeededFrom(initial);
    if (initial) {
      setType(initial.type);
      setAmount(initial.amount > 0 ? initial.amount : null);
      setDate(initial.date);
      setNote(initial.note);
      setAccountId(initial.account_id);
      setCategoryId(initial.category_id ?? "");
      setTransferAccountId(initial.transfer_account_id ?? "");
    }
  }

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
    if (isEdit && initial) {
      // ok
    } else if (!bookId) {
      setError("請先選擇帳本");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type,
        amount,
        date,
        note,
        account_id: effectiveAccountId,
        category_id: type === "transfer" ? null : String(effectiveCategoryId),
        transfer_account_id: type === "transfer" ? transferAccountId : null,
      };

      if (isEdit && initial) {
        await updateTransaction(initial.id, payload);
      } else {
        await createTransaction(bookId!, payload);
        setAmount(null);
        setNote("");
      }
      void runSync();
      onSaved?.();
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
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"
      >
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
                "min-h-11 rounded-md px-2 py-2 text-sm",
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

        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">備註</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="例：住宿/4人"
            className="min-h-12 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-base outline-none focus:border-[var(--accent)]"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">日期</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">
              {type === "transfer" ? "轉出帳戶" : "帳戶"}
            </span>
            <select
              value={effectiveAccountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
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
            <span className="mb-1 block text-xs text-[var(--muted)]">轉入帳戶</span>
            <select
              value={transferAccountId}
              onChange={(event) => setTransferAccountId(event.target.value)}
              className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
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
              className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="min-h-12 w-full rounded-md bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--paper)] disabled:opacity-60"
        >
          {saving ? "儲存中…" : isEdit ? "更新" : "記一筆"}
        </button>
      </form>

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
