import {
  createTransaction,
  listAccounts,
  listCategories,
  softDeleteTransaction,
  upsertBudget,
} from "@/lib/db/crud";
import { db } from "@/lib/db/schema";

const DEMO_MARK = "（示範）";

type DemoRow = {
  type: "income" | "expense" | "transfer";
  amount: number;
  date: string;
  note: string;
  account: "cash" | "bank" | "credit";
  category?: string;
  transfer?: "cash" | "bank" | "credit";
};

const AUGUST_ROWS: DemoRow[] = [
  { type: "income", amount: 52000, date: "2026-08-05", note: "八月薪水（示範）", account: "bank", category: "薪水" },
  { type: "income", amount: 3000, date: "2026-08-28", note: "專案獎金（示範）", account: "bank", category: "紅包獎金" },
  { type: "expense", amount: 18000, date: "2026-08-01", note: "房租（示範）", account: "bank", category: "房租水電" },
  { type: "expense", amount: 699, date: "2026-08-08", note: "手機月租（示範）", account: "bank", category: "電話費" },
  { type: "expense", amount: 1200, date: "2026-08-12", note: "水電費（示範）", account: "bank", category: "房租水電" },
  { type: "transfer", amount: 5000, date: "2026-08-06", note: "提領現金（示範）", account: "bank", transfer: "cash" },
  { type: "transfer", amount: 8000, date: "2026-08-25", note: "還信用卡（示範）", account: "bank", transfer: "credit" },
  { type: "expense", amount: 65, date: "2026-08-03", note: "美而美早餐（示範）", account: "cash", category: "早餐" },
  { type: "expense", amount: 120, date: "2026-08-03", note: "便當（示範）", account: "cash", category: "午餐" },
  { type: "expense", amount: 45, date: "2026-08-03", note: "捷運（示範）", account: "cash", category: "交通" },
  { type: "expense", amount: 220, date: "2026-08-03", note: "晚餐火鍋分攤（示範）", account: "credit", category: "晚餐" },
  { type: "expense", amount: 55, date: "2026-08-04", note: "早餐店（示範）", account: "cash", category: "早餐" },
  { type: "expense", amount: 135, date: "2026-08-04", note: "公司附近午餐（示範）", account: "cash", category: "午餐" },
  { type: "expense", amount: 50, date: "2026-08-04", note: "飲料（示範）", account: "cash", category: "飲料零食" },
  { type: "expense", amount: 180, date: "2026-08-04", note: "晚餐（示範）", account: "cash", category: "晚餐" },
  { type: "expense", amount: 70, date: "2026-08-07", note: "早餐（示範）", account: "cash", category: "早餐" },
  { type: "expense", amount: 150, date: "2026-08-07", note: "午餐（示範）", account: "cash", category: "午餐" },
  { type: "expense", amount: 90, date: "2026-08-07", note: "Uber（示範）", account: "credit", category: "交通" },
  { type: "expense", amount: 260, date: "2026-08-07", note: "晚餐聚餐（示範）", account: "credit", category: "晚餐" },
  { type: "expense", amount: 60, date: "2026-08-11", note: "早餐（示範）", account: "cash", category: "早餐" },
  { type: "expense", amount: 110, date: "2026-08-11", note: "午餐（示範）", account: "cash", category: "午餐" },
  { type: "expense", amount: 45, date: "2026-08-11", note: "捷運（示範）", account: "cash", category: "交通" },
  { type: "expense", amount: 199, date: "2026-08-11", note: "晚餐（示範）", account: "cash", category: "晚餐" },
  { type: "expense", amount: 1280, date: "2026-08-09", note: "UNIQLO（示範）", account: "credit", category: "購物" },
  { type: "expense", amount: 450, date: "2026-08-15", note: "電影＋爆米花（示範）", account: "credit", category: "娛樂" },
  { type: "expense", amount: 890, date: "2026-08-16", note: "全聯採買（示範）", account: "cash", category: "購物" },
  { type: "expense", amount: 350, date: "2026-08-18", note: "診所掛號＋藥（示範）", account: "cash", category: "醫療" },
  { type: "expense", amount: 599, date: "2026-08-20", note: "線上課程（示範）", account: "credit", category: "學習" },
  { type: "expense", amount: 320, date: "2026-08-22", note: "咖啡廳工作（示範）", account: "credit", category: "飲料零食" },
  { type: "expense", amount: 75, date: "2026-08-24", note: "早餐（示範）", account: "cash", category: "早餐" },
  { type: "expense", amount: 140, date: "2026-08-24", note: "午餐（示範）", account: "cash", category: "午餐" },
  { type: "expense", amount: 210, date: "2026-08-24", note: "晚餐（示範）", account: "cash", category: "晚餐" },
  { type: "expense", amount: 80, date: "2026-08-26", note: "飲料零食（示範）", account: "cash", category: "飲料零食" },
  { type: "expense", amount: 1600, date: "2026-08-29", note: "朋友生日禮（示範）", account: "credit", category: "其他支出" },
  { type: "expense", amount: 680, date: "2026-08-30", note: "週末晚餐（示範）", account: "credit", category: "晚餐" },
];

const SEPTEMBER_ROWS: DemoRow[] = [
  { type: "income", amount: 52000, date: "2026-09-05", note: "九月薪水（示範）", account: "bank", category: "薪水" },
  { type: "expense", amount: 18000, date: "2026-09-01", note: "房租（示範）", account: "bank", category: "房租水電" },
  { type: "expense", amount: 699, date: "2026-09-08", note: "手機月租（示範）", account: "bank", category: "電話費" },
  { type: "expense", amount: 980, date: "2026-09-10", note: "水電瓦斯（示範）", account: "bank", category: "房租水電" },
  { type: "transfer", amount: 4000, date: "2026-09-06", note: "提領現金（示範）", account: "bank", transfer: "cash" },
  { type: "transfer", amount: 6500, date: "2026-09-22", note: "還信用卡（示範）", account: "bank", transfer: "credit" },
  { type: "expense", amount: 70, date: "2026-09-02", note: "早餐（示範）", account: "cash", category: "早餐" },
  { type: "expense", amount: 130, date: "2026-09-02", note: "午餐（示範）", account: "cash", category: "午餐" },
  { type: "expense", amount: 50, date: "2026-09-02", note: "捷運（示範）", account: "cash", category: "交通" },
  { type: "expense", amount: 240, date: "2026-09-02", note: "晚餐（示範）", account: "cash", category: "晚餐" },
  { type: "expense", amount: 65, date: "2026-09-03", note: "早餐（示範）", account: "cash", category: "早餐" },
  { type: "expense", amount: 145, date: "2026-09-03", note: "午餐便當（示範）", account: "cash", category: "午餐" },
  { type: "expense", amount: 55, date: "2026-09-03", note: "手搖飲（示範）", account: "cash", category: "飲料零食" },
  { type: "expense", amount: 280, date: "2026-09-03", note: "晚餐（示範）", account: "credit", category: "晚餐" },
  { type: "expense", amount: 60, date: "2026-09-09", note: "早餐（示範）", account: "cash", category: "早餐" },
  { type: "expense", amount: 160, date: "2026-09-09", note: "午餐（示範）", account: "cash", category: "午餐" },
  { type: "expense", amount: 120, date: "2026-09-09", note: "計程車（示範）", account: "credit", category: "交通" },
  { type: "expense", amount: 320, date: "2026-09-09", note: "晚餐聚餐（示範）", account: "credit", category: "晚餐" },
  { type: "expense", amount: 75, date: "2026-09-12", note: "早餐（示範）", account: "cash", category: "早餐" },
  { type: "expense", amount: 125, date: "2026-09-12", note: "午餐（示範）", account: "cash", category: "午餐" },
  { type: "expense", amount: 45, date: "2026-09-12", note: "捷運（示範）", account: "cash", category: "交通" },
  { type: "expense", amount: 210, date: "2026-09-12", note: "晚餐（示範）", account: "cash", category: "晚餐" },
  { type: "expense", amount: 1580, date: "2026-09-07", note: "蝦皮購物（示範）", account: "credit", category: "購物" },
  { type: "expense", amount: 520, date: "2026-09-13", note: "KTV（示範）", account: "credit", category: "娛樂" },
  { type: "expense", amount: 760, date: "2026-09-14", note: "家樂福採買（示範）", account: "cash", category: "購物" },
  { type: "expense", amount: 280, date: "2026-09-16", note: "藥局（示範）", account: "cash", category: "醫療" },
  { type: "expense", amount: 990, date: "2026-09-17", note: "英語課（示範）", account: "credit", category: "學習" },
  { type: "expense", amount: 180, date: "2026-09-18", note: "咖啡（示範）", account: "credit", category: "飲料零食" },
  { type: "expense", amount: 70, date: "2026-09-19", note: "早餐（示範）", account: "cash", category: "早餐" },
  { type: "expense", amount: 135, date: "2026-09-19", note: "午餐（示範）", account: "cash", category: "午餐" },
  { type: "expense", amount: 250, date: "2026-09-19", note: "晚餐（示範）", account: "cash", category: "晚餐" },
  { type: "expense", amount: 420, date: "2026-09-20", note: "週末早午餐（示範）", account: "credit", category: "午餐" },
  { type: "expense", amount: 880, date: "2026-09-21", note: "朋友晚餐（示範）", account: "credit", category: "晚餐" },
  { type: "expense", amount: 95, date: "2026-09-23", note: "飲料零食（示範）", account: "cash", category: "飲料零食" },
  { type: "expense", amount: 350, date: "2026-09-25", note: "日用品（示範）", account: "cash", category: "其他支出" },
  { type: "expense", amount: 640, date: "2026-09-27", note: "週末晚餐（示範）", account: "credit", category: "晚餐" },
];

async function seedMonthDemo(
  bookId: string,
  year: number,
  month: number,
  rows: DemoRow[],
): Promise<number> {
  const accounts = await listAccounts(bookId);
  const categories = await listCategories(bookId);

  const byAccountType = {
    cash:
      accounts.find((a) => a.type === "cash") ??
      accounts.find((a) => a.name === "現金"),
    bank:
      accounts.find((a) => a.type === "bank") ??
      accounts.find((a) => a.name.includes("銀行")),
    credit:
      accounts.find((a) => a.type === "credit") ??
      accounts.find((a) => a.name.includes("信用")),
  };

  if (!byAccountType.cash || !byAccountType.bank || !byAccountType.credit) {
    throw new Error("找不到現金／銀行／信用卡帳戶，請先確認帳本已初始化。");
  }

  const catByName = new Map(categories.map((c) => [c.name, c]));
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  const existing = await db.transactions
    .where("book_id")
    .equals(bookId)
    .filter(
      (row) =>
        !row.deleted_at &&
        row.date >= start &&
        row.date < end &&
        row.note.includes(DEMO_MARK),
    )
    .toArray();

  for (const row of existing) {
    await softDeleteTransaction(row.id);
  }

  let count = 0;
  for (const row of rows) {
    const account = byAccountType[row.account];
    const transfer = row.transfer ? byAccountType[row.transfer] : null;
    const category = row.category ? catByName.get(row.category) : null;

    if (!account) continue;
    if (row.type === "transfer" && !transfer) continue;
    if (row.type !== "transfer" && row.category && !category) continue;

    await createTransaction(bookId, {
      type: row.type,
      amount: row.amount,
      date: row.date,
      note: row.note,
      account_id: account.id,
      category_id: category?.id ?? null,
      transfer_account_id: transfer?.id ?? null,
    });
    count += 1;
  }

  await upsertBudget(bookId, {
    year,
    month,
    category_id: null,
    amount: 45000,
  });
  const lunch = catByName.get("午餐");
  const transport = catByName.get("交通");
  const shopping = catByName.get("購物");
  if (lunch) {
    await upsertBudget(bookId, {
      year,
      month,
      category_id: lunch.id,
      amount: 8000,
    });
  }
  if (transport) {
    await upsertBudget(bookId, {
      year,
      month,
      category_id: transport.id,
      amount: 3000,
    });
  }
  if (shopping) {
    await upsertBudget(bookId, {
      year,
      month,
      category_id: shopping.id,
      amount: 5000,
    });
  }

  return count;
}

/** Fill August + September 2026 demo data into the active local book. */
export async function seedDemoMonths2026(bookId: string): Promise<{
  august: number;
  september: number;
}> {
  const august = await seedMonthDemo(bookId, 2026, 8, AUGUST_ROWS);
  const september = await seedMonthDemo(bookId, 2026, 9, SEPTEMBER_ROWS);
  return { august, september };
}

/** Seed once per book when no live demo rows exist yet. */
export async function seedDemoMonthsIfEmpty(bookId: string): Promise<{
  didSeed: boolean;
  august: number;
  september: number;
}> {
  const existing = await db.transactions
    .where("book_id")
    .equals(bookId)
    .filter((row) => !row.deleted_at && row.note.includes(DEMO_MARK))
    .count();

  if (existing > 0) {
    return { didSeed: false, august: 0, september: 0 };
  }

  const result = await seedDemoMonths2026(bookId);
  return { didSeed: true, ...result };
}

/** @deprecated use seedDemoMonths2026 */
export async function seedAugust2026Demo(bookId: string): Promise<number> {
  const result = await seedDemoMonths2026(bookId);
  return result.august + result.september;
}
