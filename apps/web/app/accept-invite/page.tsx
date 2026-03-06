"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

export default function AcceptInvitePage() {
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
  const [resolvedGymId, setResolvedGymId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user?.email) {
        setSessionUserEmail(data.user.email);
      } else {
        setSessionUserEmail(null);
      }
      setCheckingSession(false);
    };

    void run();
    const listener = supabase.auth.onAuthStateChange(async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setSessionUserEmail(data.user?.email ?? null);
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
      const { data, error: invokeError } = await supabase.functions.invoke("accept-invite", {
        body: { token }
      });
      if (invokeError) {
        throw new Error(invokeError.message || "Unable to accept invite.");
      }
      if (!data?.ok) {
        throw new Error(data?.error ?? "Unable to accept invite.");
      }

      setResolvedGymId(typeof data.gymId === "string" ? data.gymId : null);
      setSuccess("Invite accepted successfully.");
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Unable to accept invite.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password
        });
        if (signUpError) throw signUpError;

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });
        if (signInError) throw signInError;
      }
      setSessionUserEmail(normalizedEmail);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to authenticate.");
    } finally {
      setLoading(false);
    }
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
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`btn ${mode === "signup" ? "btn-primary" : ""}`}
                onClick={() => setMode("signup")}
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
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Please wait..." : mode === "signin" ? "Sign in to continue" : "Create account"}
              </button>
            </form>
          </>
        )}

        {error && (
          <div className="panel" style={{ marginTop: 12, color: "#ff9baa" }}>
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
