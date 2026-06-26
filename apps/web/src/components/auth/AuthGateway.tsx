"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { MarketingHome } from "@/components/marketing/MarketingHome";
import { ensureProfileForUser, resolveAdminAccess } from "@/lib/auth/access";
import { resolvePostAuthPath } from "@/components/public/usePublicSession";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

const DEFAULT_GYM_ADMIN_URL =
  process.env.NODE_ENV === "production" ? "https://kruxt-admin.vercel.app" : "http://localhost:3000";

export function AuthGateway() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const gymAdminUrl = normalizeLoginUrl(
    process.env.NEXT_PUBLIC_KRUXT_GYM_ADMIN_URL ??
      process.env.NEXT_PUBLIC_KRUXT_ADMIN_URL ??
      process.env.NEXT_PUBLIC_ADMIN_APP_URL ??
      DEFAULT_GYM_ADMIN_URL
  );
  const [mode, setMode] = useState<AuthMode>("signin");
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");

  const resolveNextPath = useCallback(async (): Promise<string> => {
    const access = await resolveAdminAccess(supabase);
    return resolvePostAuthPath(access);
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user) {
        const nextPath = await resolveNextPath();
        router.replace(nextPath);
        return;
      }

      setCheckingSession(false);
    };

    const listener = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!active) return;
      if (event === "SIGNED_IN" && session?.user) {
        void resolveNextPath().then((nextPath) => {
          if (!active) return;
          router.replace(nextPath);
        });
      }
    });

    void checkSession();

    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
    };
  }, [resolveNextPath, router, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });
        if (signInError) throw signInError;

        const nextPath = await resolveNextPath();
        router.replace(nextPath);
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password
      });
      if (signUpError) throw signUpError;

      if (signUpData.user) {
        await ensureProfileForUser(supabase, {
          userId: signUpData.user.id,
          email: normalizedEmail,
          username,
          displayName
        });
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });
      if (signInError) {
        setError(
          signInError.message.includes("Email not confirmed")
            ? "Account created. Check your email to confirm before signing in."
            : signInError.message
        );
        return;
      }

      const nextPath = await resolveNextPath();
      router.replace(nextPath);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="marketing-session-check">
        <div>
          <img src="/icon.svg" alt="" />
          <strong>KRUXT</strong>
          <span>Loading your workspace...</span>
        </div>
      </main>
    );
  }

  const authPanel = (
    <div className="marketing-auth-card">
      <div className="marketing-auth-toggle">
        <button type="button" className={mode === "signin" ? "is-active" : ""} onClick={() => setMode("signin")}>
          Sign in
        </button>
        <button type="button" className={mode === "signup" ? "is-active" : ""} onClick={() => setMode("signup")}>
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="marketing-auth-form">
        {mode === "signup" ? (
          <div className="marketing-auth-name-grid">
            <label>
              <span>Name</span>
              <input
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
              />
            </label>
            <label>
              <span>Username</span>
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="yourname"
              />
            </label>
          </div>
        ) : null}

        <label>
          <span>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            required
            minLength={mode === "signup" ? 8 : 1}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
          />
        </label>

        {error ? (
          <div className="marketing-auth-error" role="alert">
            {error}
          </div>
        ) : null}

        <button type="submit" className="marketing-button marketing-button-primary" disabled={loading}>
          {loading ? "Please wait..." : mode === "signin" ? "Sign in to KRUXT" : "Create my account"}
        </button>
        <p>
          By continuing, you agree to the <a href="/legal/terms">Terms</a> and acknowledge the{" "}
          <a href="/legal/privacy">Privacy Notice</a>.
        </p>
      </form>
    </div>
  );

  return <MarketingHome authPanel={authPanel} gymAdminUrl={gymAdminUrl} />;
}

function normalizeLoginUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "");
  return trimmed.endsWith("/login") ? trimmed : `${trimmed}/login`;
}
