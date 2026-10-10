import {
  dueDate,
  nextUpcomingCharge,
  periodsDue,
  recurringTransactionId,
  upcomingChargeLabel,
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

const spanned = periodsDue({
  startMonth: "2026-10",
  endMonth: "2026-12",
  dayOfMonth: 15,
  lastPosted: null,
  today: "2026-10-01",
});
assert(
  spanned.join(",") === "2026-10,2026-11,2026-12",
  "an end month posts the whole span before the due day",
);

const stopped = periodsDue({
  startMonth: "2026-01",
  endMonth: "2026-03",
  dayOfMonth: 1,
  lastPosted: null,
  today: "2026-10-20",
});
assert(
  stopped.join(",") === "2026-01,2026-02,2026-03",
  "posting stops at the end month",
);

const resumed = periodsDue({
  startMonth: "2026-01",
  endMonth: "2026-03",
  dayOfMonth: 1,
  lastPosted: "2026-01",
  today: "2026-10-20",
});
assert(resumed.join(",") === "2026-02,2026-03", "posted months are not repeated");

assert(
  periodsDue({
    startMonth: "2026-06",
    endMonth: "2026-05",
    dayOfMonth: 1,
    lastPosted: null,
    today: "2026-10-01",
  }).length === 0,
  "an end month before the start posts nothing",
);

const longSpan = periodsDue({
  startMonth: "2024-01",
  endMonth: "2026-12",
  dayOfMonth: 1,
  lastPosted: null,
  today: "2026-10-01",
});
assert(longSpan.length === 24, "a long span posts at most 24 months at once");

const aligned = periodsDue({
  startMonth: "2020-01",
  endMonth: "2026-09",
  dayOfMonth: 1,
  lastPosted: null,
  today: "2026-10-01",
  cap: Number.POSITIVE_INFINITY,
});
assert(aligned.length === 81, "aligning an old rule walks every posted month");

const idA = recurringTransactionId("rule-1", "2026-10");
const idB = recurringTransactionId("rule-1", "2026-10");
const idC = recurringTransactionId("rule-1", "2026-11");
assert(idA === idB, "the same rule and month always use the same id");
assert(idA !== idC, "another month is a different row");
assert(
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/.test(idA),
  "id is a uuid",
);

const upcoming = nextUpcomingCharge({
  startMonth: "2026-01",
  dayOfMonth: 15,
  lastPosted: "2026-09",
  today: "2026-10-09",
});
assert(upcoming?.date === "2026-10-15", "next charge is this month's due day");
assert(upcoming?.daysUntil === 6, "days until the 15th from the 9th");
assert(upcomingChargeLabel(6) === "還有 6 天", "upcoming label");
assert(upcomingChargeLabel(0) === "今天", "due today");

const afterPost = nextUpcomingCharge({
  startMonth: "2026-01",
  dayOfMonth: 15,
  lastPosted: "2026-10",
  today: "2026-10-16",
});
assert(afterPost?.date === "2026-11-15", "after posting, look at next month");

const ended = nextUpcomingCharge({
  startMonth: "2026-01",
  endMonth: "2026-09",
  dayOfMonth: 1,
  lastPosted: "2026-09",
  today: "2026-10-09",
});
assert(ended === null, "a finished rule has no next charge");

console.log("recurring tests ok");
