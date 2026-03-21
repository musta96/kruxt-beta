"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // TODO: Wire to Supabase auth reset
    await new Promise((resolve) => setTimeout(resolve, 800));

    setSubmitted(true);
    setLoading(false);
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
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-kruxt-success/15">
              <svg className="h-6 w-6 text-kruxt-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
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
