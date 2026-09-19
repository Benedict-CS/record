"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BottomSheet } from "@/components/BottomSheet";
import { useBook } from "@/components/BookProvider";
import { CategoryPieChart } from "@/components/CategoryPieChart";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  HoldingFormSheet,
  type HoldingFormValues,
} from "@/components/HoldingFormSheet";
import { ListSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/ToastProvider";
import {
  createHolding,
  recordHoldingInterest,
  restoreHolding,
  softDeleteHolding,
  updateHolding,
} from "@/lib/db/crud";
import { formatMoney, formatRate } from "@/lib/format";
import {
  COMPOUNDING_OPTIONS,
  HOLDING_KINDS,
  compoundingLabel,
  holdingKindLabel,
} from "@/lib/holding-kinds";
import {
  holdingInterest,
  holdingsInterestSummary,
  monthlyProjection,
} from "@/lib/interest";
import { useHoldings, useSeedReady } from "@/lib/hooks/useLedgerData";
import { runSync } from "@/lib/sync/engine";
import type {
  CategoryBreakdownItem,
  Holding,
  HoldingKind,
} from "@/lib/types";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function HoldingProjectionSheet({
  holding,
  currency,
  open,
  onClose,
}: {
  holding: Holding | null;
  currency: string;
  open: boolean;
  onClose: () => void;
}) {
  const rows = holding ? monthlyProjection(holding, 12) : [];
  const interest = holding ? holdingInterest(holding) : null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={holding ? `${holding.name} 利息` : "利息"}
    >
      {holding && interest ? (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            {holdingKindLabel(holding.kind)}
            {holding.institution ? ` · ${holding.institution}` : ""}
            {holding.annual_rate > 0
              ? ` · 年利率 ${formatRate(holding.annual_rate)} · ${compoundingLabel(holding.compounding)}`
              : " · 無利息"}
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-[var(--paper)] px-2 py-2">
              <p className="text-[10px] text-[var(--muted)]">月利息</p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-[var(--ink)]">
                {formatMoney(interest.monthly, currency)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--paper)] px-2 py-2">
              <p className="text-[10px] text-[var(--muted)]">年利息</p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-[var(--ink)]">
                {formatMoney(interest.yearly, currency)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--paper)] px-2 py-2">
              <p className="text-[10px] text-[var(--muted)]">已累計</p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-[var(--ink)]">
                {formatMoney(interest.accrued, currency)}
              </p>
            </div>
          </div>
          {interest.monthly > 0 ? (
            <div className="overflow-hidden rounded-xl border border-[var(--line)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--paper)] text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">月份</th>
                    <th className="px-3 py-2 font-medium">利息</th>
                    <th className="px-3 py-2 text-right font-medium">餘額</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.index}
                      className="border-t border-[var(--line)]"
                    >
                      <td className="px-3 py-1.5 tabular-nums text-[var(--muted)]">
                        第 {row.index} 月
                      </td>
                      <td className="px-3 py-1.5 tabular-nums text-[var(--ink)]">
                        {formatMoney(row.interest, currency)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--ink)]">
                        {formatMoney(row.balance, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              填上年利率後，這裡會顯示未來 12 個月的預估利息。
            </p>
          )}
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function HoldingsPage() {
  const { book, bookId } = useBook();
  const ready = useSeedReady();
  const holdings = useHoldings();
  const confirm = useConfirm();
  const { show } = useToast();
  const currency = book?.currency ?? "TWD";

  const [kindFilter, setKindFilter] = useState<HoldingKind | "all">("all");
  const [allocMode, setAllocMode] = useState<"kind" | "item">("kind");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [preview, setPreview] = useState<Holding | null>(null);

  const summary = useMemo(
    () => holdingsInterestSummary(holdings),
    [holdings],
  );

  const allocation = useMemo((): CategoryBreakdownItem[] => {
    const total = holdings.reduce((sum, row) => sum + row.amount, 0);
    if (total <= 0) return [];

    if (allocMode === "item") {
      return [...holdings]
        .filter((row) => row.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .map((row) => ({
          categoryId: row.id,
          name: row.name,
          color: row.color || "#7f8c8d",
          icon: row.icon || "dots",
          amount: row.amount,
          percent: (row.amount / total) * 100,
        }));
    }

    const byKind = new Map<
      HoldingKind,
      { amount: number; color: string; icon: string }
    >();
    for (const row of holdings) {
      if (row.amount <= 0) continue;
      const prev = byKind.get(row.kind);
      if (prev) {
        prev.amount += row.amount;
      } else {
        byKind.set(row.kind, {
          amount: row.amount,
          color: row.color || "#7f8c8d",
          icon: row.icon || "dots",
        });
      }
    }

    return [...byKind.entries()]
      .map(([kind, value]) => ({
        categoryId: kind,
        name: holdingKindLabel(kind),
        color: value.color,
        icon: value.icon,
        amount: value.amount,
        percent: (value.amount / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [holdings, allocMode]);

  const visible = useMemo(() => {
    const rows =
      kindFilter === "all"
        ? holdings
        : holdings.filter((item) => item.kind === kindFilter);
    return [...rows].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "zh-Hant"),
    );
  }, [holdings, kindFilter]);

  const kindCounts = useMemo(() => {
    const counts = new Map<HoldingKind, number>();
    for (const item of holdings) {
      counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    }
    return counts;
  }, [holdings]);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(holding: Holding) {
    setEditing(holding);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
  }

  async function handleSubmit(values: HoldingFormValues) {
    try {
      if (editing) {
        await updateHolding(editing.id, values);
        show(`已更新「${values.name}」`, { variant: "success" });
      } else {
        if (!bookId) throw new Error("尚未選擇帳本，請稍後再試");
        await createHolding(bookId, values);
        show(`已新增「${values.name}」`, { variant: "success" });
      }
      void runSync();
    } catch (error) {
      show(errorMessage(error, "儲存存款失敗"), { variant: "error" });
      throw error;
    }
  }

  async function handleDelete(holding: Holding) {
    const ok = await confirm({
      title: `刪除「${holding.name}」`,
      message: "刪除後這筆不會列入淨資產（存款／資產）。可在提示中復原。",
      confirmLabel: "刪除",
      destructive: true,
    });
    if (!ok) return;
    try {
      await softDeleteHolding(holding.id);
      show(`已刪除「${holding.name}」`, {
        variant: "success",
        action: {
          label: "復原",
          onClick: () => {
            void restoreHolding(holding.id).then(() => {
              void runSync();
            });
          },
        },
      });
      void runSync();
    } catch (error) {
      show(errorMessage(error, "刪除存款失敗"), { variant: "error" });
    }
  }

  async function handleRecordInterest(
    holding: Holding,
    period: "month" | "year",
  ) {
    const interest = holdingInterest(holding);
    const amount = period === "year" ? interest.yearly : interest.monthly;
    if (amount <= 0) {
      show("這筆存款沒有可記入的利息", { variant: "info" });
      return;
    }
    const periodLabel = period === "year" ? "年利息" : "月利息";
    const ok = await confirm({
      title: `記入${periodLabel}`,
      message: `將新增一筆收入 ${formatMoney(amount, currency)}（${holding.name}），本金不會被改動。`,
      confirmLabel: "記入帳本",
    });
    if (!ok) return;
    try {
      await recordHoldingInterest(holding.id, period);
      show(`已記入「${holding.name}」${periodLabel}`, { variant: "success" });
      void runSync();
    } catch (error) {
      show(errorMessage(error, "記入利息失敗"), { variant: "error" });
    }
  }

  return (
    <AppShell title="存款／資產">
      {!ready ? (
        <ListSkeleton rows={6} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            記錄現金、銀行活存／定存、基金與電子錢包。可自訂種類與年利率，看每月與每年預估利息。
          </p>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5">
            <p className="text-xs text-[var(--muted)]">
              {book?.name ?? "帳本"}存款總額
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--ink)]">
              {formatMoney(summary.amount, currency)}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-[var(--muted)]">月利息</p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums text-[var(--ink)]">
                  {formatMoney(summary.monthly, currency)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted)]">年利息</p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums text-[var(--ink)]">
                  {formatMoney(summary.yearly, currency)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted)]">已累計</p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums text-[var(--ink)]">
                  {formatMoney(summary.accrued, currency)}
                </p>
              </div>
            </div>
          </section>

          {summary.amount > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-[var(--ink)]">
                  資產配置
                </h2>
                <div className="flex gap-1 rounded-xl bg-[var(--paper)] p-0.5">
                  {(
                    [
                      ["kind", "依種類"],
                      ["item", "依項目"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAllocMode(id)}
                      className={[
                        "min-h-9 rounded-lg px-2.5 text-xs font-medium",
                        allocMode === id
                          ? "bg-[var(--ink)] text-[var(--paper)]"
                          : "text-[var(--muted)]",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <CategoryPieChart
                items={allocation}
                currency={currency}
                emptyLabel="尚無存款資料"
              />
            </section>
          ) : null}

          <button
            type="button"
            onClick={openCreate}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ink)] px-4 py-3 text-sm font-medium text-[var(--paper)]"
          >
            <span aria-hidden className="text-lg leading-none">
              +
            </span>
            新增存款
          </button>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setKindFilter("all")}
              className={[
                "min-h-10 shrink-0 rounded-full px-3 text-xs",
                kindFilter === "all"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface)] text-[var(--muted)]",
              ].join(" ")}
            >
              全部 {holdings.length}
            </button>
            {HOLDING_KINDS.map((item) => {
              const count = kindCounts.get(item.id) ?? 0;
              if (count === 0 && kindFilter !== item.id) return null;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setKindFilter(item.id)}
                  className={[
                    "min-h-10 shrink-0 rounded-full px-3 text-xs",
                    kindFilter === item.id
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface)] text-[var(--muted)]",
                  ].join(" ")}
                >
                  {item.label} {count}
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)]/60 px-3 py-8 text-center text-sm text-[var(--muted)]">
              這個種類還沒有存款。可自己新增，例如定存、ShopeePay、Touch n Go。
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((holding) => {
                const interest = holdingInterest(holding);
                return (
                  <li
                    key={holding.id}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3"
                  >
                    <button
                      type="button"
                      onClick={() => openEdit(holding)}
                      aria-label={`編輯 ${holding.name}`}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: holding.color || "#0f7a5f" }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--ink)]">
                          {holding.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">
                          {holdingKindLabel(holding.kind)}
                          {holding.institution
                            ? ` · ${holding.institution}`
                            : ""}
                          {holding.annual_rate > 0
                            ? ` · ${formatRate(holding.annual_rate)}`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums text-[var(--ink)]">
                          {formatMoney(holding.amount, currency)}
                        </span>
                        {interest.monthly > 0 ? (
                          <span className="mt-0.5 block text-[11px] tabular-nums text-[var(--muted)]">
                            月 {formatMoney(interest.monthly, currency)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <div className="mt-2 flex flex-wrap items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setPreview(holding)}
                        className="min-h-11 rounded-xl px-2 text-xs text-[var(--accent)]"
                      >
                        利息明細
                      </button>
                      {interest.monthly > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              void handleRecordInterest(holding, "month")
                            }
                            className="min-h-11 rounded-xl px-2 text-xs text-[var(--accent)]"
                          >
                            記入月息
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleRecordInterest(holding, "year")
                            }
                            className="min-h-11 rounded-xl px-2 text-xs text-[var(--accent)]"
                          >
                            記入年息
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleDelete(holding)}
                        className="min-h-11 rounded-xl px-2 text-xs text-[var(--muted)] hover:text-rose-600"
                      >
                        刪除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            計息方式：
            {COMPOUNDING_OPTIONS.map((item) => item.label).join("、")}
            。已累計是從起息日算到今天（若已到期則算到到期日）。
          </p>
        </div>
      )}

      <HoldingFormSheet
        key={sheetOpen ? (editing?.id ?? "new") : "closed"}
        open={sheetOpen}
        holding={editing}
        onClose={closeSheet}
        onSubmit={handleSubmit}
      />
      <HoldingProjectionSheet
        holding={preview}
        currency={currency}
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
      />
    </AppShell>
  );
}
