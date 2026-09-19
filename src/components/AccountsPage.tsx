"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  createAccount,
  softDeleteAccount,
  updateAccount,
} from "@/lib/db/crud";
import { currencyLabel, formatMoney } from "@/lib/format";
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

/** Empty input counts as 0; anything unparseable keeps the previous value out. */
function parseAmount(input: string) {
  const value = Number(input.trim());
  return Number.isFinite(value) ? value : 0;
}

export function AccountsPage() {
  const { book, bookId } = useBook();
  const ready = useSeedReady();
  const confirm = useConfirm();
  const accounts = useAccounts();
  const balances = useAccountBalances();

  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("cash");
  const [opening, setOpening] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<Account["type"]>("cash");
  const [editOpening, setEditOpening] = useState("");

  const bookCurrency = book?.currency ?? "TWD";

  const sorted = useMemo(
    () => [...accounts].sort((a, b) => a.sort_order - b.sort_order),
    [accounts],
  );

  const balanceMap = useMemo(
    () => new Map(balances.map((item) => [item.account.id, item.balance])),
    [balances],
  );

  // Same figure as `bookTotals`, reusing the live balances already subscribed.
  const total = useMemo(
    () => balances.reduce((sum, item) => sum + item.balance, 0),
    [balances],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !bookId) return;
    await createAccount(bookId, {
      name,
      type,
      currency: book?.currency,
      opening_balance: parseAmount(opening),
    });
    setName("");
    setOpening("");
    void runSync();
  }

  function startEdit(account: Account) {
    setEditingId(account.id);
    setEditName(account.name);
    setEditType(account.type);
    setEditOpening(String(account.opening_balance ?? 0));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditType("cash");
    setEditOpening("");
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingId || !editName.trim()) return;
    await updateAccount(editingId, {
      name: editName.trim(),
      type: editType,
      opening_balance: parseAmount(editOpening),
    });
    cancelEdit();
    void runSync();
  }

  return (
    <AppShell title="帳戶">
      {!ready ? (
        <p className="text-sm text-[var(--muted)]">載入本機資料…</p>
      ) : (
        <div className="space-y-3">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5">
            <p className="text-xs text-[var(--muted)]">
              {book?.name ?? "帳本"}總資產（淨額）
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--ink)]">
              {formatMoney(total, bookCurrency)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {sorted.length} 個帳戶 · 不含存款／資產，完整淨值見存款頁
            </p>
          </section>

          <form
            onSubmit={onSubmit}
            className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4"
          >
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">
                帳戶名稱
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                placeholder="例如：玉山銀行"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--muted)]">
                  類型
                </span>
                <select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as Account["type"])
                  }
                  className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--muted)]">
                  期初餘額
                </span>
                <input
                  value={opening}
                  onChange={(event) => setOpening(event.target.value)}
                  type="number"
                  step="any"
                  className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--accent)]"
                  placeholder="0"
                />
              </label>
            </div>
            <p className="text-xs text-[var(--muted)]">
              期初餘額是開始記帳前就有的金額，信用卡欠款可以填負數。
            </p>
            <button
              type="submit"
              className="min-h-11 w-full rounded-md bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--paper)]"
            >
              新增帳戶
            </button>
          </form>

          {sorted.length === 0 ? (
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
              還沒有帳戶，先新增一個吧。
            </p>
          ) : (
            <ul className="space-y-2">
              {sorted.map((account) => {
                const balance = balanceMap.get(account.id);
                const accountCurrency =
                  account.currency || bookCurrency;
                return (
                  <li
                    key={account.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
                  >
                    {editingId === account.id ? (
                      <form onSubmit={saveEdit} className="space-y-2.5">
                        <label className="block">
                          <span className="mb-1 block text-xs text-[var(--muted)]">
                            帳戶名稱
                          </span>
                          <input
                            value={editName}
                            onChange={(event) =>
                              setEditName(event.target.value)
                            }
                            className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                            autoFocus
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="mb-1 block text-xs text-[var(--muted)]">
                              類型
                            </span>
                            <select
                              value={editType}
                              onChange={(event) =>
                                setEditType(
                                  event.target.value as Account["type"],
                                )
                              }
                              className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                            >
                              {TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs text-[var(--muted)]">
                              期初餘額
                            </span>
                            <input
                              value={editOpening}
                              onChange={(event) =>
                                setEditOpening(event.target.value)
                              }
                              type="number"
                              step="any"
                              className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--accent)]"
                              placeholder="0"
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]"
                          >
                            取消
                          </button>
                          <button
                            type="submit"
                            className="min-h-11 rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-[var(--paper)]"
                          >
                            儲存
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/accounts/${account.id}`}
                            className="min-w-0 text-left"
                          >
                            <p className="truncate text-sm font-medium text-[var(--ink)]">
                              {account.name}
                            </p>
                            <p className="mt-0.5 text-xs text-[var(--muted)]">
                              {typeLabel(account.type)} ·{" "}
                              {currencyLabel(accountCurrency)}
                            </p>
                          </Link>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">
                              {balance === undefined
                                ? "—"
                                : formatMoney(balance, accountCurrency)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[var(--muted)] tabular-nums">
                              期初{" "}
                              {formatMoney(
                                account.opening_balance ?? 0,
                                accountCurrency,
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="touch-target inline-flex items-center justify-center px-2 text-xs text-[var(--accent)]"
                            onClick={() => startEdit(account)}
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            className="touch-target inline-flex items-center justify-center px-2 text-xs text-[var(--muted)] active:text-rose-600"
                            onClick={() => {
                              void (async () => {
                                const ok = await confirm({
                                  title: `刪除「${account.name}」？`,
                                  message: "帳戶會從列表隱藏，既有交易仍會保留。",
                                  confirmLabel: "刪除",
                                  destructive: true,
                                });
                                if (!ok) return;
                                await softDeleteAccount(account.id);
                                void runSync();
                              })();
                            }}
                          >
                            刪除
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </AppShell>
  );
}
