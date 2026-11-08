import { roundMoney } from "./calculator";
import type { SplitShare } from "./types";

export const SPLIT_NAME_MAX = 20;
export const SPLIT_MAX_PEOPLE = 8;

export function normalizeSplitName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, SPLIT_NAME_MAX);
}

export function parseSplits(value: unknown): SplitShare[] | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return parseSplits(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) return null;
  const rows: SplitShare[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const name = normalizeSplitName((row as SplitShare).name);
    const amount = roundMoney(Number((row as SplitShare).amount));
    if (!name || !(amount > 0)) continue;
    const settled = Boolean((row as SplitShare).settled);
    rows.push(settled ? { name, amount, settled: true } : { name, amount });
    if (rows.length >= SPLIT_MAX_PEOPLE) break;
  }
  return rows.length > 0 ? rows : null;
}

export function splitTotal(splits: SplitShare[] | null | undefined): number {
  if (!splits?.length) return 0;
  return roundMoney(splits.reduce((sum, row) => sum + row.amount, 0));
}

/** Total amount of shares marked as settled (paid back). */
export function splitSettledTotal(splits: SplitShare[] | null | undefined): number {
  if (!splits?.length) return 0;
  return roundMoney(
    splits.reduce((sum, row) => sum + (row.settled ? row.amount : 0), 0),
  );
}

/** Total amount of shares still pending repayment. */
export function splitPendingTotal(splits: SplitShare[] | null | undefined): number {
  if (!splits?.length) return 0;
  return roundMoney(
    splits.reduce((sum, row) => sum + (row.settled ? 0 : row.amount), 0),
  );
}

/** What you still cover after others' shares. */
export function splitSelfPay(
  amount: number,
  splits: SplitShare[] | null | undefined,
): number {
  return roundMoney(Math.max(0, amount - splitTotal(splits)));
}

export function splitsOverAmount(
  amount: number,
  splits: SplitShare[] | null | undefined,
): boolean {
  return splitTotal(splits) > amount + 0.001;
}

export function splitsSummary(
  amount: number,
  splits: SplitShare[] | null | undefined,
): string | null {
  if (!splits?.length) return null;
  const self = splitSelfPay(amount, splits);
  const pending = splits.filter((row) => !row.settled);
  const settled = splits.filter((row) => row.settled);

  if (pending.length === 0) {
    return `分帳已全還 · 自己 ${self}`;
  }
  if (settled.length === 0) {
    const names = pending.map((row) => row.name).join("、");
    return `分帳待還 ${splitPendingTotal(splits)} (${names}) · 自己 ${self}`;
  }
  const pendingNames = pending.map((row) => row.name).join("、");
  return `待還 ${splitPendingTotal(splits)} (${pendingNames}) · 已還 ${splitSettledTotal(splits)} · 自己 ${self}`;
}
