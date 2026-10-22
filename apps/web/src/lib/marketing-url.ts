const DEFAULT_GYM_ADMIN_URL =
  process.env.NODE_ENV === "production" ? "https://kruxt-admin.vercel.app" : "http://localhost:3000";

export function getGymAdminLoginUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_KRUXT_GYM_ADMIN_URL ??
    process.env.NEXT_PUBLIC_KRUXT_ADMIN_URL ??
    process.env.NEXT_PUBLIC_ADMIN_APP_URL ??
    DEFAULT_GYM_ADMIN_URL;
  const trimmed = url.replace(/\/+$/, "");
  return trimmed.endsWith("/login") ? trimmed : `${trimmed}/login`;
}
