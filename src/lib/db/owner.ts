/**
 * Which ledger this browser tab is looking at.
 * null = this device's logged-out ledger. A user id = that account only.
 * Other accounts' rows stay in IndexedDB but are not shown or uploaded.
 */
const OWNER_KEY = "ledger_active_user_id";
const LEGACY_BOOK_KEY = "ledger_active_book_id";

let ownerId: string | null = readStoredOwner();

function readStoredOwner(): string | null {
  if (typeof localStorage === "undefined") return null;
  const stored = localStorage.getItem(OWNER_KEY);
  return stored && stored.length > 0 ? stored : null;
}

export function getOwnerId(): string | null {
  return ownerId;
}

export function sameOwner(
  userId: string | null | undefined,
  ownerId: string | null,
): boolean {
  return (userId ?? null) === ownerId;
}

/** Switch the visible ledger. Does not move rows between accounts. */
export function setOwnerId(next: string | null) {
  const normalised = next && next.length > 0 ? next : null;
  if (ownerId === normalised) return;
  ownerId = normalised;
  if (typeof localStorage !== "undefined") {
    if (normalised) localStorage.setItem(OWNER_KEY, normalised);
    else localStorage.removeItem(OWNER_KEY);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("ledger-owner-changed", { detail: normalised }),
    );
  }
}

export function activeBookStorageKey(owner: string | null = ownerId) {
  return owner ? `ledger_active_book_id:${owner}` : "ledger_active_book_id:local";
}

export function readActiveBookId(owner: string | null = ownerId): string | null {
  if (typeof localStorage === "undefined") return null;
  return (
    localStorage.getItem(activeBookStorageKey(owner)) ??
    localStorage.getItem(LEGACY_BOOK_KEY)
  );
}

export function writeActiveBookId(bookId: string, owner: string | null = ownerId) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(activeBookStorageKey(owner), bookId);
}
