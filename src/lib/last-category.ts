"use client";

import { useSyncExternalStore } from "react";

const CHANGE_EVENT = "ledger-last-category";

/** Pick an explicit choice, otherwise the last one this device used, otherwise the first. */
export function preferredCategoryId(
  explicit: string,
  remembered: string,
  availableIds: readonly string[],
): string {
  if (explicit && availableIds.includes(explicit)) return explicit;
  if (remembered && availableIds.includes(remembered)) return remembered;
  return availableIds[0] ?? "";
}

export function lastCategoryStorageKey(kind: "expense" | "income") {
  return `ledger_last_category_${kind}`;
}

export function rememberCategory(kind: "expense" | "income", id: string) {
  try {
    localStorage.setItem(lastCategoryStorageKey(kind), id);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Private mode still records the current entry; the next one just starts blank.
  }
}

export function useRememberedCategory(kind: "expense" | "income" | "hold") {
  const key = kind === "hold" ? "" : lastCategoryStorageKey(kind);
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CHANGE_EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => {
      if (!key) return "";
      try {
        return localStorage.getItem(key) ?? "";
      } catch {
        return "";
      }
    },
    () => "",
  );
}

