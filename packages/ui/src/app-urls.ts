/**
 * One place for the public addresses of the three KRUXT web apps.
 *
 * Canonical environment variables (set the same values in every Vercel project):
 *   NEXT_PUBLIC_KRUXT_WEB_URL        member web app   (default https://kruxt-beta.vercel.app)
 *   NEXT_PUBLIC_KRUXT_GYM_ADMIN_URL  gym admin app    (default https://kruxt-admin.vercel.app)
 *   NEXT_PUBLIC_KRUXT_PLATFORM_URL   platform console (default https://kruxt-platform.vercel.app)
 *
 * Older variable names are still read so existing deployments keep working.
 * Each process.env access is written out literally so Next.js can inline it.
 *
 * These are plain navigation links. Session hand-off between workspaces stays in
 * workspace-session.ts, which applies its own origin allowlist.
 */
export type KruxtApp = "member" | "admin" | "platform";

const PRODUCTION: Record<KruxtApp, string> = {
  member: "https://kruxt-beta.vercel.app",
  admin: "https://kruxt-admin.vercel.app",
  platform: "https://kruxt-platform.vercel.app",
};

const LOCAL: Record<KruxtApp, string> = {
  member: "http://localhost:3200",
  admin: "http://localhost:3000",
  platform: "http://localhost:3100",
};

function configured(app: KruxtApp): Array<string | undefined> {
  switch (app) {
    case "member":
      return [
        process.env.NEXT_PUBLIC_KRUXT_WEB_URL,
        process.env.NEXT_PUBLIC_KRUXT_PUBLIC_WEB_URL,
        process.env.NEXT_PUBLIC_KRUXT_CONSUMER_WEB_URL,
        process.env.NEXT_PUBLIC_KRUXT_APP_URL,
      ];
    case "admin":
      return [
        process.env.NEXT_PUBLIC_KRUXT_GYM_ADMIN_URL,
        process.env.NEXT_PUBLIC_KRUXT_ADMIN_URL,
        process.env.NEXT_PUBLIC_ADMIN_APP_URL,
      ];
    case "platform":
      return [process.env.NEXT_PUBLIC_KRUXT_PLATFORM_URL, process.env.NEXT_PUBLIC_PLATFORM_APP_URL];
  }
}

/** Accept only an http(s) origin with no credentials; return it without a trailing slash. */
export function safeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.username || url.password) return null;
    if (url.protocol === "https:") return url.origin;
    if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) return url.origin;
    return null;
  } catch {
    return null;
  }
}

/** Origin of a KRUXT app, e.g. appOrigin("admin") -> "https://kruxt-admin.vercel.app". */
export function appOrigin(app: KruxtApp, candidates: Array<string | undefined> = configured(app)): string {
  for (const candidate of candidates) {
    const origin = safeOrigin(candidate);
    if (origin) return origin;
  }
  return process.env.NODE_ENV === "production" ? PRODUCTION[app] : LOCAL[app];
}

/** Absolute link into another KRUXT app, e.g. appUrl("admin", "/classes"). */
export function appUrl(app: KruxtApp, path = "/", candidates?: Array<string | undefined>): string {
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return `${appOrigin(app, candidates)}${safePath}`;
}
