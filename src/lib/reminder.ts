/**
 * Bookkeeping reminder settings.
 *
 * Everything lives in localStorage so the feature keeps working offline and
 * needs no extra dependency. All browser APIs are guarded for SSR and for
 * browsers that ship without the Notification API (iOS Safari in a tab).
 */

const SETTINGS_KEY = "ledger:reminder-settings";
const DISMISSED_KEY = "ledger:reminder-dismissed-on";
const NOTIFIED_KEY = "ledger:reminder-notified-on";

/** 24h local wall-clock time used when the user has never picked one. */
export const DEFAULT_REMINDER_TIME = "21:00";

export type ReminderSettings = {
  enabled: boolean;
  /** Local wall-clock time in 24h "HH:MM" form. */
  time: string;
};

export type NotificationOutcome = NotificationPermission | "unsupported";

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  time: DEFAULT_REMINDER_TIME,
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
function normalizeTime(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_REMINDER_TIME;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return DEFAULT_REMINDER_TIME;
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function minutesOfTime(time: string): number {
  const [hours, minutes] = normalizeTime(time).split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** Local (not UTC) YYYY-MM-DD key, so "today" matches the user's calendar. */
function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getReminderSettings(): ReminderSettings {
  const raw = readKey(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<ReminderSettings> | null;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SETTINGS };
    return {
      enabled: parsed.enabled === true,
      time: normalizeTime(parsed.time),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persists the settings and returns the normalized value that was stored. */
export function setReminderSettings(next: ReminderSettings): ReminderSettings {
  const normalized: ReminderSettings = {
    enabled: next.enabled === true,
    time: normalizeTime(next.time),
  };
  writeKey(SETTINGS_KEY, JSON.stringify(normalized));
  emitSettings();
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
  if (hasEntryToday) return false;

  const settings = getReminderSettings();
  if (!settings.enabled) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes < minutesOfTime(settings.time)) return false;

  return readKey(DISMISSED_KEY) !== dateKey(now);
}

/** Hides the nudge until the next calendar day. */
export function dismissNudgeForToday(now: Date = new Date()): void {
  writeKey(DISMISSED_KEY, dateKey(now));
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
  if (!notificationsSupported()) return false;
  if (Notification.permission !== "granted") return false;
  if (!shouldNudgeToday(hasEntryToday, now)) return false;

  const today = dateKey(now);
  if (readKey(NOTIFIED_KEY) === today) return false;

  try {
    new Notification("記帳提醒", {
      body: "今天還沒記帳，花十秒補上吧。",
      tag: "ledger-daily-reminder",
    });
  } catch {
    // Some browsers require a service worker registration to construct one.
    return false;
  }

  writeKey(NOTIFIED_KEY, today);
  return true;
}
