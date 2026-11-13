"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { HoldStepButton } from "@/components/HoldStepButton";
import { PeriodJump } from "@/components/PeriodJump";
import { CardSkeleton, ListSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/ToastProvider";
import {
  calculateMonthlyAllowance,
  resolveEffectiveMonthBudget,
  resolveEffectiveYearBudget,
  type EffectiveBudget,
} from "@/lib/budget-calc";
import { budgetPacing, formatPercentUsed, yearTimeProgress } from "@/lib/budget-pacing";
import {
  categoryBreakdown,
  monthSummary,
  softDeleteBudget,
  upsertBudget,
} from "@/lib/db/crud";
import { formatMoney, shiftYearMonth, todayLocal } from "@/lib/format";
import { clampLedgerPeriod } from "@/lib/period-jump";
import {
  useAllBudgetsForYear,
  useCategories,
  useLedgerEndYear,
  useMonthTransactions,
  useSeedReady,
  useYearTransactions,
} from "@/lib/hooks/useLedgerData";
import { runSync } from "@/lib/sync/engine";

type BudgetScope = "month" | "year";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function ProgressBar({
  spent,
  budget,
  timeRatio,
}: {
  spent: number;
  budget: number;
  timeRatio?: number;
}) {
  const ratio = budget > 0 ? Math.min(spent / budget, 1.25) : 0;
  const over = budget > 0 && spent > budget;
  const width = `${Math.min(ratio * 100, 100)}%`;

  return (
    <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--paper)]">
      <div
        className={[
          "h-full rounded-full transition-[width]",
          over ? "bg-rose-500" : "bg-[var(--accent)]",
        ].join(" ")}
        style={{ width }}
      />
      {timeRatio !== undefined && timeRatio > 0 && timeRatio < 1 ? (
        <div
          className="absolute top-0 bottom-0 w-1 -ml-0.5 rounded-full bg-amber-300 shadow-xs"
          style={{ left: `${Math.min(timeRatio * 100, 100)}%` }}
          title={`時間進度 ${Math.round(timeRatio * 100)}%`}
        />
      ) : null}
    </div>
  );
}

export function BudgetsPage() {
  const { book, bookId } = useBook();
  const currency = book?.currency;
  const ready = useSeedReady();
  const { show } = useToast();
  const today = todayLocal();
  const currentYear = Number(today.slice(0, 4));
  const currentMonthNum = Number(today.slice(5, 7));
  const [scope, setScope] = useState<BudgetScope>("month");
  const [year, setYear] = useState(() => currentYear);
  const [month, setMonth] = useState(() => currentMonthNum);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const targetMonth = scope === "year" ? 0 : month;
  const allBudgets = useAllBudgetsForYear(year);
  const endYear = useLedgerEndYear();
  const categories = useCategories("expense");
  const monthTransactions = useMonthTransactions(year, month, scope === "month");
  const yearTransactions = useYearTransactions(year, scope === "year");
  const transactions = scope === "year" ? yearTransactions : monthTransactions;

  const yearBudgets = useMemo(
    () => allBudgets.filter((b) => b.month === 0),
    [allBudgets],
  );
  const currentMonthBudgets = useMemo(
    () => allBudgets.filter((b) => b.month === month),
    [allBudgets, month],
  );
  const allMonthBudgets = useMemo(
    () => allBudgets.filter((b) => b.month > 0),
    [allBudgets],
  );

  const explicitBudgetByCategory = useMemo(
    () =>
      Object.fromEntries(
        (scope === "year" ? yearBudgets : currentMonthBudgets)
          .filter((b) => b.category_id)
          .map((b) => [b.category_id as string, b]),
      ),
    [scope, yearBudgets, currentMonthBudgets],
  );

  const explicitOverallBudget = useMemo(
    () =>
      (scope === "year" ? yearBudgets : currentMonthBudgets).find(
        (b) => b.category_id === null,
      ),
    [scope, yearBudgets, currentMonthBudgets],
  );

  const effectiveCategoryBudgets = useMemo(() => {
    const map: Record<string, EffectiveBudget> = {};
    for (const cat of categories) {
      if (scope === "month") {
        map[cat.id] = resolveEffectiveMonthBudget({
          categoryId: cat.id,
          monthBudgets: currentMonthBudgets,
          yearBudgets,
          currency,
        });
      } else {
        map[cat.id] = resolveEffectiveYearBudget({
          categoryId: cat.id,
          yearBudgets,
          allMonthBudgets,
          currency,
        });
      }
    }
    return map;
  }, [
    categories,
    scope,
    currentMonthBudgets,
    yearBudgets,
    allMonthBudgets,
    currency,
  ]);

  const categoryBudgetsSum = useMemo(() => {
    return Object.values(effectiveCategoryBudgets).reduce(
      (sum, b) => sum + (b.amount > 0 ? b.amount : 0),
      0,
    );
  }, [effectiveCategoryBudgets]);

  const effectiveOverallBudget = useMemo(() => {
    if (scope === "month") {
      return resolveEffectiveMonthBudget({
        categoryId: null,
        monthBudgets: currentMonthBudgets,
        yearBudgets,
        categoryBudgetsSum,
        currency,
      });
    } else {
      return resolveEffectiveYearBudget({
        categoryId: null,
        yearBudgets,
        allMonthBudgets,
        categoryBudgetsSum,
        currency,
      });
    }
  }, [
    scope,
    currentMonthBudgets,
    yearBudgets,
    allMonthBudgets,
    categoryBudgetsSum,
    currency,
  ]);

  const timeProgress = useMemo(
    () => yearTimeProgress(year, today),
    [year, today],
  );

  const summary = useMemo(() => monthSummary(transactions), [transactions]);
  const breakdown = useMemo(
    () => categoryBreakdown(transactions, categories, "expense"),
    [transactions, categories],
  );
  const spentByCategory = useMemo(
    () =>
      Object.fromEntries(
        breakdown.map((item) => [item.categoryId ?? "", item.amount]),
      ),
    [breakdown],
  );
  const treatByCategory = useMemo(
    () =>
      Object.fromEntries(
        breakdown.map((item) => [item.categoryId ?? "", item.treatAmount ?? 0]),
      ),
    [breakdown],
  );
  const treatTotal = useMemo(
    () => breakdown.reduce((sum, item) => sum + (item.treatAmount ?? 0), 0),
    [breakdown],
  );

  const overallAllowance = useMemo(() => {
    if (scope !== "year" || effectiveOverallBudget.amount <= 0) return null;
    return calculateMonthlyAllowance({
      annualBudgetAmount: effectiveOverallBudget.amount,
      spentSoFar: summary.selfPay,
      year,
      currentYear,
      currentMonth: currentMonthNum,
      currency,
    });
  }, [
    scope,
    effectiveOverallBudget.amount,
    summary.selfPay,
    year,
    currentYear,
    currentMonthNum,
    currency,
  ]);

  const overallPacing = useMemo(() => {
    if (effectiveOverallBudget.amount <= 0) {
      return null;
    }
    return budgetPacing(
      summary.selfPay,
      effectiveOverallBudget.amount,
      timeProgress.timeRatio,
      currency,
    );
  }, [effectiveOverallBudget.amount, summary.selfPay, timeProgress.timeRatio, currency]);

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

  function changeScope(nextScope: BudgetScope) {
    setScope(nextScope);
    setDrafts({});
  }

  async function saveBudget(categoryId: string | null) {
    if (!bookId) {
      show("尚未選擇帳本，無法儲存預算", { variant: "error" });
      return;
    }
    const key = draftKey(categoryId);
    const labelPrefix = scope === "year" ? "年度" : "";
    const name = categoryId
      ? (categories.find((item) => item.id === categoryId)?.name ?? "分類")
      : `${labelPrefix}總預算`;
    const explicit = categoryId
      ? explicitBudgetByCategory[categoryId]
      : explicitOverallBudget;
    const raw = currentDraft(categoryId, explicit?.amount);
    const parsed = Number(raw);
    setSavingKey(key);

    try {
      if (!raw.trim() || !Number.isFinite(parsed) || parsed <= 0) {
        if (explicit) {
          await softDeleteBudget(explicit.id);
          show(`已移除${name}個別設定，恢復自動換算`, { variant: "success" });
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
        month: targetMonth,
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

  function jumpTo(nextYear: number, nextMonth: number) {
    const next = clampLedgerPeriod(nextYear, nextMonth, endYear);
    setYear(next.year);
    if (scope === "month") setMonth(next.month);
    setDrafts({});
  }

  function shiftPeriod(delta: number) {
    if (scope === "year") {
      const next = clampLedgerPeriod(year + delta, month, endYear);
      setYear(next.year);
      setDrafts({});
    } else {
      const next = shiftYearMonth(year, month, delta);
      jumpTo(next.year, next.month);
    }
  }

  return (
    <AppShell title="預算" backHref="/more">
      {!ready ? (
        <div className="space-y-4">
          <CardSkeleton lines={1} />
          <ListSkeleton rows={4} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1">
            {(
              [
                { id: "month", label: "月預算" },
                { id: "year", label: "年預算" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => changeScope(option.id)}
                className={[
                  "min-h-11 rounded-xl px-2 py-2 text-sm font-medium transition",
                  scope === option.id
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "text-[var(--muted)]",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>

          <section className="rounded-2xl bg-[var(--ink)] px-4 py-4 text-[var(--paper)]">
            <div className="mb-3 flex items-center justify-between gap-1">
              <HoldStepButton
                ariaLabel={scope === "year" ? "上一年" : "上一個月"}
                title={scope === "year" ? "上一年，長按跳五年" : "上一個月，長按跳一年"}
                className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-lg text-[var(--paper)] opacity-80 hover:opacity-100"
                onStep={() => shiftPeriod(-1)}
                onHold={() => shiftPeriod(scope === "year" ? -5 : -12)}
              >
                ‹
              </HoldStepButton>
              <PeriodJump
                year={year}
                month={month}
                scope={scope}
                onChange={jumpTo}
                className="text-sm font-semibold tracking-wide tabular-nums text-[var(--paper)]"
              />
              <HoldStepButton
                ariaLabel={scope === "year" ? "下一年" : "下一個月"}
                title={scope === "year" ? "下一年，長按跳五年" : "下一個月，長按跳一年"}
                className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-lg text-[var(--paper)] opacity-80 hover:opacity-100"
                onStep={() => shiftPeriod(1)}
                onHold={() => shiftPeriod(scope === "year" ? 5 : 12)}
              >
                ›
              </HoldStepButton>
            </div>
            <p className="text-[11px] opacity-70">
              {scope === "year" ? `${year} 年` : `${month} 月`}實際花掉（不含扣住）
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(summary.selfPay, currency)}
              {effectiveOverallBudget.amount > 0 ? (
                <span className="ml-2 text-sm font-normal opacity-70">
                  / {formatMoney(effectiveOverallBudget.amount, currency)}
                  {effectiveOverallBudget.badgeText ? (
                    <span className="ml-1 text-xs opacity-80">
                      （{effectiveOverallBudget.badgeText}）
                    </span>
                  ) : null}
                </span>
              ) : null}
            </p>
            {treatTotal > 0 ? (
              <p className="mt-1 text-[11px] font-medium text-amber-200">
                含請客 {formatMoney(treatTotal, currency)}
              </p>
            ) : null}
            {summary.held > 0 ? (
              <p className="mt-1 text-[11px] opacity-80">
                另有暫時扣住{" "}
                <span className="font-medium tabular-nums text-amber-200">
                  {formatMoney(summary.held, currency)}
                </span>
                ，不計入預算
              </p>
            ) : null}
            {effectiveOverallBudget.amount > 0 ? (
              <ProgressBar
                spent={summary.selfPay}
                budget={effectiveOverallBudget.amount}
                timeRatio={
                  scope === "year" && year === currentYear
                    ? timeProgress.timeRatio
                    : undefined
                }
              />
            ) : null}
            {effectiveOverallBudget.amount > 0 && overallPacing ? (
              <div className="mt-2.5 rounded-xl bg-black/25 px-3 py-2 text-[11px]">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <span className="opacity-80">
                    {scope === "year" && year === currentYear ? (
                      <>
                        時間已過{" "}
                        <span className="font-semibold text-amber-200 tabular-nums">
                          {overallPacing.timePct}%
                        </span>
                        {" · 預算已用 "}
                        <span className="font-semibold tabular-nums">
                          {overallPacing.spentPctText}
                        </span>
                      </>
                    ) : (
                      <>
                        預算已用{" "}
                        <span className="font-semibold tabular-nums">
                          {overallPacing.spentPctText}
                        </span>
                      </>
                    )}
                  </span>
                  <span
                    className={[
                      "font-semibold tabular-nums",
                      overallPacing.isOver
                        ? "text-rose-300"
                        : "text-emerald-300",
                    ].join(" ")}
                  >
                    {overallPacing.statusText}
                  </span>
                </div>
                {scope === "year" && year === currentYear && overallAllowance ? (
                  <div className="mt-1 flex items-center justify-between opacity-80 text-[10px] text-amber-100">
                    <span>{overallAllowance.text}</span>
                  </div>
                ) : null}
                {scope === "month" && effectiveOverallBudget.noteText ? (
                  <div className="mt-1 opacity-70 text-[10px]">
                    <span>{effectiveOverallBudget.noteText}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium text-[var(--ink)]">
                  {scope === "year" ? "年度總預算" : "總預算"}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {scope === "year"
                    ? "設定整年度整體支出上限；清空並儲存可移除。"
                    : "設定每月整體支出上限；清空並儲存可移除。"}
                </p>
                {effectiveOverallBudget.isFallback && effectiveOverallBudget.noteText ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    目前狀態：
                    <span className="font-medium text-[var(--ink)]">
                      {effectiveOverallBudget.noteText}
                    </span>
                  </p>
                ) : null}
              </div>
              {effectiveOverallBudget.isFallback &&
              effectiveOverallBudget.amount > 0 &&
              !currentDraft(null, explicitOverallBudget?.amount) ? (
                <button
                  type="button"
                  onClick={() =>
                    setDraft(null, String(effectiveOverallBudget.amount))
                  }
                  className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  帶入 ${effectiveOverallBudget.amount}
                </button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                aria-label={scope === "year" ? "年度總預算金額" : "總預算金額"}
                value={currentDraft(null, explicitOverallBudget?.amount)}
                onChange={(event) => setDraft(null, event.target.value)}
                placeholder={
                  effectiveOverallBudget.isFallback &&
                  effectiveOverallBudget.amount > 0
                    ? `${effectiveOverallBudget.amount}（${effectiveOverallBudget.badgeText}）`
                    : "0"
                }
                className="min-h-11 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                disabled={savingKey === draftKey(null)}
                onClick={() => void saveBudget(null)}
                aria-label={scope === "year" ? "儲存年度總預算" : "儲存總預算"}
                className="touch-target shrink-0 rounded-md bg-[var(--ink)] px-4 text-sm text-[var(--paper)] disabled:opacity-60"
              >
                {savingKey === draftKey(null) ? "…" : "儲存"}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium text-[var(--ink)]">
                {scope === "year" ? "年度分類預算" : "分類預算"}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {scope === "year"
                  ? "依支出分類設定全年度上限，並對照該年已花金額。"
                  : "依支出分類設定上限，並對照該月已花金額。"}
              </p>
            </div>
            <ul className="space-y-2">
              {categories.map((category) => {
                const effective = effectiveCategoryBudgets[category.id] ?? {
                  amount: 0,
                  source: "none",
                  isFallback: false,
                };
                const explicit = explicitBudgetByCategory[category.id];
                const spent = spentByCategory[category.id] ?? 0;
                const treat = treatByCategory[category.id] ?? 0;
                const key = draftKey(category.id);

                const allowance =
                  scope === "year" && effective.amount > 0
                    ? calculateMonthlyAllowance({
                        annualBudgetAmount: effective.amount,
                        spentSoFar: spent,
                        year,
                        currentYear,
                        currentMonth: currentMonthNum,
                        currency,
                      })
                    : null;

                return (
                  <li
                    key={category.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-[var(--ink)]">
                            {category.name}
                          </p>
                          {effective.badgeText ? (
                            <span className="inline-flex items-center rounded-md bg-[var(--line)]/60 px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                              {effective.badgeText}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--muted)] tabular-nums">
                          已花 {formatMoney(spent, currency)}
                          {effective.amount > 0 ? (
                            <>
                              {" · 預算 "}
                              {formatMoney(effective.amount, currency)}
                              {" · 已用 "}
                              <span
                                className={
                                  spent > effective.amount
                                    ? "font-semibold text-rose-600 dark:text-rose-400"
                                    : ""
                                }
                              >
                                {formatPercentUsed(spent, effective.amount)}
                              </span>
                            </>
                          ) : (
                            " · 尚未設定"
                          )}
                        </p>
                        {treat > 0 ? (
                          <p className="mt-0.5 text-xs font-medium text-amber-800">
                            含請客 {formatMoney(treat, currency)}
                          </p>
                        ) : null}
                        {allowance ? (
                          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                            {allowance.text}
                          </p>
                        ) : null}
                        {scope === "month" && effective.noteText ? (
                          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                            {effective.noteText}
                          </p>
                        ) : null}
                      </div>
                      {effective.isFallback &&
                      effective.amount > 0 &&
                      !currentDraft(category.id, explicit?.amount) ? (
                        <button
                          type="button"
                          onClick={() =>
                            setDraft(category.id, String(effective.amount))
                          }
                          className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                          帶入 ${effective.amount}
                        </button>
                      ) : null}
                    </div>
                    {effective.amount > 0 ? (
                      <ProgressBar
                        spent={spent}
                        budget={effective.amount}
                        timeRatio={
                          scope === "year" && year === currentYear
                            ? timeProgress.timeRatio
                            : undefined
                        }
                      />
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      <input
                        inputMode="decimal"
                        aria-label={`${category.name} ${scope === "year" ? "年度" : ""}預算金額`}
                        value={currentDraft(category.id, explicit?.amount)}
                        onChange={(event) =>
                          setDraft(category.id, event.target.value)
                        }
                        placeholder={
                          effective.isFallback && effective.amount > 0
                            ? `${effective.amount}（${effective.badgeText}）`
                            : "預算金額"
                        }
                        className="min-h-11 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--accent)]"
                      />
                      <button
                        type="button"
                        disabled={savingKey === key}
                        onClick={() => void saveBudget(category.id)}
                        aria-label={`儲存 ${category.name} ${scope === "year" ? "年度" : ""}預算`}
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
        </div>
      )}
    </AppShell>
  );
}
