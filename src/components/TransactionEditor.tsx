"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AmountKeypad } from "@/components/AmountKeypad";
import { useBook } from "@/components/BookProvider";
import { CategoryPickerGrid } from "@/components/CategoryPickerGrid";
import { useToast } from "@/components/ToastProvider";
import { formatCalcNumber } from "@/lib/calculator";
import {
  markReimbursementReceived,
  releaseHold,
  undoReimbursementReceived,
  updateTransaction,
} from "@/lib/db/crud";
import { formatMoney, todayLocal } from "@/lib/format";
import { runSync } from "@/lib/sync/engine";
import type { Account, Category, Transaction, TransactionType } from "@/lib/types";

type FormType = "income" | "expense" | "hold";
type KeypadTarget = "amount" | "reimbursable";

function toFormType(type: TransactionType): FormType {
  if (type === "income") return "income";
  if (type === "hold") return "hold";
  return "expense";
}

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
  const { show } = useToast();
  const [type, setType] = useState<FormType>(toFormType(transaction.type));
  const [amount, setAmount] = useState<number | null>(
    Number.isFinite(transaction.amount) ? transaction.amount : null,
  );
  const [reimbursable, setReimbursable] = useState<number | null>(
    transaction.reimbursable_amount != null &&
      Number.isFinite(transaction.reimbursable_amount) &&
      transaction.reimbursable_amount > 0
      ? transaction.reimbursable_amount
      : null,
  );
  const [date, setDate] = useState(transaction.date);
  const [note, setNote] = useState(transaction.note);
  const [accountId, setAccountId] = useState(transaction.account_id);
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? "");
  const [keypadTarget, setKeypadTarget] = useState<KeypadTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seededFrom, setSeededFrom] = useState(transaction);
  const canRelease =
    transaction.type === "hold" &&
    (transaction.hold_status ?? "held") === "held";
  const isReleasedHold =
    transaction.type === "hold" &&
    transaction.hold_status === "released";
  const canMarkReimbursed =
    transaction.type === "expense" &&
    transaction.reimbursable_amount != null &&
    transaction.reimbursable_amount > 0 &&
    transaction.reimbursement_status === "pending";
  const isReimbursed =
    transaction.type === "expense" &&
    transaction.reimbursement_status === "received";

  if (seededFrom !== transaction) {
    setSeededFrom(transaction);
    setType(toFormType(transaction.type));
    setAmount(Number.isFinite(transaction.amount) ? transaction.amount : null);
    setReimbursable(
      transaction.reimbursable_amount != null &&
        Number.isFinite(transaction.reimbursable_amount) &&
        transaction.reimbursable_amount > 0
        ? transaction.reimbursable_amount
        : null,
    );
    setDate(transaction.date);
    setNote(transaction.note);
    setAccountId(transaction.account_id);
    setCategoryId(transaction.category_id ?? "");
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
    () => categories.filter((category) => category.kind === type),
    [categories, type],
  );

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

  async function onRelease() {
    setError(null);
    setReleasing(true);
    try {
      const income = await releaseHold(transaction.id, todayLocal());
      if (!income) {
        setError("這筆已退回或無法退回");
        return;
      }
      void runSync();
      show("已標記退回，帳戶餘額已還原", { variant: "success" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "退回失敗");
    } finally {
      setReleasing(false);
    }
  }

  async function onMarkReimbursed() {
    setError(null);
    setMarking(true);
    try {
      await markReimbursementReceived(transaction.id);
      void runSync();
      show("已銷帳（不另記收入）", { variant: "success" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "銷帳失敗");
    } finally {
      setMarking(false);
    }
  }

  async function onUndoReimbursed() {
    setError(null);
    setMarking(true);
    try {
      await undoReimbursementReceived(transaction.id);
      void runSync();
      show("已改回待報銷", { variant: "info" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取消失敗");
    } finally {
      setMarking(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (isReleasedHold) {
      setError("已退回的扣住只能查看，無法再改金額或類型");
      return;
    }

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

    setSaving(true);
    try {
      await updateTransaction(transaction.id, {
        type,
        amount,
        date,
        note: note.trim(),
        account_id: effectiveAccountId,
        category_id: effectiveCategoryId ? String(effectiveCategoryId) : null,
        transfer_account_id: null,
        hold_status: type === "hold" ? (transaction.hold_status ?? "held") : null,
        reimbursable_amount:
          type === "expense" && reimbursable != null && reimbursable > 0
            ? reimbursable
            : null,
        reimbursement_status:
          type === "expense" && reimbursable != null && reimbursable > 0
            ? (transaction.reimbursement_status === "received"
                ? "received"
                : "pending")
            : null,
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
  const reimbursableLabel =
    reimbursable === null
      ? "選填"
      : formatMoney(reimbursable, book?.currency);

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
              className="min-h-11 px-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              關閉
            </button>
          </div>

          <div className="space-y-3">
            {isReleasedHold ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900/80">
                這筆扣住已退回。金額與類型已鎖定；帳戶餘額已透過退回紀錄還原。
              </p>
            ) : null}

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
                  disabled={isReleasedHold}
                  onClick={() => {
                    setType(value);
                    setCategoryId("");
                    if (value !== "expense") setReimbursable(null);
                  }}
                  className={[
                    "min-h-11 rounded-xl px-2 py-2 text-sm font-medium disabled:opacity-50",
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

            {type === "hold" && !isReleasedHold ? (
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                錢被扣住、之後會退或結算（押金、電費預繳）。不計入「實際花掉」。
              </p>
            ) : null}

            <div className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">
                {type === "expense" ? "實付金額" : "金額"}
              </span>
              <button
                type="button"
                disabled={isReleasedHold}
                onClick={() => setKeypadTarget("amount")}
                className={[
                  "flex min-h-14 w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-left outline-none focus:border-[var(--accent)] disabled:opacity-60",
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
                    {isReimbursed ? " · 已銷帳" : ""}
                  </p>
                ) : null}
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
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">
                {type === "hold" ? "扣住項目" : "備註"}
              </span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  type === "hold" ? "例：宿舍押金、電費預繳" : "可選"
                }
                className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>

            {type !== "hold" ? (
              <div className="block">
                <span className="mb-1.5 block text-xs text-[var(--muted)]">分類</span>
                {filteredCategories.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[var(--line)] px-3 py-4 text-center text-xs text-[var(--muted)]">
                    還沒有分類。
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

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            {canRelease ? (
              <button
                type="button"
                disabled={releasing}
                onClick={() => void onRelease()}
                className="min-h-12 w-full rounded-xl border border-amber-700/40 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 disabled:opacity-60"
              >
                {releasing ? "處理中…" : "標記退回"}
              </button>
            ) : null}

            {canMarkReimbursed ? (
              <button
                type="button"
                disabled={marking}
                onClick={() => void onMarkReimbursed()}
                className="min-h-12 w-full rounded-xl border border-sky-700/30 bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-950 disabled:opacity-60"
              >
                {marking ? "處理中…" : "銷帳（補助／退稅已收到）"}
              </button>
            ) : null}

            {isReimbursed ? (
              <button
                type="button"
                disabled={marking}
                onClick={() => void onUndoReimbursed()}
                className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-2.5 text-sm font-medium text-[var(--ink)] disabled:opacity-60"
              >
                {marking ? "處理中…" : "取消銷帳（改回待報銷）"}
              </button>
            ) : null}

            {isReleasedHold ? (
              <p className="text-center text-xs text-[var(--muted)]">這筆已退回</p>
            ) : null}

            {isReimbursed ? (
              <p className="text-center text-xs text-[var(--muted)]">
                帳戶仍記實付全額；列表主數字是自付。可按上方取消銷帳。
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saving || isReleasedHold}
              className="min-h-12 w-full rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--paper)] disabled:opacity-60"
            >
              {saving ? "儲存中…" : isReleasedHold ? "僅供查看" : "儲存變更"}
            </button>
          </div>
        </form>
      </div>

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
