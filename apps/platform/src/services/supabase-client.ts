import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { captureRecoveryEvents } from "./password-recovery";

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

  const storageKey = buildAuthStorageKey(url);
  let pkceRecovery = false;
  let implicitRecovery = false;
  if (typeof window !== "undefined" && window.location.pathname === "/reset-password") {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    // The SDK rejects implicit links in PKCE mode. Only legacy recovery links
    // use this exception; the SDK still validates their tokens and emits proof.
    implicitRecovery = hash.get("type") === "recovery" && !!hash.get("access_token") && !!hash.get("refresh_token");
  }
  if (typeof window !== "undefined" && window.location.pathname === "/reset-password" && new URL(window.location.href).searchParams.get("code")) {
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(`${storageKey}-code-verifier`) ?? "null");
      pkceRecovery = typeof stored === "string" && stored.endsWith("/PASSWORD_RECOVERY");
    } catch { /* Missing or unavailable verifier must fail closed. */ }
  }
  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      flowType: implicitRecovery ? "implicit" : "pkce",
      detectSessionInUrl: true,
      storageKey,
    },
  });
  captureRecoveryEvents(client, pkceRecovery);

  getClientCache().set(cacheKey, client);
  return client;
}

export async function isPlatformProviderEnabled(provider: "google" | "apple"): Promise<boolean> {
  const url = readEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);
  const key = readEnv(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]);
  if (!url || !key) throw new Error("Authentication configuration unavailable");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: key }, signal: controller.signal, cache: "no-store",
    });
    if (!response.ok) throw new Error("Authentication settings unavailable");
    const settings: unknown = await response.json();
    if (!settings || typeof settings !== "object" || !("external" in settings) ||
      !settings.external || typeof settings.external !== "object") {
      throw new Error("Authentication settings unavailable");
    }
    return (settings.external as Record<string, unknown>)[provider] === true;
  } finally {
    clearTimeout(timer);
  }
}
