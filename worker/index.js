/**
 * Custom Record service-worker hooks (compiled into the generated SW).
 *
 * Periodic Background Sync is best-effort on installed Chromium PWAs and is
 * not an exact daily alarm. iOS never runs this event.
 */

const CLOCK_DB = "ledger_reminder";
const CLOCK_STORE = "clock";
const CLOCK_KEY = "current";
const REMINDER_TAG = "ledger-daily-reminder";
const REMINDER_TITLE = "今天記了沒";
const REMINDER_BODY = "花十秒補上今天的花費。";
const REMINDER_URL = "/#quick-add";

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function minutesOfTime(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time ?? ""));
  if (!match) return 21 * 60;
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return hours * 60 + minutes;
}

function reminderShouldNotify(clock, now) {
  if (!clock || clock.enabled !== true) return false;
  const today = localDateKey(now);
  if (clock.lastEntryDate === today) return false;
  if (clock.dismissedOn === today) return false;
  if (clock.notifiedOn === today) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= minutesOfTime(clock.time);
}

function openClockDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CLOCK_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CLOCK_STORE)) {
        db.createObjectStore(CLOCK_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("clock db"));
  });
}

async function readClock() {
  const db = await openClockDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction(CLOCK_STORE, "readonly")
        .objectStore(CLOCK_STORE)
        .get(CLOCK_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function writeClock(clock) {
  const db = await openClockDb();
  try {
    await new Promise((resolve, reject) => {
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
}

async function maybeNotifyFromClock() {
  const clock = await readClock();
  const now = new Date();
  if (!reminderShouldNotify(clock, now)) return;
  await self.registration.showNotification(REMINDER_TITLE, {
    body: REMINDER_BODY,
    tag: REMINDER_TAG,
    icon: "/icons/icon-192.png",
    data: { url: REMINDER_URL },
  });
  await writeClock({ ...clock, notifiedOn: localDateKey(now) });
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag === REMINDER_TAG) {
    event.waitUntil(maybeNotifyFromClock());
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || REMINDER_URL,
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if ("focus" in client) {
            if ("navigate" in client) {
              return client.navigate(target).then((next) => (next || client).focus());
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
        return undefined;
      }),
  );
});
