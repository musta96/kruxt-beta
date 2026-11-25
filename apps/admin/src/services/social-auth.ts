import type { SupabaseClient } from "@supabase/supabase-js";

export type SocialProvider = "google" | "apple";

export const PROVIDER_RETURN_ERROR =
  "Social sign-in could not be completed. Try again or use email and password.";

export function hasProviderReturnError(url: URL): boolean {
  const hash = new URLSearchParams(url.hash.slice(1));
  return ["error", "error_code", "error_description"].some(
    (key) => url.searchParams.has(key) || hash.has(key)
  );
}

// Call only after Supabase initialization has consumed the callback. Invite
// token_hash and type are deliberately untouched.
export function sanitizedAuthReturnUrl(url: URL): string {
  const clean = new URL(url.href);
  const keys = [
    "code", "access_token", "refresh_token", "provider_token",
    "provider_refresh_token", "expires_in", "expires_at", "token_type",
    "error", "error_code", "error_description"
  ];
  for (const key of keys) clean.searchParams.delete(key);
  const hash = new URLSearchParams(clean.hash.slice(1));
  if (keys.some((key) => hash.has(key))) {
    for (const key of keys) hash.delete(key);
    clean.hash = hash.toString();
  }
  return clean.pathname + clean.search + clean.hash;
}

export function safeInternalNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") ||
      /[\\\\\u0000-\u0020]/.test(value)) return "/";
  const origin = "https://internal.invalid";
  try {
    const target = new URL(value, origin);
    if (target.origin !== origin || target.pathname === "/login") return "/";
    return target.pathname + target.search + target.hash;
  } catch {
    return "/";
  }
}

export async function startSocialSignIn(
  client: SupabaseClient,
  config: { url?: string; anonKey?: string },
  provider: SocialProvider,
  redirectTo: string
): Promise<void> {
  const label = provider === "google" ? "Google" : "Apple";
  if (!config.url || !config.anonKey) {
    throw new Error("Social sign-in is not configured. Use email and password or contact support.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let enabled: boolean;
  try {
    const response = await fetch(config.url.replace(/\/$/, "") + "/auth/v1/settings", {
      headers: { apikey: config.anonKey },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error();
    const settings: unknown = await response.json();
    if (!settings || typeof settings !== "object" || !("external" in settings) ||
        !settings.external || typeof settings.external !== "object") throw new Error();
    const flag = (settings.external as Record<string, unknown>)[provider];
    if (typeof flag !== "boolean") throw new Error();
    enabled = flag;
  } catch {
    throw new Error("Cannot check social sign-in availability. Check your connection and try again, or use email and password.");
  } finally {
    clearTimeout(timeout);
  }
  if (!enabled) {
    throw new Error(label + " sign-in is not configured yet. Use email and password or contact support.");
  }
  // URL generation alone does not validate whether a provider is enabled.
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo }
    });
    if (error) throw new Error();
  } catch {
    throw new Error(PROVIDER_RETURN_ERROR);
  }
}

