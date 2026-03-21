"use client";

import { cn } from "@/lib/utils";

interface Addon {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: "monthly" | "yearly";
  activeSubscriptions: number;
  status: "live" | "beta" | "coming_soon" | "deprecated";
}

const mockAddons: Addon[] = [
  { id: "addon_01", name: "Advanced Analytics", description: "Custom dashboards, retention funnels, and predictive churn scoring.", price: 4900, interval: "monthly", activeSubscriptions: 23, status: "live" },
  { id: "addon_02", name: "Automation Playbooks", description: "Automated member engagement, re-activation, and upsell workflows.", price: 7900, interval: "monthly", activeSubscriptions: 8, status: "live" },
  { id: "addon_03", name: "White-Label Branding", description: "Custom app icon, splash screen, and in-app branding for your gym.", price: 9900, interval: "monthly", activeSubscriptions: 5, status: "live" },
  { id: "addon_04", name: "Multi-Location", description: "Manage multiple gym locations under one account with consolidated reporting.", price: 14900, interval: "monthly", activeSubscriptions: 3, status: "beta" },
  { id: "addon_05", name: "API Access", description: "RESTful API with webhooks for custom integrations and data sync.", price: 4900, interval: "monthly", activeSubscriptions: 4, status: "live" },
  { id: "addon_06", name: "Priority Support", description: "Dedicated support channel with 1-hour SLA and onboarding concierge.", price: 2900, interval: "monthly", activeSubscriptions: 15, status: "live" },
  { id: "addon_07", name: "AI Coach", description: "AI-powered workout recommendations and member progress insights.", price: 12900, interval: "monthly", activeSubscriptions: 0, status: "coming_soon" },
  { id: "addon_08", name: "Legacy Reporting", description: "Deprecated — replaced by Advanced Analytics.", price: 2900, interval: "monthly", activeSubscriptions: 2, status: "deprecated" },
];

const statusStyles = {
  live: "bg-kruxt-success/20 text-kruxt-success",
  beta: "bg-kruxt-platform/20 text-kruxt-platform",
  coming_soon: "bg-kruxt-accent/20 text-kruxt-accent",
  deprecated: "bg-kruxt-danger/20 text-kruxt-danger",
};

const statusLabels = {
  live: "Live",
  beta: "Beta",
  coming_soon: "Coming Soon",
  deprecated: "Deprecated",
};

export default function AddonsPage() {
  const totalMRR = mockAddons.reduce((sum, a) => sum + a.price * a.activeSubscriptions, 0);
  const totalSubs = mockAddons.reduce((sum, a) => sum + a.activeSubscriptions, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-kruxt-headline">Add-on Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage add-on subscriptions available to gym tenants.
          </p>
        </div>
        <button className="rounded-button bg-kruxt-platform px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]">
          + Create Add-on
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-kruxt-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Add-on MRR</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-kruxt-platform">${(totalMRR / 100).toLocaleString()}</p>
        </div>
        <div className="rounded-card border border-border bg-kruxt-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Active Subscriptions</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-foreground">{totalSubs}</p>
        </div>
        <div className="rounded-card border border-border bg-kruxt-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Catalog Size</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-foreground">{mockAddons.filter((a) => a.status !== "deprecated").length}</p>
        </div>
      </div>

      {/* Add-on cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockAddons.map((addon) => (
          <div
            key={addon.id}
            className={cn(
              "rounded-card border bg-kruxt-surface p-5 transition-colors hover:border-kruxt-platform/40",
              addon.status === "deprecated" ? "border-border opacity-60" : "border-border"
            )}
          >
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-foreground">{addon.name}</h3>
              <span className={cn("inline-flex rounded-badge px-2 py-0.5 text-[10px] font-bold uppercase", statusStyles[addon.status])}>
                {statusLabels[addon.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{addon.description}</p>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <span className="text-2xl font-bold font-kruxt-mono text-foreground">${(addon.price / 100)}</span>
                <span className="text-xs text-muted-foreground">/{addon.interval === "monthly" ? "mo" : "yr"}</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold font-kruxt-mono text-kruxt-accent">{addon.activeSubscriptions}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Active</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
