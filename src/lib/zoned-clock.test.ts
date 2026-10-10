import { resolveTimeZone, zonedClock } from "./zoned-clock";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(resolveTimeZone("Asia/Taipei") === "Asia/Taipei", "keeps a real zone");
assert(resolveTimeZone("Not/AZone") === "Asia/Taipei", "junk falls back");
assert(resolveTimeZone("") === "Asia/Taipei", "blank falls back");

// 2026-10-10 13:05 UTC is 21:05 in Taipei.
const taipei = zonedClock(new Date("2026-10-10T13:05:00.000Z"), "Asia/Taipei");
assert(taipei.dateKey === "2026-10-10", "Taipei date");
assert(taipei.minutes === 21 * 60 + 5, "Taipei 21:05");
assert(taipei.year === 2026 && taipei.month === 10, "Taipei month");

const utc = zonedClock(new Date("2026-10-10T13:05:00.000Z"), "UTC");
assert(utc.dateKey === "2026-10-10", "UTC date");
assert(utc.minutes === 13 * 60 + 5, "UTC 13:05");

console.log("zoned-clock.test.ts ok");
