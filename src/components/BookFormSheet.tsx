"use client";

import { useState, type FormEvent } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { currencyLabel } from "@/lib/format";
import type { Book, BookCurrency } from "@/lib/types";

const CURRENCY_OPTIONS: { value: BookCurrency; label: string }[] = [
  { value: "TWD", label: "新台幣 TWD" },
  { value: "MYR", label: "馬幣 MYR" },
];

export type BookFormValues = {
  name: string;
  currency?: BookCurrency;
};

export function BookFormSheet({
  open,
  book,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Null = create; non-null = rename (currency stays locked). */
  book: Book | null;
  onClose: () => void;
  onSubmit: (values: BookFormValues) => Promise<void>;
}) {
  const isEdit = Boolean(book);
  // Caller remounts with a key on open, so these initials reset per open.
  const [name, setName] = useState(book?.name ?? "");
  const [currency, setCurrency] = useState<BookCurrency>(book?.currency ?? "TWD");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("請輸入帳本名稱");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await onSubmit({ name: trimmed });
      } else {
        await onSubmit({ name: trimmed, currency });
      }
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
      title={isEdit ? "重新命名帳本" : "新增帳本"}
    >
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">
            帳本名稱
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：旅遊帳本"
            data-autofocus
            className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>

        {isEdit ? (
          <p className="rounded-xl bg-[var(--paper)] px-3 py-2 text-xs text-[var(--muted)]">
            幣別：{currencyLabel(book!.currency)}（建立後無法更改）
          </p>
        ) : (
          <>
            <div>
              <span className="mb-1.5 block text-xs text-[var(--muted)]">
                幣別
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CURRENCY_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCurrency(item.value)}
                    className={[
                      "min-h-11 rounded-full px-3 text-xs",
                      currency === item.value
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--paper)] text-[var(--muted)]",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              幣別建立後就固定下來，新帳本會自動變成目前使用的帳本。
            </p>
          </>
        )}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="min-h-12 w-full rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-[var(--paper)] disabled:opacity-60"
        >
          {saving ? "儲存中…" : isEdit ? "儲存" : "建立帳本"}
        </button>
      </form>
    </BottomSheet>
  );
}
