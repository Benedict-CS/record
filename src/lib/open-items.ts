import { isReimbursementPending } from "@/lib/reimbursement";
import type { Transaction } from "@/lib/types";

/** A hold still sitting in the account, waiting for 退回. */
export function isUnreleasedHold(
  tx: Pick<Transaction, "type" | "hold_status">,
): boolean {
  return tx.type === "hold" && (tx.hold_status ?? "held") === "held";
}

/** Something the home list should surface until the user closes it. */
export function isOpenItem(
  tx: Pick<
    Transaction,
    "type" | "hold_status" | "reimbursable_amount" | "reimbursement_status"
  >,
): boolean {
  return isReimbursementPending(tx) || isUnreleasedHold(tx);
}
