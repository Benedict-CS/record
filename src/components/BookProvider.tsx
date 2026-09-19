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
    const observable = liveQuery(() => listBooks());
    const sub = observable.subscribe({
      next: (rows) => {
        setBooks(rows);
        setBookIdState((current) => {
          const stored =
            typeof window !== "undefined"
              ? localStorage.getItem(STORAGE_KEY)
              : null;
          const preferred = current ?? stored;
          if (preferred && rows.some((row) => row.id === preferred)) {
            return preferred;
          }
          return rows[0]?.id ?? null;
        });
      },
      error: () => setBooks([]),
    });
    return () => sub.unsubscribe();
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