"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { TransactionEditor } from "@/components/TransactionEditor";
import { TransactionList } from "@/components/TransactionList";
import { formatMoney } from "@/lib/format";
import { expenseDisplayAmount } from "@/lib/reimbursement";
import {
  useAccountBalances,
  useAccountTransactions,
  useAccounts,
  useCategories,
  useSeedReady,
} from "@/lib/hooks/useLedgerData";
import type { Transaction } from "@/lib/types";

export function AccountDetailPage({ accountId }: { accountId: string }) {
  const ready = useSeedReady();
  const { book } = useBook();
  const accounts = useAccounts();
  const categories = useCategories();
  const balances = useAccountBalances();
  const transactions = useAccountTransactions(accountId);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const account = accounts.find((item) => item.id === accountId);
  const balance = balances.find((item) => item.account.id === accountId);
  const currency = account?.currency || book?.currency;

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let expenseCash = 0;
    let held = 0;
    for (const tx of transactions) {
      if (tx.type === "income" && tx.account_id === accountId) {
        income += tx.amount;
      }
      if (tx.type === "expense" && tx.account_id === accountId) {
        expense += expenseDisplayAmount(tx);
        expenseCash += tx.amount;
      }
      if (
        tx.type === "hold" &&
        tx.account_id === accountId
      ) {
        held += tx.amount;
      }
      if (tx.type === "transfer") {
        if (tx.account_id === accountId) {
          expense += tx.amount;
          expenseCash += tx.amount;
        }
        if (tx.transfer_account_id === accountId) income += tx.amount;
      }
    }
    return { income, expense, expenseCash, held };
  }, [transactions, accountId]);

  return (
    <AppShell title={account?.name ?? "帳戶明細"}>
      {!ready ? (
        <p className="text-sm text-[var(--muted)]">載入本機資料…</p>
      ) : !account ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">找不到這個帳戶。</p>
          <Link href="/accounts" className="text-sm text-[var(--accent)]">
            返回帳戶
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5">
            <p className="text-xs text-[var(--muted)]">目前餘額</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--ink)]">
              {formatMoney(balance?.balance ?? 0, currency)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              期初 {formatMoney(account.opening_balance ?? 0, currency)}
            </p>
          </section>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
              <p className="text-[11px] text-[var(--muted)]">流入</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-700">
                {formatMoney(summary.income, currency)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
              <p className="text-[11px] text-[var(--muted)]">實際花掉</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-rose-700">
                {formatMoney(summary.expense, currency)}
              </p>
              {summary.expense < summary.expenseCash ? (
                <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                  實付 {formatMoney(summary.expenseCash, currency)}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
              <p className="text-[11px] text-[var(--muted)]">被扣住</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-800">
                {formatMoney(summary.held, currency)}
              </p>
            </div>
          </div>
          <TransactionList
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            onEdit={setEditing}
            groupByDay
            emptyMessage="這個帳戶還沒有交易"
          />
          <Link
            href="/accounts"
            className="inline-flex min-h-11 items-center text-sm text-[var(--accent)]"
          >
            返回帳戶列表
          </Link>
        </div>
      )}
      {editing ? (
        <TransactionEditor
          transaction={editing}
          accounts={accounts}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </AppShell>
  );
}