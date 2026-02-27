import React, { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import type { StaffConsoleServices } from "@admin/staff-console";
import type { Phase2StaffConsoleSnapshot } from "@admin/index";

interface GymStaffHomeProps {
  services: StaffConsoleServices;
  gymId: string;
}

export function GymStaffHomeDashboard({ services, gymId }: GymStaffHomeProps) {
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
          <div className="skeleton h-6 w-1/3 mb-3" />
          <div className="skeleton h-4 w-2/3" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="panel p-4">
              <div className="skeleton h-3 w-1/2 mb-2" />
              <div className="skeleton h-6 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalMembers = snapshot?.memberships.length ?? 0;
  const pendingCount = snapshot?.pendingMemberships.length ?? 0;
  const staffCount = snapshot?.memberships.filter((m) =>
    ["leader", "officer", "coach"].includes(m.role)
  ).length ?? 0;
  const upcomingClassCount = snapshot?.upcomingClasses.length ?? 0;
  const pendingWaitlistCount = snapshot?.pendingWaitlist.length ?? 0;
  const openPrivacyCount = snapshot?.openPrivacyRequests.length ?? 0;

  return (
    <div className="p-6 space-y-5">
      <div className="panel p-5 space-y-2">
        <h1 className="text-xl font-display font-bold text-foreground">Gym Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your gym at a glance — members, classes, check-ins, and pending approvals.
        </p>
      </div>

      {error && (
        <div className="panel border-destructive/40 bg-destructive/10 p-3">
          <p className="text-destructive text-sm font-semibold">{error}</p>
          <button className="text-xs text-destructive underline mt-1" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Members" value={totalMembers} />
        <StatCard label="Pending Approvals" value={pendingCount} highlight={pendingCount > 0} />
        <StatCard label="Staff" value={staffCount} />
        <StatCard label="Upcoming Classes" value={upcomingClassCount} />
      </div>

      {/* Quick Actions */}
      <div className="panel p-5 space-y-3">
        <h2 className="text-sm font-display font-bold text-foreground">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <NavLink to="/admin/members" className="btn-primary w-auto">
            Manage Members
          </NavLink>
          <NavLink to="/admin/classes" className="btn-ghost w-auto">
            Class Schedule
          </NavLink>
          <NavLink to="/admin/checkins" className="btn-ghost w-auto">
            Check-ins
          </NavLink>
          <NavLink to="/admin/waivers" className="btn-ghost w-auto">
            Waivers
          </NavLink>
        </div>
      </div>

      {/* Alerts Rail */}
      {(pendingCount > 0 || pendingWaitlistCount > 0 || openPrivacyCount > 0) && (
        <div className="space-y-2">
          <h2 className="text-sm font-display font-bold text-foreground">Attention Needed</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {pendingCount > 0 && (
              <AlertCard
                label="Pending Memberships"
                count={pendingCount}
                linkTo="/admin/members"
                linkLabel="Review"
                variant="warning"
              />
            )}
            {pendingWaitlistCount > 0 && (
              <AlertCard
                label="Waitlist Entries"
                count={pendingWaitlistCount}
                linkTo="/admin/classes"
                linkLabel="Manage"
                variant="info"
              />
            )}
            {openPrivacyCount > 0 && (
              <AlertCard
                label="Open Privacy Requests"
                count={openPrivacyCount}
                linkTo="/admin/compliance"
                linkLabel="Review"
                variant="danger"
              />
            )}
          </div>
        </div>
      )}

      {/* Today's Classes */}
      {snapshot && snapshot.upcomingClasses.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-display font-bold text-foreground">Upcoming Classes</h2>
            <NavLink to="/admin/classes" className="text-xs text-primary underline underline-offset-2">
              View all
            </NavLink>
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
              {snapshot.upcomingClasses.slice(0, 5).map((cls) => (
                <tr key={cls.id}>
                  <td className="font-semibold text-foreground">{cls.title}</td>
                  <td className="text-xs text-muted-foreground font-mono">
                    {new Date(cls.startsAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="text-xs text-muted-foreground">{cls.capacity}</td>
                  <td>
                    <span className={cls.status === "scheduled" ? "badge-success" : "badge-steel"}>
                      {cls.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`panel p-4 flex flex-col gap-1 ${highlight ? "border-warning/40" : ""}`}>
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${highlight ? "text-warning" : ""}`}>{value}</span>
    </div>
  );
}

function AlertCard({
  label,
  count,
  linkTo,
  linkLabel,
  variant,
}: {
  label: string;
  count: number;
  linkTo: string;
  linkLabel: string;
  variant: "warning" | "danger" | "info";
}) {
  const borderColor =
    variant === "warning"
      ? "border-warning/40 bg-warning/5"
      : variant === "danger"
        ? "border-destructive/40 bg-destructive/5"
        : "border-primary/40 bg-primary/5";

  const textColor =
    variant === "warning"
      ? "text-warning"
      : variant === "danger"
        ? "text-destructive"
        : "text-primary";

  return (
    <div className={`panel p-4 ${borderColor}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-semibold ${textColor}`}>{count}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <NavLink to={linkTo} className={`text-xs underline underline-offset-2 ${textColor}`}>
          {linkLabel} →
        </NavLink>
      </div>
    </div>
  );
}
