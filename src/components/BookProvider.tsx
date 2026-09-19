"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

/**
 * Honor an explicit user preference whenever that book is still live.
 * Otherwise default to TWD — never auto-steal to max-tx (that flipped TWD→MYR).
 */
function pickBookId(rows: Book[], preferred: string | null) {
  if (preferred && rows.some((row) => row.id === preferred)) {
    return preferred;
  }
  const twd = rows.find((row) => row.currency === "TWD");
  return twd?.id ?? rows[0]?.id ?? null;
}

export function BookProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookIdState] = useState<string | null>(null);
  const userPicked = useRef(false);
  const pickGen = useRef(0);

  useEffect(() => {
    let cancelled = false;
    // One-shot: clear sticky MYR preference written by the old max-tx picker.
    if (typeof window !== "undefined") {
      if (localStorage.getItem("ledger_book_pref_v2") !== "1") {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem("ledger_book_pref_v2", "1");
      }
    }
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
        const gen = ++pickGen.current;
        const stored =
          typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEY)
            : null;

        // Prefer in-memory selection after the user explicitly switched.
        setBookIdState((current) => {
          if (cancelled || gen !== pickGen.current) return current;

          const preferred =
            userPicked.current && current && rows.some((r) => r.id === current)
              ? current
              : stored;

          const next = pickBookId(rows, preferred);
          if (!next || current === next) {
            // Still persist when preferred was invalid (soft-deleted twin).
            if (next && stored !== next) {
              localStorage.setItem(STORAGE_KEY, next);
            }
            return current ?? next;
          }
          localStorage.setItem(STORAGE_KEY, next);
          return next;
        });
      },
      error: () => {
        if (!cancelled) setBooks([]);
      },
    });

    // Sync engine may adopt KEEP after collapse in the same tab.
    const onAdopt = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (!id || cancelled) return;
      userPicked.current = false;
      setBookIdState(id);
    };
    window.addEventListener("ledger-active-book", onAdopt);

    return () => {
      cancelled = true;
      sub.unsubscribe();
      window.removeEventListener("ledger-active-book", onAdopt);
    };
  }, [ready]);

  const setBookId = useCallback((id: string) => {
    userPicked.current = true;
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
