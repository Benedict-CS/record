import { formatMoney, type MoneyCurrency } from "@/lib/format";
import {
  periodBalance,
  periodSpend,
  reimbursedAmount,
} from "@/lib/summary-display";
import type { PeriodSummary } from "@/lib/types";

/** Modern hero summary card highlighting monthly net savings / balance, with income/expense below. */
export function SimpleSummary({
  summary,
  currency,
  heldMode = "period",
  periodLabel = "本月",
}: {
  summary: PeriodSummary;
  currency?: MoneyCurrency;
  /** Year/all reports show money still locked; a month keeps every hold dated in it. */
  heldMode?: "period" | "outstanding";
  periodLabel?: string;
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

  const isPositive = balance >= 0;
  const balanceLabel = isPositive
    ? `${periodLabel}存下（結餘）`
    : `${periodLabel}透支（結餘）`;

  return (
    <div>
      <div className="mt-1 min-w-0">
        <p className="text-xs font-medium text-[var(--muted)]">
          {balanceLabel}
        </p>
        <p
          className={`mt-0.5 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl ${
            balance > 0.005
              ? "text-emerald-700"
              : balance < -0.005
                ? "text-rose-700"
                : "text-[var(--ink)]"
          }`}
        >
          {balance > 0.005
            ? `+${formatMoney(balance, currency)}`
            : formatMoney(balance, currency)}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-3">
        <div className="flex items-center gap-2 rounded-xl bg-[var(--paper)] px-3 py-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-[11px] text-[var(--muted)]">{periodLabel}收入</p>
            <p className="truncate text-sm font-semibold tabular-nums text-emerald-800">
              {formatMoney(summary.income, currency)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[var(--paper)] px-3 py-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-rose-500"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-[11px] text-[var(--muted)]">{periodLabel}支出</p>
            <p className="truncate text-sm font-semibold tabular-nums text-rose-700">
              {formatMoney(spend, currency)}
            </p>
          </div>
        </div>
      </div>

      {showSplit ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--line)]/60 px-1 pt-2 text-[11px] text-[var(--muted)]">
          <span>
            實付自付：
            <strong className="font-semibold tabular-nums text-[var(--ink)]">
              {formatMoney(kept, currency)}
            </strong>
          </span>
          {pending > 0 ? (
            <span className="text-sky-900/90">
              待核銷：
              <strong className="font-semibold tabular-nums">
                {formatMoney(pending, currency)}
              </strong>
            </span>
          ) : null}
          {heldShown > 0 ? (
            <span className="text-amber-900/90">
              {heldMode === "outstanding" ? "仍扣住：" : "扣住："}
              <strong className="font-semibold tabular-nums">
                {formatMoney(heldShown, currency)}
              </strong>
            </span>
          ) : null}
        </div>
      ) : null}
      {notes.length > 0 ? (
        <ul className="mt-2 space-y-0.5 border-t border-[var(--line)]/60 px-1 pt-2">
          {notes.map((note) => (
            <li
              key={note.key}
              className={`text-[11px] tabular-nums ${note.tone}`}
            >
              {note.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
