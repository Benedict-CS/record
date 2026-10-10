/**
 * Upload reminder prefs + the Push subscription for a signed-in user.
 * Missing tables (migration 017 not run yet) are ignored so local reminders
 * keep working.
 */

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type ReminderCloudSnap = {
  enabled: boolean;
  time: string;
  timeZone: string;
  notifiedOn: string | null;
  dismissedOn: string | null;
};

export function webPushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

function missingRelation(error: { message?: string | null; code?: string | null } | null) {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /reminder_prefs|push_subscriptions/.test(message)
  );
}

function vapidBytes() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return null;
  const padded = key.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isBrowser() {
  return typeof window !== "undefined";
}

export async function upsertReminderPrefs(snap: ReminderCloudSnap): Promise<boolean> {
  if (!isBrowser() || !isSupabaseConfigured()) return false;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from("reminder_prefs").upsert({
      user_id: user.id,
      enabled: snap.enabled,
      time: snap.time,
      timezone: snap.timeZone,
      notified_on: snap.notifiedOn,
      dismissed_on: snap.dismissedOn,
      updated_at: new Date().toISOString(),
    });
    if (error && !missingRelation(error)) {
      console.warn("reminder_prefs upsert", error.message);
      return false;
    }
    return !error;
  } catch {
    return false;
  }
}

export async function fetchReminderDates(): Promise<{
  notifiedOn: string | null;
  dismissedOn: string | null;
} | null> {
  if (!isBrowser() || !isSupabaseConfigured()) return null;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("reminder_prefs")
      .select("notified_on, dismissed_on")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      notifiedOn: data.notified_on,
      dismissedOn: data.dismissed_on,
    };
  } catch {
    return null;
  }
}

export async function syncPushSubscription(): Promise<boolean> {
  if (!isBrowser() || !isSupabaseConfigured()) return false;
  if (!webPushConfigured()) return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return false;
  }
  const applicationServerKey = vapidBytes();
  if (!applicationServerKey) return false;

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      }));
    const json = subscription.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) return false;

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error && !missingRelation(error)) {
      console.warn("push_subscriptions upsert", error.message);
      return false;
    }
    return !error;
  } catch {
    return false;
  }
}
