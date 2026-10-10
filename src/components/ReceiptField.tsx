"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

export function ReceiptField({
  transactionId,
  previewUrl,
  onPick,
  onClear,
  disabled = false,
}: {
  transactionId: string | null;
  previewUrl: string | null;
  onPick: (file: File) => void | Promise<void>;
  onClear: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const shownUrl = previewUrl ?? localUrl;
  const inputId = transactionId ? `receipt-${transactionId}` : "receipt-new";

  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [localUrl]);

  function openPicker() {
    if (disabled) return;
    inputRef.current?.click();
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || disabled) return;
    const nextUrl = URL.createObjectURL(file);
    setLocalUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
    await onPick(file);
  }

  function handleClear() {
    setLocalUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    onClear();
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5">
      <span className="block text-sm text-[var(--ink)]">收據照片</span>
      <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--muted)]">
        拍照或相簿，留在這台；登入後會試著傳上雲端。
      </span>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="收據照片"
        disabled={disabled}
        onChange={handleChange}
        className="sr-only"
      />
      {shownUrl ? (
        <div className="mt-2.5 space-y-2">
          {/* Local / data URLs are not a fit for next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shownUrl}
            alt=""
            className="max-h-40 w-full rounded-xl object-cover"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={openPicker}
              className="min-h-11 flex-1 rounded-xl border border-[var(--line)] px-3 text-sm font-medium text-[var(--ink)] disabled:opacity-50"
            >
              換一張
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleClear}
              className="min-h-11 flex-1 rounded-xl border border-[var(--line)] px-3 text-sm font-medium text-[var(--muted)] disabled:opacity-50"
            >
              移除
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className="mt-2.5 min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-sm font-medium text-[var(--ink)] disabled:opacity-50"
        >
          加入收據
        </button>
      )}
    </div>
  );
}
