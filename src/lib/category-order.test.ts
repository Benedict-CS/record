import {
  compareCategories,
  isPinnedLastCategory,
  sortCategories,
} from "./category-order";
import type { Category } from "./types";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

function cat(
  patch: Partial<Category> & Pick<Category, "name" | "kind" | "sort_order">,
): Category {
  return {
    id: patch.id ?? crypto.randomUUID(),
    user_id: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    client_id: "test",
    sync_status: "synced",
    book_id: "b1",
    icon: "dots",
    color: "#7f8c8d",
    ...patch,
  };
}

assert(
  isPinnedLastCategory(cat({ name: "其他支出", kind: "expense", sort_order: 0 })),
  "其他支出 pinned",
);
assert(
  isPinnedLastCategory(cat({ name: "其他收入", kind: "income", sort_order: 0 })),
  "其他收入 pinned",
);
assert(
  !isPinnedLastCategory(cat({ name: "水果", kind: "expense", sort_order: 0 })),
  "水果 not pinned",
);

const ordered = sortCategories([
  cat({ name: "其他支出", kind: "expense", sort_order: 0 }),
  cat({ name: "水果", kind: "expense", sort_order: 5 }),
  cat({ name: "早餐", kind: "expense", sort_order: 1 }),
]);
assert(ordered.map((row) => row.name).join(",") === "早餐,水果,其他支出", "pin last");
assert(compareCategories(ordered[0], ordered[2]) < 0, "compare");

console.log("category-order tests passed");
