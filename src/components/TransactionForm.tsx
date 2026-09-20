"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { AmountKeypad } from "@/components/AmountKeypad";
import { useBook } from "@/components/BookProvider";
import { CategoryPickerGrid } from "@/components/CategoryPickerGrid";
import { createTransaction, updateTransaction } from "@/lib/db/crud";
import { formatCalcNumber } from "@/lib/calculator";
import { formatMoney, todayLocal } from "@/lib/format";
import { runSync } from "@/lib/sync/engine";
import type { Account, Category, Transaction, TransactionType } from "@/lib/types";

type FormType = "income" | "expense" | "hold";
type KeypadTarget = "amount" | "reimbursable";

function toFormType(type: TransactionType | undefined): FormType {
  if (type === "income") return "income";
  if (type === "hold") return "hold";
  return "expense";
}

export function TransactionForm({
  accounts,
  categories,
  initial,
  onSaved,
  bare = false,
  defaultDate,
}: {
  accounts: Account[];
  categories: Category[];
  initial?: Transaction | null;
  onSaved?: () => void;
  /** Drop the outer card chrome when the form lives inside a sheet. */
  bare?: boolean;
  /** Prefill date when creating (e.g. calendar day). */
  defaultDate?: string;
}) {
  const { book, bookId } = useBook();
  const isEdit = Boolean(initial?.id);

  const [type, setType] = useState<FormType>(toFormType(initial?.type));
  const [amount, setAmount] = useState<number | null>(
    initial && Number.isFinite(initial.amount) ? initial.amount : null,
  );
  const [reimbursable, setReimbursable] = useState<number | null>(
    initial?.reimbursable_amount != null &&
      Number.isFinite(initial.reimbursable_amount) &&
      initial.reimbursable_amount > 0
      ? initial.reimbursable_amount
      : null,
  );
  const [date, setDate] = useState(
    initial?.date ?? defaultDate ?? todayLocal(),
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [accountId, setAccountId] = useState(
    initial?.account_id ?? accounts[0]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [keypadTarget, setKeypadTarget] = useState<KeypadTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seededFrom, setSeededFrom] = useState(initial);

  if (seededFrom !== initial) {
    setSeededFrom(initial);
    if (initial) {
      setType(toFormType(initial.type));
      setAmount(Number.isFinite(initial.amount) ? initial.amount : null);
      setReimbursable(
        initial.reimbursable_amount != null &&
          Number.isFinite(initial.reimbursable_amount) &&
          initial.reimbursable_amount > 0
          ? initial.reimbursable_amount
          : null,
      );
      setDate(initial.date);
      setNote(initial.note);
      setAccountId(initial.account_id);
      setCategoryId(initial.category_id ?? "");
    }
  }

  const filteredCategories = useMemo(() => {
    if (type === "hold") {
      return categories.filter((category) => category.kind === "expense");
    }
    return categories.filter((category) => category.kind === type);
  }, [categories, type]);

  const effectiveAccountId = accountId || accounts[0]?.id || "";
  const effectiveCategoryId =
    type === "hold"
      ? categoryId || null
      : categoryId || filteredCategories[0]?.id || "";

  const estimatedSelfPay =
    type === "expense" &&
    amount != null &&
    reimbursable != null &&
    reimbursable > 0
      ? Math.max(0, amount - reimbursable)
      : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (amount === null || !Number.isFinite(amount) || amount < 0) {
      setError("請輸入金額（請客可填 0）");
      return;
    }
    if (type === "hold" && amount <= 0) {
      setError("扣住金額需大於 0");
      return;
    }
    if (!effectiveAccountId) {
      setError("請先建立帳戶");
      return;
    }
    if (type === "hold" && !note.trim()) {
      setError("請寫明扣住項目，例如：宿舍押金");
      return;
    }
    if (type !== "hold" && !effectiveCategoryId) {
      setError("請選擇分類");
      return;
    }
    if (
      type === "expense" &&
      reimbursable != null &&
      reimbursable > 0 &&
      reimbursable > amount
    ) {
      setError("待報銷金額不可大於實付");
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
        note: note.trim(),
        account_id: effectiveAccountId,
        category_id: effectiveCategoryId ? String(effectiveCategoryId) : null,
        transfer_account_id: null,
        hold_status: type === "hold" ? ("held" as const) : null,
        reimbursable_amount:
          type === "expense" && reimbursable != null && reimbursable > 0
            ? reimbursable
            : null,
        reimbursement_status:
          type === "expense" && reimbursable != null && reimbursable > 0
            ? (initial?.reimbursement_status === "received"
                ? ("received" as const)
                : ("pending" as const))
            : null,
      };

      if (isEdit && initial) {
        await updateTransaction(initial.id, payload);
      } else {
        await createTransaction(bookId!, payload);
        setAmount(null);
        setReimbursable(null);
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
  const reimbursableLabel =
    reimbursable === null
      ? "選填"
      : formatMoney(reimbursable, book?.currency);

  return (
    <>
      <form
        onSubmit={onSubmit}
        className={
          bare
            ? "space-y-3"
            : "space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["expense", "支出"],
              ["income", "收入"],
              ["hold", "扣住"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setType(value);
                setCategoryId("");
                if (value !== "expense") setReimbursable(null);
              }}
              className={[
                "min-h-11 rounded-xl px-2 py-2 text-sm font-medium",
                type === value
                  ? value === "expense"
                    ? "bg-rose-600 text-white"
                    : value === "income"
                      ? "bg-emerald-700 text-white"
                      : "bg-amber-700 text-white"
                  : "bg-[var(--paper)] text-[var(--muted)]",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {type === "hold" ? (
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            錢被扣住、之後會退或結算（押金、電費預繳）。不計入「實際花掉」。
          </p>
        ) : null}

        <div className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">
            {type === "expense" ? "實付金額" : "金額"}
            {type === "hold" ? "" : "（請客可填 0）"}
          </span>
          <button
            type="button"
            onClick={() => setKeypadTarget("amount")}
            className={[
              "flex min-h-14 w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-left outline-none focus:border-[var(--accent)]",
              amount === null ? "text-[var(--muted)]" : "text-[var(--ink)]",
            ].join(" ")}
          >
            <span className="text-2xl font-semibold tabular-nums">
              {amountLabel}
            </span>
            <span className="text-xs text-[var(--muted)]">計算機</span>
          </button>
        </div>

        {type === "expense" ? (
          <div className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">
              待報銷（公司補助／退稅，選填）
            </span>
            <button
              type="button"
              onClick={() => setKeypadTarget("reimbursable")}
              className={[
                "flex min-h-12 w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-left outline-none focus:border-[var(--accent)]",
                reimbursable === null
                  ? "text-[var(--muted)]"
                  : "text-[var(--ink)]",
              ].join(" ")}
            >
              <span className="text-lg font-semibold tabular-nums">
                {reimbursableLabel}
              </span>
              <span className="text-xs text-[var(--muted)]">計算機</span>
            </button>
            {estimatedSelfPay != null ? (
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
                實付 {formatMoney(amount!, book?.currency)}｜待報銷{" "}
                {formatMoney(reimbursable!, book?.currency)}｜預估自付{" "}
                {formatMoney(estimatedSelfPay, book?.currency)}
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
                和「扣住」不同：帳戶已全額扣款；補助或退稅入帳後按「銷帳」（不另記收入，避免和薪水／退稅收入重複）。
              </p>
            )}
          </div>
        ) : null}

        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">
            {type === "hold" ? "扣住項目" : "備註"}
          </span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              type === "hold" ? "例：宿舍押金、電費預繳" : "例：便當、請客"
            }
            className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-base outline-none focus:border-[var(--accent)]"
          />
        </label>

        {type !== "hold" ? (
          <div className="block">
            <span className="mb-1.5 block text-xs text-[var(--muted)]">分類</span>
            {filteredCategories.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--line)] px-3 py-4 text-center text-xs text-[var(--muted)]">
                還沒有分類。
                <Link
                  href="/categories"
                  className="ml-1 text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  去新增分類
                </Link>
              </p>
            ) : (
              <CategoryPickerGrid
                categories={filteredCategories}
                value={String(effectiveCategoryId)}
                onChange={setCategoryId}
              />
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">日期</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">帳戶</span>
            {accounts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--line)] px-3 py-3 text-center text-xs text-[var(--muted)]">
                還沒有帳戶。
                <Link
                  href="/accounts"
                  className="ml-1 text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  去新增帳戶
                </Link>
              </p>
            ) : (
              <select
                value={effectiveAccountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={
            saving ||
            accounts.length === 0 ||
            (type !== "hold" && filteredCategories.length === 0)
          }
          className="min-h-12 w-full rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--paper)] disabled:opacity-60"
        >
          {saving
            ? "儲存中…"
            : isEdit
              ? "更新"
              : type === "hold"
                ? "記一筆扣住"
                : "記一筆"}
        </button>
      </form>

      <AmountKeypad
        open={keypadTarget !== null}
        initialExpression={
          keypadTarget === "reimbursable"
            ? reimbursable !== null
              ? formatCalcNumber(reimbursable)
              : ""
            : amount !== null
              ? formatCalcNumber(amount)
              : ""
        }
        onClose={() => setKeypadTarget(null)}
        onConfirm={(value) => {
          if (keypadTarget === "reimbursable") {
            setReimbursable(value > 0 ? value : null);
          } else {
            setAmount(value);
          }
          setKeypadTarget(null);
        }}
      />
    </>
  );
}
