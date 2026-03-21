"use client";

import { cn } from "@/lib/utils";

/* ── Mock platform KPI data ── */
const kpis = [
  { label: "Active Gyms", value: "127", trend: "+8", trendLabel: "this month", color: "text-kruxt-accent" },
  { label: "Total Members", value: "48.2K", trend: "+2.1K", trendLabel: "vs last month", color: "text-kruxt-success" },
  { label: "MRR", value: "$186.4K", trend: "+12%", trendLabel: "growth", color: "text-kruxt-platform" },
  { label: "Platform Health", value: "99.7%", trend: "↑", trendLabel: "uptime (30d)", color: "text-kruxt-success" },
];

const alerts = [
  { id: 1, severity: "critical" as const, title: "3 support access grants pending approval", time: "2m ago" },
  { id: 2, severity: "warning" as const, title: "Iron Temple Fitness — billing retry failed (3rd attempt)", time: "18m ago" },
  { id: 3, severity: "warning" as const, title: "2 data export requests awaiting release approval", time: "1h ago" },
  { id: 4, severity: "info" as const, title: "New gym onboarded: PowerHouse Athletics (Denver, CO)", time: "3h ago" },
  { id: 5, severity: "info" as const, title: "Partner revenue settlement completed — $12,847 recognized", time: "6h ago" },
];

const recentTenants = [
  { name: "Iron Temple Fitness", plan: "Pro", members: 342, mrr: 2899, status: "active" as const },
  { name: "CrossFit Apex", plan: "Enterprise", members: 890, mrr: 7499, status: "active" as const },
  { name: "Flex Zone Studio", plan: "Starter", members: 64, mrr: 499, status: "trial" as const },
  { name: "PowerHouse Athletics", plan: "Pro", members: 0, mrr: 0, status: "onboarding" as const },
  { name: "Summit Training Co.", plan: "Pro", members: 215, mrr: 2899, status: "active" as const },
];

const severityStyles = {
  critical: "border-kruxt-danger/30 bg-kruxt-danger/5",
  warning: "border-kruxt-warning/30 bg-kruxt-warning/5",
  info: "border-kruxt-platform/20 bg-kruxt-platform/5",
};

const severityDot = {
  critical: "bg-kruxt-danger",
  warning: "bg-kruxt-warning",
  info: "bg-kruxt-platform",
};

const statusStyles = {
  active: "bg-kruxt-success/20 text-kruxt-success",
  trial: "bg-kruxt-warning/20 text-kruxt-warning",
  onboarding: "bg-kruxt-platform/20 text-kruxt-platform",
  churned: "bg-kruxt-danger/20 text-kruxt-danger",
};

export default function PlatformOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-kruxt-headline">
          Overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide metrics and governance signals. Real-time.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-card border border-border bg-kruxt-surface p-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {kpi.label}
            </p>
            <p className={cn("mt-2 text-3xl font-bold font-kruxt-mono", kpi.color)}>
              {kpi.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="text-kruxt-success">{kpi.trend}</span> {kpi.trendLabel}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Alerts */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-bold font-kruxt-headline">
            Governance Alerts
          </h2>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "flex items-start gap-3 rounded-card border p-4",
                  severityStyles[alert.severity]
                )}
              >
                <span className={cn("mt-1 h-2 w-2 flex-shrink-0 rounded-full", severityDot[alert.severity])} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{alert.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent tenants */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-lg font-bold font-kruxt-headline">
            Recent Tenants
          </h2>
          <div className="rounded-card border border-border bg-kruxt-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gym</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Members</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">MRR</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTenants.map((tenant) => (
                  <tr key={tenant.name} className="border-b border-border/50 last:border-0 hover:bg-kruxt-panel/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{tenant.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{tenant.plan}</td>
                    <td className="px-4 py-3 text-right font-kruxt-mono text-foreground">{tenant.members.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-kruxt-mono text-kruxt-success">
                      {tenant.mrr > 0 ? `$${(tenant.mrr / 100).toFixed(0)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-badge px-2 py-0.5 text-[10px] font-bold uppercase", statusStyles[tenant.status])}>
                        {tenant.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Review Support Grants", count: 3, href: "/support-access", color: "kruxt-danger" },
          { label: "Pending Data Releases", count: 2, href: "/data-governance", color: "kruxt-warning" },
          { label: "Revenue Settlements", count: 1, href: "/revenue", color: "kruxt-platform" },
        ].map((action) => (
          <a
            key={action.label}
            href={action.href}
            className="group flex items-center justify-between rounded-card border border-border bg-kruxt-surface p-4 transition-colors hover:border-kruxt-platform/40 hover:bg-kruxt-panel"
          >
            <div>
              <p className="text-sm font-medium text-foreground group-hover:text-kruxt-platform transition-colors">
                {action.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{action.count} pending</p>
            </div>
            <svg className="h-5 w-5 text-muted-foreground group-hover:text-kruxt-platform transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}
