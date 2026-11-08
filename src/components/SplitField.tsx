"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import {
  normalizeSplitName,
  parseSplits,
  SPLIT_MAX_PEOPLE,
  SPLIT_NAME_MAX,
  splitSelfPay,
  splitsOverAmount,
} from "@/lib/split";
import type { SplitShare } from "@/lib/types";

type DraftRow = {
  id: number;
  name: string;
  amount: string;
};

let nextDraftId = 0;

function allocDraftId() {
  nextDraftId += 1;
  return nextDraftId;
}

function draftsFromValue(value: SplitShare[] | null): DraftRow[] {
  if (!value?.length) return [];
  return value.map((row) => ({
    id: allocDraftId(),
    name: row.name,
    amount: String(row.amount),
  }));
}

function emptyDraft(index?: number): DraftRow {
  return {
    id: allocDraftId(),
    name: index ? `朋友 ${index}` : "",
    amount: "",
  };
}

function emitSplits(rows: DraftRow[]): SplitShare[] | null {
  return parseSplits(
    rows.map((row) => ({
      name: normalizeSplitName(row.name),
      amount: Number(row.amount),
    })),
  );
}

function calculateShare(bill: number, people: number, currency?: string): number {
  if (bill <= 0 || people <= 0) return 0;
  const isZeroDecimal = currency === "TWD" || !currency;
  if (isZeroDecimal && Number.isInteger(bill)) {
    return Math.floor(bill / people);
  }
  return Math.floor((bill / people) * 100) / 100;
}

export function SplitField({
  amount,
  currency,
  value,
  onChange,
}: {
  amount: number | null;
  currency?: string;
  value: SplitShare[] | null;
  onChange: (next: SplitShare[] | null) => void;
}) {
  const [enabled, setEnabled] = useState(() => Boolean(value?.length));
  const [drafts, setDrafts] = useState<DraftRow[]>(() => draftsFromValue(value));

  const bill = amount || 0;
  const selfPay = splitSelfPay(bill, value);
  const overBill = splitsOverAmount(bill, value);

  function commit(next: DraftRow[]) {
    setDrafts(next);
    onChange(emitSplits(next));
  }

  function toggle(checked: boolean) {
    setEnabled(checked);
    if (!checked) {
      setDrafts([]);
      onChange(null);
      return;
    }
    if (drafts.length === 0) {
      setDrafts([emptyDraft(1)]);
    }
  }

  function applyEvenSplit(totalPeople: number) {
    if (totalPeople < 2) return;
    const othersCount = Math.min(totalPeople - 1, SPLIT_MAX_PEOPLE);
    const each = calculateShare(bill, totalPeople, currency);

    const next: DraftRow[] = [];
    for (let i = 0; i < othersCount; i++) {
      const existing = drafts[i];
      next.push({
        id: existing ? existing.id : allocDraftId(),
        name: existing?.name?.trim() ? existing.name : `朋友 ${i + 1}`,
        amount: bill > 0 ? String(each) : "",
      });
    }
    commit(next);
  }

  return (
    <div>
      <label className="flex min-h-11 items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => toggle(event.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        <span className="text-sm text-[var(--ink)]">這筆要分帳</span>
      </label>

      {enabled ? (
        <div className="mt-2 space-y-2.5">
          {/* Quick even split toolbar */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>快速平分（含自己）</span>
              {drafts.length > 0 && bill > 0 ? (
                <button
                  type="button"
                  onClick={() => applyEvenSplit(drafts.length + 1)}
                  className="font-medium text-[var(--accent)] hover:underline"
                >
                  依現有人數（{drafts.length + 1} 人）平分
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[2, 3, 4, 5].map((count) => {
                const share = calculateShare(bill, count, currency);
                const isActive =
                  drafts.length + 1 === count &&
                  !overBill &&
                  drafts.length > 0 &&
                  drafts.every((d) => d.amount === String(share));
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => applyEvenSplit(count)}
                    className={[
                      "min-h-11 rounded-xl border px-1.5 py-1 text-center transition-colors active:scale-95",
                      isActive
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--accent)]",
                    ].join(" ")}
                  >
                    <div className="text-xs font-semibold">{count} 人</div>
                    <div className="text-[10px] tabular-nums text-[var(--muted)] truncate">
                      {bill > 0 ? `${formatMoney(share, currency)}/人` : "平分"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Individual friends rows */}
          <div className="space-y-1.5">
            {drafts.map((row, index) => (
              <div key={row.id} className="flex items-center gap-2">
                <input
                  value={row.name}
                  onChange={(event) => {
                    const next = drafts.slice();
                    next[index] = { ...row, name: event.target.value };
                    commit(next);
                  }}
                  placeholder={`朋友 ${index + 1}`}
                  aria-label="分帳名字"
                  maxLength={SPLIT_NAME_MAX}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={row.amount}
                  onChange={(event) => {
                    const next = drafts.slice();
                    next[index] = { ...row, amount: event.target.value };
                    commit(next);
                  }}
                  placeholder="金額"
                  aria-label="分帳金額"
                  className="min-h-11 w-28 shrink-0 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm tabular-nums text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => commit(drafts.filter((item) => item.id !== row.id))}
                  className="min-h-11 shrink-0 rounded-xl px-2 text-xs text-[var(--muted)] hover:text-rose-600"
                  aria-label={row.name.trim() ? `刪除 ${row.name}` : "刪除這個人"}
                >
                  刪除
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={drafts.length >= SPLIT_MAX_PEOPLE}
            onClick={() => {
              if (drafts.length >= SPLIT_MAX_PEOPLE) return;
              setDrafts([...drafts, emptyDraft(drafts.length + 1)]);
            }}
            className="min-h-11 w-full rounded-xl border border-dashed border-[var(--line)] bg-[var(--paper)] px-3 text-sm text-[var(--accent)] disabled:opacity-40"
          >
            + 加一個人
          </button>

          <div className="flex items-center justify-between rounded-xl bg-[var(--surface)] px-3 py-2 text-sm">
            <span className="text-[var(--muted)]">自己應付（扣除他人後）</span>
            <span className="font-semibold tabular-nums text-[var(--ink)]">
              {formatMoney(selfPay, currency)}
            </span>
          </div>

          {overBill ? (
            <p className="text-xs text-rose-600">別人的份額加起來超過這筆總金額</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
