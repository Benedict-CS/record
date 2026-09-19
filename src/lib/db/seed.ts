import { getClientId } from "@/lib/client-id";
import { db } from "@/lib/db/schema";
import type { Account, Book, BookCurrency, Category, Holding } from "@/lib/types";

const BOOK_DEFS: {
  name: string;
  currency: BookCurrency;
  sort_order: number;
}[] = [
  { name: "台灣帳本", currency: "TWD", sort_order: 0 },
  { name: "馬來西亞帳本", currency: "MYR", sort_order: 1 },
];

function expenseCategories(): Omit<
  Category,
  | "id"
  | "book_id"
  | "user_id"
  | "updated_at"
  | "deleted_at"
  | "client_id"
  | "sync_status"
>[] {
  return [
    { name: "早餐", kind: "expense", icon: "coffee", color: "#e67e22", sort_order: 0 },
    { name: "午餐", kind: "expense", icon: "utensils", color: "#f39c12", sort_order: 1 },
    { name: "晚餐", kind: "expense", icon: "moon", color: "#d35400", sort_order: 2 },
    { name: "飲料零食", kind: "expense", icon: "cup", color: "#e74c3c", sort_order: 3 },
    { name: "交通", kind: "expense", icon: "bus", color: "#3498db", sort_order: 4 },
    { name: "機車", kind: "expense", icon: "car", color: "#2c3e50", sort_order: 5 },
    { name: "運動", kind: "expense", icon: "bolt", color: "#27ae60", sort_order: 6 },
    { name: "電話費", kind: "expense", icon: "phone", color: "#9b59b6", sort_order: 7 },
    { name: "住宿費", kind: "expense", icon: "home", color: "#1abc9c", sort_order: 8 },
    { name: "房租水電", kind: "expense", icon: "building", color: "#16a085", sort_order: 9 },
    { name: "購物", kind: "expense", icon: "bag", color: "#e91e63", sort_order: 10 },
    { name: "娛樂", kind: "expense", icon: "smile", color: "#8e44ad", sort_order: 11 },
    { name: "醫療", kind: "expense", icon: "heart", color: "#c0392b", sort_order: 12 },
    { name: "學習", kind: "expense", icon: "book", color: "#2980b9", sort_order: 13 },
    { name: "其他支出", kind: "expense", icon: "dots", color: "#7f8c8d", sort_order: 14 },
  ];
}

function incomeCategories(): Omit<
  Category,
  | "id"
  | "book_id"
  | "user_id"
  | "updated_at"
  | "deleted_at"
  | "client_id"
  | "sync_status"
>[] {
  return [
    { name: "薪水", kind: "income", icon: "wallet", color: "#27ae60", sort_order: 0 },
    { name: "定存利息", kind: "income", icon: "building", color: "#1abc9c", sort_order: 1 },
    { name: "投資收益", kind: "income", icon: "chart", color: "#f1c40f", sort_order: 2 },
    { name: "兼職", kind: "income", icon: "briefcase", color: "#3498db", sort_order: 3 },
    { name: "紅包獎金", kind: "income", icon: "gift", color: "#e74c3c", sort_order: 4 },
    { name: "其他收入", kind: "income", icon: "dots", color: "#95a5a6", sort_order: 5 },
  ];
}

function defaultAccounts(currency: BookCurrency): Omit<
  Account,
  | "id"
  | "book_id"
  | "user_id"
  | "updated_at"
  | "deleted_at"
  | "client_id"
  | "sync_status"
>[] {
  return [
    { name: "現金", type: "cash", currency, sort_order: 0, opening_balance: 0 },
    {
      name: "銀行帳戶",
      type: "bank",
      currency,
      sort_order: 1,
      opening_balance: 0,
    },
    {
      name: "信用卡",
      type: "credit",
      currency,
      sort_order: 2,
      opening_balance: 0,
    },
  ];
}

type HoldingSeed = Pick<
  Holding,
  | "name"
  | "kind"
  | "institution"
  | "amount"
  | "annual_rate"
  | "compounding"
  | "icon"
  | "color"
  | "sort_order"
>;

function defaultHoldings(currency: BookCurrency): HoldingSeed[] {
  if (currency === "MYR") {
    return [
      { name: "現金", kind: "cash", institution: "", amount: 0, annual_rate: 0, compounding: "none", icon: "wallet", color: "#27ae60", sort_order: 0 },
      { name: "Maybank 活存", kind: "savings", institution: "Maybank", amount: 0, annual_rate: 0.25, compounding: "simple", icon: "building", color: "#f39c12", sort_order: 1 },
      { name: "定存 Fixed Deposit", kind: "deposit", institution: "Maybank", amount: 0, annual_rate: 3.1, compounding: "yearly", icon: "building", color: "#16a085", sort_order: 2 },
      { name: "Touch 'n Go eWallet", kind: "ewallet", institution: "Touch 'n Go", amount: 0, annual_rate: 0, compounding: "none", icon: "phone", color: "#1abc9c", sort_order: 3 },
      { name: "ShopeePay", kind: "ewallet", institution: "Shopee", amount: 0, annual_rate: 0, compounding: "none", icon: "bag", color: "#e67e22", sort_order: 4 },
      { name: "MAE", kind: "ewallet", institution: "Maybank", amount: 0, annual_rate: 0, compounding: "none", icon: "phone", color: "#f1c40f", sort_order: 5 },
      { name: "Boost", kind: "ewallet", institution: "Boost", amount: 0, annual_rate: 0, compounding: "none", icon: "bag", color: "#e74c3c", sort_order: 6 },
      { name: "ASNB 基金", kind: "fund", institution: "ASNB", amount: 0, annual_rate: 4.5, compounding: "yearly", icon: "chart", color: "#8e44ad", sort_order: 7 },
      { name: "Public Mutual", kind: "fund", institution: "Public Mutual", amount: 0, annual_rate: 5, compounding: "yearly", icon: "chart", color: "#9b59b6", sort_order: 8 },
    ];
  }
  return [
    { name: "現金", kind: "cash", institution: "", amount: 0, annual_rate: 0, compounding: "none", icon: "wallet", color: "#27ae60", sort_order: 0 },
    { name: "銀行活存", kind: "savings", institution: "玉山銀行", amount: 0, annual_rate: 0.4, compounding: "simple", icon: "building", color: "#3498db", sort_order: 1 },
    { name: "銀行定存", kind: "deposit", institution: "中華郵政", amount: 0, annual_rate: 1.6, compounding: "yearly", icon: "building", color: "#16a085", sort_order: 2 },
    { name: "郵局活儲", kind: "savings", institution: "中華郵政", amount: 0, annual_rate: 0.2, compounding: "simple", icon: "building", color: "#1abc9c", sort_order: 3 },
    { name: "台股基金", kind: "fund", institution: "", amount: 0, annual_rate: 5, compounding: "yearly", icon: "chart", color: "#8e44ad", sort_order: 4 },
  ];
}

function nowIso() {
  return new Date().toISOString();
}

function tombstone() {
  const stamp = nowIso();
  return {
    deleted_at: stamp,
    updated_at: stamp,
    client_id: getClientId(),
    sync_status: "pending" as const,
  };
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

async function seedBookContents(book: Book, clientId: string, stamp: string) {
  const existingAccounts = await db.accounts
    .where("book_id")
    .equals(book.id)
    .filter((row) => !row.deleted_at)
    .count();
  const existingCategories = await db.categories
    .where("book_id")
    .equals(book.id)
    .filter((row) => !row.deleted_at)
    .count();

  if (existingAccounts === 0) {
    await db.accounts.bulkAdd(
      defaultAccounts(book.currency).map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        book_id: book.id,
        user_id: null,
        updated_at: stamp,
        deleted_at: null,
        client_id: clientId,
        sync_status: "pending" as const,
      })),
    );
  }

  if (existingCategories === 0) {
    const cats = [...expenseCategories(), ...incomeCategories()];
    await db.categories.bulkAdd(
      cats.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        book_id: book.id,
        user_id: null,
        updated_at: stamp,
        deleted_at: null,
        client_id: clientId,
        sync_status: "pending" as const,
      })),
    );
  } else {
    // Add newly introduced defaults (e.g. 運動 / 機車) without wiping user cats.
    const existing = await db.categories
      .where("book_id")
      .equals(book.id)
      .filter((row) => !row.deleted_at)
      .toArray();
    const have = new Set(existing.map((row) => `${row.kind}:${row.name}`));
    const missing = [...expenseCategories(), ...incomeCategories()].filter(
      (item) => !have.has(`${item.kind}:${item.name}`),
    );
    if (missing.length) {
      await db.categories.bulkAdd(
        missing.map((item) => ({
          ...item,
          id: crypto.randomUUID(),
          book_id: book.id,
          user_id: null,
          updated_at: stamp,
          deleted_at: null,
          client_id: clientId,
          sync_status: "pending" as const,
        })),
      );
    }
  }

  const existingHoldings = await db.holdings
    .where("book_id")
    .equals(book.id)
    .filter((row) => !row.deleted_at)
    .count();

  if (existingHoldings === 0) {
    await db.holdings.bulkAdd(
      defaultHoldings(book.currency).map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        book_id: book.id,
        user_id: null,
        updated_at: stamp,
        deleted_at: null,
        client_id: clientId,
        sync_status: "pending" as const,
        start_date: stamp.slice(0, 10),
        maturity_date: null,
        note: "",
      })),
    );
  }
}

/**
 * React Strict Mode (and overlapping mounts) used to run seed twice, so
 * default books/accounts/categories were inserted in duplicate. Collapse
 * those extras and re-point child rows at the survivor.
 */
async function dedupeSeedDuplicates() {
  const mark = tombstone();

  const books = (await db.books.toArray()).filter((row) => !row.deleted_at);
  const bookGroups = groupBy(
    books,
    (row) => `${row.currency}\0${row.name.trim()}`,
  );

  for (const group of bookGroups.values()) {
    if (group.length < 2) continue;
    const scored = await Promise.all(
      group.map(async (book) => {
        const txCount = await db.transactions
          .where("book_id")
          .equals(book.id)
          .filter((row) => !row.deleted_at)
          .count();
        return { book, txCount };
      }),
    );
    scored.sort((a, b) => {
      if (b.txCount !== a.txCount) return b.txCount - a.txCount;
      return a.book.sort_order - b.book.sort_order;
    });
    const keep = scored[0].book;
    for (const extra of scored.slice(1)) {
      for (const table of [
        db.accounts,
        db.categories,
        db.transactions,
        db.budgets,
        db.templates,
        db.holdings,
      ] as const) {
        const children = await table
          .where("book_id")
          .equals(extra.book.id)
          .toArray();
        for (const child of children) {
          await table.update(child.id, {
            book_id: keep.id,
            updated_at: nowIso(),
            client_id: getClientId(),
            sync_status: "pending",
          });
        }
      }
      await db.books.update(extra.book.id, mark);
    }
  }

  const activeBooks = (await db.books.toArray()).filter((row) => !row.deleted_at);
  for (const book of activeBooks) {
    const accounts = (
      await db.accounts.where("book_id").equals(book.id).toArray()
    ).filter((row) => !row.deleted_at);
    const accountGroups = groupBy(
      accounts,
      (row) => `${row.type}\0${row.name.trim()}`,
    );
    for (const group of accountGroups.values()) {
      if (group.length < 2) continue;
      const keep = group[0];
      for (const extra of group.slice(1)) {
        const txs = await db.transactions
          .where("book_id")
          .equals(book.id)
          .toArray();
        for (const tx of txs) {
          const patch: Partial<typeof tx> = {};
          if (tx.account_id === extra.id) patch.account_id = keep.id;
          if (tx.transfer_account_id === extra.id) {
            patch.transfer_account_id = keep.id;
          }
          if (Object.keys(patch).length) {
            await db.transactions.update(tx.id, {
              ...patch,
              updated_at: nowIso(),
              client_id: getClientId(),
              sync_status: "pending",
            });
          }
        }
        const templates = await db.templates
          .where("book_id")
          .equals(book.id)
          .toArray();
        for (const template of templates) {
          const patch: Partial<typeof template> = {};
          if (template.account_id === extra.id) patch.account_id = keep.id;
          if (template.transfer_account_id === extra.id) {
            patch.transfer_account_id = keep.id;
          }
          if (Object.keys(patch).length) {
            await db.templates.update(template.id, {
              ...patch,
              updated_at: nowIso(),
              client_id: getClientId(),
              sync_status: "pending",
            });
          }
        }
        await db.accounts.update(extra.id, mark);
      }
    }

    const categories = (
      await db.categories.where("book_id").equals(book.id).toArray()
    ).filter((row) => !row.deleted_at);
    const categoryGroups = groupBy(
      categories,
      (row) => `${row.kind}\0${row.name.trim()}`,
    );
    for (const group of categoryGroups.values()) {
      if (group.length < 2) continue;
      const keep = group[0];
      for (const extra of group.slice(1)) {
        const txs = await db.transactions
          .where("book_id")
          .equals(book.id)
          .filter((row) => row.category_id === extra.id)
          .toArray();
        for (const tx of txs) {
          await db.transactions.update(tx.id, {
            category_id: keep.id,
            updated_at: nowIso(),
            client_id: getClientId(),
            sync_status: "pending",
          });
        }
        const budgets = await db.budgets
          .where("book_id")
          .equals(book.id)
          .filter((row) => row.category_id === extra.id)
          .toArray();
        for (const budget of budgets) {
          await db.budgets.update(budget.id, {
            category_id: keep.id,
            updated_at: nowIso(),
            client_id: getClientId(),
            sync_status: "pending",
          });
        }
        const templates = await db.templates
          .where("book_id")
          .equals(book.id)
          .filter((row) => row.category_id === extra.id)
          .toArray();
        for (const template of templates) {
          await db.templates.update(template.id, {
            category_id: keep.id,
            updated_at: nowIso(),
            client_id: getClientId(),
            sync_status: "pending",
          });
        }
        await db.categories.update(extra.id, mark);
      }
    }
  }
}

async function runSeed(): Promise<void> {
  const clientId = getClientId();
  const stamp = nowIso();

  await db.transaction("rw", db.tables, async () => {
      await dedupeSeedDuplicates();

      const books = await db.books.toArray();
      const active = books.filter((row) => !row.deleted_at);

      for (const def of BOOK_DEFS) {
        const exists = active.some(
          (row) =>
            row.currency === def.currency && row.name.trim() === def.name,
        );
        if (exists) continue;
        await db.books.add({
          ...def,
          id: crypto.randomUUID(),
          user_id: null,
          updated_at: stamp,
          deleted_at: null,
          client_id: clientId,
          sync_status: "pending",
        });
      }

      const seededBooks = (await db.books.toArray())
        .filter((row) => !row.deleted_at)
        .sort((a, b) => a.sort_order - b.sort_order);

      for (const book of seededBooks) {
        await seedBookContents(book, clientId, stamp);
      }

      const missingColor = await db.categories
        .filter((row) => !row.color)
        .toArray();
      for (const row of missingColor) {
        await db.categories.update(row.id, { color: "#0f7a5f" });
      }

      const missingOpeningBalance = await db.accounts
        .filter((row) => typeof row.opening_balance !== "number")
        .toArray();
      for (const row of missingOpeningBalance) {
        await db.accounts.update(row.id, { opening_balance: 0 });
      }

      const defaultBookId = seededBooks[0]?.id;
      if (defaultBookId) {
        for (const table of [
          db.accounts,
          db.categories,
          db.transactions,
          db.budgets,
          db.templates,
          db.holdings,
        ] as const) {
          const orphans = await table.filter((row) => !row.book_id).toArray();
          for (const row of orphans) {
            await table.update(row.id, { book_id: defaultBookId });
          }
        }
      }

      // Second pass after reassignment, so merged books don't keep twin 現金.
      await dedupeSeedDuplicates();

      const sync = await db.sync_state.get("default");
      if (!sync) {
        await db.sync_state.put({
          id: "default",
          last_pulled_at: null,
          last_pushed_at: null,
        });
      }
  });
}

let inflight: Promise<void> | null = null;

export function ensureSeedData(): Promise<void> {
  if (!inflight) {
    inflight = runSeed().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}