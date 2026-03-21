"use client";

import { cn } from "@/lib/utils";

interface MarketplaceApp {
  id: string;
  name: string;
  partner: string;
  category: string;
  description: string;
  installs: number;
  rating: number;
  status: "published" | "review" | "draft" | "rejected";
}

const mockApps: MarketplaceApp[] = [
  { id: "app_01", name: "EquipTrack Pro", partner: "EquipTrack", category: "Equipment", description: "Track equipment maintenance, usage, and lifecycle across your gym.", installs: 34, rating: 4.6, status: "published" },
  { id: "app_02", name: "FitMetrics Dashboard", partner: "FitMetrics Analytics", category: "Analytics", description: "Real-time member engagement analytics and trend forecasting.", installs: 52, rating: 4.8, status: "published" },
  { id: "app_03", name: "HealthSync Connect", partner: "HealthSync", category: "Health", description: "Sync member workout data with wearables and health platforms.", installs: 28, rating: 4.3, status: "published" },
  { id: "app_04", name: "GymInsure", partner: "GymInsure Co.", category: "Insurance", description: "Automated liability coverage with real-time waiver verification.", installs: 19, rating: 4.5, status: "published" },
  { id: "app_05", name: "NutriCoach", partner: "NutriTech Labs", category: "Nutrition", description: "AI-powered meal planning and nutrition tracking for members.", installs: 0, rating: 0, status: "review" },
  { id: "app_06", name: "BookClass", partner: "SchedulePro", category: "Scheduling", description: "Advanced class booking with waitlists and recurring reservations.", installs: 0, rating: 0, status: "draft" },
];

const statusStyles = {
  published: "bg-kruxt-success/20 text-kruxt-success",
  review: "bg-kruxt-warning/20 text-kruxt-warning",
  draft: "bg-muted text-muted-foreground",
  rejected: "bg-kruxt-danger/20 text-kruxt-danger",
};

export default function MarketplacePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-kruxt-headline">Partner Marketplace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage third-party apps available to gym tenants through the KRUXT marketplace.
          </p>
        </div>
        <button className="rounded-button bg-kruxt-platform px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]">
          + Submit App
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-border bg-kruxt-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Published Apps</p>
          <p className="mt-1 text-2xl font-bold font-kruxt-mono text-kruxt-success">{mockApps.filter((a) => a.status === "published").length}</p>
        </div>
        <div className="rounded-card border border-border bg-kruxt-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">In Review</p>
          <p className="mt-1 text-2xl font-bold font-kruxt-mono text-kruxt-warning">{mockApps.filter((a) => a.status === "review").length}</p>
        </div>
        <div className="rounded-card border border-border bg-kruxt-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Total Installs</p>
          <p className="mt-1 text-2xl font-bold font-kruxt-mono text-foreground">{mockApps.reduce((s, a) => s + a.installs, 0)}</p>
        </div>
        <div className="rounded-card border border-border bg-kruxt-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Avg Rating</p>
          <p className="mt-1 text-2xl font-bold font-kruxt-mono text-kruxt-accent">
            {(mockApps.filter((a) => a.rating > 0).reduce((s, a) => s + a.rating, 0) / mockApps.filter((a) => a.rating > 0).length).toFixed(1)}
          </p>
        </div>
      </div>

      {/* App cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockApps.map((app) => (
          <div key={app.id} className="rounded-card border border-border bg-kruxt-surface p-5 hover:border-kruxt-platform/40 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-foreground">{app.name}</h3>
                <p className="text-xs text-muted-foreground">by {app.partner}</p>
              </div>
              <span className={cn("inline-flex rounded-badge px-2 py-0.5 text-[10px] font-bold uppercase", statusStyles[app.status])}>
                {app.status}
              </span>
            </div>
            <span className="mt-2 inline-flex rounded-badge bg-kruxt-panel px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {app.category}
            </span>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{app.description}</p>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{app.installs} installs</span>
                {app.rating > 0 && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 text-kruxt-warning" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {app.rating}
                  </span>
                )}
              </div>
              {app.status === "review" && (
                <button className="rounded-md px-2 py-1 text-xs text-kruxt-platform hover:bg-kruxt-platform/10 transition-colors">
                  Review
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
