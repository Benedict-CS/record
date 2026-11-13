import { budgetPacing, yearTimeProgress } from "./budget-pacing";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

// Past year
const past = yearTimeProgress(2025, "2026-11-14");
assert(past.timeRatio === 1, "past year is 100%");
assert(past.timePct === 100, "past year pct is 100");

// Future year
const future = yearTimeProgress(2027, "2026-11-14");
assert(future.timeRatio === 0, "future year is 0%");

// Current year (2026-11-14 is day ~318 of 365, ~87%)
const current = yearTimeProgress(2026, "2026-11-14");
assert(current.timePct >= 86 && current.timePct <= 88, `mid November is ~87%, got ${current.timePct}`);

// Pacing: under budget (ahead)
const ahead = budgetPacing(400000, 600000, 0.87, "TWD");
assert(ahead.isAhead === true, "400k of 600k at 87% is ahead");
assert(ahead.diff > 0, "diff is positive when saving money");
assert(ahead.statusText.includes("進度良好"), "status indicates good pacing");

// Pacing: over budget (spending too fast)
const over = budgetPacing(580000, 600000, 0.87, "TWD");
assert(over.isAhead === false, "580k of 600k at 87% is over pacing");
assert(over.diff < 0, "diff is negative when spending too fast");
assert(over.statusText.includes("支出超前"), "status indicates fast spending");

console.log("budget-pacing tests passed");
