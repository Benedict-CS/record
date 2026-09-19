"use client";

import type { ReactNode } from "react";

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`skeleton block rounded-lg ${className ?? "h-4 w-full"}`}
    />
  );
}

/** Announces the loading state once for the whole placeholder group. */
function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function CardSkeleton({
  lines = 2,
  label = "載入本機資料…",
  className,
}: {
  lines?: number;
  label?: string;
  className?: string;
}) {
  return (
    <LoadingRegion
      label={label}
      className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 ${className ?? ""}`}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-40" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={`mt-3 h-3 ${index % 2 === 0 ? "w-full" : "w-2/3"}`}
        />
      ))}
    </LoadingRegion>
  );
}

export function ListSkeleton({
  rows = 4,
  label = "載入本機資料…",
  className,
}: {
  rows?: number;
  label?: string;
  className?: string;
}) {
  return (
    <LoadingRegion label={label} className={`space-y-2 ${className ?? ""}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-14 shrink-0" />
        </div>
      ))}
    </LoadingRegion>
  );
}

/** Month grid placeholder used by the calendar while IndexedDB warms up. */
export function CalendarSkeleton({
  label = "載入本機資料…",
}: {
  label?: string;
}) {
  return (
    <LoadingRegion
      label={label}
      className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-14 rounded-md" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-14 rounded-md" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, index) => (
          <Skeleton key={index} className="h-[4.25rem] rounded-xl" />
        ))}
      </div>
    </LoadingRegion>
  );
}
