import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { GymRole } from "@kruxt/types";
import type { OrgInviteRecord, OrgInvitesServices } from "./runtime-services";

const ROLE_OPTIONS: GymRole[] = ["member", "coach", "officer", "leader"];

export interface OrgInvitesFlowProps {
  gymId: string;
  services: OrgInvitesServices;
}

function StatusBadge({ status }: { status: OrgInviteRecord["status"] }) {
  const className =
    status === "accepted"
      ? "badge-success"
      : status === "pending"
      ? "badge-warning"
      : status === "revoked"
      ? "badge-danger"
      : "badge-steel";
  return <span className={className}>{status}</span>;
}

export function OrgInvitesFlow({ gymId, services }: OrgInvitesFlowProps) {
  const [invites, setInvites] = useState<OrgInviteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<GymRole>("member");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await services.load(gymId);
    if (!result.ok || !result.invites) {
      setLoading(false);
      setError(result.error?.message ?? "Unable to load invites.");
      return;
    }
    setInvites(result.invites);
    setLoading(false);
  }, [gymId, services]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (
      key: string,
      action: () => Promise<{ ok: boolean; invite?: OrgInviteRecord; inviteUrl?: string; error?: { message: string } }>,
      successMessage: string
    ) => {
      setPendingKey(key);
      setError(null);
      setSuccess(null);
      setInviteLink(null);
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error?.message ?? "Action failed.");
          return;
        }
        if (result.inviteUrl) {
          setInviteLink(result.inviteUrl);
        }
        setSuccess(successMessage);
        await load();
      } finally {
        setPendingKey(null);
      }
    },
    [load]
  );

  const pendingCount = useMemo(
    () => invites.filter((invite) => invite.status === "pending").length,
    [invites]
  );

  const acceptedCount = useMemo(
    () => invites.filter((invite) => invite.status === "accepted").length,
    [invites]
  );

  const revokedCount = useMemo(
    () => invites.filter((invite) => invite.status === "revoked").length,
    [invites]
  );

  return (
    <div className="p-6 space-y-5">
      <div className="panel p-5 space-y-2">
        <h1 className="text-xl font-display font-bold text-foreground">Invites</h1>
        <p className="text-sm text-muted-foreground">
          Invite staff by email, resend pending links, and revoke access before acceptance.
        </p>
      </div>

      {error && (
        <div className="panel border-destructive/40 bg-destructive/10 p-3">
          <p className="text-sm text-destructive font-semibold">{error}</p>
        </div>
      )}

      {success && (
        <div className="panel border-success/40 bg-success/10 p-3 space-y-2">
          <p className="text-sm text-success font-semibold">{success}</p>
          {inviteLink && (
            <div className="flex items-center gap-2">
              <input className="input-field" readOnly value={inviteLink} />
              <button
                type="button"
                className="btn-compact"
                onClick={() => {
                  if (!inviteLink) return;
                  void navigator.clipboard?.writeText(inviteLink);
                }}
              >
                Copy
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="panel p-4 flex flex-col gap-1">
          <span className="stat-label">Total Invites</span>
          <span className="stat-value">{invites.length}</span>
        </div>
        <div className="panel p-4 flex flex-col gap-1">
          <span className="stat-label">Pending</span>
          <span className="stat-value">{pendingCount}</span>
        </div>
        <div className="panel p-4 flex flex-col gap-1">
          <span className="stat-label">Accepted</span>
          <span className="stat-value">{acceptedCount}</span>
        </div>
        <div className="panel p-4 flex flex-col gap-1">
          <span className="stat-label">Revoked</span>
          <span className="stat-value">{revokedCount}</span>
        </div>
      </div>

      <div className="panel p-5 space-y-3">
        <h2 className="text-sm font-display font-bold text-foreground">Send Invite</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            className="input-field"
            type="email"
            value={inviteEmail}
            placeholder="coach@bzone.it"
            onChange={(event) => setInviteEmail(event.target.value)}
          />
          <select
            className="input-field"
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as GymRole)}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary w-auto"
            disabled={pendingKey === "send_invite"}
            onClick={() => {
              const trimmed = inviteEmail.trim();
              if (!trimmed) {
                setError("Email is required.");
                return;
              }
              void run(
                "send_invite",
                () => services.sendInvite(gymId, { email: trimmed, role: inviteRole, expiresInDays: 7 }),
                `Invite sent to ${trimmed}.`
              );
            }}
          >
            {pendingKey === "send_invite" ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-display font-bold text-foreground">Invite Log</h2>
          <button type="button" className="btn-compact" onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="p-4">
            <div className="skeleton h-4 w-48 mb-2" />
            <div className="skeleton h-3 w-full" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                    No invites created yet.
                  </td>
                </tr>
              )}
              {invites.map((invite) => (
                <tr key={invite.id}>
                  <td>{invite.email}</td>
                  <td><span className="badge-steel">{invite.role}</span></td>
                  <td><StatusBadge status={invite.status} /></td>
                  <td className="text-xs text-muted-foreground">
                    {new Date(invite.expiresAt).toLocaleString()}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {invite.status === "pending" && (
                        <button
                          type="button"
                          className="btn-compact"
                          disabled={pendingKey === `resend_${invite.id}`}
                          onClick={() =>
                            void run(
                              `resend_${invite.id}`,
                              () => services.resendInvite(gymId, invite.id),
                              `Invite resent to ${invite.email}.`
                            )
                          }
                        >
                          Resend
                        </button>
                      )}
                      {invite.status === "pending" && (
                        <button
                          type="button"
                          className="btn-compact"
                          disabled={pendingKey === `revoke_${invite.id}`}
                          onClick={() =>
                            void run(
                              `revoke_${invite.id}`,
                              () => services.revokeInvite(gymId, invite.id),
                              `Invite revoked for ${invite.email}.`
                            )
                          }
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
