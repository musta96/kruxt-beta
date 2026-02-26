import React, { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Phase2StaffConsoleSnapshot,
  StaffMembershipItem
} from "../flows/phase2-staff-console-ui";
import type { StaffConsoleServices } from "./runtime-services";

export interface StaffConsoleFlowProps {
  services: StaffConsoleServices;
  gymId: string;
}

type MembershipStatus = "pending" | "trial" | "active" | "paused" | "cancelled";
type GymRole = "leader" | "officer" | "coach" | "member";

const STATUS_OPTIONS: MembershipStatus[] = ["pending", "trial", "active", "paused", "cancelled"];
const ROLE_OPTIONS: GymRole[] = ["leader", "officer", "coach", "member"];

export function StaffConsoleFlow({ services, gymId }: StaffConsoleFlowProps) {
  const [snapshot, setSnapshot] = useState<Phase2StaffConsoleSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await services.load(gymId);
    if (!result.ok) {
      setError(result.error.message);
      setLoading(false);
      return;
    }
    setSnapshot(result.snapshot);
    setLoading(false);
  }, [gymId, services]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (key: string, action: () => Promise<{ ok: boolean; error?: { message: string }; snapshot?: Phase2StaffConsoleSnapshot }>) => {
      setPendingKey(key);
      setError(null);
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error?.message ?? "Unable to complete staff action.");
        } else if (result.snapshot) {
          setSnapshot(result.snapshot);
        }
      } finally {
        setPendingKey(null);
      }
    },
    []
  );

  const staffCount = useMemo(() => {
    if (!snapshot) return 0;
    return snapshot.memberships.filter((item) => ["leader", "officer", "coach"].includes(item.role)).length;
  }, [snapshot]);

  const renderActions = (membership: StaffMembershipItem) => (
    <div className="flex gap-2">
      {membership.canApprove && (
        <button
          type="button"
          className="btn-compact"
          disabled={pendingKey === `approve_${membership.id}`}
          onClick={() =>
            void run(`approve_${membership.id}`, () =>
              services.approvePendingMembership(gymId, membership.id)
            )
          }
        >
          Approve
        </button>
      )}
      {membership.canReject && (
        <button
          type="button"
          className="btn-compact"
          disabled={pendingKey === `reject_${membership.id}`}
          onClick={() =>
            void run(`reject_${membership.id}`, () =>
              services.rejectPendingMembership(gymId, membership.id)
            )
          }
        >
          Reject
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="panel p-4">
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-3 w-full mt-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="panel p-5 space-y-2">
        <h1 className="text-xl font-display font-bold text-foreground">Members & Staff Access</h1>
        <p className="text-sm text-muted-foreground">
          Approve pending members, assign staff roles, and control permissions. Staff can later manage their own personal profile fields.
        </p>
      </div>

      {error && (
        <div className="panel border-destructive/40 bg-destructive/10 p-3">
          <p className="text-destructive text-sm font-semibold">{error}</p>
        </div>
      )}

      {!snapshot && (
        <div className="panel p-5">
          <p className="text-muted-foreground text-sm">No membership snapshot available.</p>
          <button className="btn-compact mt-3" onClick={() => { void load(); }}>
            Retry
          </button>
        </div>
      )}

      {snapshot && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total Memberships" value={snapshot.memberships.length} />
            <StatCard label="Pending" value={snapshot.pendingMemberships.length} />
            <StatCard label="Staff" value={staffCount} />
            <StatCard label="Open Privacy" value={snapshot.openPrivacyRequests.length} />
          </div>

          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-display font-bold text-foreground">Membership Directory</h2>
              <button className="btn-compact" onClick={() => { void load(); }}>
                Refresh
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th>Set Status</th>
                  <th>Set Role</th>
                  <th>Queue Actions</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.memberships.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground text-sm py-6">
                      No memberships found.
                    </td>
                  </tr>
                )}
                {snapshot.memberships.map((membership) => (
                  <tr key={membership.id}>
                    <td className="font-mono text-xs">{membership.userId.slice(0, 8)}...</td>
                    <td><StatusBadge status={membership.membershipStatus} /></td>
                    <td><StatusBadge status={membership.role} /></td>
                    <td>
                      <select
                        className="input-field"
                        value={membership.membershipStatus}
                        onChange={(event) =>
                          void run(`status_${membership.id}`, () =>
                            services.setMembershipStatus(
                              gymId,
                              membership.id,
                              event.target.value as MembershipStatus
                            )
                          )
                        }
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="input-field"
                        value={membership.role}
                        onChange={(event) =>
                          void run(`role_${membership.id}`, () =>
                            services.assignMembershipRole(
                              gymId,
                              membership.id,
                              event.target.value as GymRole
                            )
                          )
                        }
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </td>
                    <td>{renderActions(membership)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-4 flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    ["active", "trial", "leader", "officer", "coach"].includes(status)
      ? "badge-success"
      : ["cancelled", "paused"].includes(status)
        ? "badge-danger"
        : ["pending"].includes(status)
          ? "badge-warning"
          : "badge-steel";

  return <span className={variant}>{status}</span>;
}
