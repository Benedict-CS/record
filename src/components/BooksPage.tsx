"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  BookFormSheet,
  type BookFormValues,
} from "@/components/BookFormSheet";
import { BottomSheet } from "@/components/BottomSheet";
import { useBook } from "@/components/BookProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { getClientId } from "@/lib/client-id";
import { bookTotals, createBook, listBooks } from "@/lib/db/crud";
import { db } from "@/lib/db/schema";
import { currencyLabel, formatMoney } from "@/lib/format";
import { useSeedReady } from "@/lib/hooks/useLedgerData";
import { runSync } from "@/lib/sync/engine";
import type { Book } from "@/lib/types";

async function renameBook(id: string, name: string): Promise<void> {
  const existing = await db.books.get(id);
  if (!existing || existing.deleted_at) return;
  await db.books.update(id, {
    name: name.trim(),
    updated_at: new Date().toISOString(),
    client_id: getClientId(),
    sync_status: "pending",
  });
}

async function softDeleteBook(id: string): Promise<void> {
  const existing = await db.books.get(id);
  if (!existing || existing.deleted_at) return;
  const stamp = new Date().toISOString();
  await db.books.update(id, {
    deleted_at: stamp,
    updated_at: stamp,
    client_id: getClientId(),
    sync_status: "pending",
  });
}

function useBookTotals() {
  const [totals, setTotals] = useState<
    Record<string, { total: number; accounts: number; holdings: number; held: number }>
  >({});

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const rows = await listBooks();
      const entries = await Promise.all(
        rows.map(async (row) => [row.id, await bookTotals(row.id)] as const),
      );
      return Object.fromEntries(entries);
    }).subscribe({
      next: (value) => setTotals(value),
      error: () => setTotals({}),
    });
    return () => subscription.unsubscribe();
  }, []);

  return totals;
}

export function BooksPage() {
  const { books, bookId, setBookId } = useBook();
  const ready = useSeedReady();
  const confirm = useConfirm();
  const totals = useBookTotals();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [menuBook, setMenuBook] = useState<Book | null>(null);

  const canDelete = books.length > 1;

  function openCreate() {
    setMenuBook(null);
    setEditing(null);
    setSheetOpen(true);
  }

  function openRename(book: Book) {
    setMenuBook(null);
    setEditing(book);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
  }

  async function handleSubmit(values: BookFormValues) {
    if (editing) {
      await renameBook(editing.id, values.name);
    } else {
      if (!values.currency) throw new Error("請選擇幣別");
      const created = await createBook({
        name: values.name,
        currency: values.currency,
      });
      setBookId(created.id);
    }
    void runSync();
  }

  async function handleDelete(book: Book) {
    setMenuBook(null);
    if (!canDelete) return;
    const ok = await confirm({
      title: `刪除「${book.name}」？`,
      message:
        "這本帳本的帳戶、分類、交易與存款都會一起隱藏。",
      confirmLabel: "刪除",
      destructive: true,
    });
    if (!ok) return;

    if (book.id === bookId) {
      const remaining = books.filter((item) => item.id !== book.id);
      const preferred =
        remaining.find((item) => item.currency === "TWD") ?? remaining[0];
      if (preferred) setBookId(preferred.id);
    }

    await softDeleteBook(book.id);
    void runSync();
  }

  return (
    <AppShell title="帳本">
      {!ready ? (
        <p className="text-sm text-[var(--muted)]">載入本機資料…</p>
      ) : (
        <div className="space-y-4">
          <p className="px-0.5 text-xs leading-relaxed text-[var(--muted)]">
            帳本是獨立工作區。點一下切換；帳戶與交易不會互相混在一起。
          </p>

          <div className="flex items-center justify-between gap-3 px-0.5">
            <p className="text-sm font-medium text-[var(--ink)]">
              全部帳本
              <span className="ml-1.5 font-normal text-[var(--muted)]">
                {books.length}
              </span>
            </p>
            <button
              type="button"
              onClick={openCreate}
              aria-label="新增帳本"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[var(--ink)] text-lg leading-none text-[var(--paper)]"
            >
              <span aria-hidden>+</span>
            </button>
          </div>

          <ul className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            {books.map((book, index) => {
              const active = book.id === bookId;
              const figures = totals[book.id];
              return (
                <li
                  key={book.id}
                  className={
                    index > 0 ? "border-t border-[var(--line)]" : undefined
                  }
                >
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => setBookId(book.id)}
                      aria-pressed={active}
                      className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left active:bg-[var(--paper)]"
                    >
                      <span
                        className={[
                          "grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[10px] leading-none",
                          active
                            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)]"
                            : "border-[var(--line)] text-transparent",
                        ].join(" ")}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--ink)]">
                          {book.name}
                          {active ? (
                            <span className="ml-1.5 text-xs font-normal text-[var(--accent)]">
                              使用中
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">
                          {currencyLabel(book.currency)}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">
                        {figures === undefined
                          ? "—"
                          : formatMoney(figures.total, book.currency)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`${book.name} 更多操作`}
                      onClick={() => setMenuBook(book)}
                      className="inline-flex min-h-14 min-w-11 shrink-0 items-center justify-center text-[var(--muted)] active:bg-[var(--paper)] active:text-[var(--ink)]"
                    >
                      <span aria-hidden className="text-lg leading-none">
                        ···
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <BottomSheet
        open={Boolean(menuBook)}
        onClose={() => setMenuBook(null)}
        title={menuBook?.name ?? "帳本"}
        description={
          menuBook ? currencyLabel(menuBook.currency) : undefined
        }
      >
        {menuBook ? (
          <div className="space-y-2">
            {menuBook.id !== bookId ? (
              <button
                type="button"
                onClick={() => {
                  setBookId(menuBook.id);
                  setMenuBook(null);
                }}
                className="flex min-h-12 w-full items-center rounded-xl bg-[var(--paper)] px-4 text-sm font-medium text-[var(--ink)]"
              >
                切換到這本
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => openRename(menuBook)}
              className="flex min-h-12 w-full items-center rounded-xl bg-[var(--paper)] px-4 text-sm font-medium text-[var(--ink)]"
            >
              重新命名
            </button>
            {canDelete ? (
              <button
                type="button"
                onClick={() => void handleDelete(menuBook)}
                className="flex min-h-12 w-full items-center rounded-xl bg-[var(--paper)] px-4 text-sm font-medium text-rose-700"
              >
                刪除
              </button>
            ) : (
              <p className="px-1 text-xs text-[var(--muted)]">
                最後一本帳本無法刪除。
              </p>
            )}
          </div>
        ) : null}
      </BottomSheet>

      <BookFormSheet
        key={sheetOpen ? (editing?.id ?? "new") : "closed"}
        open={sheetOpen}
        book={editing}
        onClose={closeSheet}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}
