"use client";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";
import type { GymClass } from "@kruxt/types";

const columns: Column<GymClass>[] = [
  {
    key: "title",
    header: "Class",
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.title}</p>
        <p className="text-xs text-muted-foreground">{row.description ?? ""}</p>
      </div>
    ),
  },
  {
    key: "coachUserId",
    header: "Coach",
    render: (row) => (
      <span className="text-sm text-muted-foreground">{row.coachUserId ?? "—"}</span>
    ),
  },
  {
    key: "startsAt",
    header: "Schedule",
    render: (row) => (
      <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
        {row.startsAt
          ? new Date(row.startsAt).toLocaleDateString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" })
          : "—"}
      </span>
    ),
  },
  {
    key: "capacity",
    header: "Capacity",
    render: (row) => {
      const cap = row.capacity ?? 0;
      const booked = 0; // Booking count would come from a separate query
      const pct = cap > 0 ? (booked / cap) * 100 : 0;
      return (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-kruxt-panel">
            <div
              className={`h-full rounded-full ${
                pct >= 100 ? "bg-kruxt-danger" : pct >= 80 ? "bg-kruxt-warning" : "bg-kruxt-accent"
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground font-kruxt-mono">
            {booked}/{cap}
          </span>
        </div>
      );
    },
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <StatusBadge label={row.status} variant={statusToVariant(row.status)} dot />
    ),
  },
  {
    key: "actions",
    header: "",
    className: "w-12",
    render: () => (
      <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
      </button>
    ),
  },
];

export default function ClassesPage() {
  const { gymId } = useGym();
  const { ops } = useServices();

  const { status, data, error, refetch } = useAsync(
    () => ops.listGymClasses(gymId),
    [gymId]
  );

  if (status === "loading" || status === "idle") return <PageSkeleton />;

  if (status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Classes" description="Manage class schedules, instructors, and capacity." />
        <ErrorBanner message={error} onRetry={refetch} />
      </div>
    );
  }

  const classes = data ?? [];
  const activeCount = classes.filter((c) => c.status === "scheduled").length;
  const totalCapacity = classes.reduce((sum, c) => sum + (c.capacity ?? 0), 0);
  const totalBooked = 0; // Would need to aggregate bookings separately

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        description="Manage class schedules, instructors, and capacity."
        actions={
          <button className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90">
            Create Class
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active Classes" value={activeCount} />
        <StatCard
          label="Total Bookings"
          value={totalBooked}
          subtext={`of ${totalCapacity} capacity`}
          accent="success"
        />
        <StatCard
          label="Avg Fill Rate"
          value={totalCapacity > 0 ? `${Math.round((totalBooked / totalCapacity) * 100)}%` : "0%"}
          accent="default"
        />
      </div>

      {classes.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No classes yet. Create your first class to get started.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={classes}
          keyExtractor={(row) => row.id}
          searchable
          searchPlaceholder="Search classes..."
        />
      )}
    </div>
  );
}
