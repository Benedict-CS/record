import { calendarDateInYear } from "./format";
import {
  clampLedgerPeriod,
  dayAfter,
  ledgerEndYear,
  pickerYears,
  searchBounds,
} from "./period-jump";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

const years = pickerYears(2026, 2026);
assert(years[0] === 2026, "an empty future stays off the sheet");
assert(!years.includes(2027), "next year is hidden until something is booked there");
assert(years.includes(2020), "2020 stays one tap away from 2026");
assert(years.at(-1) === 2020, "the sheet starts at 2020");
assert(!years.includes(2019), "years before bookkeeping stay hidden");
assert(years.every((year, index) => index === 0 || years[index - 1] > year), "newest year first");

const bookedAhead = pickerYears(2026, 2026, 2028);
assert(bookedAhead[0] === 2028, "a year that already has a transaction is listed");
assert(bookedAhead.includes(2027), "years up to the booked future stay reachable");
assert(ledgerEndYear(2026, 2025) === 2026, "an older last entry does not hide this year");
assert(ledgerEndYear(2026, null) === 2026, "an empty book still shows this year");

const early = pickerYears(2010, 2026);
assert(early.at(-1) === 2020, "a selected year before 2020 is not listed");
assert(!early.includes(2010), "2010 does not appear");
const ahead = pickerYears(2030, 2026);
assert(!ahead.includes(2030), "a selected future year without entries is not listed");
assert(clampLedgerPeriod(2019, 8, 2026).year === 2020 && clampLedgerPeriod(2019, 8, 2026).month === 1, "navigation stops at January 2020");
assert(clampLedgerPeriod(2021, 6, 2026).year === 2021 && clampLedgerPeriod(2021, 6, 2026).month === 6, "later months stay put");
assert(clampLedgerPeriod(2027, 3, 2026).year === 2026 && clampLedgerPeriod(2027, 3, 2026).month === 12, "navigation stops at December of this year");
assert(clampLedgerPeriod(2027, 3, 2028).year === 2027 && clampLedgerPeriod(2027, 3, 2028).month === 3, "a booked future year can be opened");

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

assert(
  calendarDateInYear(2025, "2026-10-09") === "2025-10-09",
  "same month and day last year",
);
assert(
  calendarDateInYear(2023, "2024-02-29") === "2023-02-28",
  "29 Feb clamps onto 28 Feb",
);

console.log("period-jump tests ok");
