import { dayAfter, pickerYears, searchBounds } from "./period-jump";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

const years = pickerYears(2026, 2026);
assert(years[0] === 2027, "the sheet includes next year");
assert(years.includes(2020), "2020 stays one tap away from 2026");
assert(years.at(-1)! <= 2011, "the default window reaches back fifteen years");
assert(years.every((year, index) => index === 0 || years[index - 1] > year), "newest year first");

const early = pickerYears(2010, 2026);
assert(early.at(-1) === 2010, "a selected year older than the window is included");

assert(dayAfter("2024-02-28") === "2024-02-29", "leap day");
assert(dayAfter("2025-02-28") === "2025-03-01", "non-leap February");
assert(dayAfter("2025-12-31") === "2026-01-01", "year boundary");

const open = searchBounds("", "");
assert(open.start === "2000-01-01" && open.endExclusive === "2100-01-01", "no dates searches the whole ledger");
const december = searchBounds("2025-12-01", "2025-12-31");
assert(
  december.start === "2025-12-01" && december.endExclusive === "2026-01-01",
  "the end date is inclusive",
);

console.log("period-jump tests ok");
