import { rankNotes } from "./note-suggest";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

const rows = [
  { type: "expense", category_id: "food", note: "家樂福", date: "2026-10-01" },
  { type: "expense", category_id: "food", note: "家樂福", date: "2026-10-08" },
  { type: "expense", category_id: "food", note: "便當", date: "2026-10-07" },
  { type: "expense", category_id: "bike", note: "加油", date: "2026-10-06" },
  { type: "income", category_id: "salary", note: "薪水", date: "2026-10-05" },
  { type: "income", category_id: "other", note: "退回：宿舍押金", date: "2026-10-04" },
  { type: "hold", category_id: null, note: "  ", date: "2026-10-03" },
];

const ranked = rankNotes(rows, {
  type: "expense",
  categoryId: "food",
  skipPrefix: "退回：",
});
assert(ranked[0] === "家樂福", "same category + newer date wins, duplicates collapse");
assert(ranked[1] === "便當", "other notes in that category come next");
assert(ranked.indexOf("加油") > ranked.indexOf("便當"), "same type, other category still appears later");
assert(ranked.indexOf("薪水") > ranked.indexOf("加油"), "other types wait behind same-type notes");
assert(!ranked.includes("退回：宿舍押金"), "hold refund notes are skipped");
assert(!ranked.some((note) => !note.trim()), "blank notes are skipped");

const filtered = rankNotes(rows, { query: "家" });
assert(filtered.length === 1 && filtered[0] === "家樂福", "query filters by substring");

console.log("note-suggest tests ok");
