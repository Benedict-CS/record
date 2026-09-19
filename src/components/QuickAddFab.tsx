"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Floating + control: on home scrolls to the record form; elsewhere goes home. */
export function QuickAddFab() {
  const pathname = usePathname();
  const onHome = pathname === "/";

  const className =
    "quick-add-fab fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-2xl font-light leading-none text-[var(--paper)] shadow-lg shadow-[rgba(15,122,95,0.35)] transition";

  if (onHome) {
    return (
      <a
        href="#quick-add"
        className={className}
        aria-label="新增記帳"
        title="新增記帳"
      >
        +
      </a>
    );
  }

  return (
    <Link href="/#quick-add" className={className} aria-label="前往記帳" title="前往記帳">
      +
    </Link>
  );
}
