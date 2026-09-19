"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { CardSkeleton, ListSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/ToastProvider";
import {
  categoryBreakdown,
  monthSummary,
  softDeleteBudget,
  upsertBudget,
} from "@/lib/db/crud";
import { formatMoney, shiftYearMonth } from "@/lib/format";
import {
  useBudgets,
  useCategories,
  useMonthTransactions,
  useSeedReady,
} from "@/lib/hooks/useLedgerData";
import { runSync } from "@/lib/sync/engine";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function ProgressBar({
  spent,
  budget,
}: {
  spent: number;
  budget: number;
}) {
  const ratio = budget > 0 ? Math.min(spent / budget, 1.25) : 0;
  const over = budget > 0 && spent > budget;
  const width = `${Math.min(ratio * 100, 100)}%`;

  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--paper)]">
      <div
        className={[
          "h-full rounded-full transition-[width]",
          over ? "bg-rose-500" : "bg-[var(--accent)]",
        ].join(" ")}
        style={{ width }}
      />
    </div>
  );
}

export function BudgetsPage() {
  const { book, bookId } = useBook();
  const currency = book?.currency;
  const ready = useSeedReady();
  const { show } = useToast();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const budgets = useBudgets(year, month);
  const categories = useCategories("expense");
  const transactions = useMonthTransactions(year, month);

  const summary = monthSummary(transactions);
  const breakdown = categoryBreakdown(transactions, categories, "expense");
  const spentByCategory = useMemo(
    () =>
      Object.fromEntries(
        breakdown.map((item) => [item.categoryId ?? "", item.amount]),
      ),
    [breakdown],
  );

  const overallBudget = budgets.find((b) => b.category_id === null);
  const budgetByCategory = useMemo(
    () =>
      Object.fromEntries(
        budgets
          .filter((b) => b.category_id)
          .map((b) => [b.category_id as string, b]),
      ),
    [budgets],
  );

  function draftKey(categoryId: string | null) {
    return categoryId ?? "__overall__";
  }

  function currentDraft(categoryId: string | null, fallback: number | undefined) {
    const key = draftKey(categoryId);
    if (key in drafts) return drafts[key];
    return fallback !== undefined && fallback > 0 ? String(fallback) : "";
  }

  function setDraft(categoryId: string | null, value: string) {
    setDrafts((prev) => ({ ...prev, [draftKey(categoryId)]: value }));
  }

  async function saveBudget(categoryId: string | null) {
    if (!bookId) {
      show("尚未選擇帳本，無法儲存預算", { variant: "error" });
      return;
    }
    const key = draftKey(categoryId);
    const name = categoryId
      ? (categories.find((item) => item.id === categoryId)?.name ?? "分類")
      : "總預算";
    const raw = currentDraft(
      categoryId,
      categoryId
        ? budgetByCategory[categoryId]?.amount
        : overallBudget?.amount,
    );
    const parsed = Number(raw);
    setSavingKey(key);

    try {
      if (!raw.trim() || !Number.isFinite(parsed) || parsed <= 0) {
        const existing = categoryId
          ? budgetByCategory[categoryId]
          : overallBudget;
        if (existing) {
          await softDeleteBudget(existing.id);
          show(`已移除${name}預算`, { variant: "success" });
          void runSync();
        } else if (raw.trim()) {
          show("請輸入大於 0 的金額", { variant: "error" });
        }
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        return;
      }

      await upsertBudget(bookId, {
        year,
        month,
        category_id: categoryId,
        amount: parsed,
      });
      show(`已儲存${name}預算 ${formatMoney(parsed, currency)}`, {
        variant: "success",
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      void runSync();
    } catch (error) {
      show(errorMessage(error, "儲存預算失敗"), { variant: "error" });
    } finally {
      setSavingKey(null);
    }
  }

  function shiftMonth(delta: number) {
    const next = shiftYearMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
    setDrafts({});
  }

  return (
    <AppShell title="預算">
      {!ready ? (
        <div className="space-y-4">
          <CardSkeleton lines={1} />
          <ListSkeleton rows={4} />
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl bg-[var(--ink)] px-4 py-4 text-[var(--paper)]">
            <div className="mb-3 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="上一個月"
                className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-lg text-[var(--paper)] opacity-80 hover:opacity-100"
              >
                ‹
              </button>
              <p
                className="text-sm font-semibold tracking-wide tabular-nums"
                aria-live="polite"
              >
                {year} 年 {month} 月
              </p>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="下一個月"
                className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-lg text-[var(--paper)] opacity-80 hover:opacity-100"
              >
                ›
              </button>
            </div>
            <p className="text-[11px] opacity-70">本月實際花掉（不含扣住）</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(summary.expense, currency)}
              {overallBudget ? (
                <span className="ml-2 text-sm font-normal opacity-70">
                  / {formatMoney(overallBudget.amount, currency)}
                </span>
              ) : null}
            </p>
            {summary.held > 0 ? (
              <p className="mt-1 text-[11px] opacity-80">
                另有暫時扣住{" "}
                <span className="font-medium tabular-nums text-amber-200">
                  {formatMoney(summary.held, currency)}
                </span>
                ，不計入預算
              </p>
            ) : null}
            {overallBudget ? (
              <ProgressBar
                spent={summary.expense}
                budget={overallBudget.amount}
              />
            ) : null}
          </section>

          <section className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div>
              <h2 className="text-sm font-medium text-[var(--ink)]">總預算</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                設定每月整體支出上限；清空並儲存可移除。
              </p>
            </div>
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                aria-label="總預算金額"
                value={currentDraft(null, overallBudget?.amount)}
                onChange={(event) => setDraft(null, event.target.value)}
                placeholder="0"
                className="min-h-11 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                disabled={savingKey === draftKey(null)}
                onClick={() => void saveBudget(null)}
                aria-label="儲存總預算"
                className="touch-target shrink-0 rounded-md bg-[var(--ink)] px-4 text-sm text-[var(--paper)] disabled:opacity-60"
              >
                {savingKey === draftKey(null) ? "…" : "儲存"}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium text-[var(--ink)]">
                分類預算
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                依支出分類設定上限，並對照本月已花金額。
              </p>
            </div>
            <ul className="space-y-2">
              {categories.map((category) => {
                const budget = budgetByCategory[category.id];
                const spent = spentByCategory[category.id] ?? 0;
                const key = draftKey(category.id);
                return (
                  <li
                    key={category.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--ink)]">
                          {category.name}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--muted)] tabular-nums">
                          已花 {formatMoney(spent, currency)}
                          {budget
                            ? ` · 預算 ${formatMoney(budget.amount, currency)}`
                            : " · 尚未設定"}
                        </p>
                      </div>
                    </div>
                    {budget ? (
                      <ProgressBar spent={spent} budget={budget.amount} />
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      <input
                        inputMode="decimal"
                        aria-label={`${category.name} 預算金額`}
                        value={currentDraft(category.id, budget?.amount)}
                        onChange={(event) =>
                          setDraft(category.id, event.target.value)
                        }
                        placeholder="預算金額"
                        className="min-h-11 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--accent)]"
                      />
                      <button
                        type="button"
                        disabled={savingKey === key}
                        onClick={() => void saveBudget(category.id)}
                        aria-label={`儲存 ${category.name} 預算`}
                        className="touch-target shrink-0 rounded-md bg-[var(--ink)] px-4 text-sm text-[var(--paper)] disabled:opacity-60"
                      >
                        {savingKey === key ? "…" : "儲存"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {categories.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                還沒有支出分類，請先到「分類」新增。
              </p>
            ) : null}
          </section>

          <ExportCsvButton year={year} month={month} />
        </div>
      )}
    </AppShell>
  );
}
