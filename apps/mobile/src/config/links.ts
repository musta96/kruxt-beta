/**
 * Centralized external links surfaced in the app (Profile → Support).
 *
 * Legal and help pages live on the member web app (/legal/*, /support).
 * The kruxt.app domain is not live yet, so the default is the hosted web app.
 * Override the base with EXPO_PUBLIC_APP_WEB_URL when the brand domain is ready.
 */
const BRAND_SITE = process.env.EXPO_PUBLIC_APP_WEB_URL ?? "https://kruxt-beta.vercel.app";

export const SUPPORT_EMAIL = "support@kruxt.app";

export const APP_LINKS = {
  terms: `${BRAND_SITE}/legal/terms`,
  privacy: `${BRAND_SITE}/legal/privacy`,
  help: `${BRAND_SITE}/support`,
} as const;

/** Build a mailto: URL with an optional prefilled subject. */
export function supportMailto(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
