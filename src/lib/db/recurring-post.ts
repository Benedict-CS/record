import { getClientId } from "@/lib/client-id";
import { getOwnerId } from "@/lib/db/owner";
import { applyInvestMove, reverseInvestMove } from "@/lib/db/invest-move";
import { db } from "@/lib/db/schema";
import {
  createTransaction,
  softDeleteTransaction,
  updateTransaction,
} from "@/lib/db/crud";
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

function holdNote(rule: RecurringRule) {
  return rule.held_name?.trim() || rule.name;
}

function splitCharge(rule: RecurringRule) {
  if (rule.kind !== "expense") return { spent: 0, held: 0 };
  const total = cents(rule.amount);
  const held = Math.min(
    total,
    rule.held_amount != null && rule.held_amount > 0 ? cents(rule.held_amount) : 0,
  );
  return { spent: (total - held) / 100, held: held / 100 };
}

/** Months already generated for this rule, oldest first. */
function generatedPeriods(rule: Pick<RecurringRule, "start_month" | "end_month" | "last_posted">) {
  const end = rule.end_month ?? rule.last_posted;
  if (!end) return [];
  return periodsDue({
    startMonth: rule.start_month,
    endMonth: end,
    dayOfMonth: 1,
    lastPosted: null,
    today: "2000-01-01",
  });
}

async function writeGenerated(
  rule: RecurringRule,
  input: {
    id: string;
    type: "expense" | "income" | "hold";
    amount: number;
    date: string;
    note: string;
  },
) {
  const existing = await db.transactions.get(input.id);
  if (existing) return;
  const reimbursable =
    input.type === "expense" &&
    rule.reimbursable_amount != null &&
    rule.reimbursable_amount > 0
      ? Math.min(rule.reimbursable_amount, input.amount)
      : null;
  const movesBank = input.type === "expense" || input.type === "income";
  await createTransaction(rule.book_id, {
    id: input.id,
    type: input.type,
    amount: input.amount,
    date: input.date,
    note: input.note,
    account_id: rule.account_id,
    category_id: rule.category_id,
    holding_id: movesBank ? rule.holding_id : null,
    hold_status: input.type === "hold" ? "held" : null,
    reimbursable_amount: reimbursable,
    reimbursement_status: reimbursable ? "pending" : null,
  });
}

async function postExpense(rule: RecurringRule, period: string) {
  const [year, month] = period.split("-").map(Number);
  const date = dueDate(year, month, rule.day_of_month);
  const { spent, held } = splitCharge(rule);
  if (spent > 0) {
    await writeGenerated(rule, {
      id: recurringTransactionId(rule.id, period),
      type: "expense",
      amount: spent,
      date,
      note: rule.name,
    });
  }
  if (held > 0) {
    await writeGenerated(rule, {
      id: recurringTransactionId(`${rule.id}:hold`, period),
      type: "hold",
      amount: held,
      date,
      note: holdNote(rule),
    });
  }
  await markRule(rule, { last_posted: period, last_error: null });
}

async function postIncome(rule: RecurringRule, period: string) {
  const [year, month] = period.split("-").map(Number);
  await writeGenerated(rule, {
    id: recurringTransactionId(rule.id, period),
    type: "income",
    amount: rule.amount,
    date: dueDate(year, month, rule.day_of_month),
    note: rule.name,
  });
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
        else if (rule.kind === "income") await postIncome(rule, period);
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
    heldName: string | null;
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
    held_name:
      input.kind === "expense" && input.heldName?.trim()
        ? input.heldName.trim()
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

type RuleDraft = Parameters<typeof createRecurringRule>[1];

function ruleFromDraft(existing: RecurringRule, input: RuleDraft): RecurringRule {
  const held =
    input.kind === "expense" && input.heldAmount != null && input.heldAmount > 0
      ? input.heldAmount
      : null;
  return {
    ...existing,
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
    held_amount: held,
    held_name:
      input.kind === "expense" && held && input.heldName?.trim()
        ? input.heldName.trim()
        : null,
    account_id: input.accountId,
    category_id: input.categoryId,
    holding_id: input.holdingId,
    target_holding_id: input.targetHoldingId,
    updated_at: nowIso(),
    client_id: getClientId(),
    sync_status: "pending",
    last_error: null,
  };
}

async function dropGenerated(ruleId: string, period: string) {
  const ids = [
    recurringTransactionId(ruleId, period),
    recurringTransactionId(`${ruleId}:hold`, period),
  ];
  for (const id of ids) {
    const row = await db.transactions.get(id);
    if (!row || row.deleted_at) continue;
    if (row.type === "hold" && row.hold_status === "released") continue;
    await softDeleteTransaction(id);
  }
}

async function alignPeriod(rule: RecurringRule, period: string) {
  const [year, month] = period.split("-").map(Number);
  const date = dueDate(year, month, rule.day_of_month);
  const mainId = recurringTransactionId(rule.id, period);
  const holdId = recurringTransactionId(`${rule.id}:hold`, period);

  if (rule.kind === "invest") {
    await dropGeneratedHold(holdId);
    await alignInvest(rule, mainId, date);
    return;
  }

  if (rule.kind === "income") {
    await dropGeneratedHold(holdId);
    const posted = await db.transactions.get(mainId);
    if (posted && !posted.deleted_at && posted.type === "invest") {
      await dropGenerated(rule.id, period);
    }
    await alignCashRow(rule, {
      id: mainId,
      type: "income",
      amount: rule.amount,
      date,
      note: rule.name,
    });
    return;
  }

  const main = await db.transactions.get(mainId);
  if (main && !main.deleted_at && main.type === "invest") {
    await dropGenerated(rule.id, period);
  }
  const { spent, held } = splitCharge(rule);
  await alignCashRow(rule, {
    id: mainId,
    type: "expense",
    amount: spent,
    date,
    note: rule.name,
  });
  await alignCashRow(rule, {
    id: holdId,
    type: "hold",
    amount: held,
    date,
    note: holdNote(rule),
  });
}

async function dropGeneratedHold(id: string) {
  const row = await db.transactions.get(id);
  if (!row || row.deleted_at) return;
  if (row.hold_status === "released") return;
  await softDeleteTransaction(id);
}

async function alignInvest(rule: RecurringRule, id: string, date: string) {
  if (!rule.holding_id || !rule.target_holding_id) {
    throw new Error("定期定額要選扣款銀行，以及買進的股票或基金");
  }
  const existing = await db.transactions.get(id);
  if (existing && !existing.deleted_at && existing.type !== "invest") {
    await softDeleteTransaction(id);
  }
  const row = await db.transactions.get(id);
  await db.transaction("rw", db.transactions, db.holdings, async () => {
    if (
      row &&
      !row.deleted_at &&
      row.type === "invest" &&
      row.holding_id &&
      row.target_holding_id
    ) {
      await reverseInvestMove({
        bookId: rule.book_id,
        sourceId: row.holding_id,
        targetId: row.target_holding_id,
        amount: row.amount,
      });
    }
    await applyInvestMove({
      bookId: rule.book_id,
      sourceId: rule.holding_id!,
      targetId: rule.target_holding_id!,
      amount: rule.amount,
    });
    const next = {
      book_id: rule.book_id,
      type: "invest" as const,
      amount: rule.amount,
      date,
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
      deleted_at: null,
      updated_at: nowIso(),
      client_id: getClientId(),
      sync_status: "pending" as const,
    };
    if (row) await db.transactions.update(id, next);
    else {
      await db.transactions.add({
        ...next,
        id,
        user_id: getOwnerId(),
      });
    }
  });
}

async function alignCashRow(
  rule: RecurringRule,
  input: {
    id: string;
    type: "expense" | "income" | "hold";
    amount: number;
    date: string;
    note: string;
  },
) {
  const existing = await db.transactions.get(input.id);
  if (
    existing &&
    !existing.deleted_at &&
    existing.type === "hold" &&
    existing.hold_status === "released"
  ) {
    await updateTransaction(input.id, { note: input.note });
    if (existing.release_transaction_id) {
      await updateTransaction(existing.release_transaction_id, {
        note: `退回：${input.note}`,
      });
    }
    return;
  }
  if (input.amount <= 0) {
    if (existing && !existing.deleted_at) await softDeleteTransaction(input.id);
    return;
  }
  const reimbursable =
    input.type === "expense" &&
    rule.reimbursable_amount != null &&
    rule.reimbursable_amount > 0
      ? Math.min(rule.reimbursable_amount, input.amount)
      : null;
  if (!existing) {
    await writeGenerated(rule, input);
    return;
  }
  if (existing.deleted_at || existing.type !== input.type) {
    if (!existing.deleted_at && existing.type === "invest") {
      await dropGenerated(rule.id, input.date.slice(0, 7));
    }
    if (existing.deleted_at) {
      await db.transactions.update(input.id, {
        deleted_at: null,
        type: input.type,
        amount: input.amount,
        date: input.date,
        note: input.note,
        account_id: rule.account_id,
        category_id: rule.category_id,
        holding_id:
          input.type === "expense" || input.type === "income"
            ? rule.holding_id
            : null,
        hold_status: input.type === "hold" ? "held" : null,
        reimbursable_amount: reimbursable,
        reimbursement_status: reimbursable ? "pending" : null,
        target_holding_id: null,
        tag: null,
        updated_at: nowIso(),
        client_id: getClientId(),
        sync_status: "pending",
      });
      if (
        (input.type === "expense" || input.type === "income") &&
        rule.holding_id
      ) {
        await updateTransaction(input.id, {
          amount: input.amount,
          holding_id: rule.holding_id,
        });
      }
      return;
    }
  }
  await updateTransaction(input.id, {
    type: input.type,
    amount: input.amount,
    date: input.date,
    note: input.note,
    account_id: rule.account_id,
    category_id: rule.category_id,
    holding_id:
      input.type === "expense" || input.type === "income" ? rule.holding_id : null,
    hold_status: input.type === "hold" ? "held" : null,
    reimbursable_amount: reimbursable,
    reimbursement_status: reimbursable ? "pending" : null,
  });
}

/** Save changes onto an existing rule and refresh rows it already posted. */
export async function updateRecurringRule(
  id: string,
  input: RuleDraft,
): Promise<RecurringRule> {
  const existing = await db.recurring_rules.get(id);
  if (!existing || existing.deleted_at) {
    throw new Error("找不到這筆固定扣款");
  }
  const next = ruleFromDraft(existing, input);
  const oldPeriods = generatedPeriods(existing);
  const newPeriods = generatedPeriods(next);
  const keeping = new Set(newPeriods);
  for (const period of oldPeriods) {
    if (!keeping.has(period)) await dropGenerated(existing.id, period);
  }
  for (const period of newPeriods) {
    await alignPeriod(next, period);
  }
  next.last_posted = newPeriods.at(-1) ?? null;
  await db.recurring_rules.update(id, {
    name: next.name,
    kind: next.kind,
    amount: next.amount,
    day_of_month: next.day_of_month,
    start_month: next.start_month,
    end_month: next.end_month,
    reimbursable_amount: next.reimbursable_amount,
    held_amount: next.held_amount,
    held_name: next.held_name,
    account_id: next.account_id,
    category_id: next.category_id,
    holding_id: next.holding_id,
    target_holding_id: next.target_holding_id,
    last_posted: next.last_posted,
    last_error: null,
    updated_at: next.updated_at,
    client_id: next.client_id,
    sync_status: "pending",
  });
  return next;
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
