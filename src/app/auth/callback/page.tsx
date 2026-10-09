"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAuthError } from "@/lib/auth-errors";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  // The "not configured" message is a static outcome of the environment, so it
  // is derived during render instead of being pushed into state by an effect.
  // Only messages produced by the async exchange live in state.
  const [asyncMessage, setAsyncMessage] = useState<string | null>(null);
  const message = configured
    ? (asyncMessage ?? "完成登入中…")
    : "尚未設定 Supabase";

  useEffect(() => {
    if (!configured) return;

    const supabase = createClient();

    void (async () => {
      const code = new URL(window.location.href).searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setAsyncMessage(formatAuthError(error.message));
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setAsyncMessage(formatAuthError(error.message));
        return;
      }
      if (data.session) {
        router.replace("/");
        return;
      }
      setAsyncMessage("找不到登入工作階段，請重新寄送連結。");
    })();
  }, [configured, router]);

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-3 px-4">
      <p className="text-sm text-[var(--muted)]">{message}</p>
      {asyncMessage ? (
        <Link href="/login" className="text-sm text-[var(--accent)]">
          返回登入
        </Link>
      ) : null}
    </div>
  );
}