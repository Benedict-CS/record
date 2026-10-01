import {
  dueDate,
  periodsDue,
  recurringTransactionId,
} from "./recurring";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(dueDate(2026, 2, 31) === "2026-02-28", "February clamps day 31");
assert(dueDate(2024, 2, 31) === "2024-02-29", "leap February clamps day 31");
assert(dueDate(2026, 10, 1) === "2026-10-01", "day 1 stays the first");

const waiting = periodsDue({
  startMonth: "2026-10",
  dayOfMonth: 15,
  lastPosted: null,
  today: "2026-10-01",
});
assert(waiting.length === 0, "a later day this month has not come due");

const dueNow = periodsDue({
  startMonth: "2026-10",
  dayOfMonth: 1,
  lastPosted: null,
  today: "2026-10-01",
});
assert(dueNow.length === 1 && dueNow[0] === "2026-10", "today's due day posts this month");

const catchUp = periodsDue({
  startMonth: "2026-08",
  dayOfMonth: 5,
  lastPosted: "2026-08",
  today: "2026-10-05",
});
assert(
  catchUp.join(",") === "2026-09,2026-10",
  "missed months after the last post are filled in order",
);

const future = periodsDue({
  startMonth: "2026-12",
  dayOfMonth: 1,
  lastPosted: null,
  today: "2026-10-20",
});
assert(future.length === 0, "a future start month posts nothing yet");

const idA = recurringTransactionId("rule-1", "2026-10");
const idB = recurringTransactionId("rule-1", "2026-10");
const idC = recurringTransactionId("rule-1", "2026-11");
assert(idA === idB, "the same rule and month always use the same id");
assert(idA !== idC, "another month is a different row");
assert(
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/.test(idA),
  "id is a uuid",
);

console.log("recurring tests ok");
