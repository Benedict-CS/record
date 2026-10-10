export const REMINDER_NOTIFICATION_TITLE = "今天記了沒";
export const REMINDER_NOTIFICATION_BODY = "花十秒補上今天的花費。";

/** Mention budget only when it is already tight, so the daily nag stays about recording. */
export const BUDGET_HINT_PCT = 80;

export function clampBudgetPct(used: number, budget: number): number | null {
  if (!(budget > 0) || !Number.isFinite(used) || used < 0) return null;
  return Math.round((used / budget) * 100);
}

/** Highest used% among overall (or category) budgets. */
export function maxBudgetUsedPct(
  rows: { used: number; budget: number }[],
): number | null {
  let max: number | null = null;
  for (const row of rows) {
    const pct = clampBudgetPct(row.used, row.budget);
    if (pct == null) continue;
    if (max == null || pct > max) max = pct;
  }
  return max;
}

export function reminderNotificationCopy(input: {
  todayCount: number;
  budgetUsedPct?: number | null;
}): { title: string; body: string } {
  const todayCount = Math.max(0, Math.floor(input.todayCount));
  const count = `今天 ${todayCount} 筆`;
  const pct = input.budgetUsedPct;
  const body =
    pct != null && pct >= BUDGET_HINT_PCT
      ? `${count}，本月預算已用 ${pct}%。`
      : todayCount === 0
        ? `${count}。花十秒補上。`
        : `${count}。`;
  return {
    title: REMINDER_NOTIFICATION_TITLE,
    body: body || REMINDER_NOTIFICATION_BODY,
  };
}
