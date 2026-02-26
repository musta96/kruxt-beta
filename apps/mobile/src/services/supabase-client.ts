import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface MobileSupabaseConfig {
  url?: string;
  anonKey?: string;
}

function readEnv(candidates: string[]): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const viteEnv =
    typeof import.meta !== "undefined"
      ? ((import.meta as { env?: Record<string, string | undefined> }).env ?? undefined)
      : undefined;

  for (const key of candidates) {
    const value = env?.[key] ?? viteEnv?.[key];
    if (value && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

export function createMobileSupabaseClient(config?: MobileSupabaseConfig): SupabaseClient {
  const url = config?.url ?? readEnv([
    "EXPO_PUBLIC_SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "SUPABASE_URL"
  ]);
  const anonKey = config?.anonKey ?? readEnv([
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY"
  ]);

  if (!url || !anonKey) {
    throw new Error("Missing Supabase mobile config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });
}
