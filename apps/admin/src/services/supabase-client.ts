import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readEnv(candidates: string[]): string | undefined {
  // CRITICAL: Next.js's webpack DefinePlugin only inlines `process.env.NAME`
  // when it sees that EXACT static reference at build time. Dynamic accesses
  // like `process.env[someVar]` are NOT replaced, so client bundles end up
  // with `undefined` for any NEXT_PUBLIC_* vars looked up dynamically.
  // We explicitly reference every supported key statically below so each one
  // gets inlined into the client bundle.
  const staticEnv: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  };

  // On the server we still want to fall back to dynamic process.env (in case
  // a key isn't in the static list above).
  const dynamicEnv =
    typeof window === "undefined"
      ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      : undefined;

  for (const key of candidates) {
    const value = staticEnv[key] ?? dynamicEnv?.[key];
    if (value && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

const GLOBAL_CLIENT_CACHE_KEY = "__kruxtSupabaseBrowserClients";

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
    // During Next.js static generation / build, env vars may not be available.
    // Return a placeholder client that will be replaced on the real client-side render.
    const placeholder = "https://placeholder.supabase.co";
    const placeholderKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";
    if (typeof window === "undefined") {
      return createClient(placeholder, placeholderKey);
    }
    throw new Error(
      "Missing Supabase admin config. Set NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY (or EXPO_PUBLIC_/VITE_ equivalents)."
    );
  }

  const cacheKey = `${url}::${anonKey}`;
  const cachedClient = getClientCache().get(cacheKey);
  if (cachedClient) {
    return cachedClient;
  }

  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storageKey: buildAuthStorageKey(url)
    }
  });

  getClientCache().set(cacheKey, client);
  return client;
}
