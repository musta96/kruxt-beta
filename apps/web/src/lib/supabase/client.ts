import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type BrowserScope = typeof globalThis & {
  __kruxtWebSupabaseClients?: Map<string, SupabaseClient>;
};

function readEnv(candidates: string[]): string | undefined {
  for (const key of candidates) {
    const value = process.env[key];
    if (value && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function getClientCache(): Map<string, SupabaseClient> {
  const scope = globalThis as BrowserScope;
  if (!scope.__kruxtWebSupabaseClients) {
    scope.__kruxtWebSupabaseClients = new Map<string, SupabaseClient>();
  }

  return scope.__kruxtWebSupabaseClients;
}

function buildAuthStorageKey(url: string): string {
  try {
    return `kruxt-auth:${new URL(url).host}`;
  } catch {
    return "kruxt-auth";
  }
}

function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = readEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "SUPABASE_URL"
  ]);
  const anonKey = readEnv([
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY"
  ]);

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase web env. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
    );
  }

  return { url, anonKey };
}

export function createSupabaseBrowserClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseConfig();
  const cacheKey = `${url}::${anonKey}`;
  const cached = getClientCache().get(cacheKey);
  if (cached) return cached;

  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: buildAuthStorageKey(url)
    }
  });

  getClientCache().set(cacheKey, client);
  return client;
}
