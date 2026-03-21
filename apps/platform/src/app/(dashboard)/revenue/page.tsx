"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface RevenueEvent {
  id: string;
  partner: string;
  gym: string;
  type: "subscription" | "usage" | "commission" | "settlement";
  amount: number;
  status: "pending" | "recognized" | "disputed" | "settled";
  date: string;
}

const mockEvents: RevenueEvent[] = [
  { id: "rev_01", partner: "EquipTrack", gym: "CrossFit Apex", type: "commission", amount: 48700, status: "pending", date: "2026-03-21" },
  { id: "rev_02", partner: "FitMetrics Analytics", gym: "Peak Performance", type: "subscription", amount: 19900, status: "pending", date: "2026-03-20" },
  { id: "rev_03", partner: "HealthSync", gym: "Urban Fit Lab", type: "usage", amount: 8400, status: "recognized", date: "2026-03-18" },
  { id: "rev_04", partner: "GymInsure Co.", gym: "Iron Temple Fitness", type: "commission", amount: 32500, status: "recognized", date: "2026-03-15" },
  { id: "rev_05", partner: "FitMetrics Analytics", gym: "Summit Training Co.", type: "subscription", amount: 19900, status: "settled", date: "2026-03-10" },
  { id: "rev_06", partner: "EquipTrack", gym: "Atlas Barbell Club", type: "commission", amount: 15200, status: "settled", date: "2026-03-08" },
  { id: "rev_07", partner: "HealthSync", gym: "CrossFit Apex", type: "usage", amount: 12100, status: "disputed", date: "2026-03-05" },
];

const statusStyles = {
  pending: "bg-kruxt-warning/20 text-kruxt-warning",
  recognized: "bg-kruxt-success/20 text-kruxt-success",
  disputed: "bg-kruxt-danger/20 text-kruxt-danger",
  settled: "bg-kruxt-accent/20 text-kruxt-accent",
};

const typeStyles = {
  subscription: "bg-kruxt-platform/20 text-kruxt-platform",
  usage: "bg-kruxt-accent/20 text-kruxt-accent",
  commission: "bg-kruxt-success/20 text-kruxt-success",
  settlement: "bg-muted text-muted-foreground",
};

export default function RevenuePage() {
  const [filter, setFilter] = useState<"all" | "pending" | "recognized" | "disputed" | "settled">("all");

  const filtered = filter === "all" ? mockEvents : mockEvents.filter((e) => e.status === filter);

  const totalPending = mockEvents.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0);
  const totalRecognized = mockEvents.filter((e) => e.status === "recognized" || e.status === "settled").reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-kruxt-headline">Partner Revenue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track revenue from partner ecosystem — commissions, subscriptions, usage fees, and settlements.
        </p>
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-kruxt-platform/30 bg-kruxt-platform/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-kruxt-platform">Total Revenue (MTD)</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-kruxt-platform">
            ${((totalPending + totalRecognized) / 100).toLocaleString()}
          </p>
        </div>
        <div className="rounded-card border border-kruxt-warning/30 bg-kruxt-warning/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-kruxt-warning">Pending</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-kruxt-warning">
            ${(totalPending / 100).toLocaleString()}
          </p>
        </div>
        <div className="rounded-card border border-kruxt-success/30 bg-kruxt-success/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-kruxt-success">Recognized</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-kruxt-success">
            ${(totalRecognized / 100).toLocaleString()}
          </p>
        </div>
        <div className="rounded-card border border-kruxt-danger/30 bg-kruxt-danger/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-kruxt-danger">Disputed</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-kruxt-danger">
            ${(mockEvents.filter((e) => e.status === "disputed").reduce((s, e) => s + e.amount, 0) / 100).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 rounded-lg border border-border bg-kruxt-surface p-1 w-fit">
        {(["all", "pending", "recognized", "disputed", "settled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              filter === s ? "bg-kruxt-platform/20 text-kruxt-platform" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-card border border-border bg-kruxt-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Partner</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gym</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => (
              <tr key={event.id} className="border-b border-border/50 last:border-0 hover:bg-kruxt-panel/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{event.partner}</td>
                <td className="px-4 py-3 text-muted-foreground">{event.gym}</td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex rounded-badge px-2 py-0.5 text-[10px] font-bold uppercase", typeStyles[event.type])}>
                    {event.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-kruxt-mono font-medium text-foreground">
                  ${(event.amount / 100).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex rounded-badge px-2 py-0.5 text-[10px] font-bold uppercase", statusStyles[event.status])}>
                    {event.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </td>
                <td className="px-4 py-3">
                  {event.status === "pending" && (
                    <button className="rounded-md px-2 py-1 text-xs text-kruxt-success hover:bg-kruxt-success/10 transition-colors">
                      Recognize
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
