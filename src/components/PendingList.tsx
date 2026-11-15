"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import { TransactionEditor } from "@/components/TransactionEditor";
import {
  markReimbursementReceived,
  releaseHold,
  settleSplitShare,
} from "@/lib/db/crud";
import { formatDayHeading, formatMoney, todayLocal } from "@/lib/format";
import { useAccounts, useCategories, useOpenItems } from "@/lib/hooks/useLedgerData";
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
  const accounts = useAccounts();
  const categories = useCategories();
  const confirm = useConfirm();
  const { show } = useToast();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

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

  async function settleSplitGroup(
    group: OpenGroup<Transaction>,
    targetRows?: Transaction[],
  ) {
    const person = group.splitPerson;
    if (!person) return;
    const rows = targetRows ?? group.items;
    const total = rows.reduce((sum, tx) => {
      const share = tx.splits?.find((s) => s.name === person && !s.settled);
      return sum + (share?.amount ?? 0);
    }, 0);

    const ok = await confirm({
      title:
        rows.length > 1
          ? `標記「${person}」這 ${rows.length} 筆已還款？`
          : `標記「${person}」已還款？`,
      message: `確認已收到 ${person} 的 ${formatMoney(total, currency)}。這筆金額將從原支出中扣除，不再列入待還款。`,
      confirmLabel: "已還錢",
    });
    if (!ok) return;

    for (const tx of rows) {
      await settleSplitShare(tx.id, person);
    }
    void runSync();
    show(
      rows.length > 1
        ? `已標記「${person}」${rows.length} 筆已還款`
        : `已標記「${person}」已還款`,
      { variant: "success" },
    );
  }

  if (groups.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
        目前沒有待銷帳、退回或待還款。
      </p>
    );
  }

  return (
    <section aria-label="待處理" className="space-y-2">
      <p className="text-xs text-[var(--muted)]">
        {groups.length} 件
        {items.length === groups.length ? "" : ` · ${items.length} 筆`}
        {" "}
        待處理（待銷帳、退回或待還款）
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
            onView={(tx) => setEditingTx(tx)}
            onRelease={() => void releaseAll(group.items)}
            onReimburse={() => void reimburseAll(group.items)}
            onSettleSplit={() => void settleSplitGroup(group)}
            onReleaseOne={(tx) => void releaseAll([tx])}
            onReimburseOne={(tx) => void reimburseAll([tx])}
            onSettleSplitOne={(tx) => void settleSplitGroup(group, [tx])}
          />
        ))}
      </ul>

      {editingTx ? (
        <TransactionEditor
          transaction={editingTx}
          accounts={accounts}
          categories={categories}
          onClose={() => setEditingTx(null)}
        />
      ) : null}
    </section>
  );
}

function GroupCard({
  group,
  currency,
  expanded,
  onToggle,
  onView,
  onRelease,
  onReimburse,
  onSettleSplit,
  onReleaseOne,
  onReimburseOne,
  onSettleSplitOne,
}: {
  group: OpenGroup<Transaction>;
  currency: string | undefined;
  expanded: boolean;
  onToggle: () => void;
  onView: (tx: Transaction) => void;
  onRelease: () => void;
  onReimburse: () => void;
  onSettleSplit?: () => void;
  onReleaseOne: (tx: Transaction) => void;
  onReimburseOne: (tx: Transaction) => void;
  onSettleSplitOne?: (tx: Transaction) => void;
}) {
  const many = group.items.length > 1;
  const actionLabel =
    group.kind === "hold" ? "退回" : group.kind === "split" ? "已還錢" : "銷帳";
  const actionColor =
    "bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 active:scale-95 shadow-xs";

  const months = new Set(group.items.map((tx) => tx.date.slice(0, 7))).size;
  const span = months > 1 ? `${months} 個月 · ${group.items.length} 筆` : `${group.items.length} 筆`;

  const singleTx = group.items[0];
  const displayTitle = group.title.replace(/^扣住：/, "");
  const badgeLabel =
    group.kind === "hold"
      ? "暫時扣住"
      : group.kind === "split"
        ? "待還款"
        : "待核銷";
  const badgeColor =
    group.kind === "hold"
      ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
      : group.kind === "split"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
        : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900";

  const singleSubtitle = singleTx
    ? `${formatDayHeading(singleTx.date)}`
    : "";

  function itemAmount(tx: Transaction): number {
    if (group.kind === "hold") return tx.amount;
    if (group.kind === "reimbursement") return tx.reimbursable_amount ?? tx.amount;
    const share = tx.splits?.find(
      (s) => s.name === group.splitPerson && !s.settled,
    );
    return share?.amount ?? 0;
  }

  function handleAction() {
    if (group.kind === "hold") onRelease();
    else if (group.kind === "split") onSettleSplit?.();
    else onReimburse();
  }

  function handleActionOne(tx: Transaction) {
    if (group.kind === "hold") onReleaseOne(tx);
    else if (group.kind === "split") onSettleSplitOne?.(tx);
    else onReimburseOne(tx);
  }

  return (
    <li className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] transition hover:border-[var(--muted)]/40">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <span
          className={[
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-2xs",
            group.kind === "hold"
              ? "bg-blue-600"
              : group.kind === "split"
                ? "bg-emerald-600"
                : "bg-sky-600",
          ].join(" ")}
          aria-hidden
        >
          {group.kind === "hold" ? (
            <svg
              className="h-4 w-4 stroke-current stroke-2"
              fill="none"
              viewBox="0 0 24 24"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 11V7a4 4 0 0 1 8 0v4"
              />
            </svg>
          ) : group.kind === "split" ? (
            <svg
              className="h-4 w-4 stroke-current stroke-2"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 stroke-current stroke-2"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          )}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">
              {displayTitle}
            </p>
            <span
              className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${badgeColor}`}
            >
              {badgeLabel}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            <span className="font-semibold tabular-nums text-[var(--ink)]">
              {formatMoney(group.amount, currency)}
            </span>
            <span className="mx-1.5 opacity-50">·</span>
            <span>{many ? span : singleSubtitle}</span>
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          {!many ? (
            <button
              type="button"
              onClick={() => onView(group.items[0])}
              className="inline-flex min-h-9 items-center rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] transition active:scale-95"
            >
              明細
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleAction}
            className={`inline-flex min-h-9 items-center rounded-xl px-3.5 text-xs font-semibold shadow-xs transition active:scale-95 ${actionColor}`}
          >
            {many ? `全部${actionLabel}` : actionLabel}
          </button>
        </div>
      </div>
      {expanded && many ? (
        <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {group.items.map((tx) => (
            <li key={tx.id} className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => onView(tx)}
                className="min-w-0 flex-1 text-left text-[11px] text-[var(--muted)] underline-offset-2 hover:underline"
              >
                {tx.note?.trim() ? `${tx.note.trim()} · ` : ""}
                {formatDayHeading(tx.date)}
                {" · "}
                <span className="tabular-nums">
                  {formatMoney(itemAmount(tx), currency)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleActionOne(tx)}
                className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2.5 text-xs font-medium text-[var(--ink)] transition active:scale-95"
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
    <AppShell title="待處理" backHref="/">
      <OpenItemList />
    </AppShell>
  );
}
