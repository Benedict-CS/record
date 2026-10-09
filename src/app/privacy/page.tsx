import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "隱私權說明 · 記帳本",
  description:
    "記帳本如何保存帳目：預設只在這台裝置，登入後才同步到你的雲端帳號，以及如何刪除帳號。",
};

export default function PrivacyPage() {
  return (
    <AppShell title="隱私權說明">
      <article className="space-y-4 text-sm leading-relaxed text-[var(--ink)]">
        <p className="text-[var(--muted)]">
          記帳本（Record）是個人記帳工具，網站在{" "}
          <span className="text-[var(--ink)]">record.benedicttiong.site</span>
          。這份說明講資料存在哪裡、誰看得到，以及怎麼刪掉帳號。
        </p>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-medium">不登入也能記</h2>
          <p className="mt-1.5 text-[var(--muted)]">
            帳本、帳戶、分類、每一筆紀錄、預算、範本、存款和每月固定，預設寫在這台裝置的瀏覽器裡（IndexedDB）。沒有登入時，這些內容不會上傳。
          </p>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-medium">帳號裡有什麼</h2>
          <p className="mt-1.5 text-[var(--muted)]">
            註冊時你給一個帳號名稱和密碼。畫面上沒有信箱；名稱在登入系統裡會存成一組內部用的位址，不是你的
            Email，也寄不了信。密碼由 Supabase 保存，記帳本看不到明文。
          </p>
          <p className="mt-1.5 text-[var(--muted)]">
            登入之後，上面那些帳目會同步到 Supabase
            的資料庫，並且只屬於這個帳號。別人登入自己的帳號看不到你的列。未登入時記在這台的帳，不會在你登入時自動變成這個帳號的資料。
          </p>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-medium">不會拿去做的事</h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[var(--muted)]">
            <li>不出售帳目或帳號。</li>
            <li>不放廣告，也不用分析工具追蹤你怎麼點。</li>
            <li>不提供轉帳、借貸或下單。</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-medium">只留在這台的東西</h2>
          <p className="mt-1.5 text-[var(--muted)]">
            記帳提醒的時間存在這台裝置。你若允許瀏覽器通知，許可也只在這台。你自己下載的
            JSON 備份在你的檔案裡，刪帳號不會刪那些檔案。
          </p>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-medium">刪除帳號</h2>
          <p className="mt-1.5 text-[var(--muted)]">
            登入後可以在{" "}
            <Link href="/delete-account" className="text-[var(--accent)] underline-offset-2 hover:underline">
              刪除帳號
            </Link>{" "}
            把雲端帳號和雲端帳目刪掉，同時清掉這台裝置上這個帳號的紀錄。不能復原。
          </p>
          <p className="mt-1.5 text-[var(--muted)]">
            其他手機或電腦上已經下載的副本不會跟著消失，請到那些裝置清除這個網站的資料。沒登入時記在這台的帳會留下。
          </p>
        </section>
      </article>
    </AppShell>
  );
}
