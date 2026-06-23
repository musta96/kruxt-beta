"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { ensureProfileForUser, resolveAdminAccess } from "@/lib/auth/access";
import { resolvePostAuthPath } from "@/components/public/usePublicSession";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

const DEFAULT_GYM_ADMIN_URL =
  process.env.NODE_ENV === "production" ? "https://kruxt-admin.vercel.app" : "http://localhost:3000";
const DEFAULT_PLATFORM_URL =
  process.env.NODE_ENV === "production" ? "https://kruxt-platform.vercel.app" : "http://localhost:3100";

export function AuthGateway() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const gymAdminUrl = normalizeLoginUrl(
    process.env.NEXT_PUBLIC_KRUXT_GYM_ADMIN_URL ??
      process.env.NEXT_PUBLIC_KRUXT_ADMIN_URL ??
      process.env.NEXT_PUBLIC_ADMIN_APP_URL ??
      DEFAULT_GYM_ADMIN_URL
  );
  const platformUrl = normalizeLoginUrl(process.env.NEXT_PUBLIC_KRUXT_PLATFORM_URL ?? DEFAULT_PLATFORM_URL);
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
      <main className="container">
        <div className="panel">
          <h1 className="heading">KRUXT</h1>
          <p className="subheading">Checking your session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="landing-site">
      <header className="landing-nav">
        <a className="landing-logo" href="/">
          <img src="/icon.svg" alt="" className="landing-logo-mark" />
          <span>KRUXT</span>
        </a>
        <nav className="landing-nav-links" aria-label="KRUXT entry points">
          <a href="#product">Product</a>
          <a href="#gyms">For gyms</a>
          <a href="/support">Support</a>
          <a href={gymAdminUrl}>Gym admin</a>
          <a href={platformUrl}>Platform</a>
        </nav>
      </header>

      <section className="landing-hero">
        <section className="landing-copy">
          <h1 className="landing-title">
            Train.
            <span>Prove.</span>
            <span>Belong.</span>
          </h1>
          <p className="landing-subtitle">
            KRUXT connects the member app, the gym back office, and the platform control plane behind them.
          </p>

          <div className="landing-actions" aria-label="Primary login actions">
            <a className="primary-cta" href="#member-login">
              Member login
            </a>
            <a className="secondary-cta" href={gymAdminUrl}>
              Gym admin
            </a>
          </div>

          <div className="landing-signal-row">
            <span>BZone UAT</span>
            <span>Plans + proof</span>
            <span>Gym ops</span>
          </div>
        </section>

        <aside className="landing-product-panel" aria-label="KRUXT member product preview" id="product">
          <div className="mock-phone">
            <div className="mock-phone-bar">
              <strong>KRUXT</strong>
              <span>Plan</span>
            </div>
            <div className="mock-gym-row">
              <div className="mock-gym-mark">BZ</div>
              <div>
                <strong>BZone Fitness</strong>
                <span>Your home gym</span>
              </div>
              <span className="ghost-chip">Ready</span>
            </div>
            <div className="mock-session">
              <span className="status-pill">Today</span>
              <strong>Lower Strength</strong>
              <p>Coach note · 60-75 min · proof after training</p>
              <a className="primary-cta" href="/log">
                Start session
              </a>
            </div>
            <div className="mock-week-strip">
              <span className="is-active">Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
            </div>
            <div className="mock-proof-row">
              <span>Proof</span>
              <strong>Queued after log</strong>
            </div>
            <div className="mock-proof-row">
              <span>Coach visibility</span>
              <strong>BZone staff</strong>
            </div>
          </div>
        </aside>

      </section>

      <section className="landing-role-grid" aria-label="Choose your KRUXT workspace">
        <a className="door-card" href="/plan">
          <span className="promo-label">Member app</span>
          <strong>Follow the plan, log proof, join gyms, and build your profile.</strong>
          <span className="door-card-action">Go to app</span>
        </a>
        <a className="door-card" href={gymAdminUrl} id="gyms">
          <span className="promo-label">Gym owner / staff</span>
          <strong>Run members, coaching, classes, waivers, billing, and staff roles.</strong>
          <span className="door-card-action">Open gym admin</span>
        </a>
        <a className="door-card door-card-platform" href={platformUrl}>
          <span className="promo-label">Platform admin</span>
          <strong>Manage tenants, entitlements, support access, audits, and rollout.</strong>
          <span className="door-card-action">Open platform</span>
        </a>
      </section>

      <section className="auth-panel landing-auth-row" id="member-login">
        <div className="auth-shell-card">
          <p className="eyebrow">{mode === "signin" ? "WELCOME BACK" : "CREATE ACCOUNT"}</p>
          <h2 className="section-title">{mode === "signin" ? "Sign in to KRUXT" : "Claim your KRUXT account"}</h2>
          <p className="section-copy">
            Members continue into the app. Staff and platform operators use their dedicated doors.
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
                    autoComplete="name"
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
                    autoComplete="username"
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
                autoComplete="email"
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
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
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

      <section className="landing-section landing-section-split">
        <div>
          <h2 className="section-title">Built for BZone testing, ready for the network.</h2>
          <p className="section-copy">
            Invite links, public gym discovery, private member approvals, coach workspaces, custom roles, and audit logs
            all point at the same operational spine.
          </p>
        </div>
        <div className="landing-utility-actions">
          <a className="primary-cta" href="/join">Join with invite</a>
          <a className="secondary-cta" href="/gyms">Explore gyms</a>
          <a className="secondary-cta" href="/support">Member support</a>
        </div>
      </section>
    </main>
  );
}

function normalizeLoginUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "");
  return trimmed.endsWith("/login") ? trimmed : `${trimmed}/login`;
}
