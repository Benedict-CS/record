"use client";

import { CategoryIcon } from "@/components/CategoryIcon";
import type { Category } from "@/lib/types";

const MEAL_NAMES = ["早餐", "午餐", "晚餐"] as const;

export function CategoryPickerGrid({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
}) {
  const meals = MEAL_NAMES.map((name) =>
    categories.find((row) => row.name === name),
  ).filter((row): row is Category => Boolean(row));

  const mealIds = new Set(meals.map((row) => row.id));
  const others = categories.filter((row) => !mealIds.has(row.id));

  return (
    <div className="space-y-2.5">
      {meals.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs text-[var(--muted)]">常用三餐</p>
          <div className="grid grid-cols-3 gap-2">
            {meals.map((category) => {
              const selected = value === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onChange(category.id)}
                  aria-pressed={selected}
                  className={[
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 transition-colors",
                    selected
                      ? "border-[var(--accent)] bg-[rgba(15,122,95,0.1)]"
                      : "border-[var(--line)] bg-[var(--paper)]",
                  ].join(" ")}
                >
                  <CategoryIcon
                    icon={category.icon}
                    color={category.color}
                    size="sm"
                    className="!h-8 !w-8"
                  />
                  <span className="text-xs font-medium text-[var(--ink)]">
                    {category.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-1.5 text-xs text-[var(--muted)]">
          {meals.length > 0 ? "其他分類" : "分類"}
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {(meals.length > 0 ? others : categories).map((category) => {
            const selected = value === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onChange(category.id)}
                aria-pressed={selected}
                title={category.name}
                className={[
                  "flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 transition-colors",
                  selected
                    ? "border-[var(--accent)] bg-[rgba(15,122,95,0.1)]"
                    : "border-[var(--line)] bg-[var(--paper)]",
                ].join(" ")}
              >
                <CategoryIcon
                  icon={category.icon}
                  color={category.color}
                  size="sm"
                  className="!h-7 !w-7"
                />
                <span className="w-full truncate text-center text-[10px] leading-tight text-[var(--ink)]">
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
