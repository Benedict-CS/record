import { parseRecentSearches, pushRecentSearch } from "./recent-search";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(parseRecentSearches(null).length === 0, "empty storage");
assert(
  parseRecentSearches('["家樂福","便當"]').join(",") === "家樂福,便當",
  "reads a saved list",
);
assert(parseRecentSearches("not-json").length === 0, "junk JSON is ignored");

const pushed = pushRecentSearch(["便當", "加油"], "家樂福");
assert(pushed[0] === "家樂福", "newest query is first");
assert(
  pushRecentSearch(["家樂福", "便當"], "家樂福").join(",") === "家樂福,便當",
  "repeating a query moves it to the front",
);
assert(pushRecentSearch(["便當"], "  ").join(",") === "便當", "blank queries are ignored");
assert(pushRecentSearch(["家"], "家樂福").join(",") === "家樂福", "a longer query replaces its prefix");
assert(pushRecentSearch(["便當"], "家").join(",") === "便當", "a single character is ignored");
assert(pushRecentSearch(["1", "2", "3", "4", "5", "6", "7", "8"], "9").length === 8, "cap at 8");

console.log("recent-search tests ok");
