"use client";

import { useState } from "react";
import { useBook } from "@/components/BookProvider";
import { BookPickerSheet } from "@/components/BookPickerSheet";
import { currencyLabel } from "@/lib/format";

export function BookSwitcher() {
  const { books, book } = useBook();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (books.length === 0) return null;

  const label = book
    ? `${book.name} · ${currencyLabel(book.currency)}`
    : "選擇帳本";

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        aria-label="切換帳本"
        className="flex min-h-11 w-full items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-left"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">
          {label}
        </span>
        <span className="shrink-0 text-xs text-[var(--muted)]" aria-hidden>
          ▾
        </span>
      </button>

      <BookPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
