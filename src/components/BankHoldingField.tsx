"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { isSpendableBankHolding } from "@/lib/holding-spend";
import type { Holding } from "@/lib/types";

export function BankHoldingField({
  holdings,
  value,
  onChange,
  currency,
  purpose,
}: {
  holdings: Holding[];
  value: string;
  onChange: (id: string) => void;
  currency?: string;
  purpose: "expense" | "income";
}) {
  const options = holdings.filter(
    (holding) => isSpendableBankHolding(holding.kind) || holding.id === value,
  );

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--muted)]">
        {purpose === "income" ? "入到哪張銀行" : "從哪張銀行扣"}
      </span>
      {options.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] px-3 py-3 text-xs leading-relaxed text-[var(--muted)]">
          還沒有活存或定存。
          <Link
            href="/holdings"
            className="ml-1 text-[var(--accent)] underline-offset-2 hover:underline"
          >
            到存款新增
          </Link>
          （例如台新、郵局、永豐、國泰）。
        </p>
      ) : (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="">請選擇</option>
          {options.map((holding) => {
            const bank = holding.institution.trim();
            const label = bank ? `${holding.name} · ${bank}` : holding.name;
            return (
              <option key={holding.id} value={holding.id}>
                {label}（{formatMoney(holding.amount, currency)}）
              </option>
            );
          })}
        </select>
      )}
      <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
        {purpose === "income"
          ? "選了之後，儲存會把這筆收入加進這張存款。沒選、或帳戶是現金，都不會改動存款。"
          : "選了之後，儲存會從這筆存款扣掉實付金額。沒選、或帳戶是現金，都不會改動存款。"}
      </p>
    </label>
  );
}
