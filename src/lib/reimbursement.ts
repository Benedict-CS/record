import type { Transaction } from "@/lib/types";

/**
 * Amount shown on expense rows and in "花" day totals.
 * Full cash out until 銷帳; after received, show self-pay (amount − reimbursable).
 * Account balances and month net always use the full transaction.amount.
 */
export function expenseDisplayAmount(tx: Pick<
  Transaction,
  "type" | "amount" | "reimbursable_amount" | "reimbursement_status"
>): number {
  if (tx.type !== "expense") return tx.amount;
  const reimb = tx.reimbursable_amount;
  if (
    reimb != null &&
    reimb > 0 &&
    tx.reimbursement_status === "received"
  ) {
    return Math.max(0, tx.amount - reimb);
  }
  return tx.amount;
}

/** Note prefix releaseHold() writes on the refund income. */
export const HOLD_REFUND_NOTE_PREFIX = "退回：";

/**
 * Ids of refund incomes that belong to a hold in the same list.
 * Pair with isHoldRefundIncome so every aggregation skips the same rows.
 */
export function holdRefundIncomeIds(
  transactions: readonly Pick<Transaction, "type" | "release_transaction_id">[],
): Set<string> {
  const ids = new Set<string>();
  for (const tx of transactions) {
    if (tx.type === "hold" && tx.release_transaction_id) {
      ids.add(tx.release_transaction_id);
    }
  }
  return ids;
}

/**
 * A hold refund is cash coming back, not earnings. Same-period refunds are
 * matched by id; a refund booked in a later month is matched by note prefix.
 */
export function isHoldRefundIncome(
  tx: Pick<Transaction, "id" | "type" | "note">,
  refundIds: ReadonlySet<string>,
): boolean {
  if (tx.type !== "income") return false;
  return refundIds.has(tx.id) || tx.note.startsWith(HOLD_REFUND_NOTE_PREFIX);
}

export function isReimbursementPending(
  tx: Pick<
    Transaction,
    "type" | "reimbursable_amount" | "reimbursement_status"
  >,
): boolean {
  return (
    tx.type === "expense" &&
    tx.reimbursable_amount != null &&
    tx.reimbursable_amount > 0 &&
    tx.reimbursement_status === "pending"
  );
}

export function isReimbursementReceived(
  tx: Pick<
    Transaction,
    "type" | "reimbursable_amount" | "reimbursement_status"
  >,
): boolean {
  return (
    tx.type === "expense" &&
    tx.reimbursable_amount != null &&
    tx.reimbursable_amount > 0 &&
    tx.reimbursement_status === "received"
  );
}
