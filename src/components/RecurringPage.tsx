"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import {
  createRecurringRule,
  listRecurringRules,
  postDueRecurring,
  softDeleteRecurringRule,
} from "@/lib/db/recurring-post";
import { formatMoney } from "@/lib/format";
import { MAX_SCHEDULED_MONTHS, scheduledMonthCount } from "@/lib/recurring";
import { isSpendableBankHolding } from "@/lib/holding-spend";
import {
  useAccounts,
  useCategories,
  useHoldings,
} from "@/lib/hooks/useLedgerData";
import { liveQuery } from "dexie";
import { useEffect } from "react";
import { runSync } from "@/lib/sync/engine";
import type { RecurringRule } from "@/lib/types";

function useRules(bookId: string | null) {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  useEffect(() => {
    if (!bookId) return;
    const sub = liveQuery(() => listRecurringRules(bookId)).subscribe({
      next: (rows) => setRules(rows),
      error: () => setRules([]),
    });
    return () => sub.unsubscribe();
  }, [bookId]);
  return rules;
}

export function RecurringPage({
  embedded = false,
  initialDay,
}: {
  /** Render inside the home add sheet, without the page shell. */
  embedded?: boolean;
  /** Prefill the day of month, for example the day card that opened the sheet. */
  initialDay?: number;
} = {}) {
  const { book, bookId } = useBook();
  const accounts = useAccounts();
  const categories = useCategories("expense");
  const holdings = useHoldings();
  const rules = useRules(bookId);
  const confirm = useConfirm();
  const { show } = useToast();
  const currency = book?.currency;
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [name, setName] = useState("");
  const [kind, setKind] = useState<RecurringRule["kind"]>("expense");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState(
    String(
      initialDay != null && initialDay >= 1 && initialDay <= 31
        ? initialDay
        : now.getDate(),
    ),
  );
  const [startMonth, setStartMonth] = useState(defaultMonth);
  const [endMonth, setEndMonth] = useState("");
  const [reimbursableOn, setReimbursableOn] = useState(false);
  const [reimbursableAmount, setReimbursableAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [holdingId, setHoldingId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const account = accounts.find((row) => row.id === (accountId || accounts[0]?.id));
  const bankExpense = kind === "expense" && account?.type === "bank";
  const sources = holdings.filter((row) => isSpendableBankHolding(row.kind));
  const targets = holdings.filter((row) => row.kind === "fund" || row.kind === "stock");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!bookId) return;
    const parsed = Number(amount);
    const dayOfMonth = Number(day);
    if (!name.trim()) {
      setError("請寫名稱，例如房貸或 0050");
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("金額需大於 0");
      return;
    }
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      setError("扣款日要在 1 到 31 之間");
      return;
    }
    if (endMonth) {
      const span = scheduledMonthCount(startMonth, endMonth);
      if (span == null || span < 1) {
        setError("結束月份不能早於開始月份");
        return;
      }
      if (span > MAX_SCHEDULED_MONTHS) {
        setError(`一次最多先記 ${MAX_SCHEDULED_MONTHS} 個月`);
        return;
      }
    }
    let reimbursable: number | null = null;
    if (kind === "expense" && reimbursableOn) {
      reimbursable = Number(reimbursableAmount || amount);
      if (!Number.isFinite(reimbursable) || reimbursable <= 0) {
        setError("可核銷金額需大於 0");
        return;
      }
      if (reimbursable > parsed) {
        setError("可核銷金額不能大於扣款金額");
        return;
      }
    }
    const chosenAccount = accountId || accounts[0]?.id;
    if (!chosenAccount) {
      setError("請先建立帳戶");
      return;
    }
    if (kind === "expense" && categories.length === 0) {
      setError("請先建立支出分類");
      return;
    }
    if ((kind === "invest" || (kind === "expense" && bankExpense)) && !holdingId && sources.length !== 1) {
      setError(sources.length === 0 ? "請先到存款新增活存或定存" : "請選擇扣款銀行");
      return;
    }
    const sourceId =
      holdingId || (sources.length === 1 ? sources[0].id : "");
    if (kind === "invest" && !sourceId) {
      setError("請選擇扣款銀行");
      return;
    }
    if (kind === "invest" && !targetId) {
      setError(targets.length === 0 ? "請先到存款新增股票或基金，例如 0050" : "請選擇買進的股票或基金");
      return;
    }
    setSaving(true);
    try {
      const created = await createRecurringRule(bookId, {
        name: name.trim(),
        kind,
        amount: parsed,
        dayOfMonth,
        startMonth,
        endMonth: endMonth || null,
        reimbursableAmount: reimbursable,
        accountId: chosenAccount,
        categoryId: kind === "expense" ? categoryId || categories[0]?.id || null : null,
        holdingId: kind === "invest" || bankExpense ? sourceId || null : null,
        targetHoldingId: kind === "invest" ? targetId : null,
      });
      const posted = await postDueRecurring(bookId);
      const saved = (await listRecurringRules(bookId)).find((row) => row.id === created.id);
      void runSync();
      if (saved?.last_error) {
        show(saved.last_error, { variant: "error" });
      } else if (posted > 0 && endMonth) {
        show(`已設定，${posted} 期已入帳`, { variant: "success" });
      } else {
        show(posted > 0 ? "已設定，這期已入帳" : "已設定，到了扣款日會自動入帳", {
          variant: "success",
        });
      }
      setName("");
      setAmount("");
      setEndMonth("");
      setReimbursableOn(false);
      setReimbursableAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "無法建立");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(rule: RecurringRule) {
    const ok = await confirm({
      title: `停止「${rule.name}」？`,
      message: "之後的月份不再自動入帳。已經記下的不會刪掉。",
      confirmLabel: "停止",
      destructive: true,
    });
    if (!ok) return;
    await softDeleteRecurringRule(rule.id);
    void runSync();
    show("已停止", { variant: "info" });
  }

  const body = (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          {embedded
            ? "填了結束月份，開始到結束的每一期會立刻入帳，含還沒到期的月份。固定支出可以標可核銷。定期定額不算支出。"
            : "沒填結束月份時，到了每月那天會自動入帳，沒打開 App 的月份最多補 12 個月。填了結束月份，開始到結束的每一期會立刻入帳，最多 24 個月，銀行餘額會先扣掉。固定支出可以標可核銷。定期定額是把活存換成股票或基金，不算支出。"}
        </p>

        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["expense", "固定支出"],
                ["invest", "定期定額"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={[
                  "min-h-11 rounded-xl text-sm font-medium",
                  kind === value
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "bg-[var(--paper)] text-[var(--muted)]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">名稱</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={kind === "invest" ? "例如 0050" : "例如 房貸、房租、電話費"}
              className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">金額</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
                className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">每月幾號</span>
              <input
                inputMode="numeric"
                value={day}
                onChange={(event) => setDay(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">開始月份</span>
              <input
                type="month"
                value={startMonth}
                onChange={(event) => setStartMonth(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">結束月份</span>
              <input
                type="month"
                value={endMonth}
                onChange={(event) => setEndMonth(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
          </div>
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            結束月份可留空。有填的話，這段每一期會先記上一筆。
          </p>

          {kind === "expense" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--muted)]">分類</span>
                <select
                  value={categoryId || categories[0]?.id || ""}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--muted)]">帳戶</span>
                <select
                  value={accountId || accounts[0]?.id || ""}
                  onChange={(event) => setAccountId(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm"
                >
                  {accounts.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={reimbursableOn}
                  onChange={(event) => {
                    const on = event.target.checked;
                    setReimbursableOn(on);
                    if (on && !reimbursableAmount) setReimbursableAmount(amount);
                  }}
                  className="h-4 w-4"
                />
                可核銷
              </label>
              {reimbursableOn ? (
                <label className="block">
                  <span className="mb-1 block text-xs text-[var(--muted)]">
                    每期可核銷金額
                  </span>
                  <input
                    inputMode="decimal"
                    value={reimbursableAmount}
                    onChange={(event) => setReimbursableAmount(event.target.value)}
                    placeholder={amount || "0"}
                    className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                    每一期都會標成待核銷。補助入帳後，在那一筆按銷帳。
                  </p>
                </label>
              ) : null}
            </>
          ) : null}

          {kind === "invest" || bankExpense ? (
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">從哪張銀行扣</span>
              {sources.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">
                  還沒有活存或定存。
                  <Link href="/holdings" className="ml-1 text-[var(--accent)]">
                    到存款新增
                  </Link>
                </p>
              ) : (
                <select
                  value={holdingId}
                  onChange={(event) => setHoldingId(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm"
                >
                  <option value="">請選擇</option>
                  {sources.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}（{formatMoney(row.amount, currency)}）
                    </option>
                  ))}
                </select>
              )}
            </label>
          ) : null}

          {kind === "invest" ? (
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">買進哪一檔</span>
              {targets.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">
                  還沒有股票或基金。
                  <Link href="/holdings" className="ml-1 text-[var(--accent)]">
                    到存款新增
                  </Link>
                </p>
              ) : (
                <select
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm"
                >
                  <option value="">請選擇</option>
                  {targets.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}（{formatMoney(row.amount, currency)}）
                    </option>
                  ))}
                </select>
              )}
            </label>
          ) : null}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="min-h-12 w-full rounded-xl bg-[var(--ink)] text-sm font-medium text-[var(--paper)] disabled:opacity-60"
          >
            {saving ? "儲存中…" : "設定每月扣款"}
          </button>
        </form>

        <section className="space-y-2">
          {rules.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">
              還沒有固定扣款
            </p>
          ) : (
            rules.map((rule) => (
              <article
                key={rule.id}
                className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--ink)]">
                      {rule.name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {rule.kind === "invest" ? "定期定額" : "固定支出"}
                      {" · 每月 "}
                      {rule.day_of_month} 號 · {formatMoney(rule.amount, currency)}
                      {rule.reimbursable_amount
                        ? ` · 可核銷 ${formatMoney(rule.reimbursable_amount, currency)}`
                        : ""}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {rule.start_month} 開始
                      {rule.end_month ? `，${rule.end_month} 結束` : "，沒有結束"}
                      {rule.last_posted ? ` · 已入帳至 ${rule.last_posted}` : " · 尚未入帳"}
                    </p>
                    {rule.last_error ? (
                      <p className="mt-1 text-xs text-rose-700">{rule.last_error}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void onDelete(rule)}
                    className="shrink-0 text-xs text-rose-700"
                  >
                    停止
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
  );

  if (embedded) return body;
  return <AppShell title="固定扣款">{body}</AppShell>;
}
