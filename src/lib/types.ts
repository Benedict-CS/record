export type SyncStatus = "synced" | "pending" | "conflict";

export type TransactionType = "income" | "expense" | "transfer" | "hold" | "invest";

/** Only for type === "hold": money locked until refunded. */
export type HoldStatus = "held" | "released";

/** Expense only: company will reimburse part of this spend later. */
export type ReimbursementStatus = "pending" | "received";

export type CategoryKind = "income" | "expense";

export type BookCurrency = "TWD" | "MYR";

export interface SyncMeta {
  id: string;
  user_id: string | null;
  updated_at: string;
  deleted_at: string | null;
  client_id: string;
  sync_status: SyncStatus;
}

export interface Book extends SyncMeta {
  name: string;
  currency: BookCurrency;
  sort_order: number;
}

export interface Account extends SyncMeta {
  book_id: string;
  name: string;
  type: "cash" | "bank" | "credit" | "other";
  currency: string;
  sort_order: number;
  opening_balance: number;
}

export interface Category extends SyncMeta {
  book_id: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  sort_order: number;
}

export interface Transaction extends SyncMeta {
  book_id: string;
  type: TransactionType;
  amount: number;
  date: string;
  note: string;
  account_id: string;
  category_id: string | null;
  transfer_account_id: string | null;
  /** null for normal rows; held/released for type=hold */
  hold_status: HoldStatus | null;
  /** Income tx created when marking 已退回 */
  release_transaction_id: string | null;
  /** Expense only: amount expected back from company (null = none). */
  reimbursable_amount: number | null;
  /** Expense only: pending until marked received with salary. */
  reimbursement_status: ReimbursementStatus | null;
  /**
   * Bank expense or income: 存款 holding this row moves.
   * Cash rows stay null so holdings are not changed.
   */
  holding_id: string | null;
  /**
   * Optional expense mark such as 請客. Not a second category:
   * reports, budgets, and the period total ignore it.
   */
  tag: string | null;
  /**
   * Invest rows only: fund or stock holding that received the purchase.
   * Expense rows leave this null.
   */
  target_holding_id: string | null;
}

/** Monthly bill or dollar-cost purchase. One row posts at most once per month. */
export interface RecurringRule extends SyncMeta {
  book_id: string;
  name: string;
  kind: "expense" | "invest";
  amount: number;
  /** 1–31. Shorter months use the last day. */
  day_of_month: number;
  /** First month that may post, YYYY-MM. Earlier months are never backfilled. */
  start_month: string;
  /**
   * Last month that may post, YYYY-MM. Null means open-ended: post when each
   * due day arrives. A value posts every month in the span as soon as the
   * rule is saved.
   */
  end_month: string | null;
  /**
   * Expense rules only. Each posted month is pending reimbursement for this
   * amount. Null means the charge is not reimbursable.
   */
  reimbursable_amount: number | null;
  /**
   * Expense rules only. This much of `amount` is posted as 扣住 (not an
   * expense) each month. Null means the whole amount is an expense.
   * Equal to `amount` means the whole charge is held, the way rent can be.
   */
  held_amount: number | null;
  /** Name shown on the held row, such as 電費預繳. Null uses the rule name. */
  held_name: string | null;
  /** Latest YYYY-MM already posted, or null. */
  last_posted: string | null;
  last_error: string | null;
  account_id: string;
  category_id: string | null;
  /** Bank card to deduct. Required for invest; required for a bank expense. */
  holding_id: string | null;
  /** Invest only: stock or fund that receives the amount. */
  target_holding_id: string | null;
  sort_order: number;
}

export interface Budget extends SyncMeta {
  book_id: string;
  year: number;
  month: number;
  category_id: string | null;
  amount: number;
}

export interface Template extends SyncMeta {
  book_id: string;
  name: string;
  type: TransactionType;
  amount: number;
  note: string;
  account_id: string;
  category_id: string | null;
  transfer_account_id: string | null;
  sort_order: number;
}

export interface SyncState {
  id: string;
  last_pulled_at: string | null;
  last_pushed_at: string | null;
}

export type CloudBook = Omit<Book, "sync_status">;
export type CloudAccount = Omit<Account, "sync_status">;
export type CloudCategory = Omit<Category, "sync_status">;
export type CloudTransaction = Omit<Transaction, "sync_status">;
export type CloudBudget = Omit<Budget, "sync_status">;
export type CloudTemplate = Omit<Template, "sync_status">;
export type CloudRecurringRule = Omit<RecurringRule, "sync_status">;

export type SyncUiStatus = "offline" | "syncing" | "synced" | "error" | "local";

export interface CategoryBreakdownItem {
  categoryId: string | null;
  name: string;
  color: string;
  icon: string;
  amount: number;
  percent: number;
  /** Tagged 請客 amount already included in amount. Absent when this list is not expenses. */
  treatAmount?: number;
}

export interface DayBucket {
  date: string;
  income: number;
  expense: number;
  held: number;
  transactions: Transaction[];
}

export interface PeriodSummary {
  income: number;
  /** Full cash expenses (excludes 扣住). Used for account net. */
  expense: number;
  /**
   * Holds dated in this period (押金／預繳), including later-released rows.
   * Outstanding-only totals use outstandingHeldTotal() for net worth.
   */
  held: number;
  /**
   * Display「花費」= selfPay + held (after 銷帳, reimbursed portion is excluded).
   */
  outflow: number;
  /** income − full cash expense (not selfPay). */
  net: number;
  /** Pending reimbursable amounts still awaiting 銷帳. */
  reimbursablePending: number;
  /**
   * Expense minus received reimbursable (matches list / day「花」).
   * Pending reimbursable still counts in full until 銷帳.
   */
  selfPay: number;
}

export interface SummaryComparison {
  incomeDelta: number;
  expenseDelta: number;
  incomePercent: number;
  expensePercent: number;
}

export interface DailyTrendPoint {
  date: string;
  income: number;
  expense: number;
}

export interface AccountBalance {
  account: Account;
  balance: number;
}

export type HoldingKind =
  | "cash"
  | "savings"
  | "deposit"
  | "fund"
  | "ewallet"
  | "stock"
  | "other";

export type InterestCompounding = "none" | "simple" | "monthly" | "yearly";

export interface Holding extends SyncMeta {
  book_id: string;
  name: string;
  kind: HoldingKind;
  institution: string;
  amount: number;
  annual_rate: number;
  compounding: InterestCompounding;
  start_date: string;
  maturity_date: string | null;
  note: string;
  color: string;
  icon: string;
  sort_order: number;
}

export type CloudHolding = Omit<Holding, "sync_status">;

export interface HoldingInterest {
  holding: Holding;
  monthly: number;
  yearly: number;
  accrued: number;
}