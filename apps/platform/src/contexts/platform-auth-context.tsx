"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { PlatformOperatorRole } from "@kruxt/types";
import { createPlatformSupabaseClient } from "@/services/supabase-client";

interface PlatformAuthState {
  supabase: SupabaseClient;
  user: User | null;
  session: Session | null;
  platformRole: PlatformOperatorRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

type PlatformOperatorRow = {
  role: PlatformOperatorRole;
  is_active: boolean;
};

const PlatformAuthContext = createContext<PlatformAuthState | null>(null);

async function resolvePlatformRole(
  supabase: SupabaseClient,
  userId: string
): Promise<PlatformOperatorRole | null> {
  const { data, error } = await supabase
    .from("platform_operator_accounts")
    .select("role,is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.warn("[PlatformAuth] failed to resolve role:", error.message);
    return null;
  }

  const row = data as PlatformOperatorRow | null;
  return row?.is_active ? row.role : null;
}

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createPlatformSupabaseClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [platformRole, setPlatformRole] = useState<PlatformOperatorRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function applySession(nextSession: Session | null) {
      const nextUser = nextSession?.user ?? null;
      const nextRole = nextUser ? await resolvePlatformRole(supabase, nextUser.id) : null;

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
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true);
      void applySession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function refresh(): Promise<void> {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const nextUser = data.session?.user ?? null;
    const nextRole = nextUser ? await resolvePlatformRole(supabase, nextUser.id) : null;
    setSession(data.session);
    setUser(nextUser);
    setPlatformRole(nextRole);
    setLoading(false);
  }

  async function signIn(email: string, password: string): Promise<{ error?: string }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    const nextUser = data.user ?? data.session?.user ?? null;
    const nextRole = nextUser ? await resolvePlatformRole(supabase, nextUser.id) : null;
    if (!nextRole) {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setPlatformRole(null);
      return { error: "This account does not have KRUXT platform access." };
    }

    setUser(nextUser);
    setSession(data.session);
    setPlatformRole(nextRole);
    return {};
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setPlatformRole(null);
  }

  return (
    <PlatformAuthContext.Provider
      value={{ supabase, user, session, platformRole, loading, signIn, signOut, refresh }}
    >
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth(): PlatformAuthState {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error("usePlatformAuth must be used within PlatformAuthProvider");
  return ctx;
}
