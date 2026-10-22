"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { PlatformOperatorRole } from "@kruxt/types";
import { createPlatformSupabaseClient, isPlatformProviderEnabled } from "@/services/supabase-client";

type AuthResult = { error?: string };
interface PlatformAuthState {
  supabase: SupabaseClient;
  user: User | null;
  session: Session | null;
  platformRole: PlatformOperatorRole | null;
  loading: boolean;
  accessError: string | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithProvider: (provider: "google" | "apple") => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  refresh: () => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthState | null>(null);
const ACCESS_ERROR = "We couldn't verify platform access. Check your connection and try again. If this continues, contact your KRUXT platform administrator.";
const SESSION_ERROR = "We couldn't restore your session. Try signing in again.";

async function withAuthTimeout<T>(request: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Authentication timed out")), 15000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createPlatformSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [access, setAccess] = useState<{
    session: Session;
    revision: number;
    role: PlatformOperatorRole | null;
    error: string | null;
  } | null>(null);
  const authRevision = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const initialRevision = authRevision.current;
    void withAuthTimeout(supabase.auth.getSession()).then(({ data, error }) => {
      if (!active || authRevision.current !== initialRevision) return;
      setSession(data.session);
      setSessionError(error ? SESSION_ERROR : null);
      setInitializing(false);
    }).catch(() => {
      if (!active || authRevision.current !== initialRevision) return;
      setSessionError(SESSION_ERROR);
      setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Supabase holds its session lock here: only update React state.
      // getSession owns initialization errors; INITIAL_SESSION contains no error details.
      if (!active || _event === "INITIAL_SESSION") return;
      authRevision.current += 1;
      setSession(nextSession);
      setSessionError(null);
      setInitializing(false);
    });
    return () => {
      active = false;
      mounted.current = false;
      authRevision.current += 1;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const controller = new AbortController();
    // A task boundary keeps database calls outside synchronous auth notifications.
    const task = setTimeout(() => {
      void withAuthTimeout(supabase.from("platform_operator_accounts")
        .select("role,is_active").eq("user_id", session.user.id)
        .eq("is_active", true).abortSignal(controller.signal).maybeSingle())
        .then(({ data, error }) => {
          if (!active) return;
          setAccess({ session, revision, role: error ? null : data?.is_active ? data.role : null, error: error ? ACCESS_ERROR : null });
        }).catch(() => {
          if (active) setAccess({ session, revision, role: null, error: ACCESS_ERROR });
          controller.abort();
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(task);
      controller.abort();
    };
  }, [supabase, session, revision]);

  async function refresh(): Promise<void> {
    setRevision((value) => value + 1);
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const startedAt = authRevision.current;
    try {
      const { data, error } = await withAuthTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }));
      if (error) return { error: error.code === "invalid_credentials"
        ? "Email or password isn't correct. Check your details and try again."
        : "We couldn't sign you in. Check your connection and account confirmation, then try again." };
      if (mounted.current && authRevision.current === startedAt) setSession(data.session);
      return {};
    } catch {
      return { error: "Sign-in could not finish. Check your connection and try again." };
    }
  }

  async function signInWithProvider(provider: "google" | "apple"): Promise<AuthResult> {
    try {
      if (!await isPlatformProviderEnabled(provider)) {
        return { error: `${provider === "google" ? "Google" : "Apple"} sign-in isn't available for this platform yet. Use your operator email and password, or contact your KRUXT platform administrator.` };
      }
      const { error } = await withAuthTimeout(supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: new URL("/login", window.location.origin).href },
      }));
      if (!error) return {};
    } catch { /* Return only safe, actionable copy. */ }
    return { error: `We couldn't connect to ${provider === "google" ? "Google" : "Apple"}. Try again or use your operator email and password. If this continues, contact your KRUXT platform administrator.` };
  }

  async function signOut(): Promise<AuthResult> {
    try {
      const { error } = await withAuthTimeout(supabase.auth.signOut({ scope: "local" }));
      if (error) throw error;
      if (mounted.current) {
        authRevision.current += 1;
        setSession(null);
        setAccess(null);
        setSessionError(null);
      }
      return {};
    } catch {
      return { error: "We couldn't sign you out. Check your connection and try again." };
    }
  }

  const accessResolved = access?.session === session && access?.revision === revision;
  const loading = initializing || (!!session && !accessResolved);
  const platformRole = session && accessResolved ? access?.role ?? null : null;
  const accessError = sessionError ?? (accessResolved ? access?.error ?? null : null);

  return <PlatformAuthContext.Provider value={{ supabase, user: session?.user ?? null, session, platformRole, loading, accessError, signIn, signInWithProvider, signOut, refresh }}>{children}</PlatformAuthContext.Provider>;
}

export function usePlatformAuth(): PlatformAuthState {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error("usePlatformAuth must be used within PlatformAuthProvider");
  return ctx;
}
