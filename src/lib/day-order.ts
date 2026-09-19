import type { Transaction } from "@/lib/types";

/** Fixed meal slots for same-day list order (lower = earlier). */
const MEAL_RANK: Record<string, number> = {
  早餐: 0,
  午餐: 1,
  晚餐: 2,
};

/** Holds always sort after meals and other expenses. */
const HOLD_RANK = 1000;
const OTHER_RANK = 100;

export function mealRank(categoryName: string | null | undefined): number {
  if (!categoryName) return OTHER_RANK;
  const rank = MEAL_RANK[categoryName.trim()];
  return rank === undefined ? OTHER_RANK : rank;
}

function sameDayRank(
  tx: Transaction,
  categoryNameOf: (categoryId: string | null) => string | null | undefined,
): number {
  if (tx.type === "hold") return HOLD_RANK;
  return mealRank(categoryNameOf(tx.category_id));
}

/**
 * Same-day order: 早餐 → 午餐 → 晚餐 → other → 扣住 last.
 * Missing meals are simply skipped (e.g. no breakfast → lunch first).
 * Does not use updated_at — edits must not reshuffle the day.
 */
export function compareSameDayTransactions(
  a: Transaction,
  b: Transaction,
  categoryNameOf: (categoryId: string | null) => string | null | undefined,
): number {
  const rankA = sameDayRank(a, categoryNameOf);
  const rankB = sameDayRank(b, categoryNameOf);
  if (rankA !== rankB) return rankA - rankB;
  // Stable tie-break so order does not jump when a row is edited.
  return a.id.localeCompare(b.id);
}

/** Date-descending month lists, with meal order inside each day. */
export function compareMonthTransactions(
  a: Transaction,
  b: Transaction,
  categoryNameOf: (categoryId: string | null) => string | null | undefined,
): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return compareSameDayTransactions(a, b, categoryNameOf);
}
