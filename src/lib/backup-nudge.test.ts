import { backupMonthKey, shouldRemindBackup } from "./backup-nudge";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

const october = new Date(2026, 9, 4);
assert(backupMonthKey(october) === "2026-10", "October is 2026-10");
assert(backupMonthKey(new Date(2026, 0, 1)) === "2026-01", "January is zero-padded");

assert(shouldRemindBackup(null, october) === false, "the server snapshot stays hidden");
assert(shouldRemindBackup("", october) === true, "a month with no download still nags");
assert(
  shouldRemindBackup("2026-09", october) === true,
  "last month's download does not cover this month",
);
assert(
  shouldRemindBackup("2026-10", october) === false,
  "this month's download or dismiss hides the card",
);

console.log("backup-nudge.test.ts ok");
