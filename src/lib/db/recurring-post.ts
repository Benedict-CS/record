import { getClientId } from "@/lib/client-id";
import { getOwnerId } from "@/lib/db/owner";
import { applyInvestMove } from "@/lib/db/invest-move";
import { db } from "@/lib/db/schema";
import { createTransaction } from "@/lib/db/crud";
import { dueDate, periodsDue, recurringTransactionId } from "@/lib/recurring";
import type { RecurringRule } from "@/lib/types";

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nowIso() {
  return new Date().toISOString();
}

async function markRule(
  rule: RecurringRule,
  patch: Partial<Pick<RecurringRule, "last_posted" | "last_error">>,
) {
  await db.recurring_rules.update(rule.id, {
    ...patch,
    updated_at: nowIso(),
    client_id: getClientId(),
    sync_status: "pending",
  });
  if (patch.last_posted !== undefined) rule.last_posted = patch.last_posted;
  if (patch.last_error !== undefined) rule.last_error = patch.last_error;
}

function cents(value: number) {
  return Math.round(value * 100);
}

async function postExpense(rule: RecurringRule, period: string) {
  const [year, month] = period.split("-").map(Number);
  const date = dueDate(year, month, rule.day_of_month);
  const totalCents = cents(rule.amount);
  const heldCents = Math.min(
    totalCents,
    rule.held_amount != null && rule.held_amount > 0 ? cents(rule.held_amount) : 0,
  );
  const spentCents = totalCents - heldCents;

  if (spentCents > 0) {
    const id = recurringTransactionId(rule.id, period);
    const existing = await db.transactions.get(id);
    if (!existing) {
      const spent = spentCents / 100;
      const reimbursable =
        rule.reimbursable_amount != null && rule.reimbursable_amount > 0
          ? Math.min(rule.reimbursable_amount, spent)
          : null;
      await createTransaction(rule.book_id, {
        id,
        type: "expense",
        amount: spent,
        date,
        note: rule.name,
        account_id: rule.account_id,
        category_id: rule.category_id,
        holding_id: rule.holding_id,
        reimbursable_amount: reimbursable,
        reimbursement_status: reimbursable ? "pending" : null,
      });
    }
  }

  if (heldCents > 0) {
    const id = recurringTransactionId(`${rule.id}:hold`, period);
    const existing = await db.transactions.get(id);
    if (!existing) {
      await createTransaction(rule.book_id, {
        id,
        type: "hold",
        amount: heldCents / 100,
        date,
        note: rule.name,
        account_id: rule.account_id,
        category_id: rule.category_id,
        hold_status: "held",
      });
    }
  }

  await markRule(rule, { last_posted: period, last_error: null });
}

async function postInvest(rule: RecurringRule, period: string) {
  if (!rule.holding_id || !rule.target_holding_id) {
    throw new Error("定期定額要選扣款銀行，以及買進的股票或基金");
  }
  const [year, month] = period.split("-").map(Number);
  const id = recurringTransactionId(rule.id, period);
  const existing = await db.transactions.get(id);
  if (!existing) {
    const tx = {
      id,
      user_id: getOwnerId(),
      updated_at: nowIso(),
      deleted_at: null,
      client_id: getClientId(),
      sync_status: "pending" as const,
      book_id: rule.book_id,
      type: "invest" as const,
      amount: rule.amount,
      date: dueDate(year, month, rule.day_of_month),
      note: rule.name,
      account_id: rule.account_id,
      category_id: null,
      transfer_account_id: null,
      hold_status: null,
      release_transaction_id: null,
      reimbursable_amount: null,
      reimbursement_status: null,
      holding_id: rule.holding_id,
      tag: null,
      target_holding_id: rule.target_holding_id,
    };
    await db.transaction("rw", db.transactions, db.holdings, async () => {
      await applyInvestMove({
        bookId: rule.book_id,
        sourceId: rule.holding_id!,
        targetId: rule.target_holding_id!,
        amount: rule.amount,
      });
      await db.transactions.add(tx);
    });
  }
  await markRule(rule, { last_posted: period, last_error: null });
}

/** Post every due month for this book's rules. Stops a rule on the first failure. */
export async function postDueRecurring(
  bookId: string,
  today = todayIso(),
): Promise<number> {
  const rules = (await db.recurring_rules.where("book_id").equals(bookId).toArray())
    .filter((row) => !row.deleted_at);
  let posted = 0;
  for (const rule of rules) {
    const periods = periodsDue({
      startMonth: rule.start_month,
      endMonth: rule.end_month,
      dayOfMonth: rule.day_of_month,
      lastPosted: rule.last_posted,
      today,
    });
    for (const period of periods) {
      try {
        if (rule.kind === "invest") await postInvest(rule, period);
        else await postExpense(rule, period);
        posted += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "固定扣款失敗";
        await markRule(rule, { last_error: message });
        break;
      }
    }
  }
  return posted;
}

export async function listRecurringRules(bookId: string): Promise<RecurringRule[]> {
  const rows = await db.recurring_rules.where("book_id").equals(bookId).toArray();
  return rows
    .filter((row) => !row.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "zh-Hant"));
}

export async function createRecurringRule(
  bookId: string,
  input: {
    name: string;
    kind: RecurringRule["kind"];
    amount: number;
    dayOfMonth: number;
    startMonth: string;
    endMonth: string | null;
    reimbursableAmount: number | null;
    heldAmount: number | null;
    accountId: string;
    categoryId: string | null;
    holdingId: string | null;
    targetHoldingId: string | null;
  },
): Promise<RecurringRule> {
  const count = await db.recurring_rules.where("book_id").equals(bookId).count();
  const rule: RecurringRule = {
    id: crypto.randomUUID(),
    user_id: getOwnerId(),
    updated_at: nowIso(),
    deleted_at: null,
    client_id: getClientId(),
    sync_status: "pending",
    book_id: bookId,
    name: input.name.trim(),
    kind: input.kind,
    amount: input.amount,
    day_of_month: input.dayOfMonth,
    start_month: input.startMonth,
    end_month: input.endMonth,
    reimbursable_amount:
      input.kind === "expense" &&
      input.reimbursableAmount != null &&
      input.reimbursableAmount > 0
        ? input.reimbursableAmount
        : null,
    held_amount:
      input.kind === "expense" &&
      input.heldAmount != null &&
      input.heldAmount > 0
        ? input.heldAmount
        : null,
    last_posted: null,
    last_error: null,
    account_id: input.accountId,
    category_id: input.categoryId,
    holding_id: input.holdingId,
    target_holding_id: input.targetHoldingId,
    sort_order: count,
  };
  await db.recurring_rules.add(rule);
  return rule;
}

export async function softDeleteRecurringRule(id: string): Promise<void> {
  const existing = await db.recurring_rules.get(id);
  if (!existing || existing.deleted_at) return;
  await db.recurring_rules.update(id, {
    deleted_at: nowIso(),
    updated_at: nowIso(),
    client_id: getClientId(),
    sync_status: "pending",
  });
}
