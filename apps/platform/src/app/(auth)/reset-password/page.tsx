"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePlatformAuth } from "@/contexts/platform-auth-context";
import { clearRecoverySession, initializeRecovery, isRecoverySession, recoveryRequest } from "@/services/password-recovery";

export default function ResetPasswordPage() {
  const { supabase } = usePlatformAuth();
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "updated" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    void initializeRecovery(supabase).then((valid) => {
      if (active) setState(valid ? "ready" : "invalid");
    }).catch(() => { if (active) setState("invalid"); });
    return () => { active = false; };
  }, [supabase]);

  async function finishSignOut() {
    const result = await recoveryRequest(supabase.auth.signOut({ scope: "local" }));
    if (result.error) throw result.error;
    setState("done");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || (state !== "ready" && state !== "updated")) return;
    setError(null);
    if (state === "ready" && (password.length < 8 || password !== confirmation)) {
      setError("Use at least 8 characters and make sure both passwords match.");
      return;
    }
    lock.current = true;
    setBusy(true);
    let updated = state === "updated";
    try {
      if (!updated) {
        const { data, error: sessionError } = await recoveryRequest(supabase.auth.getSession());
        if (sessionError || !isRecoverySession(supabase, data.session)) {
          setState("invalid");
          return;
        }
        const result = await recoveryRequest(supabase.auth.updateUser({ password }));
        if (result.error) {
          setError("We couldn't update your password. Use a different, stronger password and try again. If the link has expired, request a new one.");
          return;
        }
        clearRecoverySession(supabase);
        setPassword("");
        setConfirmation("");
        updated = true;
        setState("updated");
      }
      await finishSignOut();
    } catch {
      setError(updated ? "Your password was updated, but sign-out could not finish. Check your connection and retry sign-out." : "The password update could not finish. Check your connection and try again, or request a new reset link.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <main className="platform-login flex min-h-screen items-center justify-center px-6 py-10">
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-3xl font-semibold">Choose a new password</h1>
      {state === "checking" && <p role="status" className="text-sm text-muted-foreground">Checking your reset link...</p>}
      {state === "invalid" && <div role="alert" className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">This reset link is invalid or expired, or was opened in a different browser. Request a new link and open it in the browser where you requested it.</p>
        <Link href="/forgot-password" className="inline-block text-sm text-kruxt-accent underline underline-offset-4">Request a new reset link</Link>
      </div>}
      {(state === "ready" || state === "updated") && <form onSubmit={submit} aria-busy={busy} className="space-y-5">
        {state === "ready" ? <fieldset disabled={busy} className="space-y-4">
          <p id="password-hint" className="text-sm leading-relaxed text-muted-foreground">Use at least 8 characters. Your password must also meet the account's security requirements.</p>
          <label htmlFor="password" className="block text-sm font-medium">New password</label>
          <input id="password" name="password" type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} aria-describedby="password-hint" value={password} onChange={(event) => setPassword(event.target.value)} className="platform-login-input" />
          <label htmlFor="confirmation" className="block text-sm font-medium">Confirm new password</label>
          <input id="confirmation" name="confirmation" type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="platform-login-input" />
          <label className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} className="h-4 w-4" />Show passwords</label>
        </fieldset> : <p role="status" className="text-sm text-muted-foreground">Password updated. Finish signing out before signing in again.</p>}
        {error && <p role="alert" className="text-sm text-kruxt-danger">{error}</p>}
        <button type="submit" disabled={busy} className="platform-login-primary w-full">{busy ? "Please wait..." : state === "updated" ? "Retry sign-out" : "Update password"}</button>
      </form>}
      {state === "done" && <p role="status" className="text-sm text-muted-foreground">Password updated. You are signed out. Sign in with your new password.</p>}
      {state !== "updated" && <Link href="/login" className="inline-block text-sm text-kruxt-accent underline underline-offset-4">Back to sign in</Link>}
    </div>
  </main>;
}
