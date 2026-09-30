import { formatMoney, type MoneyCurrency } from "@/lib/format";
import {
  periodBalance,
  periodSpend,
  reimbursedAmount,
} from "@/lib/summary-display";
import type { PeriodSummary } from "@/lib/types";

/** One equation: 結餘 = 收入 − 支出. Extra lines appear only when they change the meaning. */
export function SimpleSummary({
  summary,
  currency,
}: {
  summary: PeriodSummary;
  currency?: MoneyCurrency;
}) {
  const spend = periodSpend(summary);
  const balance = periodBalance(summary);
  const reimbursed = reimbursedAmount(summary);
  const notes: string[] = [];
  if (summary.held > 0) {
    notes.push(`押金 ${formatMoney(summary.held, currency)} 不算支出`);
  }
  if (reimbursed > 0) {
    notes.push(`已銷帳 ${formatMoney(reimbursed, currency)} 已從支出扣掉`);
  }
  if (summary.reimbursablePending > 0) {
    notes.push(
      `待報銷 ${formatMoney(summary.reimbursablePending, currency)} 還算在支出裡`,
    );
  }

  return (
    <div>
      <p className="text-[11px] text-[var(--muted)]">結餘</p>
      <p className="mt-0.5 truncate text-2xl font-semibold tabular-nums text-[var(--ink)]">
        {formatMoney(balance, currency)}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        收入{" "}
        <span className="font-medium tabular-nums text-[var(--ink)]">
          {formatMoney(summary.income, currency)}
        </span>
        {" − "}
        支出{" "}
        <span className="font-medium tabular-nums text-rose-700">
          {formatMoney(spend, currency)}
        </span>
      </p>
      {notes.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-[11px] text-[var(--muted)]">
          {notes.map((note) => (
            <li key={note} className="tabular-nums">
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
