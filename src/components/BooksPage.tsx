"use client";

import { liveQuery } from "dexie";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { getClientId } from "@/lib/client-id";
import { bookTotals, createBook, listBooks } from "@/lib/db/crud";
import { db } from "@/lib/db/schema";
import { currencyLabel, formatMoney } from "@/lib/format";
import { useSeedReady } from "@/lib/hooks/useLedgerData";
import { runSync } from "@/lib/sync/engine";
import type { Book, BookCurrency } from "@/lib/types";

const CURRENCY_OPTIONS: { value: BookCurrency; label: string }[] = [
  { value: "TWD", label: "新台幣 TWD" },
  { value: "MYR", label: "馬幣 MYR" },
];

/**
 * `crud.ts` exposes no book update/delete helper, so the two writes live here.
 * They keep the same sync bookkeeping as every other mutation: bump
 * `updated_at`, stamp this device and re-queue the row for the next push.
 */
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

/** Live per-book totals, keyed by book id. */
function useBookTotals() {
  const [totals, setTotals] = useState<
    Record<string, { total: number; accounts: number; holdings: number }>
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
  const totals = useBookTotals();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<BookCurrency>("TWD");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const canDelete = books.length > 1;

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const created = await createBook({ name, currency });
    setName("");
    setBookId(created.id);
    void runSync();
  }

  function startEdit(book: Book) {
    setConfirmingId(null);
    setEditingId(book.id);
    setEditName(book.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingId || !editName.trim()) return;
    await renameBook(editingId, editName);
    cancelEdit();
    void runSync();
  }

  async function confirmDelete(id: string) {
    if (!canDelete) return;
    await softDeleteBook(id);
    setConfirmingId(null);
    void runSync();
  }

  return (
    <AppShell title="帳本">
      {!ready ? (
        <p className="text-sm text-[var(--muted)]">載入本機資料…</p>
      ) : (
        <div className="space-y-3">
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">
            每本帳本都是獨立的：帳戶、分類、交易、預算與存款都各自分開，切換帳本只會換掉你看到的資料，不會互相影響。
          </p>

          <ul className="space-y-2">
            {books.map((book) => {
              const active = book.id === bookId;
              const figures = totals[book.id];
              return (
                <li
                  key={book.id}
                  className={[
                    "rounded-xl border bg-[var(--surface)] px-3 py-2",
                    active
                      ? "border-[var(--accent)]"
                      : "border-[var(--line)]",
                  ].join(" ")}
                >
                  {editingId === book.id ? (
                    <form onSubmit={saveEdit} className="space-y-2.5 py-1">
                      <label className="block">
                        <span className="mb-1 block text-xs text-[var(--muted)]">
                          帳本名稱
                        </span>
                        <input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                          autoFocus
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          className="min-h-11 rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-[var(--paper)]"
                        >
                          儲存
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setBookId(book.id)}
                        aria-pressed={active}
                        className="flex min-h-14 w-full items-center gap-3 text-left"
                      >
                        <span
                          className={[
                            "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] leading-none",
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
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--muted)]">
                            {currencyLabel(book.currency)}
                            {active ? " · 使用中" : " · 點一下切換"}
                            {figures
                              ? ` · 帳戶 ${formatMoney(figures.accounts, book.currency)} · 存款 ${formatMoney(figures.holdings, book.currency)}`
                              : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--ink)]">
                          {figures === undefined
                            ? "—"
                            : formatMoney(figures.total, book.currency)}
                        </span>
                      </button>

                      {confirmingId === book.id ? (
                        <div className="mt-1 space-y-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5">
                          <p className="text-xs leading-relaxed text-rose-700">
                            確定要刪除「{book.name}」嗎？這本帳本的帳戶、分類、交易與存款都會一起隱藏。
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmingId(null)}
                              className="min-h-11 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--muted)]"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={() => void confirmDelete(book.id)}
                              className="min-h-11 rounded-md bg-rose-600 px-3 text-sm font-medium text-white"
                            >
                              確定刪除
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(book)}
                            className="touch-target inline-flex items-center justify-center px-2 text-xs text-[var(--accent)]"
                          >
                            重新命名
                          </button>
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => setConfirmingId(book.id)}
                              className="touch-target inline-flex items-center justify-center px-2 text-xs text-[var(--muted)] active:text-rose-600"
                            >
                              刪除
                            </button>
                          ) : (
                            <span className="inline-flex min-h-11 items-center px-2 text-xs text-[var(--muted)]">
                              最後一本帳本無法刪除
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          <form
            onSubmit={onCreate}
            className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4"
          >
            <p className="text-sm font-medium text-[var(--ink)]">新增帳本</p>
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">
                帳本名稱
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                placeholder="例如：旅遊帳本"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">
                幣別
              </span>
              <select
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value as BookCurrency)
                }
                className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              >
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-[var(--muted)]">
              幣別建立後就固定下來，新帳本會自動變成目前使用的帳本。
            </p>
            <button
              type="submit"
              className="min-h-11 w-full rounded-md bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--paper)]"
            >
              建立帳本
            </button>
          </form>
        </div>
      )}
    </AppShell>
  );
}
