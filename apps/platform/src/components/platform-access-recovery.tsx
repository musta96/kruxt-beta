"use client";

import { useRef, useState } from "react";
import { usePlatformAuth } from "@/contexts/platform-auth-context";

function loginUrl(value: string, member = false): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return "#";
    return new URL(member ? "/#member-login" : "/login", url.origin).href;
  } catch { return "#"; }
}

export function PlatformLoginLinks() {
  const memberUrl = loginUrl(process.env.NEXT_PUBLIC_KRUXT_WEB_URL ?? (process.env.NODE_ENV === "production" ? "https://kruxt-beta.vercel.app" : "http://localhost:3200"), true);
  const gymUrl = loginUrl(process.env.NEXT_PUBLIC_KRUXT_GYM_ADMIN_URL ?? process.env.NEXT_PUBLIC_KRUXT_ADMIN_URL ?? process.env.NEXT_PUBLIC_ADMIN_APP_URL ?? (process.env.NODE_ENV === "production" ? "https://kruxt-admin.vercel.app" : "http://localhost:3000"));
  return <nav aria-label="Other KRUXT sign-in options" className="flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-5 text-sm">
    <a href={memberUrl} className="text-kruxt-accent underline underline-offset-4">Member sign-in</a>
    <a href={gymUrl} className="text-kruxt-accent underline underline-offset-4">Gym admin sign-in</a>
  </nav>;
}

export function PlatformAccessRecovery() {
  const { user, accessError, refresh, signOut } = usePlatformAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef(false);

  async function leave() {
    if (operation.current) return;
    operation.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await signOut();
      if (result.error) setError(result.error);
    } finally {
      operation.current = false;
      setPending(false);
    }
  }

  return <section aria-labelledby="access-title" aria-busy={pending} className="space-y-4">
    <div role="alert" className="space-y-2">
      <h2 id="access-title" className="text-xl font-semibold">{accessError ? "Access check unavailable" : "Platform access required"}</h2>
      <p className="break-words text-sm leading-relaxed text-muted-foreground">{accessError || "This account is signed in, but it is not an active KRUXT platform operator. Use your operator account or ask your KRUXT platform administrator to review your access."}</p>
      {user?.email && <p className="break-all text-sm text-muted-foreground">Signed in as {user.email}</p>}
    </div>
    {error && <p role="alert" className="text-sm text-kruxt-danger">{error}</p>}
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => void leave()} disabled={pending} className="platform-login-primary">{pending ? "Signing out..." : "Sign out and use another account"}</button>
      <button type="button" onClick={() => void refresh()} disabled={pending} className="platform-login-secondary">Retry access check</button>
    </div>
  </section>;
}
