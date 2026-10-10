"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useBook } from "@/components/BookProvider";
import { formatMoney, todayLocal } from "@/lib/format";
import { useRecurringRules } from "@/lib/hooks/useLedgerData";
import { nextUpcomingCharge, upcomingChargeLabel } from "@/lib/recurring";

export function UpcomingRecurring() {
  const { book } = useBook();
  const rules = useRecurringRules();
  const today = todayLocal();
  const currency = book?.currency;

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
      .sort((a, b) => a.next.daysUntil - b.next.daysUntil)
      .slice(0, 4);
  }, [rules, today]);

  if (upcoming.length === 0) return null;

  return (
    <Link
      href="/recurring"
      className="block rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-[var(--ink)]">即將入帳</p>
        <p className="text-[11px] text-[var(--accent)]">每月固定 ›</p>
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {upcoming.map(({ rule, next }) => (
          <li
            key={rule.id}
            className="flex items-baseline justify-between gap-2 text-[11px]"
          >
            <span className="min-w-0 truncate text-[var(--muted)]">
              {rule.name}
              <span className="tabular-nums">
                {" · "}
                {formatMoney(rule.amount, currency)}
              </span>
            </span>
            <span
              className={[
                "shrink-0 tabular-nums",
                next.daysUntil <= 0
                  ? "font-medium text-amber-800"
                  : "text-[var(--ink)]",
              ].join(" ")}
            >
              {upcomingChargeLabel(next.daysUntil)}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
