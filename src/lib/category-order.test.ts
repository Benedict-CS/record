import {
  compareCategories,
  getCategoryPreferredRank,
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

// 1. Basic pin last check: pinned category always stays last regardless of sort_order
const ordered = sortCategories([
  cat({ name: "其他支出", kind: "expense", sort_order: 0 }),
  cat({ name: "水果", kind: "expense", sort_order: 5 }),
  cat({ name: "早餐", kind: "expense", sort_order: 1 }),
]);
assert(ordered.map((row) => row.name).join(",") === "早餐,水果,其他支出", "pin last");
assert(compareCategories(ordered[0], ordered[2]) < 0, "compare");

// 2. When sort_order differs, sort_order strictly takes precedence over default preferred rank
const manualOrdered = sortCategories([
  cat({ name: "早餐", kind: "expense", sort_order: 10 }), // preferred rank 0
  cat({ name: "電話費", kind: "expense", sort_order: 0 }), // preferred rank 9
  cat({ name: "午餐", kind: "expense", sort_order: 5 }), // preferred rank 2
]);
assert(
  manualOrdered.map((row) => row.name).join(",") === "電話費,午餐,早餐",
  "sort_order takes precedence over default preferred rank",
);

// 3. When sort_order is equal, preferred rank breaks the tie for expense categories
const tieBreaker = sortCategories([
  cat({ name: "其他支出", kind: "expense", sort_order: 0 }),
  cat({ name: "電話費", kind: "expense", sort_order: 0 }),
  cat({ name: "午餐", kind: "expense", sort_order: 0 }),
  cat({ name: "機車", kind: "expense", sort_order: 0 }),
  cat({ name: "早餐", kind: "expense", sort_order: 0 }),
  cat({ name: "住宿費", kind: "expense", sort_order: 0 }),
  cat({ name: "水果", kind: "expense", sort_order: 0 }),
  cat({ name: "交通", kind: "expense", sort_order: 0 }),
  cat({ name: "晚餐", kind: "expense", sort_order: 0 }),
]);

const names = tieBreaker.map((c) => c.name);
assert(names[0] === "早餐", "1st is 早餐");
assert(names[1] === "水果", "2nd is 水果");
assert(names[2] === "午餐", "3rd is 午餐");
assert(names[3] === "晚餐", "4th is 晚餐");
assert(names[4] === "住宿費", "5th is 住宿費");
assert(names[5] === "交通", "6th is 交通");
assert(names[6] === "機車", "7th is 機車");
assert(names[7] === "電話費", "8th is 電話費");
assert(names[8] === "其他支出", "last is 其他支出");

// 4. When sort_order is equal and rank is equal (unknown/custom), fallback to localeCompare
const customTie = sortCategories([
  cat({ name: "Custom B", kind: "expense", sort_order: 0 }),
  cat({ name: "Custom A", kind: "expense", sort_order: 0 }),
]);
assert(
  customTie.map((c) => c.name).join(",") === "Custom A,Custom B",
  "custom categories break tie by name localeCompare",
);

assert(getCategoryPreferredRank("早餐") === 0, "rank 0");
assert(getCategoryPreferredRank("水果") === 1, "rank 1");
assert(getCategoryPreferredRank("自訂分類") === 900, "unknown rank 900");

console.log("category-order tests passed");
