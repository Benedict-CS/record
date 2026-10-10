"use client";

import { useEffect, useState } from "react";
import { getReceipt } from "@/lib/db/receipts";

export function ReceiptThumb({
  transactionId,
  receiptPath,
}: {
  transactionId: string;
  receiptPath: string | null;
}) {
  const [loaded, setLoaded] = useState<{
    id: string;
    path: string;
    dataUrl: string | null;
  } | null>(null);

  useEffect(() => {
    if (!receiptPath) return;
    let cancelled = false;
    const id = transactionId;
    const path = receiptPath;
    getReceipt(id)
      .then((row) => {
        if (!cancelled) {
          setLoaded({ id, path, dataUrl: row?.data_url ?? null });
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id, path, dataUrl: null });
      });
    return () => {
      cancelled = true;
    };
  }, [transactionId, receiptPath]);

  if (!receiptPath) return null;

  const dataUrl =
    loaded?.id === transactionId && loaded.path === receiptPath
      ? loaded.dataUrl
      : null;

  if (dataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={dataUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-xl object-cover"
      />
    );
  }

  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[10px] leading-none text-[var(--muted)]"
      aria-label="收據"
    >
      收據
    </div>
  );
}
