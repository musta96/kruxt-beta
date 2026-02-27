import React, { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import type { FounderConsoleServices, FounderGymRecord } from "@admin/founder-console";

interface FounderHomeProps {
  services: FounderConsoleServices;
  selectedGymId: string;
  onSelectGym: (gymId: string) => void;
}

interface PlatformKPIs {
  totalGyms: number;
  activeGyms: number;
  trialingGyms: number;
  pastDueGyms: number;
  canceledGyms: number;
}

function computeKPIs(gyms: FounderGymRecord[]): PlatformKPIs {
  return {
    totalGyms: gyms.length,
    activeGyms: gyms.filter((g) => g.subscriptionStatus === "active").length,
    trialingGyms: gyms.filter((g) => g.subscriptionStatus === "trialing").length,
    pastDueGyms: gyms.filter((g) => g.subscriptionStatus === "past_due").length,
    canceledGyms: gyms.filter((g) => g.subscriptionStatus === "canceled").length,
  };
}

export function FounderHomeDashboard({ services, selectedGymId, onSelectGym }: FounderHomeProps) {
  const [gyms, setGyms] = useState<FounderGymRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await services.listGyms();
      setGyms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load platform data.");
    } finally {
      setLoading(false);
    }
  }, [services]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = React.useMemo(() => computeKPIs(gyms), [gyms]);

  const recentGyms = React.useMemo(
    () => [...gyms].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [gyms]
  );

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="panel p-5">
          <div className="skeleton h-6 w-1/3 mb-3" />
          <div className="skeleton h-4 w-2/3" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="panel p-4">
              <div className="skeleton h-3 w-1/2 mb-2" />
              <div className="skeleton h-6 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="panel p-5 space-y-2">
        <h1 className="text-xl font-display font-bold text-foreground">Platform Overview</h1>
        <p className="text-sm text-muted-foreground">
          Founder-level dashboard — monitor all gyms, subscriptions, and platform health.
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard label="Total Gyms" value={kpis.totalGyms} />
        <KPICard label="Active" value={kpis.activeGyms} variant="success" />
        <KPICard label="Trialing" value={kpis.trialingGyms} variant="info" />
        <KPICard label="Past Due" value={kpis.pastDueGyms} variant="warning" />
        <KPICard label="Canceled" value={kpis.canceledGyms} variant="danger" />
      </div>

      {/* Quick Actions */}
      <div className="panel p-5 space-y-3">
        <h2 className="text-sm font-display font-bold text-foreground">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <NavLink to="/admin/gyms" className="btn-primary w-auto">
            Manage Gyms
          </NavLink>
          <NavLink to="/admin/members" className="btn-ghost w-auto">
            Member Directory
          </NavLink>
          <NavLink to="/admin/compliance" className="btn-ghost w-auto">
            Compliance
          </NavLink>
          <NavLink to="/admin/billing" className="btn-ghost w-auto">
            Billing
          </NavLink>
        </div>
      </div>

      {/* Recent Gyms */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-display font-bold text-foreground">Recently Created Gyms</h2>
          <NavLink to="/admin/gyms" className="text-xs text-primary underline underline-offset-2">
            View all
          </NavLink>
        </div>
        {recentGyms.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">No gyms provisioned yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Gym</th>
                <th>Location</th>
                <th>Subscription</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentGyms.map((gym) => (
                <tr
                  key={gym.id}
                  className={`cursor-pointer ${gym.id === selectedGymId ? "bg-muted/30" : "hover:bg-muted/20"}`}
                  onClick={() => onSelectGym(gym.id)}
                >
                  <td>
                    <div className="font-semibold text-foreground">{gym.name}</div>
                    <div className="text-xs text-muted-foreground">{gym.slug}</div>
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {gym.city ?? "—"}{gym.countryCode ? `, ${gym.countryCode}` : ""}
                  </td>
                  <td>
                    <SubscriptionBadge status={gym.subscriptionStatus} />
                  </td>
                  <td className="text-xs text-muted-foreground font-mono">
                    {new Date(gym.createdAt).toLocaleDateString()}
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

function KPICard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const dotColor =
    variant === "success"
      ? "bg-success"
      : variant === "warning"
        ? "bg-warning"
        : variant === "danger"
          ? "bg-destructive"
          : variant === "info"
            ? "bg-primary"
            : "bg-muted-foreground";

  return (
    <div className="panel p-4 flex flex-col gap-1">
      <span className="stat-label flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        {label}
      </span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function SubscriptionBadge({ status }: { status: string }) {
  const variant =
    status === "active"
      ? "badge-success"
      : status === "trialing"
        ? "badge-ion"
        : status === "past_due" || status === "unpaid"
          ? "badge-warning"
          : status === "canceled"
            ? "badge-danger"
            : "badge-steel";

  return <span className={variant}>{status}</span>;
}
