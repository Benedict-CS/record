/**
 * Piggy (豬豬記帳) BK#V2 backup. Records are one JSON object per line
 * under the BK#R section. Amounts are TWD. Dates are epoch milliseconds.
 */

export const PIGGY_HISTORY_BEFORE = "2026-01-01";

const CATEGORY_NAME: Record<string, string> = {
  "expense:早餐": "早餐",
  "expense:午餐": "午餐",
  "expense:晚餐": "晚餐",
  "expense:交通": "交通",
  "expense:機車": "機車",
  "expense:電話費": "電話費",
  "expense:宿舍": "住宿費",
  "expense:娛樂": "娛樂",
  "expense:醫療": "醫療",
  "expense:進修": "學習",
  "expense:聚餐": "請客",
  "expense:其他": "其他支出",
  "income:薪資": "薪水",
  "income:投資": "投資收益",
  "income:其他": "其他收入",
};

export type PiggyKind = "expense" | "income";

export type PiggyDraft = {
  id: string;
  type: PiggyKind;
  amount: number;
  date: string;
  month: string;
  note: string;
  categoryName: string;
};

export type PiggyReadResult = {
  drafts: PiggyDraft[];
  skipped2026: number;
  /** Pre-2026 months left untouched because this book already has that month. */
  skippedMonths: string[];
  skippedMonthRows: number;
  ignored: number;
};

type PiggyCategory = { name: string; kind: PiggyKind };
type PiggyRecord = {
  a: number;
  b: number;
  c: number;
  f: number;
  h: string;
  i: number;
  j: string;
  l: boolean;
};

/** Stable uuid so importing the same backup twice does not duplicate a row. */
export function piggyTransactionId(piggyId: number): string {
  if (!Number.isInteger(piggyId) || piggyId < 0 || piggyId > 0xffffffffffff) {
    throw new Error("豬豬記帳的編號無法轉成紀錄");
  }
  return `70696767-7900-4000-8000-${piggyId.toString(16).padStart(12, "0")}`;
}

export function taipeiDate(epochMs: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMs));
}

export function isPiggyBackup(text: string): boolean {
  return text.trimStart().startsWith("BK#");
}

export function recordCategoryName(kind: PiggyKind, piggyName: string): string {
  return CATEGORY_NAME[`${kind}:${piggyName}`] ?? (kind === "income" ? "其他收入" : "其他支出");
}

export function readPiggyHistory(
  text: string,
  occupiedMonths: ReadonlySet<string>,
): PiggyReadResult {
  if (!isPiggyBackup(text)) {
    throw new Error("這不是豬豬記帳的備份檔");
  }

  const categories = new Map<number, PiggyCategory>();
  const drafts: PiggyDraft[] = [];
  const skippedMonthSet = new Set<string>();
  let section = "";
  let skipped2026 = 0;
  let skippedMonthRows = 0;
  let ignored = 0;

  for (const line of text.split(/\n/)) {
    if (line.startsWith("BK#")) {
      section = line.trim();
      continue;
    }
    if (!line.startsWith("{")) continue;
    const row = JSON.parse(line) as { a?: number; c?: string; d?: string };
    if (section === "BK#C" && typeof row.a === "number" && typeof row.c === "string") {
      const kind = row.d === "Income" ? "income" : "expense";
      categories.set(row.a, { name: row.c, kind });
      continue;
    }
    if (section !== "BK#R") continue;

    const record = row as unknown as PiggyRecord;
    if (record.l) {
      ignored += 1;
      continue;
    }
    const kind: PiggyKind | null =
      record.j === "Expense" ? "expense" : record.j === "Income" ? "income" : null;
    const amount = Number(record.f);
    if (!kind || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(record.c)) {
      ignored += 1;
      continue;
    }
    const date = taipeiDate(record.c);
    if (date >= PIGGY_HISTORY_BEFORE) {
      skipped2026 += 1;
      continue;
    }
    const month = date.slice(0, 7);
    if (occupiedMonths.has(month)) {
      skippedMonthSet.add(month);
      skippedMonthRows += 1;
      continue;
    }
    const source = categories.get(record.i);
    const categoryKind = source?.kind ?? kind;
    drafts.push({
      id: piggyTransactionId(record.a),
      type: kind,
      amount,
      date,
      month,
      note: typeof record.h === "string" ? record.h : "",
      categoryName: recordCategoryName(categoryKind, source?.name ?? "其他"),
    });
  }

  return {
    drafts,
    skipped2026,
    skippedMonths: [...skippedMonthSet].sort(),
    skippedMonthRows,
    ignored,
  };
}
