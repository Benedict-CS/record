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
