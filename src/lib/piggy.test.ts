import {
  isPiggyBackup,
  piggyTransactionId,
  readPiggyHistory,
  recordCategoryName,
  taipeiDate,
} from "./piggy";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

const SAMPLE = `BK#V2
BK#C
{"a":12,"b":1,"c":"午餐","d":"Expense","e":9,"f":0,"g":false}
{"a":14,"b":1,"c":"薪資","d":"Income","e":2,"f":0,"g":false}
{"a":16,"b":1,"c":"宿舍","d":"Expense","e":2,"f":0,"g":false}
BK#R
{"a":5,"b":1596792602052,"c":1596274188684,"d":2,"e":0,"f":100,"g":0,"h":"便當","i":12,"j":"Expense","k":0,"l":false}
{"a":9,"b":1767225600000,"c":1767225600000,"d":2,"e":0,"f":50,"g":0,"h":"","i":12,"j":"Expense","k":0,"l":false}
{"a":14,"b":1700000000000,"c":1700000000000,"d":2,"e":0,"f":30000,"g":0,"h":"","i":14,"j":"Income","k":0,"l":false}
{"a":16,"b":1600000000000,"c":1600000000000,"d":2,"e":0,"f":8000,"g":0,"h":"","i":16,"j":"Expense","k":0,"l":false}
`;

assert(isPiggyBackup(SAMPLE), "bk header is a piggy backup");
assert(!isPiggyBackup('{"version":2}'), "record json is not piggy");
assert(piggyTransactionId(5) === "70696767-7900-4000-8000-000000000005", "id is stable");
assert(taipeiDate(1596274188684) === "2020-08-01", "epoch stays on the Taipei calendar day");
assert(recordCategoryName("expense", "進修") === "學習", "study maps to 學習");
assert(recordCategoryName("income", "薪資") === "薪水", "salary maps to 薪水");

const open = readPiggyHistory(SAMPLE, new Set());
assert(open.skipped2026 === 1, "2026 row is skipped");
assert(open.drafts.length === 3, "three historical rows remain");
assert(open.drafts[0]?.date === "2020-08-01", "first row is 1 Aug 2020");
assert(open.drafts[0]?.categoryName === "午餐", "lunch category kept");
assert(open.drafts[1]?.categoryName === "薪水", "salary category mapped");
assert(open.drafts[2]?.categoryName === "住宿費", "dorm maps to 住宿費");
assert(open.drafts.every((row) => row.date < "2026-01-01"), "nothing from 2026 is imported");

const blocked = readPiggyHistory(SAMPLE, new Set(["2020-08"]));
assert(blocked.drafts.length === 2, "an occupied month is left out");
assert(blocked.skippedMonths.join() === "2020-08", "skipped month is named");
assert(blocked.skippedMonthRows === 1, "occupied month counts its rows");
assert(blocked.drafts.every((row) => row.month !== "2020-08"), "August 2020 is absent");

console.log("piggy tests ok");
