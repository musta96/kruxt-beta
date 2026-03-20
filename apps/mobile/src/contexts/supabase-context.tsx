import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getMobileSupabaseClient, type MobileSupabaseConfig } from "../services/supabase-client";

interface SupabaseContextValue {
  supabase: SupabaseClient;
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

export interface SupabaseProviderProps {
  config?: MobileSupabaseConfig;
  children: ReactNode;
}

/**
 * Provides the singleton Supabase client to all descendant components.
 * Wrap your app root with this provider.
 */
export function SupabaseProvider({ config, children }: SupabaseProviderProps) {
  const value = useMemo<SupabaseContextValue>(() => {
    return { supabase: getMobileSupabaseClient(config) };
  }, [config]);

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}

/**
 * Returns the singleton Supabase client from context.
 * Must be called inside a `<SupabaseProvider>`.
 */
export function useSupabase(): SupabaseClient {
  const context = useContext(SupabaseContext);

  if (!context) {
    throw new Error("useSupabase must be used within a <SupabaseProvider>.");
  }

  return context.supabase;
}
