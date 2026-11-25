"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuthCaptcha } from "@kruxt/ui/auth-captcha";
import { useRouter, useSearchParams } from "next/navigation";

import { ensureProfileForUser } from "@/lib/auth/access";
import { authenticationErrorMessage } from "@/lib/auth/auth-error";
import { hasRequiredConsents } from "@/lib/auth/required-consents";
import { RequiredConsentReview } from "@/components/consent/RequiredConsentReview";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

type MembershipRow = {
  id: string;
  membership_status: "pending" | "trial" | "active" | "paused" | "cancelled";
};

export function JoinGymClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const initialCode = searchParams.get("code") ?? "";

  const [code, setCode] = useState(initialCode);
  const [mode, setMode] = useState<AuthMode>("signup");
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionUserEmail, setSessionUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const authOperationActive = useRef(false);
  const captcha = useAuthCaptcha(process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY);
  const [consentUserId, setConsentUserId] = useState<string | null>(null);
  const finishConsentReview = useCallback(async () => {
    setConsentUserId(null);
    setSuccess("Policies accepted. You can now redeem your gym code.");
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");

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
      setConsentUserId((current) => current === session?.user.id ? current : null);
    });

    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function redeemCode() {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setError("Enter an invite code first.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError && authError.name !== "AuthSessionMissingError") throw authError;
      if (!auth.user) {
        setError("Sign in before redeeming a gym code.");
        return;
      }
      await ensureProfileForUser(supabase, {
        userId: auth.user.id,
        email: auth.user.email ?? "",
        username: typeof auth.user.user_metadata.username === "string" ? auth.user.user_metadata.username : undefined,
        displayName: typeof auth.user.user_metadata.display_name === "string" ? auth.user.user_metadata.display_name : undefined
      });
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("activation_status").eq("id", auth.user.id).single();
      if (profileError) throw profileError;
      if (profile.activation_status !== "active") {
        setError("Your account must be active before joining a gym. Complete your activation or contact gym staff.");
        return;
      }
      if (!(await hasRequiredConsents(supabase, auth.user.id))) {
        setConsentUserId(auth.user.id);
        return;
      }
      const { data: membershipId, error: redeemError } = await supabase.rpc("redeem_gym_invite_code", {
        p_code: normalizedCode,
        p_note: null
      });
      if (redeemError) throw redeemError;

      const { data: membership, error: membershipError } = await supabase
        .from("gym_memberships")
        .select("id,membership_status")
        .eq("id", String(membershipId))
        .maybeSingle();
      if (membershipError) throw membershipError;

      const status = (membership as MembershipRow | null)?.membership_status;
      setSuccess(
        status === "pending"
          ? "Your request is in. Gym staff will approve the private gym area access."
          : "Invite accepted. Your private gym access is ready."
      );
    } catch {
      setError("Unable to redeem invite code. Try again or contact gym staff.");
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

    const prepareProfile = async (user: User) => {
      await ensureProfileForUser(supabase, {
        userId: user.id,
        email: user.email ?? normalizedEmail,
        username: mode === "signup" ? username : typeof user.user_metadata.username === "string" ? user.user_metadata.username : undefined,
        displayName: mode === "signup" ? displayName : typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : undefined
      });
    };

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
        const { data, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!data.user) throw new Error("Authentication completed without a user session.");
        await prepareProfile(data.user);
        setSessionUserEmail(normalizedEmail);
        if (code.trim()) await redeemCode();
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          ...(captchaToken ? { captchaToken } : {}),
          data: {
            display_name: displayName.trim(),
            username: username.trim()
          }
        }
      });
      if (signUpError) throw signUpError;

      setPassword("");
      if (!signUpData.session) {
        setSessionUserEmail(null);
        setConfirmationPending(true);
        setMode("signin");
        return;
      }

      await prepareProfile(signUpData.session.user);
      setSessionUserEmail(signUpData.session.user.email ?? normalizedEmail);
      if (code.trim()) await redeemCode();
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
          <h1 className="heading">Join gym</h1>
          <p className="subheading">Checking your session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="panel" style={{ maxWidth: 680, margin: "0 auto" }}>
        <h1 className="heading">Join a gym on KRUXT</h1>
        <p className="subheading">
          Create your KRUXT account, then redeem the gym code to request private member access.
        </p>

        <div className="panel" style={{ marginTop: 16 }}>
          <label className="label" htmlFor="gym-code">Invite code</label>
          <input
            id="gym-code"
            className="input"
            value={code}
            disabled={loading}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="KRUXT-ABCDE-23456"
          />
        </div>

        {consentUserId ? (
          <RequiredConsentReview
            client={supabase}
            userId={consentUserId}
            onComplete={finishConsentReview}
            onSignOut={() => void supabase.auth.signOut()}
          />
        ) : sessionUserEmail ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <p className="subheading" style={{ marginTop: 0 }}>
              Signed in as <strong>{sessionUserEmail}</strong>
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => void redeemCode()} disabled={loading}>
                {loading ? "Joining..." : "Redeem code"}
              </button>
              <button className="btn" onClick={() => void supabase.auth.signOut()} disabled={loading}>
                Switch account
              </button>
            </div>
          </div>
        ) : (
          <div className="panel" style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                className={`btn ${mode === "signup" ? "btn-primary" : ""}`}
                onClick={() => changeMode("signup")}
                disabled={loading}
              >
                Sign up
              </button>
              <button
                type="button"
                className={`btn ${mode === "signin" ? "btn-primary" : ""}`}
                onClick={() => changeMode("signin")}
                disabled={loading}
              >
                Sign in
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="grid">
              {mode === "signup" && (
                <div className="grid grid-2">
                  <div>
                    <label className="label" htmlFor="join-display-name">Display name</label>
                    <input
                      id="join-display-name"
                      className="input"
                      value={displayName}
                      disabled={loading}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Mario Rossi"
                      maxLength={80}
                      required
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="join-username">Username</label>
                    <input
                      id="join-username"
                      className="input"
                      value={username}
                      disabled={loading}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="mario"
                      minLength={3}
                      maxLength={24}
                      pattern="[A-Za-z0-9_]{3,24}"
                      title="Use 3 to 24 letters, numbers, or underscores."
                      required
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="label" htmlFor="join-email">Email</label>
                <input
                  id="join-email"
                  className="input"
                  type="email"
                  value={email}
                  disabled={loading}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="join-password">Password</label>
                <input
                  id="join-password"
                  className="input"
                  type="password"
                  value={password}
                  disabled={loading}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={mode === "signup" ? 8 : 1}
                  required
                />
              </div>
              {captcha.widget}
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create profile"}
              </button>
            </form>
          </div>
        )}

        {confirmationPending && (
          <p role="status">Check your email for a confirmation link if one is needed, then sign in here to continue with your gym code. If you already have an account, sign in or reset your password.</p>
        )}

        {error && !(captcha.verified && error.startsWith("Security verification")) && (
          <div className="panel" style={{ marginTop: 12, color: "#ff9baa" }} role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="panel" style={{ marginTop: 12, color: "#7ef5df" }}>
            <p style={{ marginTop: 0 }}>{success}</p>
            <button className="btn btn-primary" onClick={() => router.push("/feed")}>
              Open KRUXT
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
