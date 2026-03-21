"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type TenantStatus = "active" | "trial" | "onboarding" | "suspended" | "churned";

interface Tenant {
  id: string;
  name: string;
  city: string;
  plan: string;
  members: number;
  mrr: number;
  status: TenantStatus;
  joinedAt: string;
  lastActive: string;
}

const mockTenants: Tenant[] = [
  { id: "gym_01", name: "Iron Temple Fitness", city: "Austin, TX", plan: "Pro", members: 342, mrr: 28900, status: "active", joinedAt: "2024-08-15", lastActive: "2026-03-21" },
  { id: "gym_02", name: "CrossFit Apex", city: "Denver, CO", plan: "Enterprise", members: 890, mrr: 74900, status: "active", joinedAt: "2024-06-01", lastActive: "2026-03-21" },
  { id: "gym_03", name: "Flex Zone Studio", city: "Miami, FL", plan: "Starter", members: 64, mrr: 4900, status: "trial", joinedAt: "2026-03-10", lastActive: "2026-03-20" },
  { id: "gym_04", name: "PowerHouse Athletics", city: "Denver, CO", plan: "Pro", members: 0, mrr: 0, status: "onboarding", joinedAt: "2026-03-19", lastActive: "2026-03-19" },
  { id: "gym_05", name: "Summit Training Co.", city: "Seattle, WA", plan: "Pro", members: 215, mrr: 28900, status: "active", joinedAt: "2024-11-20", lastActive: "2026-03-21" },
  { id: "gym_06", name: "Peak Performance", city: "Chicago, IL", plan: "Enterprise", members: 1243, mrr: 74900, status: "active", joinedAt: "2024-04-10", lastActive: "2026-03-21" },
  { id: "gym_07", name: "Urban Fit Lab", city: "NYC, NY", plan: "Pro", members: 567, mrr: 28900, status: "active", joinedAt: "2025-01-05", lastActive: "2026-03-20" },
  { id: "gym_08", name: "FitBox Studios", city: "LA, CA", plan: "Starter", members: 89, mrr: 0, status: "churned", joinedAt: "2025-06-15", lastActive: "2026-01-10" },
  { id: "gym_09", name: "Atlas Barbell Club", city: "Portland, OR", plan: "Pro", members: 178, mrr: 28900, status: "active", joinedAt: "2025-03-22", lastActive: "2026-03-21" },
  { id: "gym_10", name: "Rebel Fitness Co.", city: "Nashville, TN", plan: "Pro", members: 134, mrr: 28900, status: "suspended", joinedAt: "2025-05-01", lastActive: "2026-02-28" },
];

const statusStyles: Record<TenantStatus, string> = {
  active: "bg-kruxt-success/20 text-kruxt-success",
  trial: "bg-kruxt-warning/20 text-kruxt-warning",
  onboarding: "bg-kruxt-platform/20 text-kruxt-platform",
  suspended: "bg-kruxt-danger/20 text-kruxt-danger",
  churned: "bg-muted text-muted-foreground",
};

const statusFilters: TenantStatus[] = ["active", "trial", "onboarding", "suspended", "churned"];

export default function TenantsPage() {
  const [filter, setFilter] = useState<TenantStatus | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = mockTenants.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.city.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: mockTenants.length,
    ...Object.fromEntries(statusFilters.map((s) => [s, mockTenants.filter((t) => t.status === s).length])),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-kruxt-headline">Gym Tenants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage all gym tenants on the KRUXT platform.
          </p>
        </div>
        <button className="rounded-button bg-kruxt-platform px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]">
          + Onboard Gym
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-kruxt-surface px-3 py-1.5">
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search gyms..."
            className="w-48 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-kruxt-surface p-1">
          {(["all", ...statusFilters] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                filter === s
                  ? "bg-kruxt-platform/20 text-kruxt-platform"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-card border border-border bg-kruxt-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gym</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Members</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">MRR</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((tenant) => (
              <tr key={tenant.id} className="border-b border-border/50 last:border-0 hover:bg-kruxt-panel/50 transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">{tenant.name}</p>
                    <p className="text-xs text-muted-foreground">{tenant.id}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{tenant.city}</td>
                <td className="px-4 py-3">
                  <span className="rounded-badge bg-kruxt-panel px-2 py-0.5 text-xs font-medium text-foreground">
                    {tenant.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-kruxt-mono text-foreground">{tenant.members.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-kruxt-mono text-kruxt-success">
                  {tenant.mrr > 0 ? `$${(tenant.mrr / 100).toLocaleString()}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex rounded-badge px-2 py-0.5 text-[10px] font-bold uppercase", statusStyles[tenant.status])}>
                    {tenant.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(tenant.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</td>
                <td className="px-4 py-3">
                  <button className="rounded-md p-1 text-muted-foreground hover:bg-kruxt-panel hover:text-foreground transition-colors">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
