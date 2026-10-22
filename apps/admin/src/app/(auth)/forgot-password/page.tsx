"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { createAdminSupabaseClient } from "@/services";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const { error } = await createAdminSupabaseClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: new URL("/reset-password", window.location.origin).href
      });
      if (error) throw error;
      setSubmitted(true);
    } catch {
      setError("The reset email could not be requested. Check your connection and try again. If this continues, contact support.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Logo */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-kruxt-accent font-kruxt-headline">
          KRUXT
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin Dashboard
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-card border border-border bg-card p-6">
        {submitted ? (
          <div role="status" className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-kruxt-success/15">
              <MailCheck className="h-6 w-6 text-kruxt-success" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-foreground font-kruxt-headline">
              Check your email
            </h2>
            <p className="text-sm text-muted-foreground">
              If an account exists for {email}, you will receive a password
              reset link shortly.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-block text-sm text-kruxt-accent hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-foreground font-kruxt-headline">
              Reset your password
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your email address and we will send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && <p role="alert" className="text-sm text-kruxt-danger">{error}</p>}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-button border border-border bg-kruxt-panel px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent"
                  placeholder="admin@gym.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-button bg-kruxt-accent px-4 py-2.5 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="text-xs text-kruxt-accent hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
