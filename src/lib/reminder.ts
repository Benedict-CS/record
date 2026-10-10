/**
 * Bookkeeping reminder settings.
 *
 * Preferences stay in localStorage so the feature works offline. A compact
 * clock copy also lives in a separate IndexedDB (`ledger_reminder`) so the
 * service worker can decide whether to fire without opening Dexie / bumping
 * `ledger_db`. All browser APIs are guarded for SSR and for browsers that
 * ship without the Notification API (iOS Safari in a tab).
 */

const SETTINGS_KEY = "ledger:reminder-settings";
const DISMISSED_KEY = "ledger:reminder-dismissed-on";
const NOTIFIED_KEY = "ledger:reminder-notified-on";

const CLOCK_DB = "ledger_reminder";
const CLOCK_STORE = "clock";
const CLOCK_KEY = "current";

/** Tag shared by the page, the service worker, and notificationclick. */
export const REMINDER_SYNC_TAG = "ledger-daily-reminder";
export const REMINDER_NOTIFICATION_TITLE = "今天記了沒";
export const REMINDER_NOTIFICATION_BODY = "花十秒補上今天的花費。";
export const REMINDER_OPEN_URL = "/#quick-add";

/** 24h local wall-clock time used when the user has never picked one. */
export const DEFAULT_REMINDER_TIME = "21:00";

export type ReminderSettings = {
  enabled: boolean;
  /** Local wall-clock time in 24h "HH:MM" form. */
  time: string;
};

/** Compact snapshot the service worker can read without Dexie. */
export type ReminderClock = {
  enabled: boolean;
  time: string;
  lastEntryDate: string | null;
  notifiedOn: string | null;
  dismissedOn: string | null;
};

export type NotificationOutcome = NotificationPermission | "unsupported";

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  time: DEFAULT_REMINDER_TIME,
};

const EMPTY_CLOCK: ReminderClock = {
  enabled: false,
  time: DEFAULT_REMINDER_TIME,
  lastEntryDate: null,
  notifiedOn: null,
  dismissedOn: null,
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readKey(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private mode or blocked storage: behave as if nothing was stored.
    return null;
  }
}

function writeKey(key: string, value: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to recover: the setting simply does not persist this session.
  }
}

/** Clamps any user/stored input into a valid "HH:MM" string. */
export function normalizeReminderTime(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_REMINDER_TIME;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return DEFAULT_REMINDER_TIME;
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function minutesOfTime(time: string): number {
  const [hours, minutes] = normalizeReminderTime(time).split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** Local (not UTC) YYYY-MM-DD key, so "today" matches the user's calendar. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function laterDate(a: string | null | undefined, b: string | null | undefined) {
  if (!a) return b ?? null;
  if (!b) return a;
  return a >= b ? a : b;
}

/**
 * True when the reminder time has passed, nothing was recorded today, and
 * the user has not already dismissed the nudge today.
 */
export function reminderIsDue(input: {
  enabled: boolean;
  time: string;
  hasEntryToday: boolean;
  dismissedOn: string | null;
  now: Date;
}): boolean {
  if (!input.enabled) return false;
  if (input.hasEntryToday) return false;
  const nowMinutes = input.now.getHours() * 60 + input.now.getMinutes();
  if (nowMinutes < minutesOfTime(input.time)) return false;
  return input.dismissedOn !== localDateKey(input.now);
}

/** Service-worker / page shared rule for a one-shot daily notification. */
export function reminderShouldNotify(input: {
  enabled: boolean;
  time: string;
  lastEntryDate: string | null;
  notifiedOn: string | null;
  dismissedOn: string | null;
  now: Date;
}): boolean {
  const today = localDateKey(input.now);
  if (
    !reminderIsDue({
      enabled: input.enabled,
      time: input.time,
      hasEntryToday: input.lastEntryDate === today,
      dismissedOn: input.dismissedOn,
      now: input.now,
    })
  ) {
    return false;
  }
  return input.notifiedOn !== today;
}

export function getReminderSettings(): ReminderSettings {
  const raw = readKey(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<ReminderSettings> | null;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SETTINGS };
    return {
      enabled: parsed.enabled === true,
      time: normalizeReminderTime(parsed.time),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persists the settings and returns the normalized value that was stored. */
export function setReminderSettings(next: ReminderSettings): ReminderSettings {
  const normalized: ReminderSettings = {
    enabled: next.enabled === true,
    time: normalizeReminderTime(next.time),
  };
  writeKey(SETTINGS_KEY, JSON.stringify(normalized));
  emitSettings();
  void publishReminderClock();
  void registerDailyReminderSync();
  return normalized;
}

/**
 * True when the inline nudge should be visible: reminders are on, the
 * configured time has passed, nothing was recorded today, and the user has
 * not already dismissed the nudge today.
 */
export function shouldNudgeToday(
  hasEntryToday: boolean,
  now: Date = new Date(),
): boolean {
  if (!isBrowser()) return false;
  return reminderIsDue({
    ...getReminderSettings(),
    hasEntryToday,
    dismissedOn: readKey(DISMISSED_KEY),
    now,
  });
}

/** Hides the nudge until the next calendar day. */
export function dismissNudgeForToday(now: Date = new Date()): void {
  writeKey(DISMISSED_KEY, localDateKey(now));
  void publishReminderClock();
}

/* ------------------------------------------------------------------ *
 * useSyncExternalStore adapters
 *
 * Components must not read localStorage during render, and reading it in a
 * mount effect causes a cascading render. These snapshots let React hydrate
 * with the server defaults and then swap in the stored values.
 * ------------------------------------------------------------------ */

type Listener = () => void;

const settingsListeners = new Set<Listener>();
const permissionListeners = new Set<Listener>();

let settingsSnapshot: ReminderSettings | null = null;
const SERVER_SETTINGS: ReminderSettings = { ...DEFAULT_SETTINGS };

function emitSettings() {
  settingsSnapshot = null;
  settingsListeners.forEach((listener) => listener());
}

/** Another tab changed the settings. */
function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === SETTINGS_KEY) emitSettings();
}

export function subscribeReminderSettings(listener: Listener): () => void {
  settingsListeners.add(listener);
  if (isBrowser() && settingsListeners.size === 1) {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    settingsListeners.delete(listener);
    if (isBrowser() && settingsListeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** Cached so repeated calls within one render return the same object. */
export function getReminderSettingsSnapshot(): ReminderSettings {
  if (!settingsSnapshot) settingsSnapshot = getReminderSettings();
  return settingsSnapshot;
}

export function getReminderSettingsServerSnapshot(): ReminderSettings {
  return SERVER_SETTINGS;
}

export function subscribeNotificationPermission(listener: Listener): () => void {
  permissionListeners.add(listener);
  return () => {
    permissionListeners.delete(listener);
  };
}

export function getNotificationPermissionServerSnapshot(): NotificationOutcome {
  return "default";
}

export function notificationsSupported(): boolean {
  return isBrowser() && typeof window.Notification !== "undefined";
}

export function getNotificationPermission(): NotificationOutcome {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationOutcome> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    // Older Safari only supports the callback form and may reject outright.
    return Notification.permission;
  } finally {
    permissionListeners.forEach((listener) => listener());
    void registerDailyReminderSync();
  }
}

type PeriodicSyncRegistration = ServiceWorkerRegistration & {
  periodicSync?: {
    register: (tag: string, options?: { minInterval: number }) => Promise<void>;
    unregister: (tag: string) => Promise<void>;
  };
};

/**
 * Best-effort background check on installed Chromium PWAs. Browsers usually
 * enforce a long minimum interval (often 12h) and never promise an exact
 * wall-clock fire. iOS does not implement this API.
 */
export async function registerDailyReminderSync(): Promise<boolean> {
  if (!isBrowser() || !("serviceWorker" in navigator)) return false;
  try {
    const registration = (await navigator.serviceWorker
      .ready) as PeriodicSyncRegistration;
    const periodic = registration.periodicSync;
    if (!periodic) return false;
    if (!getReminderSettings().enabled) {
      await periodic.unregister(REMINDER_SYNC_TAG).catch(() => undefined);
      return false;
    }
    await periodic.register(REMINDER_SYNC_TAG, {
      minInterval: 12 * 60 * 60 * 1000,
    });
    return true;
  } catch {
    return false;
  }
}

function reminderNotificationOptions(): NotificationOptions {
  return {
    body: REMINDER_NOTIFICATION_BODY,
    tag: REMINDER_SYNC_TAG,
    icon: "/icons/icon-192.png",
    data: { url: REMINDER_OPEN_URL },
  };
}

/** Shows the system notification. Returns false when the browser refused. */
export function showReminderNotification(): boolean {
  if (!notificationsSupported()) return false;
  if (Notification.permission !== "granted") return false;
  const title = REMINDER_NOTIFICATION_TITLE;
  const options = reminderNotificationOptions();
  try {
    const worker = navigator.serviceWorker;
    if (worker) {
      void worker.ready
        .then((registration) => registration.showNotification(title, options))
        .catch(() => {
          new Notification(title, options);
        });
    } else {
      new Notification(title, options);
    }
    return true;
  } catch {
    // Some browsers require a service worker registration to construct one.
    return false;
  }
}

/**
 * Fires a single system notification per day when the reminder is due.
 * Returns true only when a notification was actually shown.
 */
export function notifyIfDue(
  hasEntryToday: boolean,
  now: Date = new Date(),
): boolean {
  const settings = getReminderSettings();
  const today = localDateKey(now);
  if (
    !reminderShouldNotify({
      enabled: settings.enabled,
      time: settings.time,
      lastEntryDate: hasEntryToday ? today : null,
      notifiedOn: readKey(NOTIFIED_KEY),
      dismissedOn: readKey(DISMISSED_KEY),
      now,
    })
  ) {
    return false;
  }
  if (!showReminderNotification()) return false;
  writeKey(NOTIFIED_KEY, today);
  void publishReminderClock({
    lastEntryDate: hasEntryToday ? today : null,
    notifiedOn: today,
  });
  return true;
}

/* ------------------------------------------------------------------ *
 * Reminder clock (IndexedDB for the service worker)
 * ------------------------------------------------------------------ */

function openClockDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CLOCK_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CLOCK_STORE)) {
        db.createObjectStore(CLOCK_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("clock db"));
  });
}

async function readClock(): Promise<ReminderClock | null> {
  if (!isBrowser() || typeof indexedDB === "undefined") return null;
  try {
    const db = await openClockDb();
    try {
      const row = await new Promise<ReminderClock | undefined>((resolve, reject) => {
        const request = db
          .transaction(CLOCK_STORE, "readonly")
          .objectStore(CLOCK_STORE)
          .get(CLOCK_KEY);
        request.onsuccess = () => resolve(request.result as ReminderClock | undefined);
        request.onerror = () => reject(request.error);
      });
      return row ?? null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

async function writeClock(clock: ReminderClock): Promise<void> {
  if (!isBrowser() || typeof indexedDB === "undefined") return;
  try {
    const db = await openClockDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const request = db
          .transaction(CLOCK_STORE, "readwrite")
          .objectStore(CLOCK_STORE)
          .put(clock, CLOCK_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // The page reminder still works from localStorage if this write fails.
  }
}

/**
 * Merge page state into the SW-readable clock. `lastEntryDate` is only
 * overwritten when the caller knows whether today already has a booking.
 */
export async function publishReminderClock(
  patch: Partial<ReminderClock> = {},
): Promise<ReminderClock> {
  const settings = getReminderSettings();
  const previous = await readClock();
  const clock: ReminderClock = {
    enabled: settings.enabled,
    time: settings.time,
    lastEntryDate:
      patch.lastEntryDate !== undefined
        ? patch.lastEntryDate
        : (previous?.lastEntryDate ?? EMPTY_CLOCK.lastEntryDate),
    notifiedOn: laterDate(
      patch.notifiedOn ?? readKey(NOTIFIED_KEY),
      previous?.notifiedOn,
    ),
    dismissedOn: laterDate(
      patch.dismissedOn ?? readKey(DISMISSED_KEY),
      previous?.dismissedOn,
    ),
  };
  await writeClock(clock);
  return clock;
}
