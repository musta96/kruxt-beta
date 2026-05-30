"use client";

import { useMemo, useState } from "react";
import { ErrorBanner } from "@/components/error-banner";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";
import type {
  GymProfileInvitation,
  ProfileInviteResult,
  RequestedGymProfileRole,
} from "@/services";

const INPUT =
  "w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent/40";

const ROLE_LABELS: Record<RequestedGymProfileRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  pt: "PT",
  member: "Member",
};

const DEFAULT_ROLES: RequestedGymProfileRole[] = ["owner", "admin", "staff", "pt", "member"];

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inviteStatusLabel(invite: GymProfileInvitation): string {
  if (invite.status === "pending_activation" && new Date(invite.expiresAt).getTime() < Date.now()) {
    return "invite_expired";
  }
  return invite.status;
}

export function ProfileInviteForm({
  gymId,
  title = "Create profile & invite",
  defaultRole = "member",
  roles = DEFAULT_ROLES,
  showAssignments = true,
  onChanged,
}: {
  gymId: string;
  title?: string;
  defaultRole?: RequestedGymProfileRole;
  roles?: RequestedGymProfileRole[];
  showAssignments?: boolean;
  onChanged?: () => void;
}) {
  const { gym } = useServices();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RequestedGymProfileRole>(defaultRole);
  const [membershipPlanId, setMembershipPlanId] = useState("");
  const [coachUserId, setCoachUserId] = useState("");
  const [expiresInHours, setExpiresInHours] = useState("48");
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [lastResult, setLastResult] = useState<ProfileInviteResult | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);

  const plansState = useAsync(() => gym.listMembershipPlanOptions(gymId), [gymId]);
  const staffState = useAsync(() => gym.listStaffProfileOptions(gymId), [gymId]);
  const invitesState = useAsync(() => gym.listProfileInvitations(gymId), [gymId]);

  const visibleInvites = useMemo(
    () => (invitesState.data ?? []).filter((invite) => invite.status !== "active").slice(0, 5),
    [invitesState.data]
  );

  async function copyInviteUrl(inviteUrl?: string) {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyState("Copied activation link.");
    } catch {
      setCopyState("Copy failed. Select the link manually.");
    }
  }

  async function createInvite() {
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    setCopyState(null);
    try {
      const result = await gym.createProfileInvite(gymId, {
        fullName: fullName.trim(),
        email: email.trim(),
        role,
        membershipPlanId: showAssignments ? membershipPlanId || null : null,
        coachUserId: showAssignments ? coachUserId || null : null,
        expiresInHours: Number(expiresInHours) || 48,
      });
      setLastResult(result);
      setFullName("");
      setEmail("");
      setMembershipPlanId("");
      setCoachUserId("");
      invitesState.refetch();
      onChanged?.();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to create invite.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendInvite(inviteId: string) {
    setActionId(inviteId);
    setError(undefined);
    setCopyState(null);
    try {
      const result = await gym.resendProfileInvite(gymId, inviteId);
      setLastResult(result);
      invitesState.refetch();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to resend invite.");
    } finally {
      setActionId(null);
    }
  }

  async function disableInvite(inviteId: string) {
    setActionId(inviteId);
    setError(undefined);
    setCopyState(null);
    try {
      await gym.disableProfileInvite(gymId, inviteId);
      setLastResult(null);
      invitesState.refetch();
      onChanged?.();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to disable invite.");
    } finally {
      setActionId(null);
    }
  }

  const deliveryCopy = lastResult
    ? lastResult.emailDelivery === "sent"
      ? "Activation email sent."
      : lastResult.emailDelivery === "failed"
        ? "Email failed. Copy the activation link."
        : "Email provider not configured. Copy the activation link."
    : null;

  return (
    <section className="rounded-card border border-border bg-card p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground font-kruxt-headline">{title}</h2>
          <p className="text-xs text-muted-foreground">The invitee sets their own password from the magic link.</p>
        </div>
        <span className="rounded-full border border-kruxt-accent/30 bg-kruxt-accent/10 px-3 py-1 text-xs font-semibold text-kruxt-accent">
          Pending activation
        </span>
      </div>

      {error && <div className="mt-4"><ErrorBanner message={error} onRetry={() => setError(undefined)} /></div>}

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className={INPUT}
          placeholder="Full name"
        />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={INPUT}
          placeholder="Email"
        />
        <select value={role} onChange={(event) => setRole(event.target.value as RequestedGymProfileRole)} className={INPUT}>
          {roles.map((option) => (
            <option key={option} value={option}>{ROLE_LABELS[option]}</option>
          ))}
        </select>
        <select value={expiresInHours} onChange={(event) => setExpiresInHours(event.target.value)} className={INPUT}>
          <option value="24">24h link</option>
          <option value="48">48h link</option>
          <option value="72">72h link</option>
        </select>
        <button
          onClick={createInvite}
          disabled={submitting}
          className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create & Invite"}
        </button>
      </div>

      {showAssignments && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <select value={membershipPlanId} onChange={(event) => setMembershipPlanId(event.target.value)} className={INPUT}>
            <option value="">No initial plan</option>
            {(plansState.data ?? []).map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.label}</option>
            ))}
          </select>
          <select value={coachUserId} onChange={(event) => setCoachUserId(event.target.value)} className={INPUT}>
            <option value="">No initial PT</option>
            {(staffState.data ?? []).map((staff) => (
              <option key={staff.userId} value={staff.userId}>{staff.label}</option>
            ))}
          </select>
        </div>
      )}

      {lastResult?.inviteUrl && (
        <div className="mt-4 rounded-lg border border-border bg-kruxt-panel/35 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{deliveryCopy}</p>
              {lastResult.emailError && <p className="mt-1 text-xs text-kruxt-warning">{lastResult.emailError}</p>}
            </div>
            <button
              onClick={() => copyInviteUrl(lastResult.inviteUrl)}
              className="rounded-button border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card"
            >
              Copy Link
            </button>
          </div>
          <input
            readOnly
            value={lastResult.inviteUrl}
            className="mt-2 w-full rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground outline-none font-kruxt-mono"
          />
          {copyState && <p className="mt-2 text-xs text-muted-foreground">{copyState}</p>}
        </div>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent pending invites</h3>
          <button
            onClick={invitesState.refetch}
            className="rounded-button border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel"
          >
            Refresh
          </button>
        </div>
        {invitesState.status === "error" && (
          <p className="mt-3 rounded-lg bg-kruxt-danger/10 px-3 py-2 text-xs text-kruxt-danger">{invitesState.error}</p>
        )}
        {visibleInvites.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No pending profile invites.</p>
        ) : (
          <div className="mt-3 divide-y divide-border rounded-lg border border-border">
            {visibleInvites.map((invite) => {
              const busy = actionId === invite.id;
              const statusLabel = inviteStatusLabel(invite);
              return (
                <div key={invite.id} className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{invite.displayName}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {invite.email} / {ROLE_LABELS[invite.requestedRole]} / attempt {invite.inviteAttempt}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Expires {formatDateTime(invite.expiresAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={statusLabel} variant={statusToVariant(statusLabel)} dot />
                    {(invite.status === "pending_activation" || invite.status === "invite_expired") && (
                      <>
                        <button
                          onClick={() => resendInvite(invite.id)}
                          disabled={busy}
                          className="rounded-button bg-kruxt-accent/15 px-2.5 py-1 text-xs font-semibold text-kruxt-accent transition-colors hover:bg-kruxt-accent/25 disabled:opacity-50"
                        >
                          {busy ? "..." : "Resend"}
                        </button>
                        <button
                          onClick={() => disableInvite(invite.id)}
                          disabled={busy}
                          className="rounded-button border border-kruxt-danger/40 px-2.5 py-1 text-xs font-semibold text-kruxt-danger transition-colors hover:bg-kruxt-danger/10 disabled:opacity-50"
                        >
                          Disable
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
