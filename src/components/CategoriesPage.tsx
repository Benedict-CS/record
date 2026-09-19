"use client";

import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useBook } from "@/components/BookProvider";
import { CategoryFormSheet } from "@/components/CategoryFormSheet";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useConfirm } from "@/components/ConfirmProvider";
import { ListSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/ToastProvider";
import {
  createCategory,
  softDeleteCategory,
  updateCategory,
} from "@/lib/db/crud";
import {
  isPinnedLastCategory,
  sortCategories,
} from "@/lib/category-order";
import { useCategories, useSeedReady } from "@/lib/hooks/useLedgerData";
import { runSync } from "@/lib/sync/engine";
import type { Category, CategoryKind } from "@/lib/types";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function CategorySection({
  title,
  items,
  sortMode,
  busy,
  onEdit,
  onDelete,
  onMove,
}: {
  title: string;
  items: Category[];
  sortMode: boolean;
  busy: boolean;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onMove: (items: Category[], index: number, direction: -1 | 1) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-medium text-[var(--ink)]">{title}</h2>
        <span className="text-xs text-[var(--muted)]">{items.length} 項</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)]/60 px-3 py-6 text-center text-sm text-[var(--muted)]">
          尚無分類
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((category, index) => (
            <li key={category.id}>
              <div className="flex items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] pr-1">
                {sortMode ? (
                  <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
                    <CategoryIcon
                      icon={category.icon}
                      color={category.color}
                      size="md"
                    />
                    <span className="truncate text-sm font-medium text-[var(--ink)]">
                      {category.name}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onEdit(category)}
                    aria-label={`編輯 ${category.name}`}
                    className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-left"
                  >
                    <CategoryIcon
                      icon={category.icon}
                      color={category.color}
                      size="md"
                    />
                    <span className="text-sm font-medium text-[var(--ink)]">
                      {category.name}
                    </span>
                  </button>
                )}

                {sortMode ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onMove(items, index, -1)}
                      disabled={
                        busy ||
                        index === 0 ||
                        isPinnedLastCategory(category)
                      }
                      aria-label={`將 ${category.name} 上移`}
                      className="min-h-11 min-w-11 rounded-xl text-base text-[var(--ink)] hover:bg-[var(--paper)] disabled:opacity-30"
                    >
                      <span aria-hidden>↑</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(items, index, 1)}
                      disabled={
                        busy ||
                        index === items.length - 1 ||
                        isPinnedLastCategory(category) ||
                        isPinnedLastCategory(items[index + 1]!)
                      }
                      aria-label={`將 ${category.name} 下移`}
                      className="min-h-11 min-w-11 rounded-xl text-base text-[var(--ink)] hover:bg-[var(--paper)] disabled:opacity-30"
                    >
                      <span aria-hidden>↓</span>
                    </button>
                  </div>
                ) : isPinnedLastCategory(category) ? (
                  <span className="min-w-11 shrink-0 px-1 text-center text-[10px] text-[var(--muted)]">
                    固定
                  </span>
                ) : (
                  <button
                    type="button"
                    className="min-h-11 min-w-11 shrink-0 rounded-xl text-xs text-[var(--muted)] hover:bg-[var(--paper)] hover:text-rose-600"
                    onClick={() => onDelete(category)}
                    aria-label={`刪除 ${category.name}`}
                  >
                    刪除
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CategoriesPage() {
  const { bookId } = useBook();
  const ready = useSeedReady();
  const categories = useCategories();
  const confirm = useConfirm();
  const { show } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [sortMode, setSortMode] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Toast only on the first move of a sort session so it stays quiet. */
  const movedOnce = useRef(false);

  const expense = useMemo(
    () =>
      sortCategories(categories.filter((item) => item.kind === "expense")),
    [categories],
  );
  const income = useMemo(
    () =>
      sortCategories(categories.filter((item) => item.kind === "income")),
    [categories],
  );

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
  }

  async function handleSubmit(values: {
    name: string;
    kind: CategoryKind;
    icon: string;
    color: string;
  }) {
    try {
      if (editing) {
        await updateCategory(editing.id, values);
        show(`已更新「${values.name}」`, { variant: "success" });
      } else {
        if (!bookId) throw new Error("尚未選擇帳本，請稍後再試");
        await createCategory(bookId, values);
        show(`已新增「${values.name}」`, { variant: "success" });
      }
      void runSync();
    } catch (error) {
      show(errorMessage(error, "儲存分類失敗"), { variant: "error" });
      // Rethrow so the sheet stays open with the user's input intact.
      throw error;
    }
  }

  async function handleDelete(category: Category): Promise<boolean> {
    if (isPinnedLastCategory(category)) {
      show("「其他」分類需保留在最下面，無法刪除", { variant: "error" });
      return false;
    }
    const ok = await confirm({
      title: `刪除「${category.name}」`,
      message:
        "刪除後這個分類不會出現在記帳選單，已記錄的交易仍會保留。此操作無法復原。",
      confirmLabel: "刪除",
      destructive: true,
    });
    if (!ok) return false;
    try {
      await softDeleteCategory(category.id);
      show(`已刪除「${category.name}」`, { variant: "success" });
      void runSync();
      return true;
    } catch (error) {
      show(errorMessage(error, "刪除分類失敗"), { variant: "error" });
      throw error;
    }
  }

  /**
   * Rewrites sort_order to 0..n-1 within a kind. Seed data and older records
   * can share or skip values, which would make a neighbour swap a no-op.
   */
  async function normalizeOrder(list: Category[]) {
    const ordered = sortCategories(list);
    let changed = 0;
    for (let index = 0; index < ordered.length; index += 1) {
      const category = ordered[index];
      if (category.sort_order === index) continue;
      await updateCategory(category.id, { sort_order: index });
      changed += 1;
    }
    return changed;
  }

  async function toggleSortMode() {
    if (sortMode) {
      setSortMode(false);
      return;
    }
    setSortMode(true);
    movedOnce.current = false;
    setBusy(true);
    try {
      const changed =
        (await normalizeOrder(expense)) + (await normalizeOrder(income));
      if (changed > 0) void runSync();
    } catch (error) {
      show(errorMessage(error, "整理排序失敗"), { variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(
    items: Category[],
    index: number,
    direction: -1 | 1,
  ) {
    const target = items[index];
    const neighbour = items[index + direction];
    if (!target || !neighbour) return;
    // Keep catch-all tags pinned at the bottom.
    if (isPinnedLastCategory(target) || isPinnedLastCategory(neighbour)) {
      return;
    }

    setBusy(true);
    try {
      const targetOrder = target.sort_order;
      await updateCategory(target.id, { sort_order: neighbour.sort_order });
      await updateCategory(neighbour.id, { sort_order: targetOrder });
      if (!movedOnce.current) {
        movedOnce.current = true;
        show("順序已儲存", { variant: "success" });
      }
      void runSync();
    } catch (error) {
      show(errorMessage(error, "調整順序失敗"), { variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="分類">
      {!ready ? (
        <ListSkeleton rows={6} />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreate}
              disabled={sortMode}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--ink)] px-4 py-3 text-sm font-medium text-[var(--paper)] disabled:opacity-40"
            >
              <span aria-hidden className="text-lg leading-none">
                +
              </span>
              新增分類
            </button>
            <button
              type="button"
              onClick={toggleSortMode}
              aria-pressed={sortMode}
              className={[
                "min-h-12 shrink-0 rounded-2xl border px-4 text-sm font-medium",
                sortMode
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--surface)]"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]",
              ].join(" ")}
            >
              {sortMode ? "完成" : "排序"}
            </button>
          </div>

          {sortMode ? (
            <p className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)]/60 px-3 py-2.5 text-xs leading-relaxed text-[var(--muted)]">
              用上下箭頭調整順序，記帳時的分類選單會照這個順序顯示。
            </p>
          ) : null}

          <CategorySection
            title="支出"
            items={expense}
            sortMode={sortMode}
            busy={busy}
            onEdit={openEdit}
            onDelete={handleDelete}
            onMove={handleMove}
          />
          <CategorySection
            title="收入"
            items={income}
            sortMode={sortMode}
            busy={busy}
            onEdit={openEdit}
            onDelete={handleDelete}
            onMove={handleMove}
          />
        </div>
      )}

      {/* Remount per open so the form always starts from the current record. */}
      <CategoryFormSheet
        key={sheetOpen ? (editing?.id ?? "new") : "closed"}
        open={sheetOpen}
        category={editing}
        onClose={closeSheet}
        onSubmit={handleSubmit}
        onDelete={editing ? () => handleDelete(editing) : undefined}
      />
    </AppShell>
  );
}
