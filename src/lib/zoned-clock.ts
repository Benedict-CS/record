const FALLBACK_ZONE = "Asia/Taipei";

export type ZonedClock = {
  timeZone: string;
  dateKey: string;
  minutes: number;
  year: number;
  month: number;
};

export function resolveTimeZone(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return FALLBACK_ZONE;
  const timeZone = value.trim();
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return FALLBACK_ZONE;
  }
}

/** Wall-clock in the user's zone — not UTC — so 21:00 means 21:00 there. */
export function zonedClock(now: Date, timeZone: unknown): ZonedClock {
  const zone = resolveTimeZone(timeZone);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    timeZone: zone,
    dateKey: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    minutes: hour * 60 + minute,
    year,
    month,
  };
}
