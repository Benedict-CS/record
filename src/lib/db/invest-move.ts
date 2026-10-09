import { db } from "@/lib/db/schema";
import { formatMoney } from "@/lib/format";
import { isSpendableBankHolding } from "@/lib/holding-spend";

const INVEST_TARGET_KINDS = ["fund", "stock"] as const;

function centsOf(amount: number) {
  return Math.round(amount * 100);
}

function stamp() {
  return {
    updated_at: new Date().toISOString(),
    sync_status: "pending" as const,
  };
}

async function loadPair(
  bookId: string,
  sourceId: string,
  targetId: string,
) {
  if (sourceId === targetId) {
    throw new Error("扣款和買進不能是同一筆存款");
  }
  const [source, target] = await Promise.all([
    db.holdings.get(sourceId),
    db.holdings.get(targetId),
  ]);
  if (!source || source.deleted_at || source.book_id !== bookId) {
    throw new Error("找不到要扣款的銀行存款");
  }
  if (!target || target.deleted_at || target.book_id !== bookId) {
    throw new Error("找不到要買進的股票或基金");
  }
  if (!isSpendableBankHolding(source.kind)) {
    throw new Error("只能從活存或定存扣款");
  }
  if (!(INVEST_TARGET_KINDS as readonly string[]).includes(target.kind)) {
    throw new Error("定期定額只能買進股票或基金");
  }
  return { source, target };
}

/** Move cash from a bank holding into a stock or fund. Caller holds the write transaction. */
export async function applyInvestMove(input: {
  bookId: string;
  sourceId: string;
  targetId: string;
  amount: number;
}): Promise<void> {
  const { source, target } = await loadPair(
    input.bookId,
    input.sourceId,
    input.targetId,
  );
  const nextSource = centsOf(source.amount) - centsOf(input.amount);
  if (nextSource < 0) {
    throw new Error(
      `「${source.name}」餘額不足，目前 ${formatMoney(source.amount)}`,
    );
  }
  const meta = stamp();
  await db.holdings.update(source.id, { amount: nextSource / 100, ...meta });
  await db.holdings.update(target.id, {
    amount: (centsOf(target.amount) + centsOf(input.amount)) / 100,
    ...meta,
  });
}

/** Undo a purchase. Caller holds the write transaction. */
export async function reverseInvestMove(input: {
  bookId: string;
  sourceId: string;
  targetId: string;
  amount: number;
  /** Skip missing / deleted holdings instead of throwing (used on delete). */
  lenient?: boolean;
}): Promise<void> {
  let source;
  let target;
  try {
    ({ source, target } = await loadPair(
      input.bookId,
      input.sourceId,
      input.targetId,
    ));
  } catch (error) {
    if (input.lenient) return;
    throw error;
  }
  const nextTarget = centsOf(target.amount) - centsOf(input.amount);
  if (nextTarget < 0) {
    if (input.lenient) return;
    throw new Error(
      `「${target.name}」餘額不足，目前 ${formatMoney(target.amount)}`,
    );
  }
  const meta = stamp();
  await db.holdings.update(target.id, { amount: nextTarget / 100, ...meta });
  await db.holdings.update(source.id, {
    amount: (centsOf(source.amount) + centsOf(input.amount)) / 100,
    ...meta,
  });
}
