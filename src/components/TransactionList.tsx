"use client";

import { CategoryIcon } from "@/components/CategoryIcon";
import { useBook } from "@/components/BookProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import {
  duplicateTransaction,
  releaseHold,
  restoreTransaction,
  softDeleteTransaction,
} from "@/lib/db/crud";
import { compareSameDayTransactions } from "@/lib/day-order";
import { formatMoney, todayLocal } from "@/lib/format";
import { runSync } from "@/lib/sync/engine";
import type { Account, Category, Transaction } from "@/lib/types";

const TYPE_LABEL: Record<Transaction["type"], string> = {
  income: "收入",
  expense: "支出",
  transfer: "轉帳",
  hold: "扣住",
};

function weekdayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  const names = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = new Date(year, month - 1, day).getDay();
  return `${month}/${day} 週${names[weekday]}`;
}

function IconEdit({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconCopyToday({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V6a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

const actionBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors active:bg-[var(--paper)]";

export function TransactionList({
  transactions,
  accounts,
  categories,
  onEdit,
  emptyMessage = "這個月還沒有紀錄，離線也能先記一筆。",
  groupByDay = false,
  /** One shared card with dividers (use for a single-day panel). */
  framed = false,
}: {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onEdit?: (transaction: Transaction) => void;
  emptyMessage?: string;
  groupByDay?: boolean;
  framed?: boolean;
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
  const categoryNameOf = (categoryId: string | null) =>
    categoryId ? categoryMap[categoryId]?.name : null;

  async function onDuplicate(tx: Transaction) {
    const copy = await duplicateTransaction(tx.id, todayLocal());
    if (!copy) return;
    void runSync();
    show("已複製到今天", { variant: "success" });
  }

  async function onRelease(tx: Transaction) {
    const ok = await confirm({
      title: "標記已退回？",
      message: "會在今天記入一筆同額收入，帳戶餘額加回，且不再算「暫時扣住」。",
      confirmLabel: "已退回",
    });
    if (!ok) return;
    const income = await releaseHold(tx.id, todayLocal());
    if (!income) {
      show("無法退回", { variant: "error" });
      return;
    }
    void runSync();
    show("已退回", { variant: "success" });
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
    : [{ date: "", items: [...transactions] }];

  for (const group of groups) {
    group.items.sort((a, b) =>
      compareSameDayTransactions(a, b, categoryNameOf),
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const dayExpense = group.items
          .filter((tx) => tx.type === "expense")
          .reduce((sum, tx) => sum + tx.amount, 0);
        const dayHeld = group.items
          .filter((tx) => tx.type === "hold")
          .reduce((sum, tx) => sum + tx.amount, 0);
        const dayIncome = group.items
          .filter((tx) => tx.type === "income")
          .reduce((sum, tx) => sum + tx.amount, 0);
        const asCard = groupByDay || framed;

        return (
          <section
            key={group.date || "all"}
            className={
              asCard
                ? "overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]"
                : "space-y-2"
            }
          >
            {groupByDay ? (
              <div className="flex items-baseline justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
                <p className="text-xs font-medium text-[var(--ink)]">
                  {weekdayLabel(group.date)}
                  <span className="ml-1.5 font-normal text-[var(--muted)]">
                    {group.items.length} 筆
                  </span>
                </p>
                <p className="text-[11px] tabular-nums text-[var(--muted)]">
                  {dayExpense > 0
                    ? `花 ${formatMoney(dayExpense, currency)}`
                    : null}
                  {dayExpense > 0 && dayHeld > 0 ? " · " : null}
                  {dayHeld > 0
                    ? `扣 ${formatMoney(dayHeld, currency)}`
                    : null}
                  {(dayExpense > 0 || dayHeld > 0) && dayIncome > 0
                    ? " · "
                    : null}
                  {dayIncome > 0
                    ? `收 ${formatMoney(dayIncome, currency)}`
                    : null}
                </p>
              </div>
            ) : null}

            <ul className={asCard ? "divide-y divide-[var(--line)]" : "space-y-2"}>
              {group.items.map((tx) => {
                const isHold = tx.type === "hold";
                const holdReleased =
                  isHold && tx.hold_status === "released";
                const sign =
                  tx.type === "income"
                    ? "+"
                    : tx.type === "expense" || isHold
                      ? "-"
                      : "";
                const color = holdReleased
                  ? "text-[var(--muted)] line-through"
                  : tx.type === "income"
                    ? "text-emerald-700"
                    : tx.type === "expense"
                      ? "text-rose-700"
                      : isHold
                        ? "text-amber-800"
                        : "text-[var(--ink)]";
                const category = tx.category_id
                  ? categoryMap[tx.category_id]
                  : undefined;
                const title =
                  tx.type === "transfer"
                    ? `${accountMap[tx.account_id] ?? "帳戶"} → ${
                        accountMap[tx.transfer_account_id ?? ""] ?? "帳戶"
                      }`
                    : isHold
                      ? `扣住：${tx.note.trim() || "未命名"}`
                      : category?.name ?? TYPE_LABEL[tx.type];

                const note = isHold ? "" : tx.note.trim();
                const accountName = accountMap[tx.account_id] ?? "帳戶";
                const subtitleParts = [
                  !groupByDay && !framed ? tx.date : null,
                  accountName,
                  holdReleased ? "已退回" : isHold ? "暫時扣住" : null,
                  note || null,
                ].filter(Boolean);

                const row = (
                  <div className="flex items-center gap-2 px-3 py-2">
                    {tx.type === "transfer" ? (
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--paper)] text-[10px] font-medium text-[var(--muted)]"
                        aria-hidden
                      >
                        轉
                      </span>
                    ) : isHold ? (
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-100 text-[10px] font-medium text-amber-900"
                        aria-hidden
                      >
                        扣
                      </span>
                    ) : (
                      <CategoryIcon
                        icon={category?.icon ?? "dots"}
                        color={category?.color ?? "#7f8c8d"}
                        size="sm"
                        className="!h-7 !w-7"
                      />
                    )}
                    <button
                      type="button"
                      className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_6.75rem] items-center gap-x-2 gap-y-0.5 text-left"
                      onClick={() => onEdit?.(tx)}
                      disabled={!onEdit}
                    >
                      <span className="min-w-0 truncate text-sm text-[var(--ink)]">
                        {title}
                      </span>
                      <span
                        className={`w-full text-right text-sm font-semibold tabular-nums ${color}`}
                      >
                        {sign}
                        {formatMoney(tx.amount, currency)}
                      </span>
                      {subtitleParts.length > 0 ? (
                        <span className="col-span-2 min-w-0 truncate text-[11px] text-[var(--muted)]">
                          {subtitleParts.join(" · ")}
                        </span>
                      ) : null}
                    </button>
                    <div className="flex shrink-0 items-center">
                      {isHold && !holdReleased ? (
                        <button
                          type="button"
                          className="mr-0.5 rounded-lg px-1.5 py-1 text-[11px] font-medium text-amber-900 active:bg-amber-50"
                          aria-label="已退回"
                          title="已退回"
                          onClick={() => void onRelease(tx)}
                        >
                          退回
                        </button>
                      ) : null}
                      {onEdit ? (
                        <button
                          type="button"
                          className={`${actionBtn} hover:text-[var(--accent)]`}
                          aria-label="編輯"
                          title="編輯"
                          onClick={() => onEdit(tx)}
                        >
                          <IconEdit className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={`${actionBtn} hover:text-[var(--accent)]`}
                        aria-label="複製到今天"
                        title="複製到今天"
                        onClick={() => void onDuplicate(tx)}
                      >
                        <IconCopyToday className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={`${actionBtn} hover:text-rose-600`}
                        aria-label="刪除"
                        title="刪除"
                        onClick={() => void onDelete(tx)}
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );

                return asCard ? (
                  <li key={tx.id}>{row}</li>
                ) : (
                  <li
                    key={tx.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)]"
                  >
                    {row}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
