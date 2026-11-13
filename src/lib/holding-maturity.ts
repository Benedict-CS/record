import { todayLocal } from "./format";
import type { Holding } from "./types";

export type MaturityStatus = "overdue" | "today" | "soon" | "future";

export interface MaturingHoldingInfo {
  holding: Holding;
  daysUntil: number;
  status: "overdue" | "today" | "soon";
  label: string;
}

export function diffDays(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

function formatMonthDay(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length < 3) return isoDate;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return `${month}/${day}`;
}

/**
 * Returns active holdings with maturity dates that are today, within `windowDays`
 * in the future, or recently overdue (within past 60 days).
 * Sorted with most urgent first (overdue/today -> soonest upcoming).
 */
export function getMaturingHoldings(
  holdings: Holding[],
  todayIso = todayLocal(),
  windowDays = 14,
): MaturingHoldingInfo[] {
  const results: MaturingHoldingInfo[] = [];

  for (const holding of holdings) {
    if (holding.deleted_at || !holding.maturity_date) continue;
    const daysUntil = diffDays(todayIso, holding.maturity_date);

    if (daysUntil < -60 || daysUntil > windowDays) continue;

    let status: "overdue" | "today" | "soon";
    let label = "";

    if (daysUntil < 0) {
      status = "overdue";
      const overdueDays = Math.abs(daysUntil);
      label = `已於 ${formatMonthDay(holding.maturity_date)} 到期（逾期 ${overdueDays} 天）`;
    } else if (daysUntil === 0) {
      status = "today";
      label = "今天到期！可確認解約或續存";
    } else {
      status = "soon";
      label = `將在 ${daysUntil} 天後到期（${formatMonthDay(holding.maturity_date)}）`;
    }

    results.push({
      holding,
      daysUntil,
      status,
      label,
    });
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

export interface MaturityBadge {
  status: MaturityStatus;
  label: string;
  isUrgent: boolean;
}

export function getMaturityBadge(
  maturityDate: string | null | undefined,
  todayIso = todayLocal(),
): MaturityBadge | null {
  if (!maturityDate) return null;
  const daysUntil = diffDays(todayIso, maturityDate);

  if (daysUntil < 0) {
    return {
      status: "overdue",
      label: `已到期 (${formatMonthDay(maturityDate)})`,
      isUrgent: true,
    };
  }

  if (daysUntil === 0) {
    return {
      status: "today",
      label: "今天到期",
      isUrgent: true,
    };
  }

  if (daysUntil <= 14) {
    return {
      status: "soon",
      label: `剩 ${daysUntil} 天到期`,
      isUrgent: true,
    };
  }

  return {
    status: "future",
    label: `到期日 ${maturityDate.replace(/-/g, "/")}`,
    isUrgent: false,
  };
}
