const MAX_CATCH_UP = 12;
/** A filled end month posts the whole span at once, including months not yet due. */
export const MAX_SCHEDULED_MONTHS = 24;

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Calendar date for a monthly charge. Day 31 in February becomes the last day. */
export function dueDate(year: number, month: number, dayOfMonth: number): string {
  const day = Math.min(Math.max(1, dayOfMonth), daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthIndex(value: string): number | null {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return null;
  return year * 12 + month;
}

/** Inclusive month count, or null when either side is not YYYY-MM. */
export function scheduledMonthCount(startMonth: string, endMonth: string): number | null {
  const start = monthIndex(startMonth);
  const end = monthIndex(endMonth);
  if (start == null || end == null) return null;
  return end - start + 1;
}

/**
 * Months that should get a row, oldest first.
 * With no end month, the current month is included only after its due day,
 * and at most 12 missed months are filled.
 * With an end month, every month from the start through the end is included
 * now, even if that due day has not arrived yet.
 * Months before startMonth, and months already in lastPosted, are skipped.
 */
export function periodsDue(input: {
  startMonth: string;
  endMonth?: string | null;
  dayOfMonth: number;
  lastPosted: string | null;
  today: string;
}): string[] {
  const start = monthIndex(input.startMonth);
  if (start == null) return [];

  let end = start;
  let cap = MAX_CATCH_UP;
  if (input.endMonth) {
    const scheduledEnd = monthIndex(input.endMonth);
    if (scheduledEnd == null || scheduledEnd < start) return [];
    end = scheduledEnd;
    cap = MAX_SCHEDULED_MONTHS;
  } else {
    const [ty, tm, td] = input.today.split("-").map(Number);
    if (!ty || !tm || !td) return [];
    let endYear = ty;
    let endMonth = tm;
    if (td < Math.min(input.dayOfMonth, daysInMonth(ty, tm))) {
      endMonth -= 1;
      if (endMonth < 1) {
        endMonth = 12;
        endYear -= 1;
      }
    }
    end = endYear * 12 + endMonth;
  }

  const periods: string[] = [];
  let cursor = start;
  while (cursor <= end && periods.length < cap) {
    const year = Math.floor((cursor - 1) / 12);
    const month = cursor - year * 12;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!input.lastPosted || key > input.lastPosted) periods.push(key);
    cursor += 1;
  }
  return periods;
}

/** Stable id so two devices posting the same month collapse to one row. */
export function recurringTransactionId(ruleId: string, period: string): string {
  let h0 = 0x811c9dc5;
  let h1 = 0x01000193;
  let h2 = 0x9e3779b9;
  let h3 = 0x85ebca6b;
  const input = `record-recurring:${ruleId}:${period}`;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h0 = Math.imul(h0 ^ code, 0x01000193);
    h1 = Math.imul(h1 ^ code, 0x85ebca6b);
    h2 = Math.imul(h2 ^ code, 0xc2b2ae35);
    h3 = Math.imul(h3 ^ code, 0x27d4eb2f);
  }
  const hex = [h0, h1, h2, h3]
    .map((value) => (value >>> 0).toString(16).padStart(8, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
