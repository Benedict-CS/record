"use client";

import Link from "next/link";
import { useMemo } from "react";
import { accountLabel } from "@/lib/account-name";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { BackupPanel } from "@/components/BackupPanel";
import { useBook } from "@/components/BookProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { useToast } from "@/components/ToastProvider";
import { useOpenItems } from "@/lib/hooks/useLedgerData";
import { groupOpenItems } from "@/lib/open-items";

const LINKS: {
  href: string;
  title: string;
  description: string;
}[] = [
  {
    href: "/pending",
    title: "待處理",
    description: "還沒銷帳的核銷，和還沒退回的扣住",
  },
  {
    href: "/search",
    title: "搜尋",
    description: "依備註、分類、金額或日期找紀錄",
  },
  {
    href: "/settings",
    title: "設定",
    description: "記帳提醒與安裝說明",
  },
  {
    href: "/books",
    title: "帳本",
    description: "新增、切換與管理帳本",
  },
  {
    href: "/accounts",
    title: "帳戶",
    description: "現金、銀行與信用卡（日常流水）",
  },
  {
    href: "/categories",
    title: "分類",
    description: "收入與支出分類",
  },
  {
    href: "/budgets",
    title: "預算",
    description: "設定每月預算上限",
  },
  {
    href: "/templates",
    title: "範本",
    description: "常用記帳一鍵套用",
  },
  {
    href: "/recurring",
    title: "每月固定",
    description: "薪水、房貸、房租、訂閱，以及 0050 這類定期定額",
  },
  {
    href: "/login",
    title: "登入同步",
    description: "選用雲端備份與多裝置同步",
  },
];

export function MorePage() {
  const { user, configured, signOut } = useAuth();
  const confirm = useConfirm();
  const { show } = useToast();
  const { book } = useBook();
  const openCount = groupOpenItems(useOpenItems()).length;
  const now = useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return (
    <AppShell title="更多">
      <div className="space-y-3">
        <p className="text-sm text-[var(--muted)]">
          管理帳本、帳戶、分類與備份設定。
        </p>

        {configured && user ? (
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs text-[var(--muted)]">目前登入</p>
            <p className="mt-1 break-all text-sm font-medium text-[var(--ink)]">
              {accountLabel(user)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              只同步這個帳號。登出後是這台自己的帳，不會把這台的紀錄上傳到下一個帳號。
            </p>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: "登出這個帳號？",
                    message:
                      "登出後看到的是這台裝置自己的帳，可以繼續離線記。那些紀錄不會同步到雲端，也不會在下次登入別的帳號時被上傳。",
                    confirmLabel: "登出",
                  });
                  if (!ok) return;
                  try {
                    await signOut();
                    show("已登出", { variant: "success" });
                  } catch (caught) {
                    show(
                      caught instanceof Error && caught.message
                        ? caught.message
                        : "登出失敗",
                      { variant: "error" },
                    );
                  }
                })();
              }}
              className="mt-3 min-h-11 w-full rounded-xl border border-rose-200 bg-rose-50 text-sm font-medium text-rose-800"
            >
              登出
            </button>
          </section>
        ) : null}

        <ul className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          {LINKS.map((item, index) => {
            const href =
              item.href === "/login" && user ? "/settings" : item.href;
            return (
              <li key={item.href}>
                <Link
                  href={href}
                  className={[
                    "flex min-h-14 items-center justify-between gap-3 px-4 py-3 active:bg-[rgba(28,43,36,0.04)]",
                    index > 0 ? "border-t border-[var(--line)]" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--ink)]">
                      {item.href === "/login" && user
                        ? "帳號與同步"
                        : item.title}
                      {item.href === "/login" && user ? (
                        <span className="ml-2 text-xs font-normal text-[var(--accent)]">
                          已登入
                        </span>
                      ) : null}
                      {item.href === "/pending" && openCount > 0 ? (
                        <span className="ml-2 text-xs font-normal tabular-nums text-[var(--accent)]">
                          {openCount} 件
                        </span>
                      ) : null}
                      {item.href === "/books" && book ? (
                        <span className="ml-2 text-xs font-normal text-[var(--accent)]">
                          {book.name}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {item.href === "/login" && !configured
                        ? "尚未設定雲端，可先本機使用"
                        : item.href === "/login" && user
                          ? "改密碼、登出、刪除帳號"
                          : item.description}
                    </p>
                  </div>
                  <span className="text-[var(--muted)]" aria-hidden>
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <section className="space-y-2">
          <ExportCsvButton year={year} month={month} />
        </section>

        <BackupPanel />

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
          <p className="font-medium text-[var(--ink)]">帳本切換</p>
          <p className="mt-1 text-xs leading-relaxed">
            頁面上方隨時可以切換帳本，每本帳本的帳戶、分類、交易與預算完全分開。
          </p>
        </section>
      </div>
    </AppShell>
  );
}
