import type { Category, CategoryKind } from "@/lib/types";

/** Catch-all tags that should always appear last within their kind. */
const PINNED_LAST: Record<CategoryKind, string> = {
  expense: "其他支出",
  income: "其他收入",
};

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
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name, "zh-Hant");
}

export function sortCategories<T extends Category>(rows: T[]): T[] {
  return [...rows].sort(compareCategories);
}
