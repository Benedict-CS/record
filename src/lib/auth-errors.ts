/** Map Supabase / auth English errors to short Traditional Chinese. */
export function formatAuthError(message: string | undefined | null): string {
  const raw = (message ?? "").trim();
  if (!raw) return "登入失敗，請再試一次";
  const lower = raw.toLowerCase();

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid_credentials")
  ) {
    return "帳號或密碼不對";
  }
  if (lower.includes("email not confirmed")) {
    return "請先到信箱點驗證連結";
  }
  if (lower.includes("user already registered")) {
    return "這個帳號已經有人用了，請改用登入";
  }
  if (
    lower.includes("auth session missing") ||
    lower.includes("session missing")
  ) {
    return "尚未登入，請先登入再開啟此功能";
  }
  if (lower.includes("password should be at least")) {
    return "密碼至少要 6 碼";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "嘗試太多次，請稍後再試";
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "網路不通，請檢查連線後再試";
  }
  return raw;
}

/** Cloud account deletion failed. The account is still there. */
export function formatDeleteAccountError(
  message: string | undefined | null,
): string {
  const raw = (message ?? "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return "刪除失敗，請再試一次";
  if (
    lower.includes("pgrst202") ||
    lower.includes("could not find the function") ||
    lower.includes("delete_own_account")
  ) {
    return "雲端還沒開刪帳號。請先在 Supabase 執行 016 的 SQL，再試一次。";
  }
  if (lower.includes("not authenticated") || lower.includes("session")) {
    return "尚未登入，請先登入再刪除帳號";
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "網路不通，帳號還沒刪。請檢查連線後再試";
  }
  if (lower.includes("permission denied")) {
    return "雲端不允許刪除這個帳號";
  }
  return "刪除失敗，請再試一次";
}
