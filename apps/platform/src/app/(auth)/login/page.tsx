"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export default function PlatformLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // TODO: Wire up Supabase auth with platform-operator role check
    setTimeout(() => {
      setLoading(false);
      window.location.href = "/";
    }, 800);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-kruxt-bg p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight font-kruxt-headline">
            <span className="text-kruxt-accent">KRUXT</span>{" "}
            <span className="text-kruxt-platform">PLATFORM</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Super-admin control plane
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-kruxt-danger/30 bg-kruxt-danger/10 px-4 py-3 text-sm text-kruxt-danger">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-button border border-border bg-kruxt-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-platform focus:outline-none focus:ring-1 focus:ring-kruxt-platform"
              placeholder="admin@kruxt.io"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-button border border-border bg-kruxt-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-platform focus:outline-none focus:ring-1 focus:ring-kruxt-platform"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full rounded-button bg-kruxt-platform px-4 py-2.5 text-sm font-semibold text-white transition-all",
              loading
                ? "opacity-60 cursor-not-allowed"
                : "hover:brightness-110 active:scale-[0.98]"
            )}
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          This portal is restricted to KRUXT platform operators.
        </p>
      </div>
    </div>
  );
}
