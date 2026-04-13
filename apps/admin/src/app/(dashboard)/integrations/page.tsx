"use client";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";

const statusStyles: Record<string, { dot: string; label: string }> = {
  active: { dot: "bg-kruxt-success", label: "Connected" },
  revoked: { dot: "bg-kruxt-steel", label: "Revoked" },
  expired: { dot: "bg-kruxt-warning", label: "Expired" },
  error: { dot: "bg-kruxt-danger", label: "Error" },
};

export default function IntegrationsPage() {
  const { gymId } = useGym();
  const { integrations } = useServices();

  const summary = useAsync(() => integrations.getSummary(gymId), [gymId]);
  const connections = useAsync(() => integrations.listConnectionHealth(gymId), [gymId]);
  const failures = useAsync(() => integrations.listRecentSyncFailures(gymId), [gymId]);

  const isLoading = summary.status === "loading" || summary.status === "idle";

  if (isLoading) return <PageSkeleton />;

  if (summary.status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Integrations" description="Connect third-party services to extend your gym platform." />
        <ErrorBanner message={summary.error} onRetry={summary.refetch} />
      </div>
    );
  }

  const s = summary.data;
  const connectionList = connections.data ?? [];
  const failureList = failures.data ?? [];

  const activeCount = connectionList.filter((c) => c.status === "active").length;
  const errorCount = connectionList.filter((c) => c.status === "error").length;

  // Group connections by provider
  const byProvider = new Map<string, typeof connectionList>();
  for (const conn of connectionList) {
    const list = byProvider.get(conn.provider) ?? [];
    list.push(conn);
    byProvider.set(conn.provider, list);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Monitor device connections and sync health for your gym members."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Total Connections" value={s?.totalConnections ?? 0} />
        <StatCard label="Active" value={s?.activeConnections ?? 0} accent="success" />
        <StatCard label="Unhealthy" value={s?.unhealthyConnections ?? 0} accent={s?.unhealthyConnections ? "warning" : "default"} />
        <StatCard label="Failing Jobs" value={s?.failingOrRetryingJobs ?? 0} accent={s?.failingOrRetryingJobs ? "warning" : "default"} />
      </div>

      {/* Summary badges */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
          <div className="h-2 w-2 rounded-full bg-kruxt-success" />
          <span className="text-sm text-foreground font-medium">{activeCount} connected</span>
        </div>
        {errorCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-kruxt-danger/30 bg-kruxt-danger/5 px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-kruxt-danger" />
            <span className="text-sm text-kruxt-danger font-medium">{errorCount} error{errorCount !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Connections by provider */}
      {connectionList.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No device connections found. Members can connect fitness devices from the mobile app.</p>
        </div>
      ) : (
        Array.from(byProvider.entries()).map(([provider, items]) => (
          <div key={provider}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground font-kruxt-headline">
              {provider}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((conn) => {
                const style = statusStyles[conn.status] ?? statusStyles.error;
                return (
                  <div
                    key={conn.id}
                    className="flex items-center gap-4 rounded-card border border-border bg-card p-4 transition-colors hover:bg-kruxt-panel/30"
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-kruxt-accent/10 text-kruxt-accent font-bold font-kruxt-headline">
                      {provider[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {conn.actor?.username ?? conn.userId.slice(0, 8)}
                        </p>
                        <div className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {style.label}{conn.lastError ? ` — ${conn.lastError}` : ""}
                      </p>
                      {conn.lastSyncedAt && (
                        <p className="mt-1 text-[10px] tabular-nums text-muted-foreground/70 font-kruxt-mono">
                          Last sync: {new Date(conn.lastSyncedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Recent sync failures */}
      {failureList.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-kruxt-danger font-kruxt-headline">
            Recent Sync Failures
          </h2>
          <div className="rounded-card border border-kruxt-danger/30 bg-card">
            <div className="divide-y divide-border">
              {failureList.slice(0, 10).map((f) => (
                <div key={f.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-kruxt-danger/15 text-kruxt-danger">
                    <span className="text-xs font-bold">!</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{f.provider}</span>
                      {" — "}
                      <span className="text-muted-foreground">{f.errorMessage ?? "Unknown error"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Retries: {f.retryCount} · {f.status === "retry_scheduled" && f.nextRetryAt ? `Next retry: ${new Date(f.nextRetryAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : "Failed"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
