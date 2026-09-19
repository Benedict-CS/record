"use client";

import { useId, useState, type FormEvent } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import {
  CATEGORY_ICON_SLUGS,
  CategoryIcon,
  CategoryIconGlyph,
} from "@/components/CategoryIcon";
import type { Category, CategoryKind } from "@/lib/types";

export const CATEGORY_COLORS = [
  "#e67e22",
  "#f39c12",
  "#e74c3c",
  "#e91e63",
  "#9b59b6",
  "#3498db",
  "#2980b9",
  "#1abc9c",
  "#27ae60",
  "#16a085",
  "#f1c40f",
  "#7f8c8d",
] as const;

const DEFAULT_ICON = "dots";
const DEFAULT_COLOR = CATEGORY_COLORS[8];

/** Screen-reader names so the icon / colour pickers aren't read as raw slugs. */
const ICON_LABELS: Record<string, string> = {
  coffee: "咖啡",
  utensils: "餐具",
  moon: "夜生活",
  cup: "飲料",
  bus: "公車",
  phone: "手機",
  home: "住家",
  building: "大樓",
  bag: "包包",
  smile: "笑臉",
  heart: "愛心",
  book: "書本",
  dots: "其他",
  wallet: "錢包",
  gift: "禮物",
  chart: "圖表",
  briefcase: "公事包",
  car: "汽車",
  plane: "飛機",
  music: "音樂",
  game: "遊戲",
  cart: "購物車",
  bolt: "水電",
  leaf: "植物",
};

const COLOR_LABELS: Record<string, string> = {
  "#e67e22": "橘色",
  "#f39c12": "琥珀色",
  "#e74c3c": "紅色",
  "#e91e63": "桃紅色",
  "#9b59b6": "紫色",
  "#3498db": "藍色",
  "#2980b9": "深藍色",
  "#1abc9c": "青綠色",
  "#27ae60": "綠色",
  "#16a085": "墨綠色",
  "#f1c40f": "黃色",
  "#7f8c8d": "灰色",
};

type Props = {
  open: boolean;
  category: Category | null;
  onClose: () => void;
  onSubmit: (values: {
    name: string;
    kind: CategoryKind;
    icon: string;
    color: string;
  }) => Promise<void> | void;
  onDelete?: () => Promise<boolean | void> | boolean | void;
};

export function CategoryFormSheet({
  open,
  category,
  onClose,
  onSubmit,
  onDelete,
}: Props) {
  const formId = useId();
  const kindLabelId = useId();
  const iconLabelId = useId();
  const colorLabelId = useId();
  const isEdit = Boolean(category);
  // The caller remounts this component on open (see CategoriesPage), so the
  // initial values below double as the per-open reset.
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? "expense");
  const [icon, setIcon] = useState(category?.icon || DEFAULT_ICON);
  const [color, setColor] = useState<string>(category?.color || DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving || deleting) return;
    setSaving(true);
    try {
      await onSubmit({ name: trimmed, kind, icon, color });
      onClose();
    } catch {
      // The caller reports failures via a toast; keep the form open to retry.
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete || deleting || saving) return;
    setDeleting(true);
    try {
      const deleted = await onDelete();
      if (deleted !== false) onClose();
    } catch {
      // Caller shows toast.
    } finally {
      setDeleting(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEdit ? "編輯分類" : "新增分類"}
      leading={<CategoryIcon icon={icon} color={color} size="md" />}
      footer={
        <div className="space-y-2">
          <button
            type="submit"
            form={formId}
            disabled={!name.trim() || saving || deleting}
            className="min-h-12 w-full rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-medium text-[var(--paper)] disabled:opacity-40"
          >
            {saving ? "儲存中…" : isEdit ? "儲存變更" : "新增分類"}
          </button>
          {isEdit && onDelete ? (
            <button
              type="button"
              disabled={saving || deleting}
              onClick={() => void handleDelete()}
              className="min-h-11 w-full rounded-xl text-sm font-medium text-rose-600 disabled:opacity-40"
            >
              {deleting ? "刪除中…" : "刪除分類"}
            </button>
          ) : null}
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-xs text-[var(--muted)]">
            分類名稱
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            data-autofocus
            enterKeyHint="done"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-base outline-none focus:border-[var(--accent)]"
            placeholder="例如：訂閱"
          />
        </label>

        <div role="group" aria-labelledby={kindLabelId}>
          <span
            id={kindLabelId}
            className="mb-1.5 block text-xs text-[var(--muted)]"
          >
            類型
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["expense", "支出"],
                ["income", "收入"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                aria-pressed={kind === value}
                className={[
                  "min-h-11 rounded-xl px-3 py-2.5 text-sm font-medium",
                  kind === value
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--paper)] text-[var(--muted)]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div role="group" aria-labelledby={iconLabelId}>
          <span
            id={iconLabelId}
            className="mb-1.5 block text-xs text-[var(--muted)]"
          >
            圖示
          </span>
          <div className="grid grid-cols-6 gap-2">
            {CATEGORY_ICON_SLUGS.map((slug) => {
              const selected = icon === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  aria-label={`圖示：${ICON_LABELS[slug] ?? slug}`}
                  aria-pressed={selected}
                  onClick={() => setIcon(slug)}
                  className={[
                    "flex min-h-12 min-w-12 items-center justify-center rounded-xl border transition",
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]",
                  ].join(" ")}
                >
                  <CategoryIconGlyph icon={slug} className="h-5 w-5" />
                </button>
              );
            })}
          </div>
        </div>

        <div role="group" aria-labelledby={colorLabelId}>
          <span
            id={colorLabelId}
            className="mb-1.5 block text-xs text-[var(--muted)]"
          >
            顏色
          </span>
          <div className="grid grid-cols-6 gap-2">
            {CATEGORY_COLORS.map((swatch) => {
              const selected = color.toLowerCase() === swatch.toLowerCase();
              return (
                <button
                  key={swatch}
                  type="button"
                  aria-label={`顏色：${COLOR_LABELS[swatch] ?? swatch}`}
                  aria-pressed={selected}
                  onClick={() => setColor(swatch)}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-full"
                >
                  <span
                    aria-hidden
                    className={[
                      "h-9 w-9 rounded-full border-2 transition",
                      selected
                        ? "scale-105 border-[var(--ink)]"
                        : "border-transparent",
                    ].join(" ")}
                    style={{ backgroundColor: swatch }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </BottomSheet>
  );
}
