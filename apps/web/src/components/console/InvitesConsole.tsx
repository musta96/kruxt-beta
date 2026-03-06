"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GymRole } from "@kruxt/types";

import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminAccess } from "@/components/admin/useAdminAccess";
import {
  listGyms,
  listInvites,
  resendInvite,
  revokeInvite,
  sendInvite,
  type GymRecord,
  type InviteRecord
} from "@/lib/admin/data";

const ROLE_OPTIONS: GymRole[] = ["leader", "officer", "coach", "member"];

function statusClass(status: InviteRecord["status"]): string {
  if (status === "accepted") return "badge badge-staff";
  if (status === "pending") return "badge badge-founder";
  return "badge badge-danger";
}

export function InvitesConsole({ scope }: { scope: "founder" | "org" }) {
  const { access, supabase, signOut, canManageGyms, allowedGymIds } = useAdminAccess();

  const [gyms, setGyms] = useState<GymRecord[]>([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [invites, setInvites] = useState<InviteRecord[]>([]);

  const [loadingGyms, setLoadingGyms] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<GymRole>("member");
  const [expiresInDays, setExpiresInDays] = useState(7);

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canLoadGyms = access.status === "ready" && access.isAuthenticated;
  const canUseAllGyms = scope === "founder" && canManageGyms;

  const loadGyms = useCallback(async () => {
    if (!canLoadGyms) return;
    setLoadingGyms(true);
    setError(null);
    try {
      const visibleGyms = await listGyms(supabase, canUseAllGyms ? null : allowedGymIds);
      setGyms(visibleGyms);
      setSelectedGymId((current) => {
        if (visibleGyms.some((gym) => gym.id === current)) return current;
        return visibleGyms[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load gyms.");
      setGyms([]);
      setSelectedGymId("");
    } finally {
      setLoadingGyms(false);
    }
  }, [allowedGymIds, canLoadGyms, canUseAllGyms, supabase]);

  const loadInvites = useCallback(async () => {
    if (!selectedGymId) {
      setInvites([]);
      return;
    }
    setLoadingInvites(true);
    setError(null);
    try {
      const rows = await listInvites(supabase, selectedGymId);
      setInvites(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load invites.");
      setInvites([]);
    } finally {
      setLoadingInvites(false);
    }
  }, [selectedGymId, supabase]);

  useEffect(() => {
    void loadGyms();
  }, [loadGyms]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const selectedGym = useMemo(
    () => gyms.find((gym) => gym.id === selectedGymId) ?? null,
    [gyms, selectedGymId]
  );

  async function handleSendInvite() {
    if (!selectedGymId) {
      setError("Select a gym first.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setPendingKey("send");
    setInviteUrl(null);
    setError(null);
    setSuccess(null);
    try {
      const url = await sendInvite(supabase, {
        gymId: selectedGymId,
        email,
        role,
        expiresInDays
      });
      setSuccess("Invite sent.");
      setEmail("");
      if (url) setInviteUrl(url);
      await loadInvites();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send invite.");
    } finally {
      setPendingKey(null);
    }
  }

  async function handleResendInvite(inviteId: string) {
    setPendingKey(`resend_${inviteId}`);
    setInviteUrl(null);
    setError(null);
    setSuccess(null);
    try {
      const url = await resendInvite(supabase, { gymId: selectedGymId, inviteId });
      setSuccess("Invite resent.");
      if (url) setInviteUrl(url);
      await loadInvites();
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Unable to resend invite.");
    } finally {
      setPendingKey(null);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    setPendingKey(`revoke_${inviteId}`);
    setInviteUrl(null);
    setError(null);
    setSuccess(null);
    try {
      await revokeInvite(supabase, { gymId: selectedGymId, inviteId });
      setSuccess("Invite revoked.");
      await loadInvites();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Unable to revoke invite.");
    } finally {
      setPendingKey(null);
    }
  }

  const inviteHostWarning =
    inviteUrl && !inviteUrl.includes("vercel.app") && !inviteUrl.includes("localhost")
      ? "Invite URL host does not look like this app deploy. Verify APP_PUBLIC_URL in Supabase edge function secrets."
      : null;

  return (
    <AdminShell
      access={access}
      scope={scope}
      onSignOut={signOut}
      title="Invites"
      subtitle={scope === "founder" ? "Founder-level invite management" : "Invite gym staff by email"}
    >
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="grid grid-2">
          <div>
            <label className="label" htmlFor={`invites-gym-${scope}`}>Gym</label>
            <select
              id={`invites-gym-${scope}`}
              className="input"
              value={selectedGymId}
              onChange={(event) => setSelectedGymId(event.target.value)}
              disabled={loadingGyms || gyms.length === 0}
            >
              {gyms.length === 0 && <option value="">No gyms available</option>}
              {gyms.map((gym) => (
                <option key={gym.id} value={gym.id}>
                  {gym.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => void loadGyms()} disabled={loadingGyms}>
              {loadingGyms ? "Loading..." : "Refresh gyms"}
            </button>
            <button className="btn" onClick={() => void loadInvites()} disabled={loadingInvites || !selectedGymId}>
              {loadingInvites ? "Loading..." : "Refresh invites"}
            </button>
          </div>
        </div>
        {selectedGym && (
          <p className="subheading" style={{ marginTop: 10 }}>
            Managing invites for {selectedGym.name}
          </p>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Send invite</h3>
        <div className="grid grid-2">
          <div>
            <label className="label" htmlFor={`invite-email-${scope}`}>Email</label>
            <input
              id={`invite-email-${scope}`}
              type="email"
              className="input"
              placeholder="coach@bzone.it"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor={`invite-role-${scope}`}>Role</label>
            <select
              id={`invite-role-${scope}`}
              className="input"
              value={role}
              onChange={(event) => setRole(event.target.value as GymRole)}
            >
              {ROLE_OPTIONS.map((nextRole) => (
                <option key={nextRole} value={nextRole}>
                  {nextRole}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`invite-expiry-${scope}`}>Expires in days</label>
            <input
              id={`invite-expiry-${scope}`}
              className="input"
              type="number"
              min={1}
              max={30}
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(Math.max(1, Math.min(30, Number(event.target.value) || 1)))}
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              className="btn btn-primary"
              onClick={() => void handleSendInvite()}
              disabled={!selectedGymId || pendingKey === "send"}
            >
              {pendingKey === "send" ? "Sending..." : "Send invite"}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="panel" style={{ marginBottom: 12, color: "#ff9baa" }}>{error}</div>}
      {success && <div className="panel" style={{ marginBottom: 12, color: "#7ef5df" }}>{success}</div>}
      {inviteUrl && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <p className="subheading" style={{ marginTop: 0 }}>Invite URL (copy/share):</p>
          <a href={inviteUrl} target="_blank" rel="noreferrer" style={{ display: "block", wordBreak: "break-all", color: "#71deff" }}>
            {inviteUrl}
          </a>
          {inviteHostWarning && (
            <p style={{ color: "#ffd588", marginTop: 10 }}>{inviteHostWarning}</p>
          )}
        </div>
      )}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Invites</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px" }}>Email</th>
                <th style={{ padding: "8px" }}>Role</th>
                <th style={{ padding: "8px" }}>Status</th>
                <th style={{ padding: "8px" }}>Created</th>
                <th style={{ padding: "8px" }}>Expires</th>
                <th style={{ padding: "8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id} style={{ borderBottom: "1px solid #10243d" }}>
                  <td style={{ padding: "8px" }}>{invite.email}</td>
                  <td style={{ padding: "8px" }}>{invite.role}</td>
                  <td style={{ padding: "8px" }}>
                    <span className={statusClass(invite.status)}>{invite.status}</span>
                  </td>
                  <td style={{ padding: "8px", color: "var(--muted)", fontSize: 12 }}>
                    {new Date(invite.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "8px", color: "var(--muted)", fontSize: 12 }}>
                    {new Date(invite.expiresAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "8px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      disabled={invite.status !== "pending" || pendingKey === `resend_${invite.id}`}
                      onClick={() => void handleResendInvite(invite.id)}
                    >
                      {pendingKey === `resend_${invite.id}` ? "Resending..." : "Resend"}
                    </button>
                    <button
                      className="btn btn-danger"
                      disabled={invite.status !== "pending" || pendingKey === `revoke_${invite.id}`}
                      onClick={() => void handleRevokeInvite(invite.id)}
                    >
                      {pendingKey === `revoke_${invite.id}` ? "Revoking..." : "Revoke"}
                    </button>
                  </td>
                </tr>
              ))}
              {invites.length === 0 && !loadingInvites && (
                <tr>
                  <td colSpan={6} style={{ padding: 12, color: "var(--muted)", textAlign: "center" }}>
                    No invites found for this gym.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
