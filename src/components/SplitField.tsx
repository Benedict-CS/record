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

function emptyDraft(): DraftRow {
  return { id: allocDraftId(), name: "", amount: "" };
}

function emitSplits(rows: DraftRow[]): SplitShare[] | null {
  return parseSplits(
    rows.map((row) => ({
      name: normalizeSplitName(row.name),
      amount: Number(row.amount),
    })),
  );
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
      setDrafts([emptyDraft()]);
    }
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
        <div className="mt-2 space-y-2">
          {drafts.map((row, index) => (
            <div key={row.id} className="flex items-center gap-2">
              <input
                value={row.name}
                onChange={(event) => {
                  const next = drafts.slice();
                  next[index] = { ...row, name: event.target.value };
                  commit(next);
                }}
                placeholder="名字"
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
                className="min-h-11 w-[6.5rem] shrink-0 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm tabular-nums text-[var(--ink)] outline-none focus:border-[var(--accent)]"
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

          <button
            type="button"
            disabled={drafts.length >= SPLIT_MAX_PEOPLE}
            onClick={() => {
              if (drafts.length >= SPLIT_MAX_PEOPLE) return;
              setDrafts([...drafts, emptyDraft()]);
            }}
            className="min-h-11 w-full rounded-xl border border-dashed border-[var(--line)] bg-[var(--paper)] px-3 text-sm text-[var(--accent)] disabled:opacity-40"
          >
            加一個人
          </button>

          <p className="text-sm text-[var(--muted)]">
            自己{" "}
            <span className="tabular-nums text-[var(--ink)]">
              {formatMoney(selfPay, currency)}
            </span>
          </p>

          {overBill ? (
            <p className="text-sm text-rose-600">別人的份額加起來超過這筆金額</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
