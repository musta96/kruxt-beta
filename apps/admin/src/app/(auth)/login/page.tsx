"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { createAdminSupabaseClient } from "@/services";
import { authenticationErrorMessage } from "@/services/auth-error";
import { Eye, EyeOff } from "lucide-react";
import { getAdminSupabasePublicConfig } from "@/services/supabase-client";
import { hasProviderReturnError, sanitizedAuthReturnUrl, safeInternalNextPath, startSocialSignIn, PROVIDER_RETURN_ERROR, type SocialProvider } from "@/services/social-auth";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const busy = useRef(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    const original = new URL(window.location.href);
    const providerError = hasProviderReturnError(original);
    const isCallback = original.searchParams.has("code");
    const next = safeInternalNextPath(original.searchParams.get("next"));
    const supabase = createAdminSupabaseClient();
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      window.history.replaceState(window.history.state, "", sanitizedAuthReturnUrl(new URL(window.location.href)));
      if (providerError || sessionError || (isCallback && !data.session)) {
        setError(PROVIDER_RETURN_ERROR);
      } else if (data.session) {
        router.replace(next);
      }
      setCheckingSession(false);
    }).catch(() => {
      if (!active) return;
      window.history.replaceState(window.history.state, "", sanitizedAuthReturnUrl(new URL(window.location.href)));
      setError(PROVIDER_RETURN_ERROR);
      setCheckingSession(false);
    });
    return () => { active = false; };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current || checkingSession) return;
    setError(null);
    setInfo(null);

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    busy.current = true;
    setLoading(true);
    try {
      if (mode === "signin") {
        const result = await signIn(email, password);
        if (result.error) {
          setError(authenticationErrorMessage({ message: result.error }));
        } else {
          router.replace(getLoginNextPath());
        }
      } else {
        const supabase = createAdminSupabaseClient();
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError(authenticationErrorMessage(signUpError));
        } else if (data.session) {
          router.replace(getLoginNextPath());
        } else {
          setInfo("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
          setPassword("");
        }
      }
    } catch (e) {
      setError(authenticationErrorMessage(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  async function handleSocialSignIn(provider: SocialProvider) {
    if (busy.current || checkingSession) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    setInfo(null);
    const callback = new URL("/login", window.location.origin);
    const next = getLoginNextPath();
    if (next !== "/") callback.searchParams.set("next", next);
    try {
      await startSocialSignIn(createAdminSupabaseClient(), getAdminSupabasePublicConfig(), provider, callback.href);
    } catch (socialError) {
      setError(socialError instanceof Error ? socialError.message : PROVIDER_RETURN_ERROR);
      busy.current = false;
      setLoading(false);
    }
  }

  const pending = loading || checkingSession;

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
            disabled={pending}
            aria-pressed={mode === "signin"}
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
            disabled={pending}
            aria-pressed={mode === "signup"}
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
            : "Create your account, then complete the required access review. Gym and operator access is assigned separately."}
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-kruxt-danger/30 bg-kruxt-danger/10 px-4 py-3 text-sm text-kruxt-danger">
            {error}
          </div>
        )}
        {info && (
          <div role="status" className="mt-4 rounded-lg border border-kruxt-accent/30 bg-kruxt-accent/10 px-4 py-3 text-sm text-kruxt-accent">
            {info}
          </div>
        )}

        <div className="mt-5 grid gap-3" aria-busy={pending}>
          <button type="button" disabled={pending} onClick={() => void handleSocialSignIn("google")} className="w-full rounded-button border border-border bg-kruxt-panel px-4 py-2.5 text-sm font-semibold text-foreground hover:border-kruxt-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-kruxt-accent disabled:opacity-50">Continue with Google</button>
          <button type="button" disabled={pending} onClick={() => void handleSocialSignIn("apple")} className="w-full rounded-button border border-border bg-kruxt-panel px-4 py-2.5 text-sm font-semibold text-foreground hover:border-kruxt-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-kruxt-accent disabled:opacity-50">Continue with Apple</button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" aria-busy={pending}>
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
              disabled={pending}
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
            <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              disabled={pending}
              minLength={mode === "signup" ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-button border border-border bg-kruxt-panel py-2 pl-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent"
              placeholder="••••••••"
            />
            <button type="button" disabled={pending} onClick={() => setShowPassword(value => !value)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground">
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-button bg-kruxt-accent px-4 py-2.5 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending
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

function getLoginNextPath(): string {
  if (typeof window === "undefined") return "/";
  return safeInternalNextPath(new URLSearchParams(window.location.search).get("next"));
}
