"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AmountKeypad } from "@/components/AmountKeypad";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { formatCalcNumber } from "@/lib/calculator";
import {
  applyTemplate,
  createTemplate,
  softDeleteTemplate,
  updateTemplate,
} from "@/lib/db/crud";
import { formatMoney } from "@/lib/format";
import {
  useAccounts,
  useCategories,
  useSeedReady,
  useTemplates,
} from "@/lib/hooks/useLedgerData";
import { runSync } from "@/lib/sync/engine";
import type {
  Account,
  Category,
  Template,
  TransactionType,
} from "@/lib/types";

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
  { value: "transfer", label: "轉帳" },
];

const TYPE_BADGE: Record<TransactionType, string> = {
  expense: "bg-rose-50 text-rose-700",
  income: "bg-emerald-50 text-emerald-700",
  transfer: "bg-[var(--paper)] text-[var(--muted)]",
};

type TemplateDraft = {
  name: string;
  type: TransactionType;
  amount: number;
  note: string;
  account_id: string;
  category_id: string | null;
  transfer_account_id: string | null;
};

function TemplateForm({
  accounts,
  categories,
  initial,
  submitLabel,
  onSave,
  onCancel,
}: {
  accounts: Account[];
  categories: Category[];
  initial?: Template | null;
  submitLabel: string;
  onSave: (draft: TemplateDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const { book } = useBook();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [amount, setAmount] = useState<number | null>(
    initial && initial.amount > 0 ? initial.amount : null,
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [accountId, setAccountId] = useState(
    initial?.account_id ?? accounts[0]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [transferAccountId, setTransferAccountId] = useState(
    initial?.transfer_account_id ?? "",
  );
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCategories = useMemo(
    () =>
      categories.filter((category) =>
        type === "transfer" ? false : category.kind === type,
      ),
    [categories, type],
  );

  const effectiveAccountId = accountId || accounts[0]?.id || "";
  const effectiveCategoryId =
    type === "transfer" ? "" : categoryId || filteredCategories[0]?.id || "";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("請輸入範本名稱");
      return;
    }
    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      setError("請輸入有效金額");
      return;
    }
    if (!effectiveAccountId) {
      setError("請先建立帳戶");
      return;
    }
    if (type !== "transfer" && !effectiveCategoryId) {
      setError("請選擇分類");
      return;
    }
    if (type === "transfer" && !transferAccountId) {
      setError("請選擇轉入帳戶");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        type,
        amount,
        note: note.trim(),
        account_id: effectiveAccountId,
        category_id: type === "transfer" ? null : effectiveCategoryId,
        transfer_account_id: type === "transfer" ? transferAccountId : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">
            範本名稱
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：房租"
            className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-base outline-none focus:border-[var(--accent)]"
          />
        </label>

        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setType(option.value);
                setCategoryId("");
              }}
              className={[
                "min-h-11 rounded-md px-2 py-2 text-sm",
                type === option.value
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--paper)] text-[var(--muted)]",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">金額</span>
          <button
            type="button"
            onClick={() => setKeypadOpen(true)}
            className={[
              "flex min-h-14 w-full items-center justify-between rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-left outline-none focus:border-[var(--accent)]",
              amount === null ? "text-[var(--muted)]" : "text-[var(--ink)]",
            ].join(" ")}
          >
            <span className="text-2xl font-semibold tabular-nums">
              {amount === null
                ? "點擊輸入金額"
                : formatMoney(amount, book?.currency)}
            </span>
            <span className="text-xs text-[var(--muted)]">計算機</span>
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">
            {type === "transfer" ? "轉出帳戶" : "帳戶"}
          </span>
          <select
            value={effectiveAccountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        {type === "transfer" ? (
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">
              轉入帳戶
            </span>
            <select
              value={transferAccountId}
              onChange={(event) => setTransferAccountId(event.target.value)}
              className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="">選擇帳戶</option>
              {accounts
                .filter((account) => account.id !== effectiveAccountId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">分類</span>
            <select
              value={effectiveCategoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">備註</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="可選，例：3 房 2 廳"
            className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-base outline-none focus:border-[var(--accent)]"
          />
        </label>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 rounded-md bg-[var(--ink)] px-3 text-sm font-medium text-[var(--paper)] disabled:opacity-60"
          >
            {saving ? "儲存中…" : submitLabel}
          </button>
        </div>
      </form>

      <AmountKeypad
        open={keypadOpen}
        initialExpression={amount !== null ? formatCalcNumber(amount) : ""}
        onClose={() => setKeypadOpen(false)}
        onConfirm={(value) => {
          setAmount(value);
          setKeypadOpen(false);
        }}
      />
    </>
  );
}

export function TemplatesPage() {
  const { book, bookId } = useBook();
  const ready = useSeedReady();
  const templates = useTemplates();
  const accounts = useAccounts();
  const categories = useCategories();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; text: string } | null>(
    null,
  );
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );

  function flash(id: string, text: string) {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback({ id, text });
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2200);
  }

  const accountMap = useMemo(
    () => Object.fromEntries(accounts.map((item) => [item.id, item.name])),
    [accounts],
  );
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((item) => [item.id, item.name])),
    [categories],
  );

  async function onApply(template: Template) {
    setApplyingId(template.id);
    try {
      await applyTemplate(template.id);
      void runSync();
      flash(template.id, "已記一筆");
    } catch (err) {
      flash(template.id, err instanceof Error ? err.message : "記帳失敗");
    } finally {
      setApplyingId(null);
    }
  }

  async function onDelete(template: Template) {
    await softDeleteTemplate(template.id);
    setConfirmDeleteId(null);
    void runSync();
  }

  const hasAccounts = accounts.length > 0;

  return (
    <AppShell title="範本">
      {!ready ? (
        <p className="text-sm text-[var(--muted)]">載入本機資料…</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            把固定支出存成範本，之後在首頁一鍵記一筆，不必重複輸入。
          </p>

          {!hasAccounts ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-5 text-center">
              <p className="text-sm text-[var(--ink)]">還沒有任何帳戶</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                範本需要指定扣款帳戶，請先建立一個。
              </p>
              <Link
                href="/accounts"
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-[var(--paper)]"
              >
                前往帳戶
              </Link>
            </div>
          ) : null}

          {hasAccounts && creating ? (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4">
              <h2 className="mb-3 text-sm font-medium text-[var(--ink)]">
                新增範本
              </h2>
              <TemplateForm
                accounts={accounts}
                categories={categories}
                submitLabel="建立範本"
                onCancel={() => setCreating(false)}
                onSave={async (draft) => {
                  if (!bookId) throw new Error("請先選擇帳本");
                  await createTemplate(bookId, draft);
                  setCreating(false);
                  void runSync();
                }}
              />
            </section>
          ) : null}

          {hasAccounts && !creating ? (
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setEditingId(null);
              }}
              className="min-h-12 w-full rounded-md bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--paper)]"
            >
              新增範本
            </button>
          ) : null}

          {templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center">
              <p className="text-sm font-medium text-[var(--ink)]">
                還沒有範本
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                範本最適合每月都一樣的固定支出，例如
                <span className="text-[var(--ink)]">房租</span>、
                <span className="text-[var(--ink)]">電話費</span>、
                <span className="text-[var(--ink)]">月租</span>
                。存好之後只要點一下就記完帳。
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {templates.map((template) => {
                const isEditing = editingId === template.id;
                const target =
                  template.type === "transfer"
                    ? `${accountMap[template.account_id] ?? "帳戶"} → ${
                        accountMap[template.transfer_account_id ?? ""] ?? "帳戶"
                      }`
                    : `${
                        categoryMap[template.category_id ?? ""] ?? "未分類"
                      } · ${accountMap[template.account_id] ?? "帳戶"}`;

                return (
                  <li
                    key={template.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
                  >
                    {isEditing ? (
                      <>
                        <h2 className="mb-3 text-sm font-medium text-[var(--ink)]">
                          編輯範本
                        </h2>
                        <TemplateForm
                          accounts={accounts}
                          categories={categories}
                          initial={template}
                          submitLabel="儲存"
                          onCancel={() => setEditingId(null)}
                          onSave={async (draft) => {
                            await updateTemplate(template.id, draft);
                            setEditingId(null);
                            void runSync();
                          }}
                        />
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={[
                                  "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                                  TYPE_BADGE[template.type],
                                ].join(" ")}
                              >
                                {TYPE_OPTIONS.find(
                                  (option) => option.value === template.type,
                                )?.label ?? template.type}
                              </span>
                              <p className="truncate text-sm font-medium text-[var(--ink)]">
                                {template.name}
                              </p>
                            </div>
                            <p className="mt-1 truncate text-xs text-[var(--muted)]">
                              {target}
                              {template.note ? ` · ${template.note}` : ""}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">
                            {formatMoney(template.amount, book?.currency)}
                          </p>
                        </div>

                        {confirmDeleteId === template.id ? (
                          <div className="flex items-center justify-between gap-2 rounded-md bg-[var(--paper)] px-2 py-1.5">
                            <p className="text-xs text-[var(--muted)]">
                              刪除這個範本？
                            </p>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="touch-target inline-flex items-center justify-center px-2 text-xs text-[var(--muted)]"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onClick={() => void onDelete(template)}
                                className="touch-target inline-flex items-center justify-center px-2 text-xs font-medium text-rose-600"
                              >
                                確定刪除
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={applyingId === template.id}
                              onClick={() => void onApply(template)}
                              className="min-h-11 flex-1 rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-[var(--paper)] disabled:opacity-60"
                            >
                              {feedback?.id === template.id
                                ? feedback.text
                                : applyingId === template.id
                                  ? "記帳中…"
                                  : "記一筆"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(template.id);
                                setCreating(false);
                              }}
                              className="touch-target inline-flex items-center justify-center rounded-md border border-[var(--line)] px-3 text-xs text-[var(--accent)]"
                            >
                              編輯
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(template.id)}
                              className="touch-target inline-flex items-center justify-center rounded-md border border-[var(--line)] px-3 text-xs text-[var(--muted)] active:text-rose-600"
                            >
                              刪除
                            </button>
                          </div>
                        )}
                      </div>
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
