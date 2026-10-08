import { lastCategoryStorageKey, preferredCategoryId } from "./last-category";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(
  preferredCategoryId("lunch", "dinner", ["breakfast", "lunch"]) === "lunch",
  "an explicit category wins",
);
assert(
  preferredCategoryId("rent", "lunch", ["breakfast", "lunch"]) === "lunch",
  "a category from another kind falls through to the remembered one",
);
assert(
  preferredCategoryId("", "lunch", ["breakfast", "lunch"]) === "lunch",
  "an empty choice uses the remembered category",
);
assert(
  preferredCategoryId("", "gone", ["breakfast"]) === "breakfast",
  "a missing memory uses the first category",
);
assert(lastCategoryStorageKey("income") === "ledger_last_category_income", "income key");

console.log("last-category tests ok");
