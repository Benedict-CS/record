"use client";

import { useState, type FormEvent } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import type { Account } from "@/lib/types";

const TYPE_OPTIONS: { value: Account["type"]; label: string; hint: string }[] =
  [
    { value: "cash", label: "現金", hint: "錢包、零錢" },
    { value: "bank", label: "銀行", hint: "活存、轉帳" },
    { value: "credit", label: "信用卡", hint: "刷卡、欠款" },
    { value: "other", label: "其他", hint: "電子錢包等" },
  ];

export type AccountFormValues = {
  name: string;
  type: Account["type"];
  opening_balance: number;
};

/** Empty input counts as 0; unparseable values fall back to 0. */
function parseAmount(input: string) {
  const value = Number(input.trim());
  return Number.isFinite(value) ? value : 0;
}

export function AccountFormSheet({
  open,
  account,
  onClose,
  onSubmit,
}: {
  open: boolean;
  account: Account | null;
  onClose: () => void;
  onSubmit: (values: AccountFormValues) => Promise<void>;
}) {
  // Caller remounts with a key on open, so these initials reset per open.
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<Account["type"]>(account?.type ?? "cash");
  const [opening, setOpening] = useState(
    account ? String(account.opening_balance ?? 0) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("請輸入帳戶名稱");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: trimmed,
        type,
        opening_balance: parseAmount(opening),
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
      title={account ? "編輯帳戶" : "新增帳戶"}
      description="名稱與類型之後都能改"
      footer={
        <button
          type="submit"
          form="account-form"
          disabled={saving}
          className="min-h-12 w-full rounded-xl bg-[var(--ink)] px-4 text-sm font-medium text-[var(--paper)] disabled:opacity-60"
        >
          {saving ? "儲存中…" : account ? "儲存" : "新增帳戶"}
        </button>
      }
    >
      <form id="account-form" onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs text-[var(--muted)]">
            帳戶名稱
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：玉山銀行"
            data-autofocus
            className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>

        <fieldset>
          <legend className="mb-1.5 text-xs text-[var(--muted)]">類型</legend>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map((item) => {
              const selected = type === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setType(item.value)}
                  aria-pressed={selected}
                  className={[
                    "min-h-14 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    selected
                      ? "border-[var(--accent)] bg-[rgba(15,122,95,0.08)]"
                      : "border-[var(--line)] bg-[var(--paper)]",
                  ].join(" ")}
                >
                  <span className="block text-sm font-medium text-[var(--ink)]">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                    {item.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-xs text-[var(--muted)]">
            期初餘額（可之後再改）
          </span>
          <input
            value={opening}
            onChange={(event) => setOpening(event.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3.5 py-2.5 text-sm tabular-nums outline-none focus:border-[var(--accent)]"
          />
          <span className="mt-1.5 block text-[11px] leading-relaxed text-[var(--muted)]">
            開始記帳前就有的金額；信用卡欠款可填負數。
          </span>
        </label>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </form>
    </BottomSheet>
  );
}
