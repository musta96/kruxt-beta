import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

export interface AdminSupabaseConfig {
  url?: string;
  anonKey?: string;
}

export function createAdminSupabaseClient(config?: AdminSupabaseConfig): SupabaseClient {
  const url = config?.url ?? readEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "SUPABASE_URL"
  ]);
  const anonKey =
    config?.anonKey ??
    readEnv([
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY",
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_ANON_KEY",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY"
    ]);

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase admin config. Set NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY (or EXPO_PUBLIC_/VITE_ equivalents)."
    );
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });
}
