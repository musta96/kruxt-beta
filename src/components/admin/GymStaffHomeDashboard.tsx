import React, { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import type { Phase2StaffConsoleSnapshot } from "@admin/flows/phase2-staff-console-ui";
import type { StaffConsoleServices } from "@admin/staff-console/runtime-services";

interface GymStaffHomeDashboardProps {
  gymId: string;
  services: StaffConsoleServices;
}

function StatCard({
  label,
  value,
  highlight = false
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`panel p-4 flex flex-col gap-1 ${highlight ? "border-primary/50" : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function ClassStatusBadge({ status }: { status: "scheduled" | "cancelled" | "completed" }) {
  const className =
    status === "scheduled"
      ? "badge-success"
      : status === "cancelled"
      ? "badge-danger"
      : "badge-steel";
  return <span className={className}>{status}</span>;
}

export function GymStaffHomeDashboard({ gymId, services }: GymStaffHomeDashboardProps) {
  const [snapshot, setSnapshot] = useState<Phase2StaffConsoleSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await services.load(gymId);
    if (result.ok === false) {
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

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="panel p-5">
          <div className="skeleton h-5 w-64" />
          <div className="skeleton h-4 w-80 mt-3" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="panel p-4 space-y-2">
              <div className="skeleton h-3 w-1/2" />
              <div className="skeleton h-6 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalMembers = snapshot?.memberships.length ?? 0;
  const pendingMemberships = snapshot?.pendingMemberships.length ?? 0;
  const staffCount =
    snapshot?.memberships.filter((membership) =>
      ["leader", "officer", "coach"].includes(membership.role)
    ).length ?? 0;
  const upcomingClasses = snapshot?.upcomingClasses.length ?? 0;
  const pendingWaitlist = snapshot?.pendingWaitlist.length ?? 0;
  const openPrivacyRequests = snapshot?.openPrivacyRequests.length ?? 0;

  return (
    <div className="p-6 space-y-5">
      <div className="panel p-5 space-y-2">
        <h1 className="text-xl font-display font-bold text-foreground">Gym Overview</h1>
        <p className="text-sm text-muted-foreground">
          Gym-scoped operations for membership, classes, waitlist, and privacy requests.
        </p>
      </div>

      {error && (
        <div className="panel border-destructive/40 bg-destructive/10 p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-destructive font-semibold">{error}</p>
          <button type="button" className="btn-compact" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Members" value={totalMembers} />
        <StatCard label="Pending" value={pendingMemberships} highlight={pendingMemberships > 0} />
        <StatCard label="Staff" value={staffCount} />
        <StatCard label="Classes" value={upcomingClasses} />
        <StatCard label="Waitlist" value={pendingWaitlist} highlight={pendingWaitlist > 0} />
      </div>

      <div className="panel p-4">
        <div className="flex flex-wrap gap-2">
          <NavLink to="/admin/users" className="btn-compact">Users</NavLink>
          <NavLink to="/admin/invites" className="btn-compact">Invites</NavLink>
          <NavLink to="/admin/classes" className="btn-compact">Class Schedule</NavLink>
          <NavLink to="/admin/checkins" className="btn-compact">Check-ins</NavLink>
          <NavLink to="/admin/waivers" className="btn-compact">Waivers</NavLink>
          <NavLink to="/admin/settings" className="btn-compact">Settings</NavLink>
        </div>
      </div>

      {(pendingMemberships > 0 || pendingWaitlist > 0 || openPrivacyRequests > 0) && (
        <div className="panel p-4">
          <h2 className="text-sm font-display font-bold text-foreground mb-2">Attention Required</h2>
          <div className="flex flex-wrap gap-2">
            {pendingMemberships > 0 && (
              <span className="badge-warning">{pendingMemberships} pending memberships</span>
            )}
            {pendingWaitlist > 0 && (
              <span className="badge-warning">{pendingWaitlist} waitlist entries</span>
            )}
            {openPrivacyRequests > 0 && (
              <span className="badge-danger">{openPrivacyRequests} open privacy requests</span>
            )}
          </div>
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-display font-bold text-foreground">Upcoming Classes</h2>
          <button type="button" className="btn-compact" onClick={() => void load()}>
            Refresh
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Starts</th>
              <th>Capacity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!snapshot || snapshot.upcomingClasses.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-muted-foreground text-sm py-6">
                  No scheduled classes.
                </td>
              </tr>
            ) : (
              snapshot.upcomingClasses.slice(0, 8).map((gymClass) => (
                <tr key={gymClass.id}>
                  <td className="font-medium">{gymClass.title}</td>
                  <td className="text-xs text-muted-foreground">
                    {new Date(gymClass.startsAt).toLocaleString()}
                  </td>
                  <td className="font-mono tabular-nums">{gymClass.capacity}</td>
                  <td><ClassStatusBadge status={gymClass.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
