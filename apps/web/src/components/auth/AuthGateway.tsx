"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

import { RequiredConsentReview } from "@/components/consent/RequiredConsentReview";
import { MarketingHome } from "@/components/marketing/MarketingHome";
import { ensureProfileExistsForUser, resolveAdminAccess } from "@/lib/auth/access";
import { resolvePostAuthPath } from "@/components/public/usePublicSession";
import { createSupabaseBrowserClient, getSupabaseConfig } from "@/lib/supabase/client";
import { authenticationErrorMessage } from "@/lib/auth/auth-error";
import { hasProviderReturnError, sanitizedAuthReturnUrl, startSocialSignIn, PROVIDER_RETURN_ERROR, type SocialProvider } from "@/lib/auth/social-auth";
import { Eye, EyeOff } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
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
    let initializing = true;
    const original = new URL(window.location.href);
    const providerError = hasProviderReturnError(original);
    const isCallback = original.searchParams.has("code");

    const checkSession = async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      const clean = new URL(sanitizedAuthReturnUrl(new URL(window.location.href)), window.location.origin);
      if ((isCallback || providerError) && !clean.hash) clean.hash = "member-login";
      window.history.replaceState(window.history.state, "", clean.pathname + clean.search + clean.hash);
      if (providerError || (isCallback && !data.user)) {
        setError(PROVIDER_RETURN_ERROR);
        setCheckingSession(false);
        return;
      }
      if (userError && userError.name !== "AuthSessionMissingError") {
        setError(authenticationErrorMessage(userError));
        setCheckingSession(false);
        return;
      }
      if (data.user) {
        try {
          await continueAuthenticatedUser(data.user);
        } catch (sessionError) {
          if (!active) return;
          setError(authenticationErrorMessage(sessionError));
          setCheckingSession(false);
        }
        return;
      }

      setCheckingSession(false);
    };

    const listener = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!active || initializing || providerError) return;
      if (event === "SIGNED_IN" && session?.user && !authOperationActive.current) {
        window.setTimeout(() => {
          if (!active) return;
          void continueAuthenticatedUser(session.user).catch((sessionError) => {
            if (!active) return;
            setError(authenticationErrorMessage(sessionError));
            setCheckingSession(false);
          });
        }, 0);
      }
    });

    void checkSession().catch(() => {
      if (!active) return;
      window.history.replaceState(window.history.state, "", sanitizedAuthReturnUrl(new URL(window.location.href)));
      setError(PROVIDER_RETURN_ERROR);
      setCheckingSession(false);
    }).finally(() => { initializing = false; });

    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
    };
  }, [continueAuthenticatedUser, supabase]);

  useEffect(() => {
    if (checkingSession) return;
    // The member form mounts after the session check, after router hash scrolling.
    const scrollToMemberLogin = () => {
      if (window.location.hash === "#member-login") {
        document.getElementById("member-login")?.scrollIntoView();
      }
    };
    scrollToMemberLogin();
    window.addEventListener("hashchange", scrollToMemberLogin);
    return () => window.removeEventListener("hashchange", scrollToMemberLogin);
  }, [checkingSession]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authOperationActive.current) return;
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
            : authenticationErrorMessage(signInError)
        );
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Account created without an authenticated session.");
      await continueAuthenticatedUser(userData.user);
    } catch (submitError) {
      setError(authenticationErrorMessage(submitError));
    } finally {
      authOperationActive.current = false;
      setLoading(false);
    }
  }

  async function handleSocialSignIn(provider: SocialProvider) {
    if (authOperationActive.current) return;
    authOperationActive.current = true;
    setLoading(true);
    setError(null);
    try {
      await startSocialSignIn(supabase, getSupabaseConfig(), provider, new URL("/#member-login", window.location.origin).href);
    } catch (socialError) {
      setError(socialError instanceof Error ? socialError.message : PROVIDER_RETURN_ERROR);
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
              disabled={loading}
              aria-pressed={mode === "signin"}
              className={mode === "signin" ? "is-active" : ""}
              onClick={() => { setMode("signin"); setError(null); setShowPassword(false); }}
            >
              Sign in
            </button>
            <button
              type="button"
              disabled={loading}
              aria-pressed={mode === "signup"}
              className={mode === "signup" ? "is-active" : ""}
              onClick={() => { setMode("signup"); setError(null); setShowPassword(false); }}
            >
              Create account
            </button>
          </div>

          <div className="marketing-social-auth" aria-busy={loading}>
            <button type="button" className="marketing-button marketing-button-secondary" disabled={loading} onClick={() => void handleSocialSignIn("google")}>Continue with Google</button>
            <button type="button" className="marketing-button marketing-button-secondary" disabled={loading} onClick={() => void handleSocialSignIn("apple")}>Continue with Apple</button>
          </div>
          <form onSubmit={handleSubmit} className="marketing-auth-form" aria-busy={loading}>
            {mode === "signup" ? (
              <div className="marketing-auth-name-grid">
                <label>
                  <span>Name</span>
                  <input
                    autoComplete="name"
                    disabled={loading}
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
                    disabled={loading}
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
                disabled={loading}
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              <span>Password</span>
              <div className="marketing-auth-password">
              <input
                type={showPassword ? "text" : "password"}
                disabled={loading}
                required
                minLength={mode === "signup" ? 8 : 1}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              />
              <button type="button" disabled={loading} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
              </div>
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
