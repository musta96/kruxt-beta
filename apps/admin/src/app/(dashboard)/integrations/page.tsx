"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { PageSkeleton } from "@/components/loading-skeleton";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: "payment" | "access" | "fitness" | "communication" | "analytics";
  status: "connected" | "disconnected" | "error";
  icon: string;
  lastSyncAt: string | null;
}

const mockIntegrations: Integration[] = [
  { id: "stripe", name: "Stripe", description: "Payment processing and subscriptions", category: "payment", status: "connected", icon: "S", lastSyncAt: "2026-03-19 10:00" },
  { id: "nfc-reader", name: "NFC Check-in", description: "Tap-to-check-in hardware readers", category: "access", status: "connected", icon: "N", lastSyncAt: "2026-03-19 09:45" },
  { id: "apple-health", name: "Apple Health", description: "Import workouts from Apple Health data", category: "fitness", status: "connected", icon: "A", lastSyncAt: "2026-03-19 08:30" },
  { id: "google-fit", name: "Google Fit", description: "Sync with Google Fit activity data", category: "fitness", status: "disconnected", icon: "G", lastSyncAt: null },
  { id: "mailchimp", name: "Mailchimp", description: "Email campaigns and member communications", category: "communication", status: "connected", icon: "M", lastSyncAt: "2026-03-18 22:00" },
  { id: "twilio", name: "Twilio", description: "SMS notifications and reminders", category: "communication", status: "error", icon: "T", lastSyncAt: "2026-03-17 14:30" },
  { id: "mixpanel", name: "Mixpanel", description: "Product analytics and event tracking", category: "analytics", status: "disconnected", icon: "X", lastSyncAt: null },
  { id: "garmin", name: "Garmin Connect", description: "Import Garmin watch workout data", category: "fitness", status: "disconnected", icon: "G", lastSyncAt: null },
];

const categoryLabels: Record<Integration["category"], string> = {
  payment: "Payments",
  access: "Access Control",
  fitness: "Fitness Devices",
  communication: "Communication",
  analytics: "Analytics",
};

const statusStyles: Record<Integration["status"], { dot: string; label: string }> = {
  connected: { dot: "bg-kruxt-success", label: "Connected" },
  disconnected: { dot: "bg-kruxt-steel", label: "Not Connected" },
  error: { dot: "bg-kruxt-danger", label: "Error" },
};

export default function IntegrationsPage() {
  const [loading] = useState(false);

  if (loading) return <PageSkeleton />;

  const categories = Object.keys(categoryLabels) as Integration["category"][];
  const connectedCount = mockIntegrations.filter((i) => i.status === "connected").length;
  const errorCount = mockIntegrations.filter((i) => i.status === "error").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect third-party services to extend your gym platform."
      />

      {/* Summary */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
          <div className="h-2 w-2 rounded-full bg-kruxt-success" />
          <span className="text-sm text-foreground font-medium">{connectedCount} connected</span>
        </div>
        {errorCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-kruxt-danger/30 bg-kruxt-danger/5 px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-kruxt-danger" />
            <span className="text-sm text-kruxt-danger font-medium">{errorCount} error{errorCount !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Integration cards by category */}
      {categories.map((category) => {
        const items = mockIntegrations.filter((i) => i.category === category);
        if (items.length === 0) return null;

        return (
          <div key={category}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground font-kruxt-headline">
              {categoryLabels[category]}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center gap-4 rounded-card border border-border bg-card p-4 transition-colors hover:bg-kruxt-panel/30"
                >
                  {/* Icon */}
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-kruxt-accent/10 text-kruxt-accent font-bold font-kruxt-headline">
                    {integration.icon}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {integration.name}
                      </p>
                      <div className={`h-1.5 w-1.5 rounded-full ${statusStyles[integration.status].dot}`} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {integration.description}
                    </p>
                    {integration.lastSyncAt && (
                      <p className="mt-1 text-[10px] tabular-nums text-muted-foreground/70 font-kruxt-mono">
                        Last sync: {integration.lastSyncAt}
                      </p>
                    )}
                  </div>

                  {/* Action */}
                  <button
                    className={`flex-shrink-0 rounded-button px-3 py-1.5 text-xs font-semibold transition-colors ${
                      integration.status === "connected"
                        ? "border border-border text-muted-foreground hover:bg-kruxt-panel"
                        : integration.status === "error"
                          ? "bg-kruxt-danger/15 text-kruxt-danger hover:bg-kruxt-danger/25"
                          : "bg-kruxt-accent px-4 text-kruxt-bg hover:opacity-90"
                    }`}
                  >
                    {integration.status === "connected"
                      ? "Configure"
                      : integration.status === "error"
                        ? "Fix"
                        : "Connect"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
