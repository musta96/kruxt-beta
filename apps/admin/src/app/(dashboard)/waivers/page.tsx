"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { PageSkeleton } from "@/components/loading-skeleton";

interface WaiverRecord {
  id: string;
  memberName: string;
  memberEmail: string;
  waiverType: string;
  status: "signed" | "pending" | "expired" | "revoked";
  signedAt: string | null;
  expiresAt: string | null;
}

interface WaiverTemplate {
  id: string;
  name: string;
  version: string;
  lastUpdated: string;
  signedCount: number;
}

const mockTemplates: WaiverTemplate[] = [
  { id: "t1", name: "Liability Waiver", version: "v2.3", lastUpdated: "2026-02-15", signedCount: 312 },
  { id: "t2", name: "Health Questionnaire", version: "v1.8", lastUpdated: "2026-01-20", signedCount: 298 },
  { id: "t3", name: "Photo Release", version: "v1.0", lastUpdated: "2025-11-10", signedCount: 245 },
  { id: "t4", name: "Auto-Renewal Agreement", version: "v3.1", lastUpdated: "2026-03-01", signedCount: 189 },
];

const mockWaivers: WaiverRecord[] = [
  { id: "w1", memberName: "Sarah Chen", memberEmail: "sarah.chen@email.com", waiverType: "Liability Waiver", status: "pending", signedAt: null, expiresAt: null },
  { id: "w2", memberName: "Elena Park", memberEmail: "elena.park@email.com", waiverType: "Health Questionnaire", status: "signed", signedAt: "2026-03-17", expiresAt: "2027-03-17" },
  { id: "w3", memberName: "Marcus Rivera", memberEmail: "marcus@email.com", waiverType: "Liability Waiver", status: "signed", signedAt: "2025-09-15", expiresAt: "2026-09-15" },
  { id: "w4", memberName: "Tom Reeves", memberEmail: "tom.r@email.com", waiverType: "Photo Release", status: "expired", signedAt: "2025-03-01", expiresAt: "2026-03-01" },
  { id: "w5", memberName: "Sarah Chen", memberEmail: "sarah.chen@email.com", waiverType: "Health Questionnaire", status: "pending", signedAt: null, expiresAt: null },
  { id: "w6", memberName: "Jake Thompson", memberEmail: "jake.t@email.com", waiverType: "Auto-Renewal Agreement", status: "signed", signedAt: "2026-03-05", expiresAt: null },
  { id: "w7", memberName: "Ryan Okafor", memberEmail: "ryan.o@email.com", waiverType: "Liability Waiver", status: "revoked", signedAt: "2025-10-20", expiresAt: null },
  { id: "w8", memberName: "Mia Zhang", memberEmail: "mia.z@email.com", waiverType: "Liability Waiver", status: "signed", signedAt: "2026-01-05", expiresAt: "2027-01-05" },
];

const columns: Column<WaiverRecord>[] = [
  {
    key: "member",
    header: "Member",
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.memberName}</p>
        <p className="text-xs text-muted-foreground">{row.memberEmail}</p>
      </div>
    ),
  },
  {
    key: "waiverType",
    header: "Waiver Type",
    render: (row) => (
      <span className="text-sm text-muted-foreground">{row.waiverType}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <StatusBadge label={row.status} variant={statusToVariant(row.status)} dot />
    ),
  },
  {
    key: "signedAt",
    header: "Signed Date",
    sortable: true,
    render: (row) =>
      row.signedAt ? (
        <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
          {row.signedAt}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">--</span>
      ),
  },
  {
    key: "expiresAt",
    header: "Expires",
    render: (row) =>
      row.expiresAt ? (
        <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
          {row.expiresAt}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">N/A</span>
      ),
  },
];

export default function WaiversPage() {
  const [loading] = useState(false);

  if (loading) {
    return <PageSkeleton />;
  }

  const pendingCount = mockWaivers.filter((w) => w.status === "pending").length;
  const signedCount = mockWaivers.filter((w) => w.status === "signed").length;
  const expiredCount = mockWaivers.filter((w) => w.status === "expired").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waivers & Contracts"
        description="Manage waiver templates, signatures, and compliance documentation."
        actions={
          <button className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90">
            New Template
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pending Signatures" value={pendingCount} accent="warning" />
        <StatCard label="Active Signed" value={signedCount} accent="success" />
        <StatCard label="Expired" value={expiredCount} accent="danger" />
      </div>

      {/* Templates */}
      <div className="rounded-card border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-kruxt-headline">
            Waiver Templates
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {mockTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-lg border border-border bg-kruxt-panel p-4 transition-colors hover:border-kruxt-accent/30"
            >
              <p className="text-sm font-medium text-foreground">{tpl.name}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge label={tpl.version} variant="default" />
                <span className="text-xs text-muted-foreground">
                  {tpl.signedCount} signed
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Updated {tpl.lastUpdated}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Waiver records */}
      <DataTable
        columns={columns}
        data={mockWaivers}
        keyExtractor={(row) => row.id}
        searchable
        searchPlaceholder="Search waivers..."
      />
    </div>
  );
}
