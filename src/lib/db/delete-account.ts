import { activeBookStorageKey } from "@/lib/db/owner";
import { db } from "@/lib/db/schema";

/** Ledger tables stamped with user_id. Logged-out rows (null) stay. */
const OWNED_TABLES = [
  "books",
  "accounts",
  "categories",
  "transactions",
  "budgets",
  "templates",
  "holdings",
  "recurring_rules",
] as const;

export function syncStateId(userId: string) {
  return `user:${userId}`;
}

/** Drop this account's rows on this device. Does not touch the cloud. */
export async function removeLocalAccount(userId: string): Promise<void> {
  if (!userId) return;
  const tables = OWNED_TABLES.map((name) => db.table(name));
  await db.transaction("rw", [...tables, db.sync_state], async () => {
    for (const name of OWNED_TABLES) {
      await db.table(name).where("user_id").equals(userId).delete();
    }
    await db.sync_state.delete(syncStateId(userId));
  });
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(activeBookStorageKey(userId));
  }
}
