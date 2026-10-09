import { formatMoney, type MoneyCurrency } from "@/lib/format";
import {
  periodBalance,
  periodSpend,
  reimbursedAmount,
} from "@/lib/summary-display";
import type { PeriodSummary } from "@/lib/types";

function AmountBlock({
  label,
  amount,
  currency,
  tone,
}: {
  label: string;
  amount: number;
  currency?: MoneyCurrency;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--paper)] px-2 py-2.5 sm:px-2.5">
      <p className="text-[11px] text-[var(--muted)]">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold tabular-nums sm:text-base ${tone}`}>
        {formatMoney(amount, currency)}
      </p>
    </div>
  );
}

/** Three equal totals. Holds and reimbursements sit under them, only when non-zero. */
export function SimpleSummary({
  summary,
  currency,
  heldMode = "period",
}: {
  summary: PeriodSummary;
  currency?: MoneyCurrency;
  /** Year/all reports show money still locked; a month keeps every hold dated in it. */
  heldMode?: "period" | "outstanding";
}) {
  const spend = periodSpend(summary);
  const balance = periodBalance(summary);
  const reimbursed = reimbursedAmount(summary);
  const pending = summary.reimbursablePending;
  const kept = Math.max(0, summary.selfPay - pending);
  const heldShown =
    heldMode === "outstanding" ? summary.heldOutstanding : summary.held;
  const showSplit = pending > 0 || heldShown > 0;
  const notes: Array<{ key: string; text: string; tone: string }> = [];
  if (reimbursed > 0) {
    notes.push({
      key: "reimbursed",
      text: `已銷帳 ${formatMoney(reimbursed, currency)} 已從支出扣掉`,
      tone: "text-[var(--muted)]",
    });
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <AmountBlock
          label="支出"
          amount={spend}
          currency={currency}
          tone="text-rose-700"
        />
        <AmountBlock
          label="收入"
          amount={summary.income}
          currency={currency}
          tone="text-emerald-800"
        />
        <AmountBlock
          label="結餘"
          amount={balance}
          currency={currency}
          tone="text-[var(--ink)]"
        />
      </div>
      {showSplit ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-[var(--line)] pt-2">
          <p className="text-[11px] text-[var(--muted)]">
            自付
            <span className="mt-0.5 block font-medium tabular-nums text-[var(--ink)]">
              {formatMoney(kept, currency)}
            </span>
          </p>
          <p className="text-[11px] text-sky-900/80">
            待核銷
            <span className="mt-0.5 block font-medium tabular-nums">
              {formatMoney(pending, currency)}
            </span>
          </p>
          <p className="text-[11px] text-amber-900/80">
            {heldMode === "outstanding" ? "仍扣住" : "扣住"}
            <span className="mt-0.5 block font-medium tabular-nums">
              {formatMoney(heldShown, currency)}
            </span>
          </p>
        </div>
      ) : null}
      {notes.length > 0 ? (
        <ul className="mt-2 space-y-0.5 border-t border-[var(--line)] pt-2">
          {notes.map((note) => (
            <li key={note.key} className={`text-[11px] tabular-nums ${note.tone}`}>
              {note.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
