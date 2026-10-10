"use client";

import { useSyncExternalStore } from "react";

const KEY = "ledger_recent_searches";
const CHANGE_EVENT = "ledger-recent-searches";
const MAX = 8;
const EMPTY: string[] = [];

let cachedRaw = "";
let cachedList: string[] = EMPTY;

export function parseRecentSearches(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecentSearch(existing: string[], query: string): string[] {
  const next = query.trim();
  if (next.length < 2) return existing;
  return [
    next,
    ...existing.filter((item) => item !== next && !next.startsWith(item)),
  ].slice(0, MAX);
}

export function rememberSearch(query: string) {
  const next = pushRecentSearch(readRecentSearches(), query);
  const raw = JSON.stringify(next);
  if (raw === cachedRaw) return;
  try {
    localStorage.setItem(KEY, raw);
    cachedRaw = raw;
    cachedList = next;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Private mode just skips the chip list.
  }
}

function readRecentSearches() {
  try {
    const raw = localStorage.getItem(KEY) ?? "";
    if (raw === cachedRaw) return cachedList;
    cachedRaw = raw;
    cachedList = parseRecentSearches(raw);
    return cachedList;
  } catch {
    return cachedList;
  }
}

export function useRecentSearches() {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CHANGE_EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    readRecentSearches,
    () => EMPTY,
  );
}
