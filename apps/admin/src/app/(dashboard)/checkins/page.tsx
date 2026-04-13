"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";

const methodBadge: Record<string, { label: string; variant: "default" | "success" | "info" | "warning" }> = {
  nfc: { label: "NFC", variant: "default" },
  qr: { label: "QR", variant: "info" },
  manual: { label: "Manual", variant: "warning" },
  kiosk: { label: "Kiosk", variant: "success" },
};

export default function CheckinsPage() {
  const { gymId } = useGym();
  const { ops } = useServices();
  const [search, setSearch] = useState("");

  const { status, data, error, refetch } = useAsync(
    () => ops.listRecentCheckins(gymId),
    [gymId]
  );

  if (status === "loading" || status === "idle") return <PageSkeleton />;

  if (status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Check-ins" description="Live check-in feed and today's attendance." />
        <ErrorBanner message={error} onRetry={refetch} />
      </div>
    );
  }

  const checkins = data ?? [];

  const filtered = checkins.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.userId ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-ins"
        description="Live check-in feed and today's attendance."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Today's Check-ins"
          value={checkins.length}
          accent="success"
        />
        <StatCard
          label="Methods Used"
          value={new Set(checkins.map((c) => c.sourceChannel)).size}
          subtext="distinct methods"
        />
        <StatCard
          label="Total Records"
          value={checkins.length}
          subtext="last 200"
        />
      </div>

      <div className="rounded-card border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-kruxt-headline">
              Live Feed
            </h2>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kruxt-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-kruxt-success" />
              </span>
              <span className="text-xs text-kruxt-success">Live</span>
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-kruxt-panel px-3 py-1.5">
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search by member..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              title="No check-ins found"
              description={checkins.length === 0 ? "No check-ins recorded yet." : "No check-ins match your search."}
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((checkin) => {
              const badge = methodBadge[checkin.sourceChannel ?? "manual"] ?? methodBadge.manual;
              return (
                <div
                  key={checkin.id}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-kruxt-panel/30"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-kruxt-accent/15 text-xs font-bold text-kruxt-accent">
                    CI
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {checkin.userId ?? "Unknown"}
                      </p>
                      <StatusBadge label={badge.label} variant={badge.variant} />
                    </div>
                    {checkin.classId && (
                      <p className="text-xs text-muted-foreground">
                        Class: {checkin.classId}
                      </p>
                    )}
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
                    {checkin.checkedInAt
                      ? new Date(checkin.checkedInAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
