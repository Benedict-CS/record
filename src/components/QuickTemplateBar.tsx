"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useBook } from "@/components/BookProvider";
import { applyTemplate } from "@/lib/db/crud";
import { formatMoney } from "@/lib/format";
import { useTemplates } from "@/lib/hooks/useLedgerData";
import { runSync } from "@/lib/sync/engine";
import type { Template } from "@/lib/types";

const TYPE_SIGN: Record<Template["type"], string> = {
  income: "+",
  expense: "-",
  transfer: "",
};

/** One-tap reuse of saved templates, shown above the home entry form. */
export function QuickTemplateBar() {
  const { book } = useBook();
  const templates = useTemplates();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    },
    [],
  );

  async function onApply(template: Template) {
    setBusyId(template.id);
    setError(null);
    try {
      await applyTemplate(template.id);
      void runSync();
      if (doneTimer.current) clearTimeout(doneTimer.current);
      setDoneId(template.id);
      doneTimer.current = setTimeout(() => setDoneId(null), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "記帳失敗");
    } finally {
      setBusyId(null);
    }
  }

  if (templates.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-[var(--ink)]">一鍵複用</h2>
      {/* -mx-3.5 matches the ≤400px shell padding, so the bleed never widens the page. */}
      <div
        className="-mx-3.5 overflow-x-auto px-3.5 sm:-mx-4 sm:px-4"
        style={{ scrollbarWidth: "none" }}
      >
        <ul className="flex w-max items-stretch gap-2 pb-0.5">
          {templates.map((template) => {
            const done = doneId === template.id;
            return (
              <li key={template.id}>
                <button
                  type="button"
                  disabled={busyId === template.id}
                  onClick={() => void onApply(template)}
                  aria-label={`用範本記一筆：${template.name}`}
                  className={[
                    "flex min-h-11 flex-col justify-center rounded-full border px-3.5 py-1.5 text-left whitespace-nowrap disabled:opacity-60",
                    done
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)]"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]",
                  ].join(" ")}
                >
                  <span className="text-sm font-medium">
                    {done ? "已記錄" : template.name}
                  </span>
                  <span
                    className={[
                      "text-xs tabular-nums",
                      done ? "text-[var(--paper)]" : "text-[var(--muted)]",
                    ].join(" ")}
                  >
                    {TYPE_SIGN[template.type]}
                    {formatMoney(template.amount, book?.currency)}
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <Link
              href="/templates"
              className="flex h-full min-h-11 items-center rounded-full border border-dashed border-[var(--line)] px-3.5 text-xs whitespace-nowrap text-[var(--accent)]"
            >
              管理範本
            </Link>
          </li>
        </ul>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </section>
  );
}
