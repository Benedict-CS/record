import { parseSplits, splitSelfPay, splitsOverAmount, splitsSummary, splitTotal } from "./split";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(parseSplits(null) === null, "null stays null");
assert(parseSplits("nope") === null, "junk json is ignored");
assert(parseSplits([{ name: " 阿明 ", amount: 120 }])?.[0].name === "阿明", "trims names");
assert(parseSplits([{ name: "x", amount: 0 }]) === null, "zero shares drop");
assert(splitTotal(parseSplits([{ name: "a", amount: 40 }, { name: "b", amount: 60 }])) === 100, "sums shares");
assert(splitSelfPay(300, parseSplits([{ name: "a", amount: 100 }])) === 200, "self keeps the rest");
assert(splitsOverAmount(100, parseSplits([{ name: "a", amount: 120 }])) === true, "over the bill");
assert(
  splitsSummary(300, parseSplits([{ name: "阿明", amount: 100 }])) ===
    "分帳 1 人 · 自己 200 · 阿明",
  "one-line summary",
);

console.log("split.test.ts ok");
