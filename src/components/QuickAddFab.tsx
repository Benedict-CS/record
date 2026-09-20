"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Floating + control. Home owns its own FAB that opens the add sheet;
 * elsewhere this link jumps home and opens that sheet via #quick-add.
 */
export function QuickAddFab() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <Link
      href="/#quick-add"
      className="quick-add-fab fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-2xl font-light leading-none text-[var(--paper)] shadow-lg shadow-[rgba(15,122,95,0.35)] transition"
      aria-label="記一筆"
      title="記一筆"
    >
      +
    </Link>
  );
}
