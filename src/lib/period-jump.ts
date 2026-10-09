/** Newest year shown is next year, so a salary posted ahead of today can be opened. */
const FUTURE_YEARS = 1;
/** How many years before this year stay one tap away. */
const PAST_YEARS = 15;
/** Bookkeeping starts in 2020. Earlier years stay out of the jump sheet. */
export const LEDGER_START_YEAR = 2020;

export const SEARCH_RANGE_START = "2000-01-01";
export const SEARCH_RANGE_END = "2100-01-01";

/** Years in the jump sheet, newest first. Never lists a year before 2020. */
export function pickerYears(
  selected: number,
  nowYear: number,
  past = PAST_YEARS,
): number[] {
  const end = Math.max(selected, nowYear + FUTURE_YEARS, LEDGER_START_YEAR);
  const start = Math.max(LEDGER_START_YEAR, Math.min(selected, nowYear - past));
  const years: number[] = [];
  for (let year = end; year >= start; year -= 1) years.push(year);
  return years;
}

/** Keep the open month inside the years the ledger shows. */
export function clampLedgerPeriod(year: number, month: number) {
  if (year < LEDGER_START_YEAR) return { year: LEDGER_START_YEAR, month: 1 };
  return { year, month };
}

/** The calendar day after `YYYY-MM-DD`. */
export function dayAfter(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day + 1);
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
}

/**
 * Inclusive date filters become an IndexedDB range. Empty ends mean the whole
 * ledger, not the last few years.
 */
export function searchBounds(
  dateFrom: string,
  dateTo: string,
): { start: string; endExclusive: string } {
  return {
    start: dateFrom || SEARCH_RANGE_START,
    endExclusive: dateTo ? dayAfter(dateTo) : SEARCH_RANGE_END,
  };
}
