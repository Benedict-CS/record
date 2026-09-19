import type { Holding, HoldingInterest, InterestCompounding } from "@/lib/types";

function clampRate(rate: number) {
  if (!Number.isFinite(rate) || rate < 0) return 0;
  return rate;
}

/** Simple monthly coupon: principal × annual% / 12. */
export function monthlyInterest(amount: number, annualRate: number) {
  return amount * (clampRate(annualRate) / 100) / 12;
}

/**
 * Expected interest over the next 12 months.
 * monthly compounding uses (1 + r/12)^12 − 1; others use simple annual %.
 */
export function yearlyInterest(
  amount: number,
  annualRate: number,
  compounding: InterestCompounding = "simple",
) {
  const rate = clampRate(annualRate) / 100;
  if (rate <= 0 || amount <= 0) return 0;
  if (compounding === "monthly") {
    return amount * (Math.pow(1 + rate / 12, 12) - 1);
  }
  if (compounding === "yearly") {
    return amount * rate;
  }
  if (compounding === "none") return 0;
  return amount * rate;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Interest accrued from start_date until today (or maturity if earlier). */
export function accruedInterest(holding: Holding, asOf = new Date()) {
  const rate = clampRate(holding.annual_rate);
  if (rate <= 0 || holding.amount <= 0 || holding.compounding === "none") {
    return 0;
  }
  const start = parseDate(holding.start_date);
  if (!start) return 0;
  const maturity = holding.maturity_date
    ? parseDate(holding.maturity_date)
    : null;
  const end =
    maturity && maturity.getTime() < asOf.getTime() ? maturity : asOf;
  if (end.getTime() <= start.getTime()) return 0;

  const years = daysBetween(start, end) / 365.25;
  if (holding.compounding === "monthly") {
    const months = years * 12;
    return holding.amount * (Math.pow(1 + rate / 100 / 12, months) - 1);
  }
  return holding.amount * (rate / 100) * years;
}

export function holdingInterest(holding: Holding): HoldingInterest {
  return {
    holding,
    monthly: monthlyInterest(holding.amount, holding.annual_rate),
    yearly: yearlyInterest(
      holding.amount,
      holding.annual_rate,
      holding.compounding,
    ),
    accrued: accruedInterest(holding),
  };
}

export function holdingsInterestSummary(holdings: Holding[]) {
  return holdings.reduce(
    (sum, holding) => {
      const item = holdingInterest(holding);
      sum.amount += holding.amount;
      sum.monthly += item.monthly;
      sum.yearly += item.yearly;
      sum.accrued += item.accrued;
      return sum;
    },
    { amount: 0, monthly: 0, yearly: 0, accrued: 0 },
  );
}

export type ProjectionRow = {
  index: number;
  interest: number;
  balance: number;
};

/**
 * Next N months of interest and running balance.
 * Monthly compounding adds interest to principal; simple/yearly coupons
 * stay on the original amount so the estimate matches the summary cards.
 */
export function monthlyProjection(holding: Holding, months = 12): ProjectionRow[] {
  const rate = clampRate(holding.annual_rate);
  const rows: ProjectionRow[] = [];
  let balance = holding.amount;
  for (let index = 1; index <= months; index += 1) {
    let interest = 0;
    if (rate > 0 && holding.amount > 0 && holding.compounding !== "none") {
      if (holding.compounding === "monthly") {
        interest = balance * (rate / 100 / 12);
        balance += interest;
      } else {
        interest = holding.amount * (rate / 100 / 12);
        balance = holding.amount + interest * index;
      }
    }
    rows.push({ index, interest, balance });
  }
  return rows;
}