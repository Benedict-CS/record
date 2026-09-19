"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { runSync } from "@/lib/sync/engine";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error?: string }>;
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error?: string; needsEmailConfirm?: boolean }>;
  setPassword: (password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  // When Supabase is not configured there is no session to wait for, so the
  // loading flag is derived from `configured` instead of being written into
  // state from an effect.
  const loading = configured && !authResolved;

  useEffect(() => {
    if (!configured) return;

    const supabase = createClient();
    let mounted = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      setAuthResolved(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthResolved(true);
      if (session?.user) {
        void runSync();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [configured]);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!isSupabaseConfigured()) {
        return { error: "尚未設定 Supabase 環境變數" };
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { error: error.message };
      return {};
    },
    [],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!isSupabaseConfigured()) {
        return { error: "尚未設定 Supabase 環境變數" };
      }
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) return { error: error.message };
      // When "Confirm email" is on, session may be null until the user clicks
      // the confirmation link. When it is off, session is present immediately.
      return { needsEmailConfirm: !data.session };
    },
    [],
  );

  const setPassword = useCallback(async (password: string) => {
    if (!isSupabaseConfigured()) {
      return { error: "尚未設定 Supabase 環境變數" };
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      configured,
      signInWithPassword,
      signUpWithPassword,
      setPassword,
      signOut,
    }),
    [
      user,
      loading,
      configured,
      signInWithPassword,
      signUpWithPassword,
      setPassword,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
