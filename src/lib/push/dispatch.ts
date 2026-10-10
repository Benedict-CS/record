import webPush from "web-push";
import { reminderShouldNotifyAt } from "@/lib/reminder";
import { reminderNotificationCopy } from "@/lib/reminder-copy";
import { createAdminClient } from "@/lib/supabase/admin";
import { zonedClock } from "@/lib/zoned-clock";

export type ReminderCronResult = {
  checked: number;
  sent: number;
  skipped: number;
  gone: number;
  reason?: string;
};

type PrefRow = {
  user_id: string;
  enabled: boolean;
  time: string;
  timezone: string;
  notified_on: string | null;
  dismissed_on: string | null;
};

type SubRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function configureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:record@users.record",
    publicKey,
    privateKey,
  );
  return true;
}

export async function runReminderCron(
  now = new Date(),
): Promise<ReminderCronResult> {
  const empty: ReminderCronResult = { checked: 0, sent: 0, skipped: 0, gone: 0 };
  const admin = createAdminClient();
  if (!admin) return { ...empty, reason: "no-admin" };
  if (!configureVapid()) return { ...empty, reason: "no-vapid" };

  const { data: prefs, error: prefError } = await admin
    .from("reminder_prefs")
    .select("user_id, enabled, time, timezone, notified_on, dismissed_on")
    .eq("enabled", true);
  if (prefError) return { ...empty, reason: prefError.message };
  const rows = (prefs ?? []) as PrefRow[];
  if (rows.length === 0) return empty;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");
  const byUser = new Map<string, SubRow[]>();
  for (const row of (subs ?? []) as SubRow[]) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const result = { ...empty, checked: rows.length };

  for (const pref of rows) {
    const clock = zonedClock(now, pref.timezone);
    const due = reminderShouldNotifyAt({
      enabled: pref.enabled,
      time: pref.time,
      lastEntryDate: null,
      notifiedOn: pref.notified_on,
      dismissedOn: pref.dismissed_on,
      dateKey: clock.dateKey,
      minutes: clock.minutes,
    });
    if (!due) {
      result.skipped += 1;
      continue;
    }

    const todayCount = await countToday(admin, pref.user_id, clock.dateKey);
    if (todayCount > 0) {
      result.skipped += 1;
      continue;
    }

    const budgetUsedPct = await budgetUsedPctFor(
      admin,
      pref.user_id,
      clock.year,
      clock.month,
    );
    const copy = reminderNotificationCopy({ todayCount, budgetUsedPct });
    const devices = byUser.get(pref.user_id) ?? [];
    if (devices.length === 0) {
      result.skipped += 1;
      continue;
    }

    let delivered = 0;
    for (const device of devices) {
      try {
        await webPush.sendNotification(
          {
            endpoint: device.endpoint,
            keys: { p256dh: device.p256dh, auth: device.auth },
          },
          JSON.stringify({
            title: copy.title,
            body: copy.body,
            url: "/#quick-add",
          }),
        );
        delivered += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", device.endpoint);
          result.gone += 1;
        }
      }
    }

    if (delivered === 0) {
      result.skipped += 1;
      continue;
    }

    await admin
      .from("reminder_prefs")
      .update({
        notified_on: clock.dateKey,
        updated_at: now.toISOString(),
      })
      .eq("user_id", pref.user_id);
    result.sent += 1;
  }

  return result;
}

async function countToday(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  dateKey: string,
) {
  const { count } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("date", dateKey)
    .is("deleted_at", null)
    .neq("type", "transfer");
  return count ?? 0;
}

async function budgetUsedPctFor(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  year: number,
  month: number,
) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  const { data: budgets } = await admin
    .from("budgets")
    .select("book_id, amount")
    .eq("user_id", userId)
    .eq("year", year)
    .eq("month", month)
    .is("category_id", null)
    .is("deleted_at", null);

  const rows = (budgets ?? []) as { book_id: string | null; amount: number }[];
  if (rows.length === 0) return null;

  const { data: expenses } = await admin
    .from("transactions")
    .select("book_id, amount")
    .eq("user_id", userId)
    .eq("type", "expense")
    .is("deleted_at", null)
    .gte("date", start)
    .lt("date", end);

  const usedByBook = new Map<string, number>();
  for (const row of (expenses ?? []) as { book_id: string | null; amount: number }[]) {
    const key = row.book_id ?? "";
    usedByBook.set(key, (usedByBook.get(key) ?? 0) + Number(row.amount ?? 0));
  }

  let max: number | null = null;
  for (const budget of rows) {
    const used = usedByBook.get(budget.book_id ?? "") ?? 0;
    const amount = Number(budget.amount ?? 0);
    if (!(amount > 0)) continue;
    const pct = Math.round((used / amount) * 100);
    if (max == null || pct > max) max = pct;
  }
  return max;
}
