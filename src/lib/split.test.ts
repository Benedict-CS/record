import {
  parseSplits,
  splitPendingTotal,
  splitSelfPay,
  splitSettledTotal,
  splitsOverAmount,
  splitsSummary,
  splitTotal,
} from "./split";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assert(parseSplits(null) === null, "null stays null");
assert(parseSplits("nope") === null, "junk json is ignored");
assert(parseSplits([{ name: " 阿明 ", amount: 120 }])?.[0].name === "阿明", "trims names");
assert(parseSplits([{ name: "x", amount: 0 }]) === null, "zero shares drop");
assert(
  parseSplits([{ name: "a", amount: 50, settled: true }])?.[0].settled === true,
  "preserves settled status",
);
assert(splitTotal(parseSplits([{ name: "a", amount: 40 }, { name: "b", amount: 60 }])) === 100, "sums shares");
assert(
  splitSettledTotal(
    parseSplits([
      { name: "a", amount: 40, settled: true },
      { name: "b", amount: 60, settled: false },
    ]),
  ) === 40,
  "settled total",
);
assert(
  splitPendingTotal(
    parseSplits([
      { name: "a", amount: 40, settled: true },
      { name: "b", amount: 60, settled: false },
    ]),
  ) === 60,
  "pending total",
);
assert(splitSelfPay(300, parseSplits([{ name: "a", amount: 100 }])) === 200, "self keeps the rest");
assert(splitsOverAmount(100, parseSplits([{ name: "a", amount: 120 }])) === true, "over the bill");

assert(
  splitsSummary(300, parseSplits([{ name: "阿明", amount: 100 }])) ===
    "分帳待還 100 (阿明) · 自己 200",
  "one friend pending summary",
);
assert(
  splitsSummary(300, parseSplits([{ name: "阿明", amount: 100, settled: true }])) ===
    "分帳已全還 · 自己 200",
  "all settled summary",
);
assert(
  splitsSummary(
    500,
    parseSplits([
      { name: "阿明", amount: 100, settled: true },
      { name: "小華", amount: 150, settled: false },
    ]),
  ) === "待還 150 (小華) · 已還 100 · 自己 250",
  "partial settled summary",
);

console.log("split.test.ts ok");
