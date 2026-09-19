export type SyncStatus = "synced" | "pending" | "conflict";

export type TransactionType = "income" | "expense" | "transfer" | "hold";

/** Only for type === "hold": money locked until refunded. */
export type HoldStatus = "held" | "released";

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

export type SyncUiStatus = "offline" | "syncing" | "synced" | "error" | "local";

export interface CategoryBreakdownItem {
  categoryId: string | null;
  name: string;
  color: string;
  icon: string;
  amount: number;
  percent: number;
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
  /** Actual spending (excludes 扣住). */
  expense: number;
  /**
   * Holds dated in this period (押金／預繳), including later-released rows.
   * Outstanding-only totals use outstandingHeldTotal() for net worth.
   */
  held: number;
  /** Money that left accounts this period: expense + held. */
  outflow: number;
  net: number;
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