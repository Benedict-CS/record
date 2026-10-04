"use client";

import { useState } from "react";
import { useBook } from "@/components/BookProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import { markReimbursementReceived, releaseHold } from "@/lib/db/crud";
import { formatDayHeading, formatMoney, todayLocal } from "@/lib/format";
import { useCategories, useOpenItems } from "@/lib/hooks/useLedgerData";
import { isReimbursementPending } from "@/lib/reimbursement";
import { runSync } from "@/lib/sync/engine";
import type { Transaction } from "@/lib/types";

const PREVIEW = 6;

/**
 * Open 待核銷 and unreleased 扣住 across every month, with the same
 * 銷帳 and 退回 actions as the day list.
 */
export function PendingList() {
  const { book } = useBook();
  const currency = book?.currency;
  const items = useOpenItems();
  const categories = useCategories();
  const confirm = useConfirm();
  const { show } = useToast();
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, PREVIEW);
  const hidden = items.length - visible.length;
  const categoryName = new Map(categories.map((row) => [row.id, row.name]));

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

  async function onMarkReimbursed(tx: Transaction) {
    const ok = await confirm({
      title: "銷帳待報銷？",
      message:
        "確認補助或退稅已入帳（薪水裡／銀行入帳另記過）。只標記狀態，不另記收入。帳戶仍保留實付全額。",
      confirmLabel: "銷帳",
    });
    if (!ok) return;
    await markReimbursementReceived(tx.id);
    void runSync();
    show("已銷帳", { variant: "success" });
  }

  return (
    <section
      aria-label="待處理"
      className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]"
    >
      <div className="flex items-baseline justify-between gap-2 px-3 py-2.5">
        <h2 className="text-sm font-medium text-[var(--ink)]">待處理</h2>
        <p className="text-xs text-[var(--muted)]">{items.length} 筆還沒銷帳或退回</p>
      </div>
      <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
        {visible.map((tx) => {
          const pending = isReimbursementPending(tx);
          const title = pending
            ? tx.note.trim() ||
              (tx.category_id ? categoryName.get(tx.category_id) : "") ||
              "待核銷"
            : `扣住：${tx.note.trim() || "未命名"}`;
          const amount = pending ? (tx.reimbursable_amount ?? tx.amount) : tx.amount;
          return (
            <li key={tx.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[var(--ink)]">{title}</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  {formatDayHeading(tx.date)}
                  {" · "}
                  {pending ? "待核銷" : "暫時扣住"}
                  {" "}
                  <span className="tabular-nums">
                    {formatMoney(amount, currency)}
                  </span>
                </p>
              </div>
              {pending ? (
                <button
                  type="button"
                  onClick={() => void onMarkReimbursed(tx)}
                  className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-sky-100 px-3 text-xs font-medium text-sky-950"
                >
                  銷帳
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void onRelease(tx)}
                  className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-amber-100 px-3 text-xs font-medium text-amber-950"
                >
                  退回
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {hidden > 0 || (expanded && items.length > PREVIEW) ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="min-h-11 w-full border-t border-[var(--line)] text-xs font-medium text-[var(--accent)]"
        >
          {expanded ? "收合" : `還有 ${hidden} 筆`}
        </button>
      ) : null}
    </section>
  );
}
