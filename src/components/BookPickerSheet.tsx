"use client";

import Link from "next/link";
import { BottomSheet } from "@/components/BottomSheet";
import { useBook } from "@/components/BookProvider";
import { currencyLabel } from "@/lib/format";

export function BookPickerSheet({
  open,
  onClose,
  onAddBook,
}: {
  open: boolean;
  onClose: () => void;
  /** Optional shortcut to open create flow from the picker footer. */
  onAddBook?: () => void;
}) {
  const { books, bookId, setBookId } = useBook();

  function selectBook(id: string) {
    setBookId(id);
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="切換帳本"
      footer={
        <div className="flex items-center gap-2">
          <Link
            href="/books"
            onClick={onClose}
            className="flex min-h-11 flex-1 items-center justify-center rounded-md border border-[var(--line)] px-3 text-sm text-[var(--accent)]"
          >
            管理帳本
          </Link>
          {onAddBook ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddBook();
              }}
              className="flex min-h-11 flex-1 items-center justify-center rounded-md bg-[var(--ink)] px-3 text-sm font-medium text-[var(--paper)]"
            >
              新增帳本
            </button>
          ) : null}
        </div>
      }
    >
      {books.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--muted)]">
          還沒有帳本。
        </p>
      ) : (
        <ul className="space-y-1">
          {books.map((book) => {
            const active = book.id === bookId;
            return (
              <li key={book.id}>
                <button
                  type="button"
                  onClick={() => selectBook(book.id)}
                  aria-pressed={active}
                  className={[
                    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                    active
                      ? "bg-[var(--paper)]"
                      : "hover:bg-[var(--paper)]/60",
                  ].join(" ")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--ink)]">
                      {book.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      {currencyLabel(book.currency)}
                    </span>
                  </span>
                  {active ? (
                    <span
                      className="shrink-0 text-sm text-[var(--accent)]"
                      aria-label="目前使用中"
                    >
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
