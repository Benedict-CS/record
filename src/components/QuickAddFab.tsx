"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";
import { TransactionForm } from "@/components/TransactionForm";
import { useToast } from "@/components/ToastProvider";
import { useAccounts, useCategories } from "@/lib/hooks/useLedgerData";
import { todayLocal } from "@/lib/format";

/**
 * Floating + control. Home owns its own FAB with day-jump support;
 * on other pages, this FAB opens the entry sheet in-place without navigating away.
 */
export function QuickAddFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const accounts = useAccounts();
  const categories = useCategories();
  const { show } = useToast();

  if (pathname === "/") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="quick-add-fab fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-2xl font-light leading-none text-[var(--paper)] shadow-lg shadow-[rgba(15,122,95,0.35)] transition active:scale-95"
        aria-label="記一筆"
        title="記一筆"
      >
        +
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="記一筆"
      >
        <TransactionForm
          key={open ? "open" : "closed"}
          bare
          defaultDate={todayLocal()}
          accounts={accounts}
          categories={categories}
          onSaved={() => {
            setOpen(false);
            show("已記一筆", { variant: "success" });
          }}
        />
      </BottomSheet>
    </>
  );
}
