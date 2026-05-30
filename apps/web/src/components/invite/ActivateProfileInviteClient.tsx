"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { broadcastPublicSessionRefresh } from "@/components/public/usePublicSession";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type InviteRow = {
  id: string;
  gym_id: string;
  invited_user_id: string | null;
  email: string;
  display_name: string;
  requested_role: "owner" | "admin" | "staff" | "pt" | "member";
  gym_role: "leader" | "officer" | "coach" | "member";
  status: "pending_activation" | "active" | "invite_expired" | "disabled";
  invite_attempt: number;
  expires_at: string;
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role: InviteRow["requested_role"]): string {
  if (role === "pt") return "PT";
  return `${role.slice(0, 1).toUpperCase()}${role.slice(1)}`;
}

export function ActivateProfileInviteClient() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [status, setStatus] = useState<"loading" | "ready" | "success">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [invite, setInvite] = useState<InviteRow | null>(null);
  const [attempt, setAttempt] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedOwnerTerms, setAcceptedOwnerTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setStatus("loading");
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !userData.user) {
        setError("Open the latest activation email and use its magic link before setting a password.");
        setStatus("ready");
        return;
      }

      setUser(userData.user);

      const inviteId = searchParams.get("inviteId");
      const attemptParam = searchParams.get("attempt");

      let query = supabase
        .from("gym_profile_invitations")
        .select("id,gym_id,invited_user_id,email,display_name,requested_role,gym_role,status,invite_attempt,expires_at")
        .eq("invited_user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (inviteId) {
        query = query.eq("id", inviteId);
      } else {
        query = query.in("status", ["pending_activation", "invite_expired"]);
      }

      const { data: inviteRows, error: inviteError } = await query;
      if (!active) return;

      if (inviteError) {
        setError(inviteError.message || "Unable to load invite.");
        setStatus("ready");
        return;
      }

      const row = ((inviteRows as InviteRow[] | null) ?? [])[0] ?? null;
      if (!row) {
        setError("No pending activation invite was found for this account.");
        setStatus("ready");
        return;
      }

      setInvite(row);
      setAttempt(Number(attemptParam || row.invite_attempt));
      if (row.status === "active") {
        setStatus("success");
      } else {
        setStatus("ready");
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [searchParams, supabase]);

  async function completeActivation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invite || !attempt) return;

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (invite.requested_role === "owner" && !acceptedOwnerTerms) {
      setError("Owner terms and DPA acceptance is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw passwordError;

      const { data, error: functionError } = await supabase.functions.invoke("complete-profile-activation", {
        body: {
          inviteId: invite.id,
          attempt,
          acceptedOwnerTerms,
        },
      });

      if (functionError) throw functionError;
      if (!data?.ok) throw new Error(data?.error ?? "Unable to activate profile.");

      broadcastPublicSessionRefresh();
      setStatus("success");
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : "Unable to activate profile.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="landing-shell">
        <section className="auth-panel">
          <div className="auth-shell-card">
            <p className="eyebrow">KRUXT</p>
            <h1 className="section-title">Opening activation link</h1>
            <p className="section-copy">Checking your session and invite.</p>
          </div>
        </section>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className="landing-shell">
        <section className="landing-copy">
          <p className="eyebrow">KRUXT</p>
          <h1 className="landing-title">Profile active.</h1>
          <p className="landing-subtitle">
            Your account is ready. You can use the member app now, and staff roles can open the gym workspace.
          </p>
        </section>
        <section className="auth-panel">
          <div className="auth-shell-card">
            <p className="eyebrow">SECURITY</p>
            <h2 className="section-title">MFA is the next checkpoint</h2>
            <p className="section-copy">
              Use a strong password now. Multi-factor setup is prompted from the security area as KRUXT rolls it out.
            </p>
            <div className="stack-actions" style={{ marginTop: "1rem" }}>
              <Link href="/feed" className="primary-cta">Open member app</Link>
              <Link href="/org" className="secondary-cta">Open gym workspace</Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="landing-shell">
      <section className="landing-copy">
        <p className="eyebrow">KRUXT INVITE</p>
        <h1 className="landing-title">Activate your profile.</h1>
        <p className="landing-subtitle">
          Verify your invite, set your own password, and unlock the gym workspace assigned to this account.
        </p>
      </section>

      <section className="auth-panel">
        <div className="auth-shell-card">
          <p className="eyebrow">PENDING ACTIVATION</p>
          <h2 className="section-title">{invite ? `Welcome, ${invite.display_name}` : "Activation required"}</h2>
          {invite && (
            <p className="section-copy">
              {roleLabel(invite.requested_role)} invite for {invite.email}. Expires {formatDateTime(invite.expires_at)}.
            </p>
          )}

          {error && (
            <div className="status-banner status-danger" role="alert" style={{ marginTop: "1rem" }}>
              {error}
            </div>
          )}

          {user && invite && invite.status !== "disabled" ? (
            <form onSubmit={completeActivation} className="auth-form-grid" style={{ marginTop: "1rem" }}>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <input
                  id="password"
                  className="input"
                  type="password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div>
                <label className="label" htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  className="input"
                  type="password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat password"
                />
              </div>

              {invite.requested_role === "owner" && (
                <label className="checkbox-row" style={{ alignItems: "flex-start" }}>
                  <input
                    type="checkbox"
                    checked={acceptedOwnerTerms}
                    onChange={(event) => setAcceptedOwnerTerms(event.target.checked)}
                    style={{ marginTop: "0.25rem" }}
                  />
                  <span className="section-copy">
                    I accept the owner terms and DPA for this gym workspace.
                  </span>
                </label>
              )}

              <button type="submit" className="primary-cta" disabled={submitting}>
                {submitting ? "Activating..." : "Set Password & Activate"}
              </button>
            </form>
          ) : (
            <div className="stack-actions" style={{ marginTop: "1rem" }}>
              <Link href="/" className="primary-cta">Go to sign in</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
