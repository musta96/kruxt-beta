"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ensureProfileForUser } from "@/lib/auth/access";
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    let active = true;
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setSessionUserEmail(data.user?.email ?? null);
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
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to redeem invite code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
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
        setSessionUserEmail(normalizedEmail);
        if (code.trim()) await redeemCode();
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
            ? "Account created. Check your email to confirm before redeeming the gym invite."
            : signInError.message
        );
        return;
      }

      setSessionUserEmail(normalizedEmail);
      if (code.trim()) await redeemCode();
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
          <h1 className="heading">Join gym</h1>
          <p className="subheading">Checking your session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="panel" style={{ maxWidth: 680, margin: "0 auto" }}>
        <p className="eyebrow">GYM PRIVATE ACCESS</p>
        <h1 className="heading">Join a gym on KRUXT</h1>
        <p className="subheading">
          Create your public social profile first, then redeem the gym code to enter the private member area.
        </p>

        <div className="panel" style={{ marginTop: 16 }}>
          <label className="label" htmlFor="gym-code">Invite code</label>
          <input
            id="gym-code"
            className="input"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="KRUXT-ABCDE-23456"
          />
        </div>

        {sessionUserEmail ? (
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
                onClick={() => setMode("signup")}
              >
                Sign up
              </button>
              <button
                type="button"
                className={`btn ${mode === "signin" ? "btn-primary" : ""}`}
                onClick={() => setMode("signin")}
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
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Mario Rossi"
                      required
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="join-username">Username</label>
                    <input
                      id="join-username"
                      className="input"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="mario"
                      minLength={3}
                      maxLength={24}
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
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={mode === "signup" ? 8 : 1}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create profile"}
              </button>
            </form>
          </div>
        )}

        {error && (
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
