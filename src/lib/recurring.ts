const MAX_CATCH_UP = 12;

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Calendar date for a monthly charge. Day 31 in February becomes the last day. */
export function dueDate(year: number, month: number, dayOfMonth: number): string {
  const day = Math.min(Math.max(1, dayOfMonth), daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Months that should already have a row, oldest first.
 * The current month is included only after its due day.
 * Months before startMonth, and months already in lastPosted, are skipped.
 */
export function periodsDue(input: {
  startMonth: string;
  dayOfMonth: number;
  lastPosted: string | null;
  today: string;
}): string[] {
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

  const [sy, sm] = input.startMonth.split("-").map(Number);
  if (!sy || !sm) return [];
  const periods: string[] = [];
  let year = sy;
  let month = sm;
  const endKey = endYear * 12 + endMonth;
  while (year * 12 + month <= endKey && periods.length < MAX_CATCH_UP) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!input.lastPosted || key > input.lastPosted) periods.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
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
