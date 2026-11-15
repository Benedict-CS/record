"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBook } from "@/components/BookProvider";
import { useToast } from "@/components/ToastProvider";
import { formatMoney, todayLocal } from "@/lib/format";
import { useRecurringRules } from "@/lib/hooks/useLedgerData";
import { nextUpcomingCharge, upcomingChargeLabel } from "@/lib/recurring";
import { postDueRecurring } from "@/lib/db/recurring-post";
import { runSync } from "@/lib/sync/engine";
import type { RecurringRule } from "@/lib/types";

export function UpcomingRecurring() {
  const { book, bookId } = useBook();
  const rules = useRecurringRules();
  const { show } = useToast();
  const today = todayLocal();
  const currency = book?.currency;
  const [postingId, setPostingId] = useState<string | null>(null);

  const upcoming = useMemo(() => {
    return rules
      .map((rule) => {
        const next = nextUpcomingCharge({
          startMonth: rule.start_month,
          endMonth: rule.end_month,
          dayOfMonth: rule.day_of_month,
          lastPosted: rule.last_posted,
          today,
        });
        if (!next) return null;
        return { rule, next };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      // Only show when the charge date has actually arrived (today or overdue).
      .filter(({ next }) => next.daysUntil <= 0)
      .sort((a, b) => a.next.daysUntil - b.next.daysUntil)
      .slice(0, 4);
  }, [rules, today]);

  // Auto-post due items when detected
  useEffect(() => {
    if (!bookId || upcoming.length === 0) return;
    let cancelled = false;
    void postDueRecurring(bookId, today).then((count) => {
      if (!cancelled && count > 0) void runSync();
    });
    return () => {
      cancelled = true;
    };
  }, [bookId, today, upcoming.length]);

  const handlePostNow = useCallback(
    async (event: React.MouseEvent, rule: RecurringRule) => {
      event.preventDefault();
      event.stopPropagation();
      if (!bookId || postingId) return;
      setPostingId(rule.id);
      try {
        const count = await postDueRecurring(bookId, today, rule.id);
        void runSync();
        if (count > 0) {
          show(`已入帳 ${rule.name}`, { variant: "success" });
        } else {
          show(`${rule.name} 本期已入帳過`, { variant: "success" });
        }
      } catch (err) {
        show(err instanceof Error ? err.message : "入帳失敗", {
          variant: "error",
        });
      } finally {
        setPostingId(null);
      }
    },
    [bookId, today, postingId, show],
  );

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <p className="text-xs font-semibold text-[var(--ink)]">今日固定扣款</p>
        </div>
        <Link
          href="/recurring"
          className="min-h-9 inline-flex items-center text-[11px] font-medium text-[var(--accent)] hover:underline active:scale-95"
        >
          每月固定 ›
        </Link>
      </div>
      <ul className="mt-2 space-y-2">
        {upcoming.map(({ rule, next }) => (
          <li
            key={rule.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="truncate font-medium text-[var(--ink)]">
                  {rule.name}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--muted)]">
                  {formatMoney(rule.amount, currency)}
                </span>
              </div>
              {rule.last_error ? (
                <p className="mt-0.5 text-[11px] text-rose-600 dark:text-rose-400 truncate">
                  ⚠️ {rule.last_error}
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  {upcomingChargeLabel(next.daysUntil)}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={postingId === rule.id}
              onClick={(e) => void handlePostNow(e, rule)}
              className="shrink-0 min-h-9 min-w-[76px] rounded-xl bg-[var(--accent)] px-3 py-1.5 text-center text-xs font-medium text-white shadow-xs hover:opacity-90 active:scale-95 disabled:opacity-60"
            >
              {postingId === rule.id ? "入帳中…" : rule.last_error ? "重試" : "立即入帳"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
