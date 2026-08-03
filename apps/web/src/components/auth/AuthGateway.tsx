"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

import { RequiredConsentReview } from "@/components/consent/RequiredConsentReview";
import { MarketingHome } from "@/components/marketing/MarketingHome";
import { ensureProfileExistsForUser, resolveAdminAccess } from "@/lib/auth/access";
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
  const [consentUserId, setConsentUserId] = useState<string | null>(null);
  const authOperationActive = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");

  const continueAuthenticatedUser = useCallback(async (user: User): Promise<void> => {
    await ensureProfileExistsForUser(supabase, {
      userId: user.id,
      email: user.email ?? "member@kruxt.app",
      username: typeof user.user_metadata.username === "string" ? user.user_metadata.username : undefined,
      displayName: typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : undefined
    });

    const access = await resolveAdminAccess(supabase);
    if (access.status === "error") {
      throw new Error(access.error || "Unable to validate account access.");
    }

    if (access.status === "consent_required") {
      setConsentUserId(user.id);
      setCheckingSession(false);
      return;
    }

    setConsentUserId(null);
    router.replace(resolvePostAuthPath(access));
  }, [router, supabase]);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError) {
        setError(userError.message || "Unable to validate your session.");
        setCheckingSession(false);
        return;
      }
      if (data.user) {
        try {
          await continueAuthenticatedUser(data.user);
        } catch (sessionError) {
          if (!active) return;
          setError(sessionError instanceof Error ? sessionError.message : "Unable to validate account access.");
          setCheckingSession(false);
        }
        return;
      }

      setCheckingSession(false);
    };

    const listener = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!active) return;
      if (event === "SIGNED_IN" && session?.user && !authOperationActive.current) {
        window.setTimeout(() => {
          if (!active) return;
          void continueAuthenticatedUser(session.user).catch((sessionError) => {
            if (!active) return;
            setError(sessionError instanceof Error ? sessionError.message : "Unable to validate account access.");
            setCheckingSession(false);
          });
        }, 0);
      }
    });

    void checkSession();

    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
    };
  }, [continueAuthenticatedUser, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    authOperationActive.current = true;

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });
        if (signInError) throw signInError;

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) throw new Error("Sign-in completed without an authenticated user.");
        await continueAuthenticatedUser(userData.user);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            username: username.trim()
          }
        }
      });
      if (signUpError) throw signUpError;

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

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Account created without an authenticated session.");
      await continueAuthenticatedUser(userData.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      authOperationActive.current = false;
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

  const handleConsentComplete = async () => {
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!data.user) throw new Error("Your session ended before consent verification completed.");
    await continueAuthenticatedUser(data.user);
  };

  const handleConsentSignOut = async () => {
    await supabase.auth.signOut();
    setConsentUserId(null);
    setCheckingSession(false);
  };

  const authPanel = (
    <div className="marketing-auth-card">
      {consentUserId ? (
        <RequiredConsentReview
          client={supabase}
          userId={consentUserId}
          onComplete={handleConsentComplete}
          onSignOut={() => void handleConsentSignOut()}
        />
      ) : (
        <>
          <div className="marketing-auth-toggle">
            <button
              type="button"
              className={mode === "signin" ? "is-active" : ""}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "signup" ? "is-active" : ""}
              onClick={() => setMode("signup")}
            >
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
                    maxLength={80}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Your name"
                  />
                </label>
                <label>
                  <span>Username</span>
                  <input
                    autoComplete="username"
                    minLength={3}
                    maxLength={24}
                    pattern="[A-Za-z0-9_]{3,24}"
                    title="Use 3 to 24 letters, numbers, or underscores."
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
              {mode === "signup"
                ? "Creating an account does not accept a policy. After authentication, you must review and explicitly accept the active required versions before entering KRUXT."
                : "Signing in does not create a consent record. KRUXT requests review whenever a required policy version changes."}
            </p>
          </form>
        </>
      )}
    </div>
  );

  return <MarketingHome authPanel={authPanel} gymAdminUrl={gymAdminUrl} />;
}

function normalizeLoginUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "");
  return trimmed.endsWith("/login") ? trimmed : `${trimmed}/login`;
}
