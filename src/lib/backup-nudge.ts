/**
 * Monthly JSON backup reminder. The month key lives in localStorage so the
 * card stays quiet after a download or a dismiss, including from another page.
 */

const DONE_KEY = "ledger:backup-done-month";

type Listener = () => void;

const listeners = new Set<Listener>();

/** YYYY-MM in the user's local calendar. */
export function backupMonthKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function readDoneMonth(): string {
  if (!isBrowser()) return "";
  try {
    return window.localStorage.getItem(DONE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * True when this calendar month has not been downloaded or dismissed.
 * A null snapshot means the server render, which stays hidden.
 */
export function shouldRemindBackup(
  doneMonth: string | null,
  now: Date = new Date(),
): boolean {
  if (doneMonth == null) return false;
  return doneMonth !== backupMonthKey(now);
}

export function markBackupDone(now: Date = new Date()): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(DONE_KEY, backupMonthKey(now));
  } catch {
    return;
  }
  snapshot = null;
  listeners.forEach((listener) => listener());
}

let snapshot: string | null = null;

function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === DONE_KEY) {
    snapshot = null;
    listeners.forEach((listener) => listener());
  }
}

export function subscribeBackupDone(listener: Listener): () => void {
  listeners.add(listener);
  if (isBrowser() && listeners.size === 1) {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (isBrowser() && listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function getBackupDoneSnapshot(): string {
  if (snapshot == null) snapshot = readDoneMonth();
  return snapshot;
}

export function getBackupDoneServerSnapshot(): null {
  return null;
}
