import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readEnv(candidates: string[]): string | undefined {
  const staticEnv: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  };

  const dynamicEnv =
    typeof window === "undefined"
      ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      : undefined;

  for (const key of candidates) {
    const value = staticEnv[key] ?? dynamicEnv?.[key];
    if (value) return value;
  }

  return undefined;
}

const GLOBAL_CLIENT_CACHE_KEY = "__kruxtPlatformSupabaseBrowserClients";

function getClientCache(): Map<string, SupabaseClient> {
  const scope = globalThis as typeof globalThis & {
    [GLOBAL_CLIENT_CACHE_KEY]?: Map<string, SupabaseClient>;
  };

  if (!scope[GLOBAL_CLIENT_CACHE_KEY]) {
    scope[GLOBAL_CLIENT_CACHE_KEY] = new Map<string, SupabaseClient>();
  }

  return scope[GLOBAL_CLIENT_CACHE_KEY];
}

function buildAuthStorageKey(url: string): string {
  try {
    return `kruxt-auth:${new URL(url).host}`;
  } catch {
    return "kruxt-auth";
  }
}

export function createPlatformSupabaseClient(): SupabaseClient {
  const url = readEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);
  const anonKey = readEnv([
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  ]);

  if (!url || !anonKey) {
    const placeholder = "https://placeholder.supabase.co";
    const placeholderKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";
    if (typeof window === "undefined") {
      return createClient(placeholder, placeholderKey);
    }
    throw new Error(
      "Missing Supabase platform config. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const cacheKey = `${url}::${anonKey}`;
  const cachedClient = getClientCache().get(cacheKey);
  if (cachedClient) return cachedClient;

  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storageKey: buildAuthStorageKey(url),
    },
  });

  getClientCache().set(cacheKey, client);
  return client;
}
