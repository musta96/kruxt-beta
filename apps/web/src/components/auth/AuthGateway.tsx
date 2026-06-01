"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { ensureProfileForUser, resolveAdminAccess } from "@/lib/auth/access";
import { resolvePostAuthPath } from "@/components/public/usePublicSession";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

export function AuthGateway() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const gymAdminUrl = normalizeLoginUrl(
    process.env.NEXT_PUBLIC_KRUXT_GYM_ADMIN_URL ?? process.env.NEXT_PUBLIC_KRUXT_ADMIN_URL ?? "http://localhost:3000"
  );
  const platformUrl = normalizeLoginUrl(process.env.NEXT_PUBLIC_KRUXT_PLATFORM_URL ?? "http://localhost:3100");
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
          <a href="/gyms">Gyms</a>
          <a href="/plan">Plan</a>
          <a href="/rank">Rank</a>
          <a href={gymAdminUrl}>Gym admin</a>
          <a href={platformUrl}>Platform</a>
        </nav>
      </header>

      <section className="landing-hero">
        <section className="landing-copy">
          <h1 className="landing-title">KRUXT</h1>
          <p className="landing-subtitle">
            The training app where proof, plans, rank, coaching, and gym operations finally move together.
          </p>

          <div className="landing-actions" aria-label="Primary login actions">
            <a className="primary-cta" href="#member-login">Member login</a>
            <a className="secondary-cta" href={gymAdminUrl}>Gym admin login</a>
            <a className="secondary-cta" href={platformUrl}>Platform login</a>
          </div>

          <div className="landing-promo">
            <a className="promo-panel" href="/feed">
              <span className="promo-label">Members</span>
              <strong>Plan, log, post proof, rank up, and join gyms.</strong>
            </a>
            <a className="promo-panel" href={gymAdminUrl}>
              <span className="promo-label">Gyms</span>
              <strong>Members, staff, classes, coaching, waivers, billing, and public pages.</strong>
            </a>
            <a className="promo-panel" href={platformUrl}>
              <span className="promo-label">Platform</span>
              <strong>Tenant control, entitlements, support access, governance, and audits.</strong>
            </a>
          </div>
        </section>

        <section className="auth-panel" id="member-login">
        <div className="auth-shell-card">
          <p className="eyebrow">{mode === "signin" ? "WELCOME BACK" : "CREATE ACCOUNT"}</p>
          <h2 className="section-title">{mode === "signin" ? "Sign in to KRUXT" : "Claim your KRUXT account"}</h2>
          <p className="section-copy">
            Members continue into the app. Gym staff and platform operators can use the dedicated login buttons.
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

        <aside className="landing-product-panel" aria-label="KRUXT product preview">
          <div className="mock-phone">
            <div className="mock-phone-bar">
              <span>Today</span>
              <strong>Plan 72%</strong>
            </div>
            <div className="mock-session">
              <span className="promo-label">BZone Hybrid</span>
              <strong>Strength + Engine</strong>
              <p>4 blocks · Coach note · Proof required</p>
            </div>
            <div className="mock-proof-row">
              <span>Proof feed</span>
              <strong>+180 XP</strong>
            </div>
            <div className="mock-proof-row">
              <span>Rank trial</span>
              <strong>#12</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="landing-section">
        <div>
          <h2 className="section-title">One product, three doors.</h2>
          <p className="section-copy">
            KRUXT keeps the consumer app, gym back office, and founder control plane connected without forcing every
            person into the same workspace.
          </p>
        </div>
        <div className="landing-door-grid">
          <a className="door-card" href="/gyms">
            <span className="promo-label">User app</span>
            <strong>Discover gyms, follow a plan, log workouts, and compete with proof.</strong>
          </a>
          <a className="door-card" href={gymAdminUrl}>
            <span className="promo-label">Gym workspace</span>
            <strong>Run B2B operations: members, staff roles, coaching, classes, payments, and compliance.</strong>
          </a>
          <a className="door-card" href={platformUrl}>
            <span className="promo-label">KRUXT platform</span>
            <strong>Manage tenant access, feature entitlements, support sessions, marketplace, and audit trails.</strong>
          </a>
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
