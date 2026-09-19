import Dexie, { type EntityTable } from "dexie";
import type {
  Account,
  Book,
  Budget,
  Category,
  Holding,
  SyncState,
  Template,
  Transaction,
} from "@/lib/types";

export class LedgerDB extends Dexie {
  books!: EntityTable<Book, "id">;
  accounts!: EntityTable<Account, "id">;
  categories!: EntityTable<Category, "id">;
  transactions!: EntityTable<Transaction, "id">;
  budgets!: EntityTable<Budget, "id">;
  templates!: EntityTable<Template, "id">;
  holdings!: EntityTable<Holding, "id">;
  sync_state!: EntityTable<SyncState, "id">;

  constructor() {
    super("ledger_db");
    this.version(1).stores({
      accounts: "id, user_id, updated_at, sync_status, deleted_at, sort_order",
      categories:
        "id, user_id, kind, updated_at, sync_status, deleted_at, sort_order",
      transactions:
        "id, user_id, date, account_id, category_id, updated_at, sync_status, deleted_at, type",
      sync_state: "id",
    });
    this.version(2)
      .stores({
        accounts: "id, user_id, updated_at, sync_status, deleted_at, sort_order",
        categories:
          "id, user_id, kind, updated_at, sync_status, deleted_at, sort_order",
        transactions:
          "id, user_id, date, account_id, category_id, updated_at, sync_status, deleted_at, type",
        budgets:
          "id, user_id, year, month, category_id, updated_at, sync_status, deleted_at",
        sync_state: "id",
      })
      .upgrade(async (tx) => {
        const rows = await tx.table("categories").toArray();
        for (const row of rows) {
          if (!row.color) {
            await tx.table("categories").update(row.id, {
              color: "#0f7a5f",
            });
          }
        }
      });
    this.version(3)
      .stores({
        books: "id, user_id, currency, updated_at, sync_status, deleted_at, sort_order",
        accounts:
          "id, book_id, user_id, updated_at, sync_status, deleted_at, sort_order",
        categories:
          "id, book_id, user_id, kind, updated_at, sync_status, deleted_at, sort_order",
        transactions:
          "id, book_id, user_id, date, account_id, category_id, updated_at, sync_status, deleted_at, type",
        budgets:
          "id, book_id, user_id, year, month, category_id, updated_at, sync_status, deleted_at",
        sync_state: "id",
      })
      .upgrade(async (tx) => {
        const stamp = new Date().toISOString();
        const booksTable = tx.table("books");
        const existingBooks = await booksTable.count();
        let twdId: string;

        if (existingBooks === 0) {
          twdId = crypto.randomUUID();
          const myrId = crypto.randomUUID();
          await booksTable.bulkAdd([
            {
              id: twdId,
              user_id: null,
              updated_at: stamp,
              deleted_at: null,
              client_id: "migration",
              sync_status: "pending",
              name: "台灣帳本",
              currency: "TWD",
              sort_order: 0,
            },
            {
              id: myrId,
              user_id: null,
              updated_at: stamp,
              deleted_at: null,
              client_id: "migration",
              sync_status: "pending",
              name: "馬來西亞帳本",
              currency: "MYR",
              sort_order: 1,
            },
          ]);
        } else {
          const twd = (await booksTable.toArray()).find(
            (row) => row.currency === "TWD" && !row.deleted_at,
          );
          twdId = twd?.id ?? (await booksTable.toArray())[0].id;
        }

        for (const tableName of ["accounts", "categories", "transactions", "budgets"] as const) {
          const table = tx.table(tableName);
          const rows = await table.toArray();
          for (const row of rows) {
            if (!row.book_id) {
              await table.update(row.id, { book_id: twdId });
            }
          }
        }
      });
    // Version 4 adds compound indexes (so month/day/category/budget queries no
    // longer scan whole tables), the `templates` table and Account.opening_balance.
    this.version(4)
      .stores({
        books:
          "id, user_id, currency, updated_at, sync_status, deleted_at, sort_order",
        accounts:
          "id, book_id, user_id, updated_at, sync_status, deleted_at, sort_order",
        categories:
          "id, book_id, user_id, kind, updated_at, sync_status, deleted_at, sort_order, [book_id+kind]",
        transactions:
          "id, book_id, user_id, date, account_id, category_id, updated_at, sync_status, deleted_at, type, [book_id+date]",
        budgets:
          "id, book_id, user_id, year, month, category_id, updated_at, sync_status, deleted_at, [book_id+year+month]",
        templates:
          "id, book_id, user_id, updated_at, sync_status, deleted_at, sort_order, [book_id+sort_order]",
        sync_state: "id",
      })
      .upgrade(async (tx) => {
        // Compound indexes only cover rows where every part is present, so any
        // row still missing book_id has to be adopted by the first book first.
        const books = await tx.table("books").toArray();
        const fallbackBook =
          books.find((row) => !row.deleted_at && row.currency === "TWD") ??
          books.find((row) => !row.deleted_at) ??
          books[0];

        if (fallbackBook) {
          for (const tableName of [
            "accounts",
            "categories",
            "transactions",
            "budgets",
          ] as const) {
            const table = tx.table(tableName);
            const rows = await table.toArray();
            for (const row of rows) {
              if (!row.book_id) {
                await table.update(row.id, { book_id: fallbackBook.id });
              }
            }
          }
        }

        const accounts = tx.table("accounts");
        const accountRows = await accounts.toArray();
        for (const row of accountRows) {
          if (typeof row.opening_balance !== "number") {
            await accounts.update(row.id, { opening_balance: 0 });
          }
        }
      });
    this.version(5).stores({
      books:
        "id, user_id, currency, updated_at, sync_status, deleted_at, sort_order",
      accounts:
        "id, book_id, user_id, updated_at, sync_status, deleted_at, sort_order",
      categories:
        "id, book_id, user_id, kind, updated_at, sync_status, deleted_at, sort_order, [book_id+kind]",
      transactions:
        "id, book_id, user_id, date, account_id, category_id, updated_at, sync_status, deleted_at, type, [book_id+date]",
      budgets:
        "id, book_id, user_id, year, month, category_id, updated_at, sync_status, deleted_at, [book_id+year+month]",
      templates:
        "id, book_id, user_id, updated_at, sync_status, deleted_at, sort_order, [book_id+sort_order]",
      holdings:
        "id, book_id, user_id, kind, updated_at, sync_status, deleted_at, sort_order, [book_id+kind]",
      sync_state: "id",
    });
  }
}

export const db = new LedgerDB();