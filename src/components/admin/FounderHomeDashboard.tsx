import React, { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import type {
  FounderConsoleServices,
  FounderGymRecord
} from "@admin/founder-console/runtime-services";

interface FounderHomeDashboardProps {
  services: FounderConsoleServices;
  selectedGymId: string;
  onSelectGym: (gymId: string) => void;
}

interface PlatformStats {
  totalGyms: number;
  activeGyms: number;
  trialingGyms: number;
  pastDueGyms: number;
  canceledGyms: number;
}

function computePlatformStats(gyms: FounderGymRecord[]): PlatformStats {
  return {
    totalGyms: gyms.length,
    activeGyms: gyms.filter((gym) => gym.subscriptionStatus === "active").length,
    trialingGyms: gyms.filter((gym) => gym.subscriptionStatus === "trialing").length,
    pastDueGyms: gyms.filter((gym) => gym.subscriptionStatus === "past_due").length,
    canceledGyms: gyms.filter((gym) => gym.subscriptionStatus === "canceled").length
  };
}

function SubscriptionBadge({ status }: { status: FounderGymRecord["subscriptionStatus"] }) {
  const className =
    status === "active"
      ? "badge-success"
      : status === "trialing"
      ? "badge-ion"
      : status === "past_due" || status === "unpaid"
      ? "badge-warning"
      : status === "canceled"
      ? "badge-danger"
      : "badge-steel";
  return <span className={className}>{status}</span>;
}

function StatCard({
  label,
  value
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="panel p-4 flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export function FounderHomeDashboard({
  services,
  selectedGymId,
  onSelectGym
}: FounderHomeDashboardProps) {
  const [gyms, setGyms] = useState<FounderGymRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGyms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await services.listGyms();
      setGyms(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load gyms.");
    } finally {
      setLoading(false);
    }
  }, [services]);

  useEffect(() => {
    void loadGyms();
  }, [loadGyms]);

  const stats = React.useMemo(() => computePlatformStats(gyms), [gyms]);
  const recentGyms = React.useMemo(
    () => [...gyms].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 8),
    [gyms]
  );

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="panel p-5">
          <div className="skeleton h-5 w-56" />
          <div className="skeleton h-4 w-96 mt-3" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="panel p-4 space-y-2">
              <div className="skeleton h-3 w-2/3" />
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
          Founder dashboard for all gyms, subscriptions, and cross-gym operations.
        </p>
      </div>

      {error && (
        <div className="panel border-destructive/40 bg-destructive/10 p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-destructive font-semibold">{error}</p>
          <button type="button" className="btn-compact" onClick={() => void loadGyms()}>
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Gyms" value={stats.totalGyms} />
        <StatCard label="Active" value={stats.activeGyms} />
        <StatCard label="Trialing" value={stats.trialingGyms} />
        <StatCard label="Past Due" value={stats.pastDueGyms} />
        <StatCard label="Canceled" value={stats.canceledGyms} />
      </div>

      <div className="panel p-4">
        <div className="flex flex-wrap gap-2">
          <NavLink to="/admin/gyms" className="btn-compact">Manage Gyms</NavLink>
          <NavLink to="/admin/users" className="btn-compact">Users</NavLink>
          <NavLink to="/admin/invites" className="btn-compact">Invites</NavLink>
          <NavLink to="/admin/compliance" className="btn-compact">Compliance</NavLink>
          <NavLink to="/admin/billing" className="btn-compact">Billing</NavLink>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-display font-bold text-foreground">Recently Added Gyms</h2>
          <button type="button" className="btn-compact" onClick={() => void loadGyms()}>
            Refresh
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Gym</th>
              <th>Location</th>
              <th>Subscription</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recentGyms.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                  No gyms provisioned yet.
                </td>
              </tr>
            )}
            {recentGyms.map((gym) => {
              const selected = gym.id === selectedGymId;
              return (
                <tr key={gym.id} className={selected ? "bg-muted/30" : ""}>
                  <td>
                    <div className="font-semibold text-foreground">{gym.name}</div>
                    <div className="text-xs text-muted-foreground">{gym.slug}</div>
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {gym.city ?? "—"}
                    {gym.countryCode ? `, ${gym.countryCode}` : ""}
                  </td>
                  <td>
                    <SubscriptionBadge status={gym.subscriptionStatus} />
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {new Date(gym.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-compact"
                      onClick={() => onSelectGym(gym.id)}
                    >
                      {selected ? "Selected" : "Use Gym"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
