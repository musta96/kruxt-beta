"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface DataRelease {
  id: string;
  gym: string;
  partner: string;
  dataType: string;
  recordCount: number;
  status: "pending_approval" | "approved" | "released" | "denied" | "expired";
  requestedAt: string;
  anonymized: boolean;
}

const mockReleases: DataRelease[] = [
  { id: "dr_01", gym: "CrossFit Apex", partner: "FitMetrics Analytics", dataType: "Aggregated workout stats", recordCount: 45000, status: "pending_approval", requestedAt: "2026-03-20T14:00:00Z", anonymized: true },
  { id: "dr_02", gym: "Peak Performance", partner: "GymInsure Co.", dataType: "Waiver completion rates", recordCount: 1200, status: "pending_approval", requestedAt: "2026-03-19T10:30:00Z", anonymized: true },
  { id: "dr_03", gym: "Iron Temple Fitness", partner: "EquipTrack", dataType: "Equipment usage patterns", recordCount: 8500, status: "approved", requestedAt: "2026-03-15T09:00:00Z", anonymized: true },
  { id: "dr_04", gym: "Urban Fit Lab", partner: "HealthSync", dataType: "Member activity summaries", recordCount: 23000, status: "released", requestedAt: "2026-03-10T11:00:00Z", anonymized: true },
  { id: "dr_05", gym: "Summit Training Co.", partner: "FitMetrics Analytics", dataType: "Class attendance patterns", recordCount: 5600, status: "denied", requestedAt: "2026-03-08T16:00:00Z", anonymized: false },
];

const statusStyles = {
  pending_approval: "bg-kruxt-warning/20 text-kruxt-warning",
  approved: "bg-kruxt-accent/20 text-kruxt-accent",
  released: "bg-kruxt-success/20 text-kruxt-success",
  denied: "bg-kruxt-danger/20 text-kruxt-danger",
  expired: "bg-muted text-muted-foreground",
};

const statusLabels = {
  pending_approval: "Pending",
  approved: "Approved",
  released: "Released",
  denied: "Denied",
  expired: "Expired",
};

export default function DataGovernancePage() {
  const [tab, setTab] = useState<"releases" | "partners" | "audit">("releases");

  const pending = mockReleases.filter((r) => r.status === "pending_approval");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-kruxt-headline">Data Governance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Data release approvals, partner access grants, and privacy compliance audit trail.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-kruxt-warning/30 bg-kruxt-warning/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-kruxt-warning">Pending Releases</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-kruxt-warning">{pending.length}</p>
        </div>
        <div className="rounded-card border border-border bg-kruxt-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Data Partners</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-foreground">4</p>
        </div>
        <div className="rounded-card border border-border bg-kruxt-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Records Shared (30d)</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-foreground">31.5K</p>
        </div>
        <div className="rounded-card border border-kruxt-success/30 bg-kruxt-success/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-kruxt-success">Anonymization Rate</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-kruxt-success">100%</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-kruxt-surface p-1 w-fit">
        {([
          { key: "releases", label: "Data Releases" },
          { key: "partners", label: "Partners" },
          { key: "audit", label: "Audit Log" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-kruxt-platform/20 text-kruxt-platform"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "releases" && (
        <div className="rounded-card border border-border bg-kruxt-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gym</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Partner</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data Type</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Records</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Anonymized</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {mockReleases.map((release) => (
                <tr key={release.id} className="border-b border-border/50 last:border-0 hover:bg-kruxt-panel/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{release.gym}</td>
                  <td className="px-4 py-3 text-muted-foreground">{release.partner}</td>
                  <td className="px-4 py-3 text-foreground">{release.dataType}</td>
                  <td className="px-4 py-3 text-right font-kruxt-mono text-foreground">{release.recordCount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {release.anonymized ? (
                      <span className="text-kruxt-success text-xs font-medium">Yes</span>
                    ) : (
                      <span className="text-kruxt-danger text-xs font-medium">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex rounded-badge px-2 py-0.5 text-[10px] font-bold uppercase", statusStyles[release.status])}>
                      {statusLabels[release.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {release.status === "pending_approval" && (
                      <div className="flex gap-1">
                        <button className="rounded-md px-2 py-1 text-xs text-kruxt-success hover:bg-kruxt-success/10 transition-colors">Approve</button>
                        <button className="rounded-md px-2 py-1 text-xs text-kruxt-danger hover:bg-kruxt-danger/10 transition-colors">Deny</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "partners" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {["FitMetrics Analytics", "GymInsure Co.", "EquipTrack", "HealthSync"].map((partner) => (
            <div key={partner} className="rounded-card border border-border bg-kruxt-surface p-5">
              <h3 className="font-medium text-foreground">{partner}</h3>
              <p className="mt-1 text-xs text-muted-foreground">Active data partnership</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span>Access: <span className="text-kruxt-success">Granted</span></span>
                <span>Exports: {Math.floor(Math.random() * 5) + 1}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "audit" && (
        <div className="rounded-card border border-border bg-kruxt-surface p-5">
          <p className="text-sm text-muted-foreground">
            Audit log shows all data governance actions. Coming soon with full Supabase integration.
          </p>
        </div>
      )}
    </div>
  );
}
