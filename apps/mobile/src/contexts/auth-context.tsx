import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { useSupabase } from "./supabase-context";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Listens to Supabase `onAuthStateChange` and exposes the current
 * user, session, and loading state to descendant components.
 * Must be nested inside a `<SupabaseProvider>`.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const supabase = useSupabase();
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true
  });

  useEffect(() => {
    // Seed state from current session
    supabase.auth.getSession().then(({ data }) => {
      setState({
        user: data.session?.user ?? null,
        session: data.session,
        loading: false
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        user: session?.user ?? null,
        session,
        loading: false
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signOut }),
    [state, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Returns the current auth state (user, session, loading) and a `signOut` helper.
 * Must be called inside an `<AuthProvider>`.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>.");
  }

  return context;
}

/**
 * Returns the authenticated user or throws if not authenticated.
 * Use this in screens/flows that require a signed-in user.
 */
export function useRequireAuth(): { user: User; session: Session } {
  const { user, session, loading } = useAuth();

  if (loading) {
    throw new Error("Auth state is still loading. Wait for loading to complete before calling useRequireAuth.");
  }

  if (!user || !session) {
    throw new Error("Authentication required. User is not signed in.");
  }

  return { user, session };
}
