"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { useBook } from "@/components/BookProvider";
import { COMPOUNDING_OPTIONS, HOLDING_KINDS } from "@/lib/holding-kinds";
import { formatMoney, todayLocal } from "@/lib/format";
import { monthlyInterest, yearlyInterest } from "@/lib/interest";
import type { Holding, HoldingKind, InterestCompounding } from "@/lib/types";

export type HoldingFormValues = {
  name: string;
  kind: HoldingKind;
  institution: string;
  amount: number;
  annual_rate: number;
  compounding: InterestCompounding;
  start_date: string;
  maturity_date: string | null;
  note: string;
};

export function HoldingFormSheet({
  open,
  holding,
  onClose,
  onSubmit,
}: {
  open: boolean;
  holding: Holding | null;
  onClose: () => void;
  onSubmit: (values: HoldingFormValues) => Promise<void>;
}) {
  const { book } = useBook();
  const currency = book?.currency ?? "TWD";
  const [name, setName] = useState("");
  const [kind, setKind] = useState<HoldingKind>("savings");
  const [institution, setInstitution] = useState("");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [compounding, setCompounding] = useState<InterestCompounding>("none");
  const [startDate, setStartDate] = useState(todayLocal());
  const [maturity, setMaturity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsedAmount = Number(amount || 0);
  const parsedRate = Number(rate || 0);
  const previewCompounding =
    parsedRate > 0 && compounding === "none" ? "simple" : compounding;
  const previewMonthly =
    Number.isFinite(parsedAmount) && Number.isFinite(parsedRate)
      ? monthlyInterest(parsedAmount, parsedRate)
      : 0;
  const previewYearly =
    Number.isFinite(parsedAmount) && Number.isFinite(parsedRate)
      ? yearlyInterest(parsedAmount, parsedRate, previewCompounding)
      : 0;

  useEffect(() => {
    if (!open) return;
    setName(holding?.name ?? "");
    setKind(holding?.kind ?? "savings");
    setInstitution(holding?.institution ?? "");
    setAmount(holding ? String(holding.amount) : "");
    setRate(holding ? String(holding.annual_rate) : "");
    setCompounding(holding?.compounding ?? "none");
    setStartDate(holding?.start_date ?? todayLocal());
    setMaturity(holding?.maturity_date ?? "");
    setNote(holding?.note ?? "");
    setError(null);
  }, [open, holding]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("請輸入名稱");
      return;
    }
    const parsedAmount = Number(amount || 0);
    const parsedRate = Number(rate || 0);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError("金額無效");
      return;
    }
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      setError("年利率無效");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: trimmed,
        kind,
        institution: institution.trim(),
        amount: parsedAmount,
        annual_rate: parsedRate,
        compounding: parsedRate > 0 && compounding === "none" ? "simple" : compounding,
        start_date: startDate,
        maturity_date: maturity.trim() ? maturity : null,
        note: note.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={holding ? "編輯存款" : "新增存款"}
    >
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">名稱</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：玉山定存、ShopeePay"
            className="min-h-12 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-base outline-none focus:border-[var(--accent)]"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-xs text-[var(--muted)]">種類</span>
          <div className="flex flex-wrap gap-1.5">
            {HOLDING_KINDS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setKind(item.id)}
                className={[
                  "min-h-10 rounded-full px-3 text-xs",
                  kind === item.id
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--paper)] text-[var(--muted)]",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">
            銀行／平台
          </span>
          <input
            value={institution}
            onChange={(event) => setInstitution(event.target.value)}
            placeholder="例如：中華郵政、Touch n Go"
            className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">金額</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">
              年利率 %
            </span>
            <input
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--accent)]"
            />
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-xs text-[var(--muted)]">計息方式</span>
          <div className="grid grid-cols-4 gap-1.5">
            {COMPOUNDING_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCompounding(item.id)}
                className={[
                  "min-h-10 rounded-xl px-1 text-[11px]",
                  compounding === item.id
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "bg-[var(--paper)] text-[var(--muted)]",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">起息日</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">
              到期日（可空）
            </span>
            <input
              type="date"
              value={maturity}
              onChange={(event) => setMaturity(event.target.value)}
              className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
        </div>

        {previewMonthly > 0 ? (
          <p className="rounded-xl bg-[var(--paper)] px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
            預估月利息{" "}
            <span className="tabular-nums text-[var(--ink)]">
              {formatMoney(previewMonthly, currency)}
            </span>
            ，年利息{" "}
            <span className="tabular-nums text-[var(--ink)]">
              {formatMoney(previewYearly, currency)}
            </span>
            。記入帳本時只會新增收入，不會改本金。
          </p>
        ) : null}

        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">備註</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="可選"
            className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="min-h-12 w-full rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-[var(--paper)] disabled:opacity-60"
        >
          {saving ? "儲存中…" : holding ? "更新" : "新增"}
        </button>
      </form>
    </BottomSheet>
  );
}