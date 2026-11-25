"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthCaptcha } from "@kruxt/ui/auth-captcha";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { invokeSupabaseFunction } from "@/lib/supabase/functions";
import { authenticationErrorMessage } from "@/lib/auth/auth-error";

type AuthMode = "signin" | "signup";

export function AcceptInviteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const token = searchParams.get("token") ?? "";
  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionUserEmail, setSessionUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const authOperationActive = useRef(false);
  const captcha = useAuthCaptcha(process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY);
  const [resolvedGymId, setResolvedGymId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active || authOperationActive.current) return;
      setSessionUserEmail(data.session?.user.email ?? null);
      setCheckingSession(false);
    };

    void run();
    const listener = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || authOperationActive.current) return;
      setSessionUserEmail(session?.user.email ?? null);
    });

    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function acceptInvite() {
    if (!token) {
      setError("Missing invite token.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await invokeSupabaseFunction<{ ok?: boolean; error?: string; gymId?: string }>(
        supabase,
        "accept-invite",
        { token }
      );
      if (!data?.ok) {
        throw new Error(data?.error ?? "Unable to accept invite.");
      }

      setResolvedGymId(typeof data.gymId === "string" ? data.gymId : null);
      setSuccess("Invite accepted successfully.");
    } catch {
      setError("Unable to accept invite. Try again or contact gym staff.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authOperationActive.current) return;
    authOperationActive.current = true;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setConfirmationPending(false);

    const normalizedEmail = email.trim().toLowerCase();
    let requestStarted = false;
    try {
      const captchaToken = captcha.takeToken();
      requestStarted = true;
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
          ...(captchaToken ? { options: { captchaToken } } : {})
        });
        if (signInError) throw signInError;
      } else {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          ...(captchaToken ? { options: { captchaToken } } : {})
        });
        if (signUpError) throw signUpError;

        setPassword("");
        if (!signUpData.session) {
          setSessionUserEmail(null);
          setConfirmationPending(true);
          setMode("signin");
          return;
        }
        setSessionUserEmail(signUpData.session.user.email ?? normalizedEmail);
        return;
      }
      setSessionUserEmail(normalizedEmail);
    } catch (authError) {
      setError(authenticationErrorMessage(authError));
    } finally {
      if (requestStarted) captcha.reset();
      authOperationActive.current = false;
      setLoading(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    captcha.reset();
    setMode(nextMode);
    setError(null);
    setSuccess(null);
    setConfirmationPending(false);
  }

  if (checkingSession) {
    return (
      <main className="container">
        <div className="panel">
          <h1 className="heading">Accept invite</h1>
          <p className="subheading">Checking session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="panel" style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 className="heading">Accept gym invite</h1>
        <p className="subheading">
          Use the invited account to accept this staff invitation.
        </p>

        {!token && (
          <div className="panel" style={{ marginTop: 12, color: "#ff9baa" }}>
            Missing token in URL. Open the full invite link from your email.
          </div>
        )}

        {sessionUserEmail ? (
          <div style={{ marginTop: 16 }} className="grid">
            <div className="panel">
              <p className="subheading" style={{ marginTop: 0 }}>
                Signed in as <strong>{sessionUserEmail}</strong>
              </p>
              <button className="btn btn-primary" onClick={() => void acceptInvite()} disabled={loading || !token}>
                {loading ? "Accepting..." : "Accept invite"}
              </button>
              <button
                className="btn"
                style={{ marginLeft: 8 }}
                onClick={() => void supabase.auth.signOut()}
                disabled={loading}
              >
                Switch account
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 16 }}>
              <button
                type="button"
                className={`btn ${mode === "signin" ? "btn-primary" : ""}`}
                onClick={() => changeMode("signin")}
                disabled={loading}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`btn ${mode === "signup" ? "btn-primary" : ""}`}
                onClick={() => changeMode("signup")}
                disabled={loading}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="grid">
              <div>
                <label className="label" htmlFor="invite-email">Email</label>
                <input
                  id="invite-email"
                  className="input"
                  type="email"
                  required
                  value={email}
                  disabled={loading}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="invite-password">Password</label>
                <input
                  id="invite-password"
                  className="input"
                  type="password"
                  required
                  minLength={mode === "signup" ? 8 : 1}
                  value={password}
                  disabled={loading}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {captcha.widget}
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Please wait..." : mode === "signin" ? "Sign in to continue" : "Create account"}
              </button>
            </form>
          </>
        )}

        {confirmationPending && (
          <p role="status">Check your email for a confirmation link if one is needed, then sign in here to continue with your invitation. If you already have an account, sign in or reset your password.</p>
        )}

        {error && !(captcha.verified && error.startsWith("Security verification")) && (
          <div className="panel" style={{ marginTop: 12, color: "#ff9baa" }} role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="panel" style={{ marginTop: 12, color: "#7ef5df" }}>
            <p style={{ marginTop: 0 }}>{success}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={() => router.push("/org")}>
                Open organization workspace
              </button>
              {resolvedGymId && (
                <span className="subheading">Gym: {resolvedGymId.slice(0, 8)}...</span>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
