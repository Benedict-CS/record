import { isReimbursementPending } from "@/lib/reimbursement";
import type { SplitShare, Transaction } from "@/lib/types";

/** A hold still sitting in the account, waiting for 退回. */
export function isUnreleasedHold(
  tx: Pick<Transaction, "type" | "hold_status">,
): boolean {
  return tx.type === "hold" && (tx.hold_status ?? "held") === "held";
}

/** Split expense with at least one friend who hasn't repaid yet. */
export function isSplitPending(
  tx: Pick<Transaction, "type"> & { splits?: SplitShare[] | null },
): boolean {
  if (tx.type !== "expense" || !tx.splits?.length) return false;
  return tx.splits.some((s) => !s.settled && s.amount > 0);
}

/** Something the home list should surface until the user closes it. */
export function isOpenItem(
  tx: Pick<
    Transaction,
    "type" | "hold_status" | "reimbursable_amount" | "reimbursement_status"
  > & { splits?: SplitShare[] | null },
): boolean {
  return isReimbursementPending(tx) || isUnreleasedHold(tx) || isSplitPending(tx);
}

type OpenRow = Pick<
  Transaction,
  | "id"
  | "type"
  | "date"
  | "note"
  | "amount"
  | "category_id"
  | "hold_status"
  | "reimbursable_amount"
  | "reimbursement_status"
  | "splits"
>;

export type OpenGroup<T extends OpenRow = OpenRow> = {
  key: string;
  kind: "hold" | "reimbursement" | "split";
  title: string;
  amount: number;
  items: T[];
  splitPerson?: string;
};

function openTitle(
  tx: OpenRow,
  categoryName?: (id: string | null) => string | undefined,
): string {
  if (isUnreleasedHold(tx)) {
    const note = tx.note.trim();
    return note ? `扣住：${note}` : "扣住";
  }
  const note = tx.note.trim();
  if (note) return note;
  return (tx.category_id && categoryName?.(tx.category_id)) || "待核銷";
}

function openAmount(tx: OpenRow): number {
  if (isReimbursementPending(tx)) return tx.reimbursable_amount ?? tx.amount;
  return tx.amount;
}

/**
 * Collapse the same hold, reimbursement, or friend split across months into one row.
 * Items inside a group stay oldest first.
 */
export function groupOpenItems<T extends OpenRow>(
  items: T[],
  categoryName?: (id: string | null) => string | undefined,
): OpenGroup<T>[] {
  const groups = new Map<string, OpenGroup<T>>();
  for (const tx of items) {
    if (isUnreleasedHold(tx)) {
      const kind = "hold";
      const title = openTitle(tx, categoryName);
      const key = `${kind}:${title}`;
      const group = groups.get(key);
      if (group) {
        group.items.push(tx);
        group.amount += openAmount(tx);
      } else {
        groups.set(key, {
          key,
          kind,
          title,
          amount: openAmount(tx),
          items: [tx],
        });
      }
    }

    if (isReimbursementPending(tx)) {
      const kind = "reimbursement";
      const title = openTitle(tx, categoryName);
      const key = `${kind}:${title}`;
      const reimbAmt = tx.reimbursable_amount ?? tx.amount;
      const group = groups.get(key);
      if (group) {
        group.items.push(tx);
        group.amount += reimbAmt;
      } else {
        groups.set(key, {
          key,
          kind,
          title,
          amount: reimbAmt,
          items: [tx],
        });
      }
    }

    if (isSplitPending(tx) && tx.splits) {
      for (const share of tx.splits) {
        if (!share.settled && share.amount > 0) {
          const kind = "split";
          const title = `${share.name} 待還款`;
          const key = `split:${share.name}`;
          const group = groups.get(key);
          if (group) {
            group.items.push(tx);
            group.amount += share.amount;
          } else {
            groups.set(key, {
              key,
              kind,
              title,
              amount: share.amount,
              items: [tx],
              splitPerson: share.name,
            });
          }
        }
      }
    }
  }

  for (const group of groups.values()) {
    group.items.sort((a, b) => a.date.localeCompare(b.date));
  }
  return [...groups.values()].sort(
    (a, b) =>
      a.items[0].date.localeCompare(b.items[0].date) ||
      a.title.localeCompare(b.title, "zh-Hant"),
  );
}
