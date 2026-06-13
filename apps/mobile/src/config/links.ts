/**
 * Centralized external links surfaced in the app (Profile → Support).
 *
 * Legal pages live on the brand site (see the policy seed:
 * kruxt.app/legal/...). Override the brand base with EXPO_PUBLIC_APP_WEB_URL
 * if the marketing/legal site moves.
 */
const BRAND_SITE = process.env.EXPO_PUBLIC_APP_WEB_URL ?? "https://kruxt.app";

export const SUPPORT_EMAIL = "support@kruxt.app";

export const APP_LINKS = {
  terms: `${BRAND_SITE}/legal/terms`,
  privacy: `${BRAND_SITE}/legal/privacy`,
  help: `${BRAND_SITE}/help`,
} as const;

/** Build a mailto: URL with an optional prefilled subject. */
export function supportMailto(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
