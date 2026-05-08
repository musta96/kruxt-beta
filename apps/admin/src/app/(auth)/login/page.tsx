"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { createAdminSupabaseClient } from "@/services";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
        } else {
          router.replace("/");
        }
      } else {
        const supabase = createAdminSupabaseClient();
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError(signUpError.message);
        } else if (data.session) {
          router.replace("/");
        } else {
          setInfo("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
          setPassword("");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
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
        <p className="mt-1 text-sm text-muted-foreground">Admin Dashboard</p>
      </div>

      {/* Form card */}
      <div className="rounded-card border border-border bg-card p-6">
        {/* Mode switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-kruxt-panel p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
              setInfo(null);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
              mode === "signin"
                ? "bg-kruxt-accent/15 text-kruxt-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
              setInfo(null);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
              mode === "signup"
                ? "bg-kruxt-accent/15 text-kruxt-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign up
          </button>
        </div>

        <h2 className="mt-5 text-lg font-semibold text-foreground font-kruxt-headline">
          {mode === "signin" ? "Sign in to your account" : "Create a new account"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Enter your credentials to access the admin panel."
            : "Use a real email — Supabase may send a confirmation link."}
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-kruxt-danger/30 bg-kruxt-danger/10 px-4 py-3 text-sm text-kruxt-danger">
            {error}
          </div>
        )}
        {info && (
          <div className="mt-4 rounded-lg border border-kruxt-accent/30 bg-kruxt-accent/10 px-4 py-3 text-sm text-kruxt-accent">
            {info}
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
              placeholder="you@example.com"
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
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-button border border-border bg-kruxt-panel px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-button bg-kruxt-accent px-4 py-2.5 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? "Working…"
              : mode === "signin"
                ? "Sign In"
                : "Create account"}
          </button>
        </form>

        {mode === "signin" && (
          <div className="mt-4 text-center">
            <Link
              href="/forgot-password"
              className="text-xs text-kruxt-accent hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
        )}
      </div>

      {/* Brand footer */}
      <p className="text-center text-[11px] text-muted-foreground">
        No log, no legend.
      </p>
    </div>
  );
}
