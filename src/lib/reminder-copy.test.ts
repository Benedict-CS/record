import {
  BUDGET_HINT_PCT,
  clampBudgetPct,
  maxBudgetUsedPct,
  reminderNotificationCopy,
} from "./reminder-copy";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(clampBudgetPct(80, 100) === 80, "80 of 100 is 80%");
assert(clampBudgetPct(0, 0) === null, "no budget means no percent");
assert(maxBudgetUsedPct([]) === null, "empty budgets");
assert(
  maxBudgetUsedPct([
    { used: 10, budget: 100 },
    { used: 90, budget: 100 },
  ]) === 90,
  "uses the tightest book",
);

const none = reminderNotificationCopy({ todayCount: 0 });
assert(none.title === "今天記了沒", "title stays 今天記了沒");
assert(none.body === "今天 0 筆。花十秒補上。", "zero entries ask to record");

const booked = reminderNotificationCopy({ todayCount: 3 });
assert(booked.body === "今天 3 筆。", "a count without a tight budget");

const tight = reminderNotificationCopy({
  todayCount: 0,
  budgetUsedPct: BUDGET_HINT_PCT,
});
assert(tight.body === "今天 0 筆，本月預算已用 80%。", "tight budget is named");

const loose = reminderNotificationCopy({ todayCount: 0, budgetUsedPct: 40 });
assert(loose.body === "今天 0 筆。花十秒補上。", "a loose budget stays quiet");

console.log("reminder-copy.test.ts ok");
