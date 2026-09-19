"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AccountFormSheet,
  type AccountFormValues,
} from "@/components/AccountFormSheet";
import { AppShell } from "@/components/AppShell";
import { BottomSheet } from "@/components/BottomSheet";
import { useBook } from "@/components/BookProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  createAccount,
  softDeleteAccount,
  updateAccount,
} from "@/lib/db/crud";
import { formatMoney } from "@/lib/format";
import {
  useAccountBalances,
  useAccounts,
  useSeedReady,
} from "@/lib/hooks/useLedgerData";
import { runSync } from "@/lib/sync/engine";
import type { Account } from "@/lib/types";

const TYPE_OPTIONS: { value: Account["type"]; label: string }[] = [
  { value: "cash", label: "現金" },
  { value: "bank", label: "銀行" },
  { value: "credit", label: "信用卡" },
  { value: "other", label: "其他" },
];

function typeLabel(type: Account["type"]) {
  return TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type;
}

export function AccountsPage() {
  const { book, bookId } = useBook();
  const ready = useSeedReady();
  const confirm = useConfirm();
  const accounts = useAccounts();
  const balances = useAccountBalances();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [menuAccount, setMenuAccount] = useState<Account | null>(null);

  const bookCurrency = book?.currency ?? "TWD";

  const sorted = useMemo(
    () => [...accounts].sort((a, b) => a.sort_order - b.sort_order),
    [accounts],
  );

  const balanceMap = useMemo(
    () => new Map(balances.map((item) => [item.account.id, item.balance])),
    [balances],
  );

  const total = useMemo(
    () => balances.reduce((sum, item) => sum + item.balance, 0),
    [balances],
  );

  function openCreate() {
    setMenuAccount(null);
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(account: Account) {
    setMenuAccount(null);
    setEditing(account);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
  }

  async function handleSubmit(values: AccountFormValues) {
    if (editing) {
      await updateAccount(editing.id, {
        name: values.name,
        type: values.type,
        opening_balance: values.opening_balance,
      });
    } else {
      if (!bookId) throw new Error("尚未選擇帳本，請稍後再試");
      await createAccount(bookId, {
        name: values.name,
        type: values.type,
        currency: book?.currency,
        opening_balance: values.opening_balance,
      });
    }
    void runSync();
  }

  async function handleDelete(account: Account) {
    setMenuAccount(null);
    const ok = await confirm({
      title: `刪除「${account.name}」？`,
      message: "帳戶會從列表隱藏，既有交易仍會保留。",
      confirmLabel: "刪除",
      destructive: true,
    });
    if (!ok) return;
    await softDeleteAccount(account.id);
    void runSync();
  }

  return (
    <AppShell title="帳戶">
      {!ready ? (
        <p className="text-sm text-[var(--muted)]">載入本機資料…</p>
      ) : (
        <div className="space-y-4">
          <section className="px-0.5">
            <p className="text-xs text-[var(--muted)]">
              {book?.name ?? "帳本"} · 帳戶淨額
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-[var(--ink)]">
              {formatMoney(total, bookCurrency)}
            </p>
          </section>

          <div className="flex items-center justify-between gap-3 px-0.5">
            <p className="text-sm font-medium text-[var(--ink)]">
              全部帳戶
              <span className="ml-1.5 font-normal text-[var(--muted)]">
                {sorted.length}
              </span>
            </p>
            <button
              type="button"
              onClick={openCreate}
              aria-label="新增帳戶"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[var(--ink)] text-lg leading-none text-[var(--paper)]"
            >
              <span aria-hidden>+</span>
            </button>
          </div>

          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)]/70 px-5 py-10 text-center">
              <p className="text-sm font-medium text-[var(--ink)]">
                還沒有帳戶
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
                先加一個現金或銀行帳戶，之後記帳才能選付款來源。
              </p>
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--ink)] px-5 text-sm font-medium text-[var(--paper)]"
              >
                新增第一個帳戶
              </button>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              {sorted.map((account, index) => {
                const balance = balanceMap.get(account.id);
                const accountCurrency = account.currency || bookCurrency;
                return (
                  <li
                    key={account.id}
                    className={
                      index > 0 ? "border-t border-[var(--line)]" : undefined
                    }
                  >
                    <div className="flex items-stretch">
                      <Link
                        href={`/accounts/${account.id}`}
                        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left active:bg-[var(--paper)]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[var(--ink)]">
                            {account.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--muted)]">
                            {typeLabel(account.type)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">
                          {balance === undefined
                            ? "—"
                            : formatMoney(balance, accountCurrency)}
                        </span>
                      </Link>
                      <button
                        type="button"
                        aria-label={`${account.name} 更多操作`}
                        onClick={() => setMenuAccount(account)}
                        className="inline-flex min-h-14 min-w-11 shrink-0 items-center justify-center text-[var(--muted)] active:bg-[var(--paper)] active:text-[var(--ink)]"
                      >
                        <span aria-hidden className="text-lg leading-none">
                          ···
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="px-0.5 text-xs leading-relaxed text-[var(--muted)]">
            點帳戶看明細；右上角 + 新增。存款／資產請到存款頁。
          </p>
        </div>
      )}

      <BottomSheet
        open={Boolean(menuAccount)}
        onClose={() => setMenuAccount(null)}
        title={menuAccount?.name ?? "帳戶"}
        description={
          menuAccount ? typeLabel(menuAccount.type) : undefined
        }
      >
        {menuAccount ? (
          <div className="space-y-2">
            <Link
              href={`/accounts/${menuAccount.id}`}
              onClick={() => setMenuAccount(null)}
              className="flex min-h-12 items-center rounded-xl bg-[var(--paper)] px-4 text-sm font-medium text-[var(--ink)]"
            >
              查看明細
            </Link>
            <button
              type="button"
              onClick={() => openEdit(menuAccount)}
              className="flex min-h-12 w-full items-center rounded-xl bg-[var(--paper)] px-4 text-sm font-medium text-[var(--ink)]"
            >
              編輯
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(menuAccount)}
              className="flex min-h-12 w-full items-center rounded-xl bg-[var(--paper)] px-4 text-sm font-medium text-rose-700"
            >
              刪除
            </button>
          </div>
        ) : null}
      </BottomSheet>

      <AccountFormSheet
        key={sheetOpen ? (editing?.id ?? "new") : "closed"}
        open={sheetOpen}
        account={editing}
        onClose={closeSheet}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}
