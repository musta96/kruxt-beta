"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthCaptcha } from "@kruxt/ui/auth-captcha";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePlatformAuth } from "@/contexts/platform-auth-context";
import { PlatformAccessRecovery, PlatformLoginLinks } from "@/components/platform-access-recovery";
import { platformAuthErrorMessage } from "@/services/auth-error";
import { SOCIAL_PROVIDER_LABELS, verifiedSocialProviders } from "@kruxt/ui/social-sign-in";

const SOCIAL_PROVIDERS = verifiedSocialProviders(process.env.NEXT_PUBLIC_KRUXT_VERIFIED_SOCIAL_PROVIDERS);

export default function PlatformLoginPage() {
  const router = useRouter();
  const captcha = useAuthCaptcha(process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY);
  const { signIn, signInWithProvider, user, platformRole, accessError, loading: authLoading } = usePlatformAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef(false);
  const busy = authLoading || !!pending;
  const visibleError = error && !(captcha.verified && error.startsWith("Security verification")) ? error : accessError;

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    if (url.searchParams.has("error") || url.searchParams.has("error_description") || hash.has("error") || hash.has("error_description")) {
      setError("Provider sign-in could not finish. Try again or use your operator email and password.");
      for (const key of ["error", "error_code", "error_description"]) url.searchParams.delete(key);
      url.hash = "";
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && platformRole) router.replace("/");
  }, [authLoading, platformRole, router]);

  async function authenticate(provider?: "google" | "apple") {
    if (operation.current || authLoading) return;
    operation.current = true;
    setPending(provider ? `Connecting to ${provider === "google" ? "Google" : "Apple"}...` : "Signing in...");
    setError(null);
    let requestStarted = false;
    try {
      let result;
      if (provider) {
        result = await signInWithProvider(provider);
      } else {
        const captchaToken = captcha.takeToken();
        requestStarted = true;
        result = await signIn(email, password, captchaToken);
      }
      if (result.error) setError(result.error);
      // Navigation waits for verified operator access, never just a valid session.
    } catch (cause) {
      setError(!provider && !requestStarted
        ? platformAuthErrorMessage(cause)
        : "Sign-in could not finish. Check your connection and try again.");
    } finally {
      if (requestStarted) captcha.reset();
      operation.current = false;
      setPending(null);
    }
  }

  return (
    <main className="platform-login flex min-h-screen items-center justify-center bg-kruxt-bg px-6 py-10">
      <div className="w-full max-w-sm space-y-7">
        <header className="space-y-3">
          <h1 className="font-kruxt-headline text-3xl font-semibold">
            <span className="text-kruxt-accent">KRUXT</span> PLATFORM
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">Sign in with your operator account. Platform access is managed by your KRUXT administrator.</p>
        </header>

        {user && !authLoading && !platformRole ? <PlatformAccessRecovery /> : (
          <form onSubmit={(event) => { event.preventDefault(); void authenticate(); }} aria-busy={busy} className="space-y-5">
            {visibleError && <p role="alert" className="rounded-md border border-kruxt-danger/30 bg-kruxt-danger/10 p-3 text-sm leading-relaxed text-kruxt-danger">{visibleError}</p>}
            <fieldset disabled={busy || !!platformRole} className="space-y-5">
              <legend className="sr-only">Operator sign-in</legend>
              {SOCIAL_PROVIDERS.length > 0 && (
                <>
                  <div className="grid gap-3">
                    {SOCIAL_PROVIDERS.map((provider) => (
                      <button key={provider} type="button" onClick={() => void authenticate(provider)} className="platform-login-secondary">Continue with {SOCIAL_PROVIDER_LABELS[provider]}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" /></div>
                </>
              )}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium">Operator email</label>
                <input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} className="platform-login-input" required />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium">Password</label>
                <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="platform-login-input" required />
                <Link href="/forgot-password" className="inline-block py-2 text-sm text-kruxt-accent underline underline-offset-4">Forgot password?</Link>
                <label className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} className="h-4 w-4 accent-[hsl(var(--kruxt-accent))]" aria-controls="password" />Show password
                </label>
              </div>
              {captcha.widget}
              <button type="submit" className="platform-login-primary w-full">Sign in to platform</button>
            </fieldset>
            <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">{pending || (authLoading ? "Checking platform access..." : platformRole ? "Opening platform..." : "")}</p>
          </form>
        )}
        <PlatformLoginLinks />
      </div>
    </main>
  );
}
