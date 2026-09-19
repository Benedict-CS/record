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

export function todayLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftYearMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}