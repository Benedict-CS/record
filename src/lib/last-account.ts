"use client";

import { useSyncExternalStore } from "react";

const CHANGE_EVENT = "ledger-last-account";

/** Pick an explicit choice, otherwise the last one this device used, otherwise the first. */
export function preferredStoredId(
  explicit: string,
  remembered: string,
  availableIds: readonly string[],
): string {
  if (explicit && availableIds.includes(explicit)) return explicit;
  if (remembered && availableIds.includes(remembered)) return remembered;
  return availableIds[0] ?? "";
}

export function lastAccountStorageKey(bookId: string) {
  return `ledger_last_account_${bookId}`;
}

export function lastHoldingStorageKey(bookId: string) {
  return `ledger_last_holding_${bookId}`;
}

function readKey(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeKey(key: string, id: string) {
  try {
    localStorage.setItem(key, id);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Private mode still records the current entry; the next one just starts blank.
  }
}

export function rememberAccount(bookId: string, id: string) {
  if (!bookId || !id) return;
  writeKey(lastAccountStorageKey(bookId), id);
}

export function rememberHolding(bookId: string, id: string) {
  if (!bookId || !id) return;
  writeKey(lastHoldingStorageKey(bookId), id);
}

function useStoredId(key: string) {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CHANGE_EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => (key ? readKey(key) : ""),
    () => "",
  );
}

export function useRememberedAccount(bookId: string | null | undefined) {
  return useStoredId(bookId ? lastAccountStorageKey(bookId) : "");
}

export function useRememberedHolding(bookId: string | null | undefined) {
  return useStoredId(bookId ? lastHoldingStorageKey(bookId) : "");
}
