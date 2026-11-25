"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAuthCaptcha } from "@kruxt/ui/auth-captcha";
import { usePlatformAuth } from "@/contexts/platform-auth-context";
import { recoveryRequest } from "@/services/password-recovery";
import { platformAuthErrorMessage } from "@/services/auth-error";

export default function ForgotPasswordPage() {
  const { supabase } = usePlatformAuth();
  const captcha = useAuthCaptcha(process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    let requestStarted = false;
    try {
      const captchaToken = captcha.takeToken();
      requestStarted = true;
      const result = await recoveryRequest(supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: new URL("/reset-password", window.location.origin).href,
        ...(captchaToken ? { captchaToken } : {}),
      }));
      if (result.error) throw result.error;
      setSent(true);
    } catch (cause) {
      setError(platformAuthErrorMessage(cause, "recovery"));
    } finally {
      if (requestStarted) captcha.reset();
      lock.current = false;
      setBusy(false);
    }
  }

  return <main className="platform-login flex min-h-screen items-center justify-center px-6 py-10">
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-3xl font-semibold">Reset platform password</h1>
      {sent ? <p role="status" className="text-sm leading-relaxed text-muted-foreground">If an account exists for that email, a password reset link will arrive shortly. Open it in this browser. Check your spam folder too.</p> : <form onSubmit={submit} aria-busy={busy} className="space-y-5">
        <p className="text-sm leading-relaxed text-muted-foreground">Enter your operator email to request a password reset link. Resetting your password does not change platform access.</p>
        <fieldset disabled={busy} className="space-y-4">
          <label htmlFor="email" className="block text-sm font-medium">Operator email</label>
          <input id="email" name="email" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} className="platform-login-input" />
          {captcha.widget}
          <button className="platform-login-primary w-full" type="submit">{busy ? "Requesting link..." : "Send reset link"}</button>
        </fieldset>
        {error && !(captcha.verified && error.startsWith("Security verification")) && <p role="alert" className="text-sm text-kruxt-danger">{error}</p>}
      </form>}
      <Link href="/login" className="inline-block text-sm text-kruxt-accent underline underline-offset-4">Back to sign in</Link>
    </div>
  </main>;
}
