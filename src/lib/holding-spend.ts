/**
 * Bank-card expenses move money out of a 存款 holding.
 * Cash (and every non-bank account) never changes holdings.
 */

export type HoldingSpendLink = {
  holdingId: string | null;
  /** Positive cash that left the holding. */
  amount: number;
};

export type HoldingBalanceDelta = {
  holdingId: string;
  /** Cents added to the holding. Negative means a deduction. */
  deltaCents: number;
};

/** Kinds a bank expense can draw from. Cash holdings stay manual. */
export const SPENDABLE_HOLDING_KINDS = ["savings", "deposit"] as const;

export function isSpendableBankHolding(kind: string) {
  return (SPENDABLE_HOLDING_KINDS as readonly string[]).includes(kind);
}

function deductionAmount(amount: number) {
  const value = Math.abs(Number(amount));
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Deduction already stored on a transaction, including rows whose account later changed. */
export function storedHoldingSpend(input: {
  type: string;
  amount: number;
  holdingId: string | null | undefined;
  deleted: boolean;
}): HoldingSpendLink {
  const holdingId = input.holdingId ?? null;
  if (input.deleted || input.type !== "expense" || !holdingId) {
    return { holdingId: null, amount: 0 };
  }
  return { holdingId, amount: deductionAmount(input.amount) };
}

/** Deduction a save should apply. Only live bank expenses keep the link. */
export function nextHoldingSpend(input: {
  type: string;
  amount: number;
  holdingId: string | null | undefined;
  accountType: string | null | undefined;
  deleted: boolean;
}): HoldingSpendLink {
  if (input.accountType !== "bank") {
    return { holdingId: null, amount: 0 };
  }
  return storedHoldingSpend(input);
}

/** Net cents to add back (positive) or take (negative) when a link changes. */
export function holdingBalanceDeltas(
  previous: HoldingSpendLink,
  next: HoldingSpendLink,
): HoldingBalanceDelta[] {
  const cents = new Map<string, number>();
  const add = (holdingId: string | null, deltaCents: number) => {
    if (!holdingId || deltaCents === 0) return;
    cents.set(holdingId, (cents.get(holdingId) ?? 0) + deltaCents);
  };
  add(previous.holdingId, Math.round(previous.amount * 100));
  add(next.holdingId, -Math.round(next.amount * 100));
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
