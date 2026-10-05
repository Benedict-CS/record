"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { accountLabel } from "@/lib/account-name";
import { clearAfterLogin, rememberAfterLogin } from "@/lib/after-login";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

const REMOVED = [
  "雲端帳號，包含帳號名稱和密碼",
  "雲端上這個帳號的帳本、帳戶、分類、紀錄、預算、範本、存款、每月固定",
  "這台裝置上已經下載的這個帳號的紀錄",
];

const KEPT = [
  "沒登入時記在這台的帳，它跟帳號是分開的",
  "你已經存成檔案的 JSON 備份",
  "其他裝置上已經下載的副本。請到那些裝置清除這個網站的資料",
];

export function DeleteAccountPage() {
  const { user, loading, configured, deleteAccount } = useAuth();
  const confirm = useConfirm();
  const { show } = useToast();
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const label = accountLabel(user);
  const matches =
    label.length > 0 && typed.trim().toLowerCase() === label.trim().toLowerCase();

  useEffect(() => {
    if (user) clearAfterLogin();
  }, [user]);

  async function onDelete() {
    if (!matches || deleting) return;
    const ok = await confirm({
      title: "刪除這個帳號？",
      message:
        "雲端帳號和雲端帳目會刪掉，這台裝置上這個帳號的紀錄也會清掉。不能復原。",
      confirmLabel: "刪除帳號",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    const result = await deleteAccount();
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      show(result.error, { variant: "error" });
      return;
    }
    show("帳號已刪除", { variant: "success" });
    router.replace("/");
  }

  return (
    <AppShell title="刪除帳號">
      <div className="space-y-4">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-medium text-[var(--ink)]">會刪掉</h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-relaxed text-[var(--muted)]">
            {REMOVED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-medium text-[var(--ink)]">會留下</h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-relaxed text-[var(--muted)]">
            {KEPT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
            做法也寫在{" "}
            <Link
              href="/privacy"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              隱私權說明
            </Link>
            。
          </p>
        </section>

        {configured && loading ? (
          <p className="text-sm text-[var(--muted)]" role="status">
            檢查登入狀態…
          </p>
        ) : null}

        {configured && !loading && !user ? (
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <h2 className="text-sm font-medium text-[var(--ink)]">怎麼刪</h2>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-sm leading-relaxed text-[var(--muted)]">
              <li>登入要刪除的那個帳號。</li>
              <li>回到這一頁，輸入帳號名稱。</li>
              <li>確認之後就會刪除，不能復原。</li>
            </ol>
            <Link
              href="/login"
              onClick={() => rememberAfterLogin("/delete-account")}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-[var(--paper)]"
            >
              登入後刪除
            </Link>
          </section>
        ) : null}

        {configured && !loading && user ? (
          <section className="rounded-2xl border border-rose-200 bg-[var(--surface)] px-4 py-3">
            <h2 className="text-sm font-medium text-[var(--ink)]">
              確認刪除 {label}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
              輸入帳號名稱才會打開刪除。刪掉之後這個帳號不能再登入。
            </p>
            <label htmlFor="delete-account-name" className="mt-3 block text-xs text-[var(--muted)]">
              帳號名稱
            </label>
            <input
              id="delete-account-name"
              value={typed}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => setTyped(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--accent)]"
            />
            {error ? (
              <p className="mt-2 text-sm text-rose-600" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={!matches || deleting}
              className="mt-3 min-h-11 w-full rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-800 disabled:opacity-50"
            >
              {deleting ? "刪除中…" : "刪除帳號"}
            </button>
          </section>
        ) : null}

        {!configured ? (
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            這個環境沒有雲端帳號。帳只在這台裝置，清除瀏覽器裡這個網站的資料就會一起清掉。
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
