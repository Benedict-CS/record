/**
 * Bank-account rows move a 存款 holding.
 * An expense deducts the full amount. Income adds the full amount.
 * Cash (and every non-bank account) never changes holdings.
 */

export type HoldingSpendLink = {
  holdingId: string | null;
  /** Positive cash moved. Zero stays linked without a balance change. */
  amount: number;
  /** -1 deducts the holding (expense). +1 credits it (income). */
  sign: -1 | 1;
};

export const NO_HOLDING_LINK: HoldingSpendLink = {
  holdingId: null,
  amount: 0,
  sign: -1,
};

export type HoldingBalanceDelta = {
  holdingId: string;
  /** Cents added to the holding. Negative means a deduction. */
  deltaCents: number;
};

/** Kinds a bank expense or income can move. Cash holdings stay manual. */
export const SPENDABLE_HOLDING_KINDS = ["savings", "deposit"] as const;

export function isSpendableBankHolding(kind: string) {
  return (SPENDABLE_HOLDING_KINDS as readonly string[]).includes(kind);
}

function deductionAmount(amount: number) {
  const value = Math.abs(Number(amount));
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Movement already stored on a transaction, including rows whose account later changed. */
export function storedHoldingSpend(input: {
  type: string;
  amount: number;
  holdingId: string | null | undefined;
  deleted: boolean;
}): HoldingSpendLink {
  const holdingId = input.holdingId ?? null;
  const linked =
    !input.deleted &&
    Boolean(holdingId) &&
    (input.type === "expense" || input.type === "income");
  if (!linked || !holdingId) return NO_HOLDING_LINK;
  return {
    holdingId,
    amount: deductionAmount(input.amount),
    sign: input.type === "income" ? 1 : -1,
  };
}

/** Movement a save should apply. Only live bank expenses and income keep the link. */
export function nextHoldingSpend(input: {
  type: string;
  amount: number;
  holdingId: string | null | undefined;
  accountType: string | null | undefined;
  deleted: boolean;
}): HoldingSpendLink {
  if (input.accountType !== "bank") return NO_HOLDING_LINK;
  if (input.type !== "expense" && input.type !== "income") return NO_HOLDING_LINK;
  return storedHoldingSpend(input);
}

/**
 * The save needs the target holding to still exist.
 * A smaller movement on the same card can be saved after that card is gone.
 * A new card, or a larger movement, has to land on a live 活存 or 定存.
 */
export function holdingLinkNeedsLiveTarget(
  previous: HoldingSpendLink,
  next: HoldingSpendLink,
): boolean {
  if (!next.holdingId || next.amount <= 0) return false;
  const sameCard =
    previous.holdingId === next.holdingId && previous.sign === next.sign;
  return !sameCard || next.amount > previous.amount;
}

/** Net cents to apply when a link changes. Positive credits the holding. */
export function holdingBalanceDeltas(
  previous: HoldingSpendLink,
  next: HoldingSpendLink,
): HoldingBalanceDelta[] {
  const cents = new Map<string, number>();
  const add = (holdingId: string | null, deltaCents: number) => {
    if (!holdingId || deltaCents === 0) return;
    cents.set(holdingId, (cents.get(holdingId) ?? 0) + deltaCents);
  };
  add(previous.holdingId, -previous.sign * Math.round(previous.amount * 100));
  add(next.holdingId, next.sign * Math.round(next.amount * 100));
  return [...cents.entries()]
    .filter(([, deltaCents]) => deltaCents !== 0)
    .map(([holdingId, deltaCents]) => ({ holdingId, deltaCents }));
}

/**
 * Apply deltas to balances stored in cents.
 * On a missing holding or a negative result, balances are left unchanged.
 */
export function nextHoldingBalances(
  currentCents: Record<string, number>,
  deltas: HoldingBalanceDelta[],
): {
  balances: Record<string, number>;
  shortfallId: string | null;
  missingId: string | null;
} {
  const balances = { ...currentCents };
  for (const delta of deltas) {
    if (!(delta.holdingId in balances)) {
      return {
        balances: currentCents,
        shortfallId: null,
        missingId: delta.holdingId,
      };
    }
    const next = balances[delta.holdingId] + delta.deltaCents;
    if (next < 0) {
      return {
        balances: currentCents,
        shortfallId: delta.holdingId,
        missingId: null,
      };
    }
    balances[delta.holdingId] = next;
  }
  return { balances, shortfallId: null, missingId: null };
}
