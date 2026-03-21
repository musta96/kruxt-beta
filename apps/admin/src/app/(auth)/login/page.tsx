"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // TODO: Wire to Supabase auth
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (!email || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    // Simulate login -- replace with real auth
    window.location.href = "/";
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
        <h2 className="text-lg font-semibold text-foreground font-kruxt-headline">
          Sign in to your account
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your credentials to access the admin panel.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-kruxt-danger/30 bg-kruxt-danger/10 px-4 py-3 text-sm text-kruxt-danger">
            {error}
          </div>
        )}

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

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-button border border-border bg-kruxt-panel px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-button bg-kruxt-accent px-4 py-2.5 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link
            href="/forgot-password"
            className="text-xs text-kruxt-accent hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
      </div>

      {/* Brand footer */}
      <p className="text-center text-[11px] text-muted-foreground">
        No log, no legend.
      </p>
    </div>
  );
}
