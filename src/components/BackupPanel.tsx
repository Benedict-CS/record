"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { exportBackup, importBackup } from "@/lib/db/backup";
import { todayLocal } from "@/lib/format";
import { runSync } from "@/lib/sync/engine";

type ImportMode = "merge" | "replace";

const MODE_OPTIONS: { value: ImportMode; label: string; hint: string }[] = [
  {
    value: "merge",
    label: "合併",
    hint: "保留現有資料，同一筆以較新的版本為準。",
  },
  {
    value: "replace",
    label: "覆蓋",
    hint: "先清空這台裝置的所有資料，再寫入備份檔內容。",
  },
];

function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setConfirmingReplace(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onExport() {
    setBusy("export");
    setMessage(null);
    setError(null);
    try {
      const json = await exportBackup();
      downloadJson(`記帳備份-${todayLocal()}.json`, json);
      setMessage("備份檔已下載。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "匯出失敗，請再試一次。");
    } finally {
      setBusy(null);
    }
  }

  function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setConfirmingReplace(false);
    setMessage(null);
    setError(null);
  }

  function onModeChange(next: ImportMode) {
    setMode(next);
    setConfirmingReplace(false);
  }

  async function runImport() {
    if (!file) return;
    setBusy("import");
    setMessage(null);
    setError(null);
    try {
      const text = await file.text();
      const { imported } = await importBackup(text, mode);
      setMessage(
        `已匯入 ${imported} 筆資料（${mode === "merge" ? "合併" : "覆蓋"}）。`,
      );
      reset();
      void runSync();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "匯入失敗，請確認檔案。");
    } finally {
      setBusy(null);
    }
  }

  function onImportClick() {
    if (!file) return;
    if (mode === "replace" && !confirmingReplace) {
      setConfirmingReplace(true);
      return;
    }
    void runImport();
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div>
        <p className="text-sm font-medium text-[var(--ink)]">備份與還原</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
          備份檔包含所有帳本的完整資料，存在你的裝置上，離線也能匯出。
        </p>
      </div>

      <button
        type="button"
        onClick={() => void onExport()}
        disabled={busy !== null}
        className="min-h-11 w-full rounded-md bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--paper)] disabled:opacity-50"
      >
        {busy === "export" ? "正在匯出…" : "匯出備份"}
      </button>

      <div className="space-y-2.5 border-t border-[var(--line)] pt-3">
        <p className="text-sm font-medium text-[var(--ink)]">匯入備份</p>

        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">
            選擇備份檔（.json）
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={onPickFile}
            className="block w-full text-xs text-[var(--muted)] file:mr-3 file:min-h-11 file:rounded-md file:border file:border-[var(--line)] file:bg-[var(--paper)] file:px-3 file:text-sm file:text-[var(--ink)]"
          />
        </label>

        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs text-[var(--muted)]">匯入方式</legend>
          {MODE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 items-start gap-2.5 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
            >
              <input
                type="radio"
                name="backup-import-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => onModeChange(option.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span className="min-w-0">
                <span className="block text-sm text-[var(--ink)]">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {mode === "replace" ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">
            注意：覆蓋會刪掉這台裝置上現有的帳本、帳戶、分類、交易、預算與範本，且無法復原。建議先匯出一份備份。
          </p>
        ) : null}

        {confirmingReplace ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirmingReplace(false)}
              className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={busy !== null}
              className="min-h-11 rounded-md bg-rose-600 px-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy === "import" ? "正在覆蓋…" : "確定覆蓋"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onImportClick}
            disabled={!file || busy !== null}
            className="min-h-11 w-full rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--paper)] disabled:opacity-50"
          >
            {busy === "import"
              ? "正在匯入…"
              : file
                ? `匯入（${mode === "merge" ? "合併" : "覆蓋"}）`
                : "請先選擇備份檔"}
          </button>
        )}
      </div>

      {message ? (
        <p role="status" className="text-xs text-[var(--accent)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      ) : null}
    </section>
  );
}
