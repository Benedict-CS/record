export type NoteSource = {
  type: string;
  category_id: string | null;
  note: string;
  date: string;
};

const DEFAULT_LIMIT = 8;

/**
 * Rank unique notes: same category first, then same type, then recency.
 * Skip empty notes and hold-refund incomes (those start with skipPrefix).
 */
export function rankNotes(
  rows: readonly NoteSource[],
  options: {
    type?: string;
    categoryId?: string | null;
    query?: string;
    limit?: number;
    skipPrefix?: string;
  } = {},
): string[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const query = (options.query ?? "").trim().toLowerCase();
  const skip = options.skipPrefix ?? "";
  const seen = new Set<string>();
  const scored: { note: string; score: number; date: string }[] = [];
  const newestFirst = [...rows].sort((a, b) => b.date.localeCompare(a.date));

  for (const row of newestFirst) {
    const note = row.note.trim();
    if (!note) continue;
    if (skip && note.startsWith(skip)) continue;
    const key = note.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (query && !key.includes(query)) continue;
    let score = 0;
    if (options.type && row.type === options.type) score += 2;
    if (options.categoryId && row.category_id === options.categoryId) score += 3;
    scored.push({ note, score, date: row.date });
  }

  scored.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
  return scored.slice(0, limit).map((row) => row.note);
}
