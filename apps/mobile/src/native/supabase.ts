import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type NativeScope = typeof globalThis & {
  __kruxtNativeSupabaseClients?: Map<string, SupabaseClient>;
};

function getClientCache(): Map<string, SupabaseClient> {
  const scope = globalThis as NativeScope;
  if (!scope.__kruxtNativeSupabaseClients) {
    scope.__kruxtNativeSupabaseClients = new Map<string, SupabaseClient>();
  }

  return scope.__kruxtNativeSupabaseClients;
}

function buildAuthStorageKey(url: string): string {
  try {
    return `kruxt-native-auth:${new URL(url).host}`;
  } catch {
    return "kruxt-native-auth";
  }
}

function getEnv(name: string): string | undefined {
  const env = globalThis.process?.env as Record<string, string | undefined> | undefined;
  return env?.[name];
}

function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = getEnv("EXPO_PUBLIC_SUPABASE_URL") ?? getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey =
    getEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY") ??
    getEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!url || !anonKey) {
    throw new Error(
      "Missing Expo Supabase env. Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return { url, anonKey };
}

export function createNativeSupabaseClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseConfig();
  const cacheKey = `${url}::${anonKey}`;
  const cached = getClientCache().get(cacheKey);
  if (cached) return cached;

  const client = createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storageKey: buildAuthStorageKey(url)
    }
  });

  getClientCache().set(cacheKey, client);
  return client;
}

export function getPublicWebAppUrl(): string {
  return getEnv("EXPO_PUBLIC_APP_WEB_URL") ?? "https://kruxt-foundation-kit.vercel.app";
}
