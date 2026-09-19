"use client";

import Link from "next/link";
import { useBook } from "@/components/BookProvider";
import { currencyLabel } from "@/lib/format";

export function BookSwitcher() {
  const { books, bookId, setBookId } = useBook();

  if (books.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 py-1">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">切換帳本</span>
        <select
          value={bookId ?? ""}
          onChange={(event) => setBookId(event.target.value)}
          className="min-h-11 w-full appearance-none truncate bg-transparent pr-6 pl-1 text-sm font-medium text-[var(--ink)] outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="切換帳本"
        >
          {books.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {currencyLabel(item.currency)}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 text-xs text-[var(--muted)]"
          aria-hidden
        >
          ▾
        </span>
      </label>

      <Link
        href="/books"
        className="touch-target inline-flex shrink-0 items-center justify-center rounded-md px-2 text-xs text-[var(--accent)] active:bg-[rgba(15,122,95,0.08)]"
      >
        管理
      </Link>
    </div>
  );
}
