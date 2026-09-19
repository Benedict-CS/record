"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { CategoryDetailSheet } from "@/components/CategoryDetailSheet";
import { CategoryPieChart } from "@/components/CategoryPieChart";
import { TrendLineChart, type TrendPoint } from "@/components/TrendLineChart";
import { YearBarChart } from "@/components/YearBarChart";
import {
  categoryBreakdown,
  compareSummaries,
  dailyAverageExpense,
  dailyTrend,
  monthSummary,
  monthlyTotalsForYear,
  topCategories,
} from "@/lib/db/crud";
import { formatMoney, shiftYearMonth, type MoneyCurrency } from "@/lib/format";
import {
  useCategories,
  useHoldings,
  useMonthTransactions,
  useSeedReady,
  useYearTransactions,
} from "@/lib/hooks/useLedgerData";
import type { CategoryBreakdownItem, CategoryKind } from "@/lib/types";
import { holdingsInterestSummary } from "@/lib/interest";

type ReportScope = "month" | "year";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function daysInYear(year: number) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return leap ? 366 : 365;
}

function dayOfYear(date: Date) {
  const start = Date.UTC(date.getFullYear(), 0, 1);
  const current = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  return Math.floor((current - start) / 86_400_000) + 1;
}

export function ReportsPage() {
  const { book } = useBook();
  const currency = book?.currency;
  const ready = useSeedReady();
  const now = useMemo(() => new Date(), []);
  const [scope, setScope] = useState<ReportScope>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [pieKind, setPieKind] = useState<CategoryKind>("expense");
  const [detail, setDetail] = useState<CategoryBreakdownItem | null>(null);

  const categories = useCategories();
  const holdings = useHoldings();
  const monthTransactions = useMonthTransactions(year, month);
  const yearTransactions = useYearTransactions(year, scope === "year");

  const previousMonthRef = useMemo(
    () => shiftYearMonth(year, month, -1),
    [year, month],
  );
  const previousMonthTransactions = useMonthTransactions(
    previousMonthRef.year,
    previousMonthRef.month,
  );
  const previousYearTransactions = useYearTransactions(
    year - 1,
    scope === "year",
  );

  const activeTransactions =
    scope === "month" ? monthTransactions : yearTransactions;
  const previousTransactions =
    scope === "month" ? previousMonthTransactions : previousYearTransactions;

  const summary = useMemo(
    () => monthSummary(activeTransactions),
    [activeTransactions],
  );
  const previousSummary = useMemo(
    () => monthSummary(previousTransactions),
    [previousTransactions],
  );
  const comparison = useMemo(
    () => compareSummaries(summary, previousSummary),
    [summary, previousSummary],
  );
  const expenseBreakdown = useMemo(
    () => categoryBreakdown(activeTransactions, categories, "expense"),
    [activeTransactions, categories],
  );
  const breakdown = useMemo(
    () => categoryBreakdown(activeTransactions, categories, pieKind),
    [activeTransactions, categories, pieKind],
  );
  const ranking = useMemo(
    () => topCategories(activeTransactions, categories, pieKind, 5),
    [activeTransactions, categories, pieKind],
  );
  const monthlyTotals = useMemo(
    () => monthlyTotalsForYear(yearTransactions),
    [yearTransactions],
  );

  // Days already spent in the period: elapsed days for the ongoing month/year,
  // the full month for past months, and 365/366 for past years.
  const periodDays = useMemo(() => {
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth() + 1;
    if (scope === "month") {
      if (year > todayYear || (year === todayYear && month > todayMonth)) {
        return 0;
      }
      if (year === todayYear && month === todayMonth) return now.getDate();
      return daysInMonth(year, month);
    }
    if (year > todayYear) return 0;
    if (year === todayYear) return dayOfYear(now);
    return daysInYear(year);
  }, [scope, year, month, now]);

  const averageExpense = useMemo(
    () => dailyAverageExpense(activeTransactions, periodDays),
    [activeTransactions, periodDays],
  );

  const trendPoints = useMemo<TrendPoint[]>(() => {
    if (scope === "month") {
      const byDate = new Map(
        dailyTrend(monthTransactions).map((point) => [point.date, point]),
      );
      return Array.from({ length: daysInMonth(year, month) }, (_, index) => {
        const day = index + 1;
        const date = `${year}-${pad2(month)}-${pad2(day)}`;
        const point = byDate.get(date);
        return {
          label: String(day),
          fullLabel: `${month} 月 ${day} 日`,
          income: point?.income ?? 0,
          expense: point?.expense ?? 0,
        };
      });
    }
    return monthlyTotals.map((row) => ({
      label: `${row.month}月`,
      fullLabel: `${year} 年 ${row.month} 月`,
      income: row.income,
      expense: row.expense,
    }));
  }, [scope, monthTransactions, monthlyTotals, year, month]);

  const topExpense = expenseBreakdown[0];
  const topExpenseTitle = scope === "month" ? "本月消費最多" : "本年消費最多";
  const rankingTitle = `${pieKind === "expense" ? "支出" : "收入"}排行 TOP 5`;
  const interestForecast = useMemo(
    () => holdingsInterestSummary(holdings),
    [holdings],
  );

  function shiftPeriod(delta: number) {
    if (scope === "month") {
      const next = shiftYearMonth(year, month, delta);
      setYear(next.year);
      setMonth(next.month);
      return;
    }
    setYear((value) => value + delta);
  }

  const periodLabel =
    scope === "month" ? `${year} 年 ${month} 月` : `${year} 年`;
  const previousLabel =
    scope === "month"
      ? `${previousMonthRef.year} 年 ${previousMonthRef.month} 月`
      : `${year - 1} 年`;

  return (
    <AppShell title="報表">
      {!ready ? (
        <p className="text-sm text-[var(--muted)]">載入本機資料…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1">
            {(
              [
                { id: "month", label: "月報表" },
                { id: "year", label: "年報表" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setScope(option.id)}
                className={[
                  "min-h-11 rounded-xl px-3 py-2 text-sm font-medium transition",
                  scope === option.id
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "text-[var(--muted)]",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4">
            <div className="mb-3 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => shiftPeriod(-1)}
                aria-label={scope === "month" ? "上一期" : "上一年"}
                className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)]"
              >
                ‹
              </button>
              <p className="text-sm font-semibold tracking-wide text-[var(--ink)]">
                {periodLabel}
              </p>
              <button
                type="button"
                onClick={() => shiftPeriod(1)}
                aria-label={scope === "month" ? "下一期" : "下一年"}
                className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)]"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[var(--paper)] px-2.5 py-2.5 text-left">
                <p className="text-[11px] text-[var(--muted)]">花費</p>
                <p className="mt-1 truncate text-base font-semibold tabular-nums text-[var(--ink)]">
                  {formatMoney(summary.outflow, currency)}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--muted)]">花掉＋扣住</p>
              </div>
              <div className="rounded-xl bg-amber-50 px-2.5 py-2.5 text-left">
                <p className="text-[11px] text-amber-900/70">被扣住</p>
                <p className="mt-1 truncate text-base font-semibold tabular-nums text-amber-900">
                  {formatMoney(summary.held, currency)}
                </p>
                <p className="mt-0.5 text-[10px] text-amber-900/60">押金／預繳</p>
              </div>
              <div className="rounded-xl bg-[var(--paper)] px-2.5 py-2.5 text-left">
                <p className="text-[11px] text-[var(--muted)]">實際花掉</p>
                <p className="mt-1 truncate text-base font-semibold tabular-nums text-rose-700">
                  {formatMoney(summary.expense, currency)}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--muted)]">花費 − 被扣住</p>
              </div>
              <div className="rounded-xl bg-[var(--paper)] px-2.5 py-2.5 text-left">
                <p className="text-[11px] text-[var(--muted)]">結餘</p>
                <p className="mt-1 truncate text-base font-semibold tabular-nums text-[var(--ink)]">
                  {formatMoney(summary.net, currency)}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                  收入 {formatMoney(summary.income, currency)}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium text-[var(--ink)]">
                與上期比較
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                對比 {previousLabel}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DeltaCard
                label="實際花掉"
                delta={comparison.expenseDelta}
                percent={comparison.expensePercent}
                previous={previousSummary.expense}
                positiveIsGood={false}
                currency={currency}
              />
              <DeltaCard
                label="收入"
                delta={comparison.incomeDelta}
                percent={comparison.incomePercent}
                previous={previousSummary.income}
                positiveIsGood
                currency={currency}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium text-[var(--ink)]">
                存款預估利息
              </h2>
              <p className="text-[11px] text-[var(--muted)]">依目前年利率</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-[var(--muted)]">本金</p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums text-[var(--ink)]">
                  {formatMoney(interestForecast.amount, currency)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted)]">每月</p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums text-[var(--ink)]">
                  {formatMoney(interestForecast.monthly, currency)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted)]">每年</p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums text-[var(--ink)]">
                  {formatMoney(interestForecast.yearly, currency)}
                </p>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-[var(--ink)]">日均支出</p>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                {periodDays > 0 ? `以 ${periodDays} 天計算` : "此期間尚未開始"}
              </p>
            </div>
            <p className="shrink-0 text-lg font-semibold tabular-nums text-[var(--ink)]">
              {formatMoney(averageExpense, currency)}
            </p>
          </section>

          {topExpense ? (
            <section className="rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface)] px-4 py-4">
              <p className="text-xs font-medium tracking-wide text-[var(--accent)]">
                {topExpenseTitle}
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold text-[var(--ink)]">
                    {topExpense.name}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    占支出 {topExpense.percent.toFixed(1)}%
                  </p>
                </div>
                <p className="shrink-0 text-lg font-semibold tabular-nums text-rose-700">
                  {formatMoney(topExpense.amount, currency)}
                </p>
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-[var(--ink)]">收支趨勢</h2>
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-2 py-3 sm:px-3">
              <TrendLineChart
                points={trendPoints}
                currency={currency}
                emptyLabel={
                  scope === "month"
                    ? "此月份尚無收支資料"
                    : "此年度尚無收支資料"
                }
              />
            </div>
          </section>

          {scope === "year" ? (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-[var(--ink)]">各月收支</h2>
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-2 py-3 sm:px-3">
                <YearBarChart months={monthlyTotals} currency={currency} />
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-[var(--ink)]">分類占比</h2>
              <div className="flex gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
                {(
                  [
                    { id: "expense", label: "支出" },
                    { id: "income", label: "收入" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPieKind(option.id)}
                    className={[
                      "rounded-md px-2.5 py-1 text-xs font-medium transition",
                      pieKind === option.id
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--muted)]",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <CategoryPieChart
              items={breakdown}
              currency={currency}
              emptyLabel={
                pieKind === "expense"
                  ? "此期間尚無支出分類資料"
                  : "此期間尚無收入分類資料"
              }
            />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-[var(--ink)]">
              {rankingTitle}
            </h2>
            {ranking.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                此期間尚無資料
              </p>
            ) : (
              <ul className="space-y-2">
                {ranking.map((item, index) => (
                  <li key={item.categoryId ?? item.name}>
                    <button
                      type="button"
                      onClick={() => setDetail(item)}
                      className="flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-left transition active:bg-[var(--paper)]"
                    >
                      <span className="w-4 shrink-0 text-sm font-semibold tabular-nums text-[var(--muted)]">
                        {index + 1}
                      </span>
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm text-[var(--ink)]">
                            {item.name}
                          </span>
                          <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--ink)]">
                            {formatMoney(item.amount, currency)}
                          </span>
                        </span>
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--paper)]">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${Math.max(item.percent, 2)}%`,
                                backgroundColor: item.color,
                              }}
                            />
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-[var(--muted)]">
                            {item.percent.toFixed(1)}%
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {detail ? (
        <CategoryDetailSheet
          categoryId={detail.categoryId}
          categoryName={detail.name}
          color={detail.color}
          transactions={activeTransactions}
          currency={currency}
          periodLabel={periodLabel}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </AppShell>
  );
}

function DeltaCard({
  label,
  delta,
  percent,
  previous,
  positiveIsGood,
  currency,
}: {
  label: string;
  delta: number;
  percent: number;
  previous: number;
  positiveIsGood: boolean;
  currency?: MoneyCurrency;
}) {
  const flat = Math.abs(delta) < 0.005;
  const up = delta > 0;
  const good = positiveIsGood ? up : !up;
  const tone = flat
    ? "text-[var(--muted)]"
    : good
      ? "text-emerald-700"
      : "text-rose-700";
  const arrow = flat ? "－" : up ? "▲" : "▼";
  const hasBaseline = previous > 0;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3">
      <p className="text-[11px] text-[var(--muted)]">{label}</p>
      <p className={`mt-1 flex items-baseline gap-1 text-sm font-semibold ${tone}`}>
        <span aria-hidden>{arrow}</span>
        <span className="tabular-nums">
          {formatMoney(Math.abs(delta), currency)}
        </span>
      </p>
      <p className="mt-1 text-[11px] text-[var(--muted)]">
        {hasBaseline ? (
          <span className="tabular-nums">
            {flat ? "持平" : `${up ? "+" : "-"}${Math.abs(percent).toFixed(1)}%`}
          </span>
        ) : (
          "上期無資料"
        )}
      </p>
    </div>
  );
}
