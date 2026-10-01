"use client";

import { useEffect } from "react";
import { useBook } from "@/components/BookProvider";
import { SimpleSummary } from "@/components/SimpleSummary";
import { monthSummary } from "@/lib/db/crud";
import type { Transaction } from "@/lib/types";

export function MonthSummary({
  year,
  month,
  transactions,
  onPrev,
  onNext,
  onGoCurrent,
}: {
  year: number;
  month: number;
  transactions: Transaction[];
  onPrev: () => void;
  onNext: () => void;
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
        onPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onPrev, onNext]);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 sm:px-4 sm:py-4">
      <div className="mb-2.5 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label="上一個月"
          title="← 上一個月"
          className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)] active:scale-[0.98]"
        >
          ‹
        </button>
        <div className="min-w-0 text-center">
          <p className="text-sm font-semibold tracking-wide tabular-nums text-[var(--ink)]">
            {year} 年 {month} 月
          </p>
          {onGoCurrent ? (
            <button
              type="button"
              onClick={onGoCurrent}
              className="mt-0.5 text-[11px] text-[var(--accent)] underline-offset-2 hover:underline"
            >
              回到本月
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onNext}
          aria-label="下一個月"
          title="→ 下一個月"
          className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-lg text-[var(--ink)] active:scale-[0.98]"
        >
          ›
        </button>
      </div>

      <SimpleSummary summary={summary} currency={currency} />
    </section>
  );
}
