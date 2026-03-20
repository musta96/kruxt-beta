import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface MobileSupabaseConfig {
  url?: string;
  anonKey?: string;
}

function readEnv(candidates: string[]): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

  for (const key of candidates) {
    const value = env?.[key];
    if (value && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

let _singleton: SupabaseClient | null = null;
let _singletonConfig: { url: string; anonKey: string } | null = null;

function resolveConfig(config?: MobileSupabaseConfig): { url: string; anonKey: string } {
  const url = config?.url ?? readEnv(["EXPO_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);
  const anonKey = config?.anonKey ?? readEnv(["EXPO_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"]);

  if (!url || !anonKey) {
    throw new Error("Missing Supabase mobile config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return { url, anonKey };
}

/**
 * Creates or returns the singleton Supabase client for the mobile app.
 * If called multiple times, returns the same instance (singleton pattern).
 * Pass `config` only on first call or after `resetMobileSupabaseClient()`.
 */
export function createMobileSupabaseClient(config?: MobileSupabaseConfig): SupabaseClient {
  if (_singleton) {
    return _singleton;
  }

  const resolved = resolveConfig(config);
  _singletonConfig = resolved;

  _singleton = createClient(resolved.url, resolved.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });

  return _singleton;
}

/**
 * Returns the singleton Supabase client, creating it if necessary.
 * Alias for `createMobileSupabaseClient()` that better communicates intent.
 */
export function getMobileSupabaseClient(config?: MobileSupabaseConfig): SupabaseClient {
  return createMobileSupabaseClient(config);
}

/**
 * Resets the singleton Supabase client. Call this on logout to ensure
 * the next session starts with a fresh client instance.
 */
export function resetMobileSupabaseClient(): void {
  _singleton = null;
  _singletonConfig = null;
}
