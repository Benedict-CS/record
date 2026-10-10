"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import { markReimbursementReceived, releaseHold } from "@/lib/db/crud";
import { formatDayHeading, formatMoney, todayLocal } from "@/lib/format";
import { useCategories, useOpenItems } from "@/lib/hooks/useLedgerData";
import { groupOpenItems, type OpenGroup } from "@/lib/open-items";
import { runSync } from "@/lib/sync/engine";
import type { Transaction } from "@/lib/types";

function useOpenGroups() {
  const items = useOpenItems();
  const categories = useCategories();
  const names = new Map(categories.map((row) => [row.id, row.name]));
  const groups = groupOpenItems(items, (id) => (id ? names.get(id) : undefined));
  return { items, groups };
}

/** One row on home. The full list, grouped by name, lives on /pending. */
export function PendingHomeLink() {
  const { groups } = useOpenGroups();
  if (groups.length === 0) return null;

  return (
    <Link
      href="/pending"
      className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3"
    >
      <span className="truncate text-sm text-[var(--ink)]">待處理</span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums text-[var(--ink)]">
        {groups.length} 件
        <span className="text-[var(--muted)]" aria-hidden>
          ›
        </span>
      </span>
    </Link>
  );
}

function OpenItemList() {
  const { book } = useBook();
  const currency = book?.currency;
  const { items, groups } = useOpenGroups();
  const confirm = useConfirm();
  const { show } = useToast();
  const [openKey, setOpenKey] = useState<string | null>(null);

  async function releaseAll(rows: Transaction[]) {
    const ok = await confirm({
      title: rows.length > 1 ? `退回這 ${rows.length} 筆？` : "標記已退回？",
      message:
        rows.length > 1
          ? "每一筆都會在今天記入同額收入，帳戶餘額加回，且不再算「暫時扣住」。"
          : "會在今天記入一筆同額收入，帳戶餘額加回，且不再算「暫時扣住」。",
      confirmLabel: "已退回",
    });
    if (!ok) return;
    for (const tx of rows) {
      const income = await releaseHold(tx.id, todayLocal());
      if (!income) {
        show("有一筆無法退回", { variant: "error" });
        return;
      }
    }
    void runSync();
    show(rows.length > 1 ? `已退回 ${rows.length} 筆` : "已退回", {
      variant: "success",
    });
  }

  async function reimburseAll(rows: Transaction[]) {
    const ok = await confirm({
      title: rows.length > 1 ? `銷帳這 ${rows.length} 筆？` : "銷帳待報銷？",
      message:
        "確認補助或退稅已入帳（薪水裡／銀行入帳另記過）。只標記狀態，不另記收入。帳戶仍保留實付全額。",
      confirmLabel: "銷帳",
    });
    if (!ok) return;
    for (const tx of rows) {
      await markReimbursementReceived(tx.id);
    }
    void runSync();
    show(rows.length > 1 ? `已銷帳 ${rows.length} 筆` : "已銷帳", {
      variant: "success",
    });
  }

  if (groups.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
        目前沒有待銷帳或待退回。
      </p>
    );
  }

  return (
    <section aria-label="待處理" className="space-y-2">
      <p className="text-xs text-[var(--muted)]">
        {groups.length} 件
        {items.length === groups.length ? "" : ` · ${items.length} 筆`}
        {" "}
        還沒銷帳或退回
      </p>
      <ul className="space-y-2">
        {groups.map((group) => (
          <GroupCard
            key={group.key}
            group={group}
            currency={currency}
            expanded={openKey === group.key}
            onToggle={() =>
              setOpenKey((current) => (current === group.key ? null : group.key))
            }
            onRelease={() => void releaseAll(group.items)}
            onReimburse={() => void reimburseAll(group.items)}
            onReleaseOne={(tx) => void releaseAll([tx])}
            onReimburseOne={(tx) => void reimburseAll([tx])}
          />
        ))}
      </ul>
    </section>
  );
}

function GroupCard({
  group,
  currency,
  expanded,
  onToggle,
  onRelease,
  onReimburse,
  onReleaseOne,
  onReimburseOne,
}: {
  group: OpenGroup<Transaction>;
  currency: string | undefined;
  expanded: boolean;
  onToggle: () => void;
  onRelease: () => void;
  onReimburse: () => void;
  onReleaseOne: (tx: Transaction) => void;
  onReimburseOne: (tx: Transaction) => void;
}) {
  const many = group.items.length > 1;
  const actionLabel = group.kind === "hold" ? "退回" : "銷帳";
  const months = new Set(group.items.map((tx) => tx.date.slice(0, 7))).size;
  const span = months > 1 ? `${months} 個月` : `${group.items.length} 筆`;
  const detail =
    group.kind === "hold" ? `${span} · 暫時扣住` : `${span} · 待核銷`;

  return (
    <li className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
        >
          <p className="truncate text-sm font-medium text-[var(--ink)]">{group.title}</p>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            {many ? detail : formatDayHeading(group.items[0].date)}
            {" · "}
            <span className="tabular-nums">{formatMoney(group.amount, currency)}</span>
          </p>
        </button>
        {!many ? (
          <Link
            href={`/calendar?date=${group.items[0].date}&tx=${group.items[0].id}`}
            className="inline-flex min-h-10 shrink-0 items-center rounded-xl px-2 text-xs text-[var(--accent)]"
          >
            看
          </Link>
        ) : null}
        <button
          type="button"
          onClick={group.kind === "hold" ? onRelease : onReimburse}
          className={[
            "inline-flex min-h-10 shrink-0 items-center rounded-xl px-3 text-xs font-medium",
            group.kind === "hold"
              ? "bg-amber-100 text-amber-950"
              : "bg-sky-100 text-sky-950",
          ].join(" ")}
        >
          {many ? `全部${actionLabel}` : actionLabel}
        </button>
      </div>
      {expanded && many ? (
        <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {group.items.map((tx) => (
            <li key={tx.id} className="flex items-center gap-2 px-3 py-2">
              <Link
                href={`/calendar?date=${tx.date}&tx=${tx.id}`}
                className="min-w-0 flex-1 text-[11px] text-[var(--muted)] underline-offset-2 hover:underline"
              >
                {formatDayHeading(tx.date)}
                {" · "}
                <span className="tabular-nums">
                  {formatMoney(
                    group.kind === "hold" ? tx.amount : (tx.reimbursable_amount ?? tx.amount),
                    currency,
                  )}
                </span>
              </Link>
              <button
                type="button"
                onClick={() =>
                  group.kind === "hold" ? onReleaseOne(tx) : onReimburseOne(tx)
                }
                className="inline-flex min-h-10 shrink-0 items-center rounded-xl px-3 text-xs font-medium text-[var(--muted)]"
              >
                {actionLabel}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function PendingPage() {
  return (
    <AppShell title="待處理">
      <OpenItemList />
    </AppShell>
  );
}
