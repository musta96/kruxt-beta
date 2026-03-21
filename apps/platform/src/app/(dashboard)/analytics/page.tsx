"use client";

import { cn } from "@/lib/utils";

const kpiTimeline = [
  { date: "Mar 15", gyms: 122, members: 46800, mrr: 172400, churn: 1.2 },
  { date: "Mar 16", gyms: 123, members: 47100, mrr: 174200, churn: 1.1 },
  { date: "Mar 17", gyms: 124, members: 47300, mrr: 176800, churn: 1.3 },
  { date: "Mar 18", gyms: 125, members: 47600, mrr: 179500, churn: 1.0 },
  { date: "Mar 19", gyms: 126, members: 47900, mrr: 182100, churn: 0.9 },
  { date: "Mar 20", gyms: 126, members: 48000, mrr: 184300, churn: 1.1 },
  { date: "Mar 21", gyms: 127, members: 48200, mrr: 186400, churn: 1.0 },
];

const topGyms = [
  { name: "CrossFit Apex", members: 890, mrr: 74900, growth: "+3.2%" },
  { name: "Peak Performance", members: 1243, mrr: 74900, growth: "+2.8%" },
  { name: "Urban Fit Lab", members: 567, mrr: 28900, growth: "+5.1%" },
  { name: "Iron Temple Fitness", members: 342, mrr: 28900, growth: "+1.9%" },
  { name: "Summit Training Co.", members: 215, mrr: 28900, growth: "+4.3%" },
];

const engagementMetrics = [
  { label: "Daily Active Users", value: "12.4K", pct: 25.7, trend: "+2.3%" },
  { label: "Workouts Logged (7d)", value: "34.8K", pct: 72.2, trend: "+8.1%" },
  { label: "Proof Posts (7d)", value: "8.2K", pct: 17.0, trend: "+12.4%" },
  { label: "Guild Participation", value: "43%", pct: 43, trend: "+5.6%" },
];

export default function AnalyticsPage() {
  const latest = kpiTimeline[kpiTimeline.length - 1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-kruxt-headline">Platform Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide KPIs, tenant performance, and member engagement insights.
        </p>
      </div>

      {/* Top-line KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active Gyms", value: latest.gyms.toString(), color: "text-kruxt-accent" },
          { label: "Total Members", value: `${(latest.members / 1000).toFixed(1)}K`, color: "text-kruxt-success" },
          { label: "Platform MRR", value: `$${(latest.mrr / 100).toLocaleString()}`, color: "text-kruxt-platform" },
          { label: "Avg Churn Rate", value: `${latest.churn}%`, color: latest.churn <= 1.0 ? "text-kruxt-success" : "text-kruxt-warning" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-card border border-border bg-kruxt-surface p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
            <p className={cn("mt-2 text-3xl font-bold font-kruxt-mono", kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* KPI mini-chart */}
      <div className="rounded-card border border-border bg-kruxt-surface p-5">
        <h2 className="text-lg font-bold font-kruxt-headline">7-Day Trend</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Gyms</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Members</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">MRR</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Churn</th>
              </tr>
            </thead>
            <tbody>
              {kpiTimeline.map((row, i) => (
                <tr key={row.date} className={cn("border-b border-border/30", i === kpiTimeline.length - 1 && "bg-kruxt-platform/5")}>
                  <td className="px-3 py-2 text-foreground font-medium">{row.date}</td>
                  <td className="px-3 py-2 text-right font-kruxt-mono text-foreground">{row.gyms}</td>
                  <td className="px-3 py-2 text-right font-kruxt-mono text-foreground">{row.members.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-kruxt-mono text-kruxt-success">${(row.mrr / 100).toLocaleString()}</td>
                  <td className={cn("px-3 py-2 text-right font-kruxt-mono", row.churn <= 1.0 ? "text-kruxt-success" : "text-kruxt-warning")}>
                    {row.churn}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top gyms */}
        <div className="rounded-card border border-border bg-kruxt-surface p-5">
          <h2 className="text-lg font-bold font-kruxt-headline">Top Gyms by MRR</h2>
          <div className="mt-4 space-y-3">
            {topGyms.map((gym, i) => (
              <div key={gym.name} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kruxt-panel text-xs font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{gym.name}</p>
                  <p className="text-xs text-muted-foreground">{gym.members.toLocaleString()} members</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-kruxt-mono font-medium text-foreground">${(gym.mrr / 100).toLocaleString()}</p>
                  <p className="text-xs text-kruxt-success">{gym.growth}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Engagement */}
        <div className="rounded-card border border-border bg-kruxt-surface p-5">
          <h2 className="text-lg font-bold font-kruxt-headline">Member Engagement</h2>
          <div className="mt-4 space-y-4">
            {engagementMetrics.map((metric) => (
              <div key={metric.label}>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">{metric.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-kruxt-mono font-medium text-foreground">{metric.value}</span>
                    <span className="text-xs text-kruxt-success">{metric.trend}</span>
                  </div>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-kruxt-panel">
                  <div
                    className="h-2 rounded-full bg-kruxt-platform transition-all"
                    style={{ width: `${Math.min(metric.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
