/**
 * Which social sign-in buttons a surface may show.
 *
 * A provider appears only when it is listed in NEXT_PUBLIC_KRUXT_VERIFIED_SOCIAL_PROVIDERS
 * (comma-separated, e.g. "google" or "google,apple"). List a provider for an app only
 * after sign-in with it has been verified end to end on that app's deployment:
 * provider configured in Supabase, callback URL allowed, account lands in the right
 * workspace. Unset or empty means no social buttons.
 *
 * The click-time check against Supabase's /auth/v1/settings stays in place as a
 * second, fail-closed gate.
 */
export type SocialProvider = "google" | "apple";

export const SOCIAL_PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: "Google",
  apple: "Apple",
};

const ORDER: SocialProvider[] = ["google", "apple"];

export function verifiedSocialProviders(raw: string | undefined | null): SocialProvider[] {
  if (!raw) return [];
  const listed = new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
  return ORDER.filter((provider) => listed.has(provider));
}
