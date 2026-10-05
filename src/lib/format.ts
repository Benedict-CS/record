export type MoneyCurrency = "TWD" | "MYR" | string;

export function formatMoney(
  value: number,
  currency: MoneyCurrency = "TWD",
) {
  const code = currency === "MYR" ? "MYR" : currency === "TWD" ? "TWD" : currency;
  return new Intl.NumberFormat(code === "MYR" ? "ms-MY" : "zh-TW", {
    style: "currency",
    currency: code,
    maximumFractionDigits: code === "MYR" ? 2 : 0,
  }).format(value);
}

export function currencyLabel(currency: MoneyCurrency) {
  if (currency === "TWD") return "新台幣";
  if (currency === "MYR") return "馬幣";
  return currency;
}

/** Display an annual rate such as `1.6%`; zero or invalid rates stay empty. */
export function formatRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) return "";
  const rounded = Math.round(rate * 10000) / 10000;
  return `${rounded}%`;
}

/** Drop rows dated after `today`. Year totals use this so pre-posted months stay out. */
export function throughToday<T extends { date: string }>(
  rows: T[],
  today = todayLocal(),
): T[] {
  return rows.filter((row) => row.date <= today);
}

export function todayLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

/** `2026-08-27` → `8/27 週四`. Invalid input is returned unchanged. */
export function formatDayHeading(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  const weekday = new Date(year, month - 1, day).getDay();
  return `${month}/${day} 週${WEEKDAY_LABELS[weekday]}`;
}

export function shiftYearMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}