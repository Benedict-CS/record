import { getClientId } from "@/lib/client-id";
import { sortCategories } from "@/lib/category-order";
import { db } from "@/lib/db/schema";
import type { Account, Book, BookCurrency, Category } from "@/lib/types";

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
    { name: "請客", kind: "expense", icon: "cup", color: "#e67e22", sort_order: 14 },
    { name: "水果", kind: "expense", icon: "leaf", color: "#27ae60", sort_order: 15 },
    { name: "其他支出", kind: "expense", icon: "dots", color: "#7f8c8d", sort_order: 16 },
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

function nowIso() {
  return new Date().toISOString();
}

/** Rewrite catch-all category sort_order so they stay last within each kind. */
async function pinCatchAllCategories(
  bookId: string,
  clientId: string,
  stamp: string,
) {
  const rows = (await db.categories.where("book_id").equals(bookId).toArray())
    .filter((row) => !row.deleted_at);
  for (const kind of ["expense", "income"] as const) {
    const ofKind = sortCategories(rows.filter((row) => row.kind === kind));
    for (let index = 0; index < ofKind.length; index += 1) {
      const row = ofKind[index];
      if (row.sort_order === index) continue;
      await db.categories.update(row.id, {
        sort_order: index,
        updated_at: stamp,
        client_id: clientId,
        sync_status: "pending",
      });
    }
  }
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
    // Still respect soft-deleted names so wiping every live tag cannot
    // resurrect the full default set on the next seed/sync.
    const existing = await db.categories
      .where("book_id")
      .equals(book.id)
      .toArray();
    const have = new Set(
      existing.map((row) => `${row.kind}:${row.name.trim()}`),
    );
    const missing = [...expenseCategories(), ...incomeCategories()].filter(
      (item) => !have.has(`${item.kind}:${item.name.trim()}`),
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
  } else {
    // Add newly introduced defaults (e.g. 運動 / 機車) without wiping user cats.
    // Include soft-deleted names so user deletions are not resurrected on every boot.
    const existing = await db.categories
      .where("book_id")
      .equals(book.id)
      .toArray();
    const have = new Set(
      existing.map((row) => `${row.kind}:${row.name.trim()}`),
    );
    const missing = [...expenseCategories(), ...incomeCategories()].filter(
      (item) => !have.has(`${item.kind}:${item.name.trim()}`),
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

  // Keep catch-all tags at the end even if newer defaults were inserted after them.
  await pinCatchAllCategories(book.id, clientId, stamp);

  // Do not seed empty placeholder holdings (郵局活儲 / ASM1 @ $0). Users add
  // real deposits themselves; empty shells just clutter the list and duplicate.
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
      if (
        typeof localStorage !== "undefined" &&
        localStorage.getItem("ledger_active_book_id") === extra.book.id
      ) {
        localStorage.setItem("ledger_active_book_id", keep.id);
      }
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
      // Prefer synced / most-referenced account so collapse does not tombstone
      // the cloud KEEP cash/bank ids.
      const scored = await Promise.all(
        group.map(async (account) => {
          const txCount = await db.transactions
            .where("book_id")
            .equals(book.id)
            .filter(
              (row) =>
                !row.deleted_at &&
                (row.account_id === account.id ||
                  row.transfer_account_id === account.id),
            )
            .count();
          return {
            account,
            txCount,
            synced: account.sync_status === "synced" ? 1 : 0,
          };
        }),
      );
      scored.sort((a, b) => {
        if (b.txCount !== a.txCount) return b.txCount - a.txCount;
        if (b.synced !== a.synced) return b.synced - a.synced;
        return a.account.sort_order - b.account.sort_order;
      });
      const keep = scored[0].account;
      for (const { account: extra } of scored.slice(1)) {
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

        // Restore a soft-deleted twin instead of minting a new empty UUID
        // (orphans accounts/txs on the tombstoned id and breaks web sync).
        const tombstoned = books.find(
          (row) =>
            row.deleted_at &&
            row.currency === def.currency &&
            row.name.trim() === def.name,
        );
        if (tombstoned) {
          await db.books.update(tombstoned.id, {
            deleted_at: null,
            updated_at: stamp,
            client_id: clientId,
            sync_status: "pending",
          });
          continue;
        }

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