"use client";

import { useEffect } from "react";
import { useBook } from "@/components/BookProvider";
import { HoldStepButton } from "@/components/HoldStepButton";
import { PeriodJump } from "@/components/PeriodJump";
import { SimpleSummary } from "@/components/SimpleSummary";
import { YearSpendCard } from "@/components/YearSpendCard";
import { monthSummary } from "@/lib/db/crud";
import { shiftYearMonth } from "@/lib/format";
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
  const summary = monthSummary(transactions);
  const currency = book?.currency;

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
      <div className="mt-2 border-t border-[var(--line)] pt-2">
        <YearSpendCard year={year} />
      </div>
    </section>
  );
}
