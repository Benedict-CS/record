import { budgetPacing, formatPercentUsed, yearTimeProgress } from "./budget-pacing";

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

// Percentage formatting
assert(formatPercentUsed(0, 50000) === "0%", "zero spent is 0%");
assert(formatPercentUsed(100, 0) === "0%", "zero budget is 0%");
assert(formatPercentUsed(15, 50000) === "< 0.1%", "tiny spend is < 0.1%");
assert(formatPercentUsed(234, 50000) === "0.5%", "234 of 50k is 0.5%");
assert(formatPercentUsed(500, 50000) === "1%", "500 of 50k is 1%");
assert(formatPercentUsed(1250, 50000) === "2.5%", "1250 of 50k is 2.5%");
assert(formatPercentUsed(5063, 50000) === "10%", "5063 of 50k is 10%");
assert(formatPercentUsed(43550, 50000) === "87%", "43550 of 50k is 87%");
assert(formatPercentUsed(55000, 50000) === "110%", "55000 of 50k is 110%");

// Pacing under budget
const under = budgetPacing(234, 50000, 0.87, "TWD");
assert(under.isOver === false, "under budget is not over");
assert(under.remaining === 49766, "remaining is 49766");
assert(under.spentPctText === "0.5%", "spent pct text is 0.5%");
assert(under.statusText.includes("還剩"), "status indicates remaining dollars");

// Pacing over budget
const over = budgetPacing(60000, 50000, 0.87, "TWD");
assert(over.isOver === true, "60k of 50k is over");
assert(over.remaining === -10000, "remaining is negative");
assert(over.spentPctText === "120%", "spent pct text is 120%");
assert(over.statusText.includes("超支"), "status indicates over budget");

console.log("budget-pacing tests passed");
