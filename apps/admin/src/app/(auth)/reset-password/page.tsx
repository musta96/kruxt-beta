"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createAdminSupabaseClient } from "@/services";
import { clearRecoverySession, initializeRecovery } from "@/services/password-recovery";

export default function ResetPasswordPage() {
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "saved">("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignOut, setNeedsSignOut] = useState(false);
  const recovery = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    let active = true;
    const client = createAdminSupabaseClient();
    void initializeRecovery(client).then(valid => {
      if (!active) return;
      recovery.current = valid;
      setState(valid ? "ready" : "invalid");
    }).catch(() => {
      if (active) setState("invalid");
    });
    return () => { active = false; };
  }, []);

  async function signOut() {
    const { error } = await createAdminSupabaseClient().auth.signOut({ scope: "global" });
    setNeedsSignOut(!!error);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || state !== "ready" || !recovery.current) return;
    setError(null);
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    busy.current = true;
    setLoading(true);
    try {
      const { error } = await createAdminSupabaseClient().auth.updateUser({ password });
      if (error) throw error;
      clearRecoverySession(createAdminSupabaseClient());
      setPassword("");
      setConfirmation("");
      setState("saved");
      setNeedsSignOut(true);
      await signOut();
    } catch {
      setError("The password could not be updated or sign-out did not finish. Use a strong password and try again, or request a new reset link.");
    } finally { busy.current = false; setLoading(false); }
  }

  return <section className="space-y-5 rounded-card border border-border bg-card p-6">
    <h1 className="font-kruxt-headline text-2xl font-semibold">Set a new password</h1>
    {state === "checking" && <p role="status" className="text-sm text-muted-foreground">Checking your reset link...</p>}
    {state === "invalid" && <div role="alert" className="space-y-3 text-sm">
      <p>This reset link is invalid or expired. Request a new link and open it in the browser where you requested it.</p>
      <Link href="/forgot-password" className="text-kruxt-accent underline">Request a new reset link</Link>
    </div>}
    {state === "ready" && <form onSubmit={submit} aria-busy={loading} className="space-y-4">
      <label className="block space-y-2 text-sm">New password
        <input type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} disabled={loading} value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-button border border-border bg-kruxt-panel px-3 py-2.5 text-base" />
      </label>
      <label className="block space-y-2 text-sm">Confirm password
        <input type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} disabled={loading} value={confirmation} onChange={event => setConfirmation(event.target.value)} className="w-full rounded-button border border-border bg-kruxt-panel px-3 py-2.5 text-base" />
      </label>
      <button type="button" disabled={loading} onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide passwords" : "Show passwords"} title={showPassword ? "Hide passwords" : "Show passwords"} className="flex h-10 w-10 items-center justify-center rounded-button border border-border">
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
      {error && <p role="alert" className="text-sm text-kruxt-danger">{error}</p>}
      <button disabled={loading} className="w-full rounded-button bg-kruxt-accent px-4 py-2.5 text-sm font-semibold text-kruxt-bg">{loading ? "Updating..." : "Update password"}</button>
    </form>}
    {state === "saved" && <div role="status" className="space-y-3 text-sm">
      <p>{needsSignOut ? "Password updated. Finish signing out before returning to sign in." : "Password updated. Sign in with your new password."}</p>
      {needsSignOut && <button type="button" disabled={loading} onClick={() => void signOut().catch(() => setNeedsSignOut(true))} className="rounded-button border border-border px-4 py-2">Finish signing out</button>}
    </div>}
    {(state === "invalid" || (state === "saved" && !needsSignOut)) && <Link href="/login" className="inline-block text-sm text-kruxt-accent underline">Back to sign in</Link>}
  </section>;
}
