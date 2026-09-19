"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { liveQuery } from "dexie";
import { listBooks } from "@/lib/db/crud";
import { db } from "@/lib/db/schema";
import { ensureSeedData } from "@/lib/db/seed";
import type { Book } from "@/lib/types";

const STORAGE_KEY = "ledger_active_book_id";

type BookContextValue = {
  ready: boolean;
  books: Book[];
  book: Book | null;
  bookId: string | null;
  setBookId: (id: string) => void;
};

const BookContext = createContext<BookContextValue | null>(null);

async function countLiveTx(bookId: string) {
  return db.transactions
    .where("book_id")
    .equals(bookId)
    .filter((row) => !row.deleted_at)
    .count();
}

/** Prefer the live book that actually has ledger rows. */
async function pickBookId(rows: Book[], preferred: string | null) {
  if (preferred && rows.some((row) => row.id === preferred)) {
    const preferredCount = await countLiveTx(preferred);
    if (preferredCount > 0) return preferred;
  }
  let best: { id: string; count: number } | null = null;
  for (const row of rows) {
    const count = await countLiveTx(row.id);
    if (!best || count > best.count) best = { id: row.id, count };
  }
  if (best && best.count > 0) return best.id;
  const twd = rows.find((row) => row.currency === "TWD");
  return twd?.id ?? rows[0]?.id ?? null;
}

export function BookProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookIdState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void ensureSeedData().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const observable = liveQuery(() => listBooks());
    const sub = observable.subscribe({
      next: (rows) => {
        if (cancelled) return;
        setBooks(rows);
        const stored =
          typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEY)
            : null;
        void pickBookId(rows, stored).then((next) => {
          if (cancelled || !next) return;
          setBookIdState((current) => {
            if (current === next) return current;
            localStorage.setItem(STORAGE_KEY, next);
            return next;
          });
        });
      },
      error: () => {
        if (!cancelled) setBooks([]);
      },
    });
    return () => {
      cancelled = true;
      sub.unsubscribe();
    };
  }, [ready]);

  const setBookId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setBookIdState(id);
  }, []);

  const book = useMemo(
    () => books.find((row) => row.id === bookId) ?? null,
    [books, bookId],
  );

  const value = useMemo(
    () => ({ ready, books, book, bookId, setBookId }),
    [ready, books, book, bookId, setBookId],
  );

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>;
}

export function useBook() {
  const ctx = useContext(BookContext);
  if (!ctx) {
    throw new Error("useBook must be used within BookProvider");
  }
  return ctx;
}
