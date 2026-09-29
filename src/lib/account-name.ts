/**
 * Record accounts are names such as "account", plus a password.
 * Supabase Auth still stores an email, so a name is saved as
 * `name@users.record`. People never type that address.
 */

export const ACCOUNT_EMAIL_DOMAIN = "users.record";

const ACCOUNT_NAME = /^[a-z0-9][a-z0-9._-]{1,31}$/;

export function normalizeAccountName(input: string) {
  return input.trim().toLowerCase();
}

/** Empty when the name can be registered. */
export function accountNameError(input: string): string | null {
  const name = normalizeAccountName(input);
  if (!name) return "請輸入帳號";
  if (name.includes("@")) return "帳號不用 Email，例如 account";
  if (!ACCOUNT_NAME.test(name) || /[._-]$/.test(name)) {
    return "帳號用 2 到 32 個英數，可含 . _ -";
  }
  return null;
}

/** Sign-in still accepts a legacy email until that account is renamed. */
export function signInAccountError(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return "請輸入帳號";
  if (trimmed.includes("@")) return null;
  return accountNameError(trimmed);
}

export function toAuthEmail(account: string) {
  const trimmed = account.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  return `${normalizeAccountName(trimmed)}@${ACCOUNT_EMAIL_DOMAIN}`;
}

export function accountLabel(user: {
  email?: string | null;
  user_metadata?: { username?: unknown } | null;
} | null) {
  if (!user) return "";
  const username = user.user_metadata?.username;
  if (typeof username === "string" && username.trim()) return username.trim();
  const email = user.email ?? "";
  const suffix = `@${ACCOUNT_EMAIL_DOMAIN}`;
  if (email.toLowerCase().endsWith(suffix)) {
    return email.slice(0, email.length - suffix.length);
  }
  return email;
}
