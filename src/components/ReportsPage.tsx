"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { CategoryDetailSheet } from "@/components/CategoryDetailSheet";
import { HoldStepButton } from "@/components/HoldStepButton";
import { PeriodJump } from "@/components/PeriodJump";
import { SimpleSummary } from "@/components/SimpleSummary";
import { CategoryPieChart } from "@/components/CategoryPieChart";
import { TrendLineChart, type TrendPoint } from "@/components/TrendLineChart";
import { YearBarChart } from "@/components/YearBarChart";
import {
  categoryBreakdown,
  compareSummaries,
  dailyTrend,
  monthSummary,
  monthlyTotalsForYear,
  yearlyTotals,
} from "@/lib/db/crud";
import {
  calendarDateInYear,
  formatMoney,
  shiftYearMonth,
  throughToday,
  todayLocal,
  type MoneyCurrency,
} from "@/lib/format";
import { clampLedgerPeriod, LEDGER_START_YEAR } from "@/lib/period-jump";
import {
  useCategories,
  useLedgerEndYear,
  useMonthTransactions,
  useSeedReady,
  useTransactionsBetween,
  useYearTransactions,
} from "@/lib/hooks/useLedgerData";
import type { CategoryBreakdownItem, CategoryKind } from "@/lib/types";

type ReportScope = "month" | "year" | "all";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function ReportsPage() {
  const { book } = useBook();
  const currency = book?.currency;
  const ready = useSeedReady();
  const today = todayLocal();
  const nowYear = Number(today.slice(0, 4));
  const nowMonth = Number(today.slice(5, 7));
  const [scope, setScope] = useState<ReportScope>("month");
  const [year, setYear] = useState(nowYear);
  const [month, setMonth] = useState(nowMonth);
  const [pieKind, setPieKind] = useState<CategoryKind>("expense");
  const [detail, setDetail] = useState<
    (CategoryBreakdownItem & { kind: CategoryKind }) | null
  >(null);

  const categories = useCategories();
  const endYear = useLedgerEndYear();
  const monthTransactions = useMonthTransactions(
    year,
    month,
    scope === "month",
  );
  const yearTransactions = useYearTransactions(year, scope === "year");
  const historyTransactions = useTransactionsBetween(
    `${LEDGER_START_YEAR}-01-01`,
    "2100-01-01",
    scope === "all",
  );

  const previousMonthRef = useMemo(
    () => shiftYearMonth(year, month, -1),
    [year, month],
  );
  const previousMonthTransactions = useMonthTransactions(
    previousMonthRef.year,
    previousMonthRef.month,
    scope === "month",
  );
  const previousYearTransactions = useYearTransactions(
    year - 1,
    scope === "year",
  );

  const isCurrentMonth = year === nowYear && month === nowMonth;
  const isCurrentYear = year === nowYear;
  const periodTransactions =
    scope === "month"
      ? monthTransactions
      : scope === "year"
        ? yearTransactions
        : historyTransactions;
  const monthCounted = useMemo(
    () =>
      isCurrentMonth
        ? throughToday(monthTransactions, today)
        : monthTransactions,
    [isCurrentMonth, monthTransactions, today],
  );
  const scopedCounted = useMemo(
    () => throughToday(periodTransactions, today),
    [periodTransactions, today],
  );
  const activeTransactions =
    scope === "month" ? monthCounted : scopedCounted;
  const previousYearCutoff = calendarDateInYear(year - 1, today);
  const previousTransactions = useMemo(
    () =>
      scope === "month"
        ? previousMonthTransactions
        : isCurrentYear
          ? previousYearTransactions.filter(
              (tx) => tx.date <= previousYearCutoff,
            )
          : previousYearTransactions,
    [
      scope,
      previousMonthTransactions,
      isCurrentYear,
      previousYearTransactions,
      previousYearCutoff,
    ],
  );
  const laterCount = periodTransactions.length - activeTransactions.length;

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
  const ranking = useMemo(() => breakdown.slice(0, 5), [breakdown]);
  const monthlyTotals = useMemo(
    () => monthlyTotalsForYear(scope === "year" ? activeTransactions : yearTransactions),
    [scope, activeTransactions, yearTransactions],
  );
  const historyYears = useMemo(
    () =>
      yearlyTotals(
        scope === "all" ? activeTransactions : [],
        LEDGER_START_YEAR,
        nowYear,
      ),
    [scope, activeTransactions, nowYear],
  );

  const trendPoints = useMemo<TrendPoint[]>(() => {
    if (scope === "month") {
      const byDate = new Map(
        dailyTrend(activeTransactions).map((point) => [point.date, point]),
      );
      const lastDay =
        isCurrentMonth ? Number(today.slice(8, 10)) : daysInMonth(year, month);
      return Array.from({ length: lastDay }, (_, index) => {
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
    if (scope === "all") {
      return historyYears.map((row) => ({
        label: String(row.year),
        fullLabel: `${row.year} 年`,
        income: row.income,
        expense: row.expense,
      }));
    }
    return monthlyTotals.map((row) => ({
      label: `${row.month}月`,
      fullLabel: `${year} 年 ${row.month} 月`,
      income: row.income,
      expense: row.expense,
    }));
  }, [
    scope,
    activeTransactions,
    isCurrentMonth,
    today,
    monthlyTotals,
    historyYears,
    year,
    month,
  ]);

  const topExpense = expenseBreakdown[0];
  const topExpenseTitle =
    scope === "month"
      ? `${month} 月消費最多`
      : scope === "year"
        ? `${year} 年消費最多`
        : "全部消費最多";
  const rankingTitle = `${pieKind === "expense" ? "支出" : "收入"}排行 TOP 5`;

  function shiftPeriod(delta: number) {
    if (scope === "month") {
      const shifted = shiftYearMonth(year, month, delta);
      const next = clampLedgerPeriod(shifted.year, shifted.month, endYear);
      setYear(next.year);
      setMonth(next.month);
      return;
    }
    setYear((value) => clampLedgerPeriod(value + delta, 1, endYear).year);
  }

  const hasPreviousPeriod =
    scope === "all"
      ? false
      : scope === "month"
        ? previousMonthRef.year >= LEDGER_START_YEAR
        : year - 1 >= LEDGER_START_YEAR;

  const periodLabel =
    scope === "month"
      ? `${year} 年 ${month} 月`
      : scope === "year"
        ? `${year} 年`
        : `${LEDGER_START_YEAR} 年至今`;
  const previousLabel =
    scope === "month"
      ? `${previousMonthRef.year} 年 ${previousMonthRef.month} 月`
      : isCurrentYear
        ? `${year - 1} 年 1 月 1 日–${Number(previousYearCutoff.slice(5, 7))} 月 ${Number(previousYearCutoff.slice(8, 10))} 日`
        : `${year - 1} 年`;

  return (
    <AppShell title="報表">
      {!ready ? (
        <p className="text-sm text-[var(--muted)]">載入本機資料…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1">
            {(
              [
                { id: "month", label: "月報表" },
                { id: "year", label: "年報表" },
                { id: "all", label: "全部" },
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
            {scope === "all" ? (
              <div className="mb-3 text-center">
                <p className="text-sm font-semibold tracking-wide text-[var(--ink)]">
                  {periodLabel}
                </p>
                <p className="text-[11px] text-[var(--muted)]">從開始記帳到今天</p>
                {laterCount > 0 ? (
                  <p className="text-[11px] text-[var(--muted)]">
                    不含今天之後先入帳的 {laterCount} 筆
                  </p>
                ) : null}
              </div>
            ) : (
            <div className="mb-3 flex items-center justify-between gap-1">
              <HoldStepButton
                ariaLabel={scope === "month" ? "上一期" : "上一年"}
                title={scope === "month" ? "上一個月，長按跳一年" : "上一年，長按跳五年"}
                className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)]"
                onStep={() => shiftPeriod(-1)}
                onHold={() => shiftPeriod(scope === "month" ? -12 : -5)}
              >
                ‹
              </HoldStepButton>
              <div className="min-w-0 text-center">
                <PeriodJump
                  year={year}
                  month={month}
                  scope={scope}
                  onChange={(nextYear, nextMonth) => {
                    const next = clampLedgerPeriod(nextYear, nextMonth, endYear);
                    setYear(next.year);
                    if (scope === "month") setMonth(next.month);
                  }}
                />
                {scope === "month" && !isCurrentMonth ? (
                  <button
                    type="button"
                    onClick={() => {
                      setYear(nowYear);
                      setMonth(nowMonth);
                    }}
                    className="text-[11px] text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    回到本月
                  </button>
                ) : null}
                {scope === "year" && !isCurrentYear ? (
                  <button
                    type="button"
                    onClick={() => setYear(nowYear)}
                    className="text-[11px] text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    回到今年
                  </button>
                ) : null}
                {laterCount > 0 ? (
                  <p className="text-[11px] text-[var(--muted)]">
                    不含今天之後先入帳的 {laterCount} 筆
                  </p>
                ) : null}
              </div>
              <HoldStepButton
                ariaLabel={scope === "month" ? "下一期" : "下一年"}
                title={scope === "month" ? "下一個月，長按跳一年" : "下一年，長按跳五年"}
                className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)]"
                onStep={() => shiftPeriod(1)}
                onHold={() => shiftPeriod(scope === "month" ? 12 : 5)}
              >
                ›
              </HoldStepButton>
            </div>
            )}
            <SimpleSummary
              summary={summary}
              currency={currency}
              heldMode={scope === "month" ? "period" : "outstanding"}
            />
          </section>

          {hasPreviousPeriod ? (
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
                  label="支出"
                  delta={comparison.expenseDelta}
                  percent={comparison.expensePercent}
                  previous={previousSummary.selfPay}
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
          ) : null}

          {topExpense ? (
            <button
              type="button"
              onClick={() => setDetail({ ...topExpense, kind: "expense" })}
              className="w-full rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface)] px-4 py-4 text-left transition active:bg-[var(--paper)]"
            >
              <p className="text-xs font-medium tracking-wide text-[var(--accent)]">
                {topExpenseTitle} · 點開看明細
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold text-[var(--ink)]">
                    {topExpense.name}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    占支出 {topExpense.percent.toFixed(1)}%
                  </p>
                  {topExpense.treatAmount ? (
                    <p className="mt-1 text-xs font-medium text-amber-800">
                      含請客 {formatMoney(topExpense.treatAmount, currency)}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-lg font-semibold tabular-nums text-rose-700">
                  {formatMoney(topExpense.amount, currency)}
                </p>
              </div>
            </button>
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
                    : scope === "year"
                      ? "此年度尚無收支資料"
                      : "尚無收支資料"
                }
              />
            </div>
          </section>

          {scope === "all" ? (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-[var(--ink)]">各年收支</h2>
              <ul className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                {[...historyYears].reverse().map((row) => (
                  <li key={row.year} className="border-t border-[var(--line)] first:border-t-0">
                    <button
                      type="button"
                      onClick={() => {
                        setYear(row.year);
                        setScope("year");
                      }}
                      aria-label={`查看 ${row.year} 年報表`}
                      className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left active:bg-[var(--paper)]"
                    >
                      <span className="w-14 shrink-0 text-sm font-medium tabular-nums text-[var(--ink)]">
                        {row.year}
                      </span>
                      <span className="min-w-0 flex-1 text-right text-sm tabular-nums text-rose-700">
                        {formatMoney(row.expense, currency)}
                      </span>
                      <span className="min-w-0 flex-1 text-right text-sm tabular-nums text-emerald-800">
                        {formatMoney(row.income, currency)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="px-1 text-[11px] text-[var(--muted)]">
                左紅是支出，右綠是收入。點一年可看該年的年報表。
              </p>
            </section>
          ) : null}

          {scope === "year" ? (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-[var(--ink)]">各月收支</h2>
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-2 py-3 sm:px-3">
                <YearBarChart months={monthlyTotals} currency={currency} />
                <div className="mt-3 grid grid-cols-6 gap-1.5 px-1">
                  {monthlyTotals.map((row) => (
                    <Link
                      key={row.month}
                      href={`/?y=${year}&m=${row.month}`}
                      className="flex min-h-10 items-center justify-center rounded-lg text-xs font-medium text-[var(--ink)] active:bg-[var(--paper)]"
                    >
                      {row.month}月
                    </Link>
                  ))}
                </div>
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
              onSelect={(item) => setDetail({ ...item, kind: pieKind })}
              emptyLabel={
                pieKind === "expense"
                  ? "此期間尚無支出分類資料"
                  : "此期間尚無收入分類資料"
              }
            />
          </section>

          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-[var(--ink)]">
                {rankingTitle}
              </h2>
              <p className="text-[11px] text-[var(--muted)]">點一下看明細</p>
            </div>
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
                      onClick={() => setDetail({ ...item, kind: pieKind })}
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
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-[var(--ink)]">
                              {item.name}
                            </span>
                            {item.treatAmount ? (
                              <span className="block truncate text-[10px] font-medium text-amber-800">
                                含請客 {formatMoney(item.treatAmount, currency)}
                              </span>
                            ) : null}
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
          kind={detail.kind}
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
  const current = previous + delta;
  const flat = Math.abs(delta) < 0.005;
  const up = delta > 0;
  const noCurrent = Math.abs(current) < 0.005;
  const noPrevious = previous <= 0;
  const good = positiveIsGood ? up : !up;
  const tone =
    noPrevious || noCurrent || flat
      ? "text-[var(--muted)]"
      : good
        ? "text-emerald-700"
        : "text-rose-700";
  const arrow = noPrevious || noCurrent || flat ? "－" : up ? "▲" : "▼";

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
        {noCurrent ? (
          "尚無本期資料"
        ) : noPrevious ? (
          "上期無資料"
        ) : (
          <span className="tabular-nums">
            {flat ? "持平" : `${up ? "+" : "-"}${Math.abs(percent).toFixed(1)}%`}
          </span>
        )}
      </p>
    </div>
  );
}
