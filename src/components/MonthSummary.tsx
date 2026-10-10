"use client";

import { useEffect, useMemo } from "react";
import { useBook } from "@/components/BookProvider";
import { HoldStepButton } from "@/components/HoldStepButton";
import { PeriodJump } from "@/components/PeriodJump";
import { SimpleSummary } from "@/components/SimpleSummary";
import { YearSpendCard } from "@/components/YearSpendCard";
import { compareSummaries, monthSummary } from "@/lib/db/crud";
import { formatMoney, shiftYearMonth, throughToday, todayLocal } from "@/lib/format";
import { useMonthTransactions } from "@/lib/hooks/useLedgerData";
import type { Transaction } from "@/lib/types";

export function MonthSummary({
  year,
  month,
  transactions,
  onPrev,
  onNext,
  onJump,
  onGoCurrent,
}: {
  year: number;
  month: number;
  transactions: Transaction[];
  onPrev: () => void;
  onNext: () => void;
  onJump: (year: number, month: number) => void;
  onGoCurrent?: () => void;
}) {
  const { book } = useBook();
  const today = todayLocal();
  const isCurrentMonth =
    year === Number(today.slice(0, 4)) && month === Number(today.slice(5, 7));
  const counted = useMemo(
    () => (isCurrentMonth ? throughToday(transactions, today) : transactions),
    [isCurrentMonth, transactions, today],
  );
  const summary = useMemo(() => monthSummary(counted), [counted]);
  const previous = shiftYearMonth(year, month, -1);
  const previousTransactions = useMonthTransactions(
    previous.year,
    previous.month,
  );
  const previousCounted = useMemo(() => {
    if (!isCurrentMonth) return previousTransactions;
    const cutoff = `${previous.year}-${String(previous.month).padStart(2, "0")}-${today.slice(8, 10)}`;
    return previousTransactions.filter((row) => row.date <= cutoff);
  }, [isCurrentMonth, previous.month, previous.year, previousTransactions, today]);
  const comparison = useMemo(
    () => compareSummaries(summary, monthSummary(previousCounted)),
    [previousCounted, summary],
  );
  const currency = book?.currency;
  const spendDelta = comparison.expenseDelta;
  const showDelta =
    summary.selfPay > 0 || monthSummary(previousCounted).selfPay > 0;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (event.shiftKey) {
          const next = shiftYearMonth(year, month, -12);
          onJump(next.year, next.month);
        } else {
          onPrev();
        }
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (event.shiftKey) {
          const next = shiftYearMonth(year, month, 12);
          onJump(next.year, next.month);
        } else {
          onNext();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onPrev, onNext, onJump, year, month]);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 sm:px-4 sm:py-4">
      <div className="mb-2.5 flex items-center justify-between gap-1">
        <HoldStepButton
          ariaLabel="上一個月"
          title="上一個月，長按或 Shift+← 跳一年"
          className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)] active:scale-[0.98]"
          onStep={onPrev}
          onHold={() => {
            const next = shiftYearMonth(year, month, -12);
            onJump(next.year, next.month);
          }}
        >
          ‹
        </HoldStepButton>
        <div className="flex min-w-0 flex-col items-center">
          <PeriodJump year={year} month={month} onChange={onJump} />
          {onGoCurrent ? (
            <button
              type="button"
              onClick={onGoCurrent}
              className="text-[11px] text-[var(--accent)] underline-offset-2 hover:underline"
            >
              回到本月
            </button>
          ) : null}
        </div>
        <HoldStepButton
          ariaLabel="下一個月"
          title="下一個月，長按或 Shift+→ 跳一年"
          className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)] active:scale-[0.98]"
          onStep={onNext}
          onHold={() => {
            const next = shiftYearMonth(year, month, 12);
            onJump(next.year, next.month);
          }}
        >
          ›
        </HoldStepButton>
      </div>

      <SimpleSummary summary={summary} currency={currency} />
      {showDelta ? (
        <p className="mt-2 text-[11px] tabular-nums text-[var(--muted)]">
          {Math.abs(spendDelta) < 0.005
            ? isCurrentMonth
              ? "支出和上月同一天一樣"
              : "支出和上月一樣"
            : `${isCurrentMonth ? "支出比上月同期" : "支出比上月"}${
                spendDelta > 0 ? "多" : "少"
              } ${formatMoney(Math.abs(spendDelta), currency)}`}
        </p>
      ) : null}
      <div className="mt-2 border-t border-[var(--line)] pt-2">
        <YearSpendCard year={year} />
      </div>
    </section>
  );
}
