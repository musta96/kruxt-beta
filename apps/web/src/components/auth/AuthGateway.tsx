"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { ensureProfileForUser, resolveAdminAccess } from "@/lib/auth/access";
import { resolvePostAuthPath } from "@/components/public/usePublicSession";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

export function AuthGateway() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");

  async function resolveNextPath(): Promise<string> {
    const access = await resolveAdminAccess(supabase);
    return resolvePostAuthPath(access);
  }

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
  }, [router, supabase]);

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
      <main className="container">
        <div className="panel">
          <h1 className="heading">KRUXT</h1>
          <p className="subheading">Checking your session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="landing-shell">
      <section className="landing-copy">
        <p className="eyebrow">KRUXT</p>
        <h1 className="landing-title">No log, no legend.</h1>
        <p className="landing-subtitle">
          Member-facing web shell, gym operations workspace, and founder control plane running from the same app.
        </p>

        <div className="landing-promo">
          <div className="promo-panel">
            <span className="promo-label">Members</span>
            <strong>Feed, proof, profile, and logging flow</strong>
          </div>
          <div className="promo-panel">
            <span className="promo-label">Gyms</span>
            <strong>Class scheduling, invites, roles, and organization ops</strong>
          </div>
          <div className="promo-panel">
            <span className="promo-label">Platform</span>
            <strong>Founder-level control over gyms, owners, and compliance</strong>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-shell-card">
          <p className="eyebrow">{mode === "signin" ? "WELCOME BACK" : "CREATE ACCOUNT"}</p>
          <h2 className="section-title">{mode === "signin" ? "Sign in to KRUXT" : "Claim your KRUXT account"}</h2>
          <p className="section-copy">
            Founders land in `/admin`, gym staff in `/org`, and members in `/feed`.
          </p>

          <div className="mode-toggle">
            <button
              type="button"
              className={`toggle-pill ${mode === "signin" ? "is-active" : ""}`}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`toggle-pill ${mode === "signup" ? "is-active" : ""}`}
              onClick={() => setMode("signup")}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form-grid">
            {mode === "signup" && (
              <>
                <div>
                  <label className="label" htmlFor="displayName">Display name</label>
                  <input
                    id="displayName"
                    className="input"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Edoardo Mustarelli"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="username">Username</label>
                  <input
                    id="username"
                    className="input"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="musta96"
                  />
                </div>
              </>
            )}

            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="mustarelli.edoardo@gmail.com"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                required
                minLength={mode === "signup" ? 8 : 1}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "signup" ? "Minimum 8 characters" : "Your password"}
              />
            </div>

            {error && (
              <div className="status-banner status-danger" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="primary-cta" disabled={loading}>
              {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
