"use client";

import { CategoryIcon } from "@/components/CategoryIcon";
import { useBook } from "@/components/BookProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import {
  duplicateTransaction,
  restoreTransaction,
  softDeleteTransaction,
} from "@/lib/db/crud";
import { formatMoney, todayLocal } from "@/lib/format";
import { runSync } from "@/lib/sync/engine";
import type { Account, Category, Transaction } from "@/lib/types";

const TYPE_LABEL: Record<Transaction["type"], string> = {
  income: "收入",
  expense: "支出",
  transfer: "轉帳",
};

function weekdayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  const names = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = new Date(year, month - 1, day).getDay();
  return `${month}/${day} 週${names[weekday]}`;
}

export function TransactionList({
  transactions,
  accounts,
  categories,
  onEdit,
  onSaveTemplate,
  emptyMessage = "這個月還沒有紀錄，離線也能先記一筆。",
  groupByDay = false,
}: {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onEdit?: (transaction: Transaction) => void;
  onSaveTemplate?: (transaction: Transaction) => void;
  emptyMessage?: string;
  groupByDay?: boolean;
}) {
  const { book } = useBook();
  const currency = book?.currency;
  const confirm = useConfirm();
  const { show } = useToast();

  const accountMap = Object.fromEntries(
    accounts.map((account) => [account.id, account.name]),
  );
  const categoryMap = Object.fromEntries(
    categories.map((category) => [category.id, category]),
  );

  async function onDuplicate(tx: Transaction) {
    const copy = await duplicateTransaction(tx.id, todayLocal());
    if (!copy) return;
    void runSync();
    show("已複製到今天", { variant: "success" });
  }

  async function onDelete(tx: Transaction) {
    const ok = await confirm({
      title: "刪除這筆紀錄？",
      message: "刪除後可立刻按「復原」。之後仍可從雲端同步回來。",
      confirmLabel: "刪除",
      destructive: true,
    });
    if (!ok) return;
    await softDeleteTransaction(tx.id);
    void runSync();
    show("已刪除", {
      variant: "info",
      duration: 5000,
      action: {
        label: "復原",
        onClick: () => {
          void restoreTransaction(tx.id).then(() => runSync());
        },
      },
    });
  }

  if (transactions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
        {emptyMessage}
      </p>
    );
  }

  const groups = groupByDay
    ? transactions.reduce<Array<{ date: string; items: Transaction[] }>>(
        (acc, tx) => {
          const last = acc[acc.length - 1];
          if (last && last.date === tx.date) {
            last.items.push(tx);
          } else {
            acc.push({ date: tx.date, items: [tx] });
          }
          return acc;
        },
        [],
      )
    : [{ date: "", items: transactions }];

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.date || "all"} className="space-y-2">
          {groupByDay ? (
            <p className="px-1 text-xs font-medium text-[var(--muted)]">
              {weekdayLabel(group.date)}
              <span className="ml-1 tabular-nums">
                · {group.items.length} 筆
              </span>
            </p>
          ) : null}
          <ul className="space-y-2">
            {group.items.map((tx) => {
              const sign =
                tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "";
              const color =
                tx.type === "income"
                  ? "text-emerald-700"
                  : tx.type === "expense"
                    ? "text-rose-700"
                    : "text-[var(--ink)]";
              const category = tx.category_id
                ? categoryMap[tx.category_id]
                : undefined;
              const title =
                tx.type === "transfer"
                  ? `${accountMap[tx.account_id] ?? "帳戶"} → ${
                      accountMap[tx.transfer_account_id ?? ""] ?? "帳戶"
                    }`
                  : category?.name ?? TYPE_LABEL[tx.type];

              return (
                <li
                  key={tx.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    {tx.type === "transfer" ? (
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--paper)] text-xs font-medium text-[var(--muted)]"
                        aria-hidden
                      >
                        轉
                      </span>
                    ) : (
                      <CategoryIcon
                        icon={category?.icon ?? "dots"}
                        color={category?.color ?? "#7f8c8d"}
                        size="sm"
                      />
                    )}
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onEdit?.(tx)}
                      disabled={!onEdit}
                    >
                      <p className="truncate text-sm font-medium text-[var(--ink)]">
                        {title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                        {groupByDay ? "" : `${tx.date} · `}
                        {accountMap[tx.account_id] ?? "帳戶"}
                        {tx.note ? ` · ${tx.note}` : ""}
                      </p>
                    </button>
                    <p
                      className={`shrink-0 text-sm font-semibold tabular-nums ${color}`}
                    >
                      {sign}
                      {formatMoney(tx.amount, currency)}
                    </p>
                  </div>
                  <div className="mt-1 flex justify-end gap-1">
                    {onEdit ? (
                      <button
                        type="button"
                        className="min-h-10 px-2 text-xs text-[var(--muted)] hover:text-[var(--accent)]"
                        onClick={() => onEdit(tx)}
                      >
                        編輯
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="min-h-10 px-2 text-xs text-[var(--muted)] hover:text-[var(--accent)]"
                      onClick={() => void onDuplicate(tx)}
                    >
                      複製今日
                    </button>
                    {onSaveTemplate ? (
                      <button
                        type="button"
                        className="min-h-10 px-2 text-xs text-[var(--muted)] hover:text-[var(--accent)]"
                        onClick={() => onSaveTemplate(tx)}
                      >
                        存範本
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="min-h-10 px-2 text-xs text-[var(--muted)] hover:text-rose-600"
                      onClick={() => void onDelete(tx)}
                    >
                      刪除
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}