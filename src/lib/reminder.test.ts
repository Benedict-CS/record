import {
  DEFAULT_REMINDER_TIME,
  localDateKey,
  minutesOfTime,
  normalizeReminderTime,
  reminderIsDue,
  reminderShouldNotify,
} from "./reminder";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(normalizeReminderTime("9:05") === "09:05", "pads a one-digit hour");
assert(normalizeReminderTime("21:00") === "21:00", "keeps a valid time");
assert(normalizeReminderTime("25:99") === "23:59", "clamps overflow");
assert(normalizeReminderTime("nope") === DEFAULT_REMINDER_TIME, "junk falls back");
assert(normalizeReminderTime(12) === DEFAULT_REMINDER_TIME, "non-strings fall back");
assert(minutesOfTime("21:00") === 21 * 60, "21:00 is 1260 minutes");
assert(minutesOfTime("00:30") === 30, "half past midnight");

const evening = new Date(2026, 9, 9, 21, 5, 0);
assert(localDateKey(evening) === "2026-10-09", "local date is not UTC");

assert(
  reminderIsDue({
    enabled: false,
    time: "21:00",
    hasEntryToday: false,
    dismissedOn: null,
    now: evening,
  }) === false,
  "disabled reminders stay quiet",
);

assert(
  reminderIsDue({
    enabled: true,
    time: "21:00",
    hasEntryToday: false,
    dismissedOn: null,
    now: new Date(2026, 9, 9, 20, 59, 0),
  }) === false,
  "before the chosen time is not due",
);

assert(
  reminderIsDue({
    enabled: true,
    time: "21:00",
    hasEntryToday: false,
    dismissedOn: null,
    now: evening,
  }) === true,
  "after the chosen time with no entry is due",
);

assert(
  reminderIsDue({
    enabled: true,
    time: "21:00",
    hasEntryToday: true,
    dismissedOn: null,
    now: evening,
  }) === false,
  "a booking today hides the nudge",
);

assert(
  reminderIsDue({
    enabled: true,
    time: "21:00",
    hasEntryToday: false,
    dismissedOn: "2026-10-09",
    now: evening,
  }) === false,
  "dismissed today stays hidden",
);

assert(
  reminderIsDue({
    enabled: true,
    time: "21:00",
    hasEntryToday: false,
    dismissedOn: "2026-10-08",
    now: evening,
  }) === true,
  "yesterday's dismiss comes back today",
);

assert(
  reminderShouldNotify({
    enabled: true,
    time: "21:00",
    lastEntryDate: null,
    notifiedOn: null,
    dismissedOn: null,
    now: evening,
  }) === true,
  "due and never notified means send",
);

assert(
  reminderShouldNotify({
    enabled: true,
    time: "21:00",
    lastEntryDate: null,
    notifiedOn: "2026-10-09",
    dismissedOn: null,
    now: evening,
  }) === false,
  "one system notification per day",
);

assert(
  reminderShouldNotify({
    enabled: true,
    time: "21:00",
    lastEntryDate: "2026-10-09",
    notifiedOn: null,
    dismissedOn: null,
    now: evening,
  }) === false,
  "already booked today skips the push",
);

console.log("reminder.test.ts ok");
