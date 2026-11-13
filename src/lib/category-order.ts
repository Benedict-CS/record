import type { Category, CategoryKind } from "@/lib/types";

/** Catch-all tags that should always appear last within their kind. */
const PINNED_LAST: Record<CategoryKind, string> = {
  expense: "其他支出",
  income: "其他收入",
};

/**
 * Standard preferred order for expense categories based on daily usage frequency:
 * Daily diet (breakfast, fruit, lunch, dinner, snacks) ->
 * Living & transport (housing/rent, transit, scooter, phone bill) ->
 * Lifestyle & health (exercise, shopping, entertainment, study, haircut, laundry, medical, ARC, treats) ->
 * Other expenses (pinned last).
 */
export const PREFERRED_EXPENSE_ORDER: string[] = [
  "早餐",
  "水果",
  "午餐",
  "晚餐",
  "飲料零食",
  "住宿費",
  "房租水電",
  "交通",
  "機車",
  "電話費",
  "運動",
  "購物",
  "娛樂",
  "學習",
  "剪頭髮",
  "洗衣",
  "醫療",
  "居留證",
  "請客",
];

const PREFERRED_EXPENSE_RANK = new Map(
  PREFERRED_EXPENSE_ORDER.map((name, index) => [name, index]),
);

export function getCategoryPreferredRank(name: string): number {
  const rank = PREFERRED_EXPENSE_RANK.get(name.trim());
  return rank !== undefined ? rank : 900;
}

export function isPinnedLastCategory(
  category: Pick<Category, "kind" | "name">,
): boolean {
  return category.name.trim() === PINNED_LAST[category.kind];
}

export function compareCategories(a: Category, b: Category): number {
  if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
  const aPinned = isPinnedLastCategory(a);
  const bPinned = isPinnedLastCategory(b);
  if (aPinned !== bPinned) return aPinned ? 1 : -1;

  if (a.kind === "expense" && b.kind === "expense") {
    const aRank = getCategoryPreferredRank(a.name);
    const bRank = getCategoryPreferredRank(b.name);
    if (aRank !== bRank) return aRank - bRank;
  }

  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name, "zh-Hant");
}

export function sortCategories<T extends Category>(rows: T[]): T[] {
  return [...rows].sort(compareCategories);
}
