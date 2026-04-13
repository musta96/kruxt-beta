"use client";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";

interface QuickAction {
  label: string;
  description: string;
  href: string;
}

const quickActions: QuickAction[] = [
  { label: "Add Member", description: "Register a new gym member", href: "/members" },
  { label: "Create Class", description: "Schedule a new class", href: "/classes" },
  { label: "View Check-ins", description: "Today's check-in log", href: "/checkins" },
  { label: "Support Queue", description: "Open support tickets", href: "/support" },
];

const typeColors: Record<string, string> = {
  checkin: "bg-kruxt-success/15 text-kruxt-success",
  member: "bg-kruxt-accent/15 text-kruxt-accent",
  class: "bg-purple-500/15 text-purple-400",
  billing: "bg-kruxt-warning/15 text-kruxt-warning",
  support: "bg-orange-500/15 text-orange-400",
};

export default function DashboardPage() {
  const { gymId } = useGym();
  const { gym, ops } = useServices();

  // Fetch real data from services
  const summary = useAsync(() => gym.getGymOpsSummary(gymId), [gymId]);
  const memberships = useAsync(() => gym.listGymMemberships(gymId), [gymId]);
  const classes = useAsync(() => ops.listGymClasses(gymId), [gymId]);
  const checkins = useAsync(() => ops.listRecentCheckins(gymId), [gymId]);
  const tickets = useAsync(
    () =>
      import("@/services").then(({ CustomizationSupportService, createAdminSupabaseClient }) => {
        const svc = new CustomizationSupportService(createAdminSupabaseClient());
        return svc.listSupportTickets(gymId, { statuses: ["open", "in_progress"], limit: 10 });
      }),
    [gymId]
  );

  // If any core data is loading, show skeleton
  const isLoading =
    summary.status === "loading" || summary.status === "idle";

  if (isLoading) {
    return <PageSkeleton />;
  }

  // If summary failed, show error with retry
  if (summary.status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Overview"
          description="Your gym at a glance. Data refreshed in real-time."
        />
        <ErrorBanner message={summary.error} onRetry={summary.refetch} />
      </div>
    );
  }

  const memberList = memberships.data ?? [];
  const activeMembers = memberList.filter((m) => m.membershipStatus === "active").length;
  const pendingMembers = memberList.filter((m) => m.membershipStatus === "pending").length;
  const activeClasses = (classes.data ?? []).filter((c) => c.status === "scheduled").length;
  const recentCheckinList = (checkins.data ?? []).slice(0, 8);
  const openTickets = (tickets.data ?? []).length;

  // Build activity items from real check-ins
  const activityItems = recentCheckinList.map((ci, i) => ({
    id: ci.id ?? String(i),
    message: `Check-in recorded (${ci.sourceChannel ?? "manual"})`,
    time: ci.checkedInAt
      ? new Date(ci.checkedInAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : "—",
    type: "checkin" as const,
  }));

  const pendingActions = pendingMembers + openTickets;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Your gym at a glance. Data refreshed in real-time."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Members"
          value={memberList.length}
          trend={activeMembers > 0 ? { value: `${activeMembers} active`, positive: true } : undefined}
        />
        <StatCard
          label="Active Today"
          value={recentCheckinList.length}
          subtext="checked in"
          accent="success"
        />
        <StatCard
          label="Active Classes"
          value={activeClasses}
          subtext={`${(classes.data ?? []).length} total`}
        />
        <StatCard
          label="Pending Actions"
          value={pendingActions}
          subtext={`${pendingMembers} memberships, ${openTickets} tickets`}
          accent={pendingActions > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-card border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-kruxt-headline">
              Recent Activity
            </h2>
          </div>
          {activityItems.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activityItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-kruxt-panel/30"
                >
                  <div
                    className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${typeColors[item.type] ?? "bg-muted text-muted-foreground"}`}
                  >
                    <span className="text-xs font-bold">
                      {item.type[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{item.message}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="rounded-card border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-kruxt-headline">
                Quick Actions
              </h2>
            </div>
            <div className="p-3">
              {quickActions.map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-kruxt-panel"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-kruxt-accent/10">
                    <svg className="h-4 w-4 text-kruxt-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {action.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Alerts from real data */}
          {pendingActions > 0 && (
            <div className="rounded-card border border-kruxt-warning/30 bg-kruxt-warning/5 p-4">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-kruxt-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span className="text-sm font-medium text-kruxt-warning">
                  Attention Required
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {pendingMembers > 0 && (
                  <li className="text-xs text-muted-foreground">
                    {pendingMembers} membership request{pendingMembers > 1 ? "s" : ""} pending approval
                  </li>
                )}
                {openTickets > 0 && (
                  <li className="text-xs text-muted-foreground">
                    {openTickets} open support ticket{openTickets > 1 ? "s" : ""}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
