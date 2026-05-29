"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import type { PlatformOperatorRole } from "@kruxt/types";
import { createAdminSupabaseClient } from "@/services";

interface AuthState {
  user: User | null;
  session: Session | null;
  platformRole: PlatformOperatorRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [platformRole, setPlatformRole] = useState<PlatformOperatorRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = createAdminSupabaseClient();

    async function applySession(nextSession: Session | null) {
      const nextUser = nextSession?.user ?? null;
      const nextRole = nextUser ? await resolvePlatformRole(nextUser.id) : null;
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextUser);
      setPlatformRole(nextRole);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setLoading(true);
      void applySession(newSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function resolvePlatformRole(userId: string): Promise<PlatformOperatorRole | null> {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("platform_operator_accounts")
      .select("role,is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.warn("[AuthProvider] failed to resolve platform role:", error.message);
      return null;
    }

    const row = data as { role: PlatformOperatorRole; is_active: boolean } | null;
    return row?.is_active ? row.role : null;
  }

  async function refreshAccess(): Promise<void> {
    setLoading(true);
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const nextUser = data.session?.user ?? null;
    const nextRole = nextUser ? await resolvePlatformRole(nextUser.id) : null;
    setSession(data.session);
    setUser(nextUser);
    setPlatformRole(nextRole);
    setLoading(false);
  }

  async function signIn(
    email: string,
    password: string
  ): Promise<{ error?: string }> {
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };
    return {};
  }

  async function signOut(): Promise<void> {
    const supabase = createAdminSupabaseClient();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setPlatformRole(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, session, platformRole, loading, signIn, signOut, refreshAccess }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
