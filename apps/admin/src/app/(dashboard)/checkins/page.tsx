"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/loading-skeleton";

interface CheckinEntry {
  id: string;
  memberName: string;
  memberEmail: string;
  method: "nfc" | "qr" | "manual" | "kiosk";
  timestamp: string;
  className: string | null;
}

const mockCheckins: CheckinEntry[] = [
  { id: "1", memberName: "Mia Zhang", memberEmail: "mia.z@email.com", method: "nfc", timestamp: "10:15 AM", className: "Strength Foundations" },
  { id: "2", memberName: "Luna Martinez", memberEmail: "luna.m@email.com", method: "manual", timestamp: "09:02 AM", className: null },
  { id: "3", memberName: "Marcus Rivera", memberEmail: "marcus@email.com", method: "nfc", timestamp: "08:30 AM", className: "HIIT Blast" },
  { id: "4", memberName: "Jake Thompson", memberEmail: "jake.t@email.com", method: "qr", timestamp: "07:15 AM", className: null },
  { id: "5", memberName: "David Kim", memberEmail: "david.kim@email.com", method: "kiosk", timestamp: "06:00 AM", className: "HIIT Blast" },
  { id: "6", memberName: "Aisha Johnson", memberEmail: "aisha.j@email.com", method: "nfc", timestamp: "06:02 AM", className: "HIIT Blast" },
  { id: "7", memberName: "Elena Park", memberEmail: "elena.park@email.com", method: "qr", timestamp: "05:55 AM", className: null },
];

const methodBadge: Record<CheckinEntry["method"], { label: string; variant: "default" | "success" | "info" | "warning" }> = {
  nfc: { label: "NFC", variant: "default" },
  qr: { label: "QR", variant: "info" },
  manual: { label: "Manual", variant: "warning" },
  kiosk: { label: "Kiosk", variant: "success" },
};

export default function CheckinsPage() {
  const [loading] = useState(false);
  const [search, setSearch] = useState("");

  if (loading) {
    return <PageSkeleton />;
  }

  const filtered = mockCheckins.filter(
    (c) =>
      !search ||
      c.memberName.toLowerCase().includes(search.toLowerCase()) ||
      c.memberEmail.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-ins"
        description="Live check-in feed and today's attendance."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Today's Check-ins"
          value={47}
          trend={{ value: "+8%", positive: true }}
          subtext="vs yesterday"
          accent="success"
        />
        <StatCard
          label="Peak Hour"
          value="6-7 AM"
          subtext="14 check-ins"
        />
        <StatCard
          label="Avg Daily"
          value={42}
          subtext="last 30 days"
        />
      </div>

      {/* Live feed */}
      <div className="rounded-card border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-kruxt-headline">
              Live Feed
            </h2>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kruxt-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-kruxt-success" />
              </span>
              <span className="text-xs text-kruxt-success">Live</span>
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-kruxt-panel px-3 py-1.5">
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search by member..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              title="No check-ins found"
              description="No check-ins match your search criteria."
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((checkin) => {
              const badge = methodBadge[checkin.method];
              return (
                <div
                  key={checkin.id}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-kruxt-panel/30"
                >
                  {/* Avatar */}
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-kruxt-accent/15 text-xs font-bold text-kruxt-accent">
                    {checkin.memberName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {checkin.memberName}
                      </p>
                      <StatusBadge label={badge.label} variant={badge.variant} />
                    </div>
                    {checkin.className && (
                      <p className="text-xs text-muted-foreground">
                        Class: {checkin.className}
                      </p>
                    )}
                  </div>

                  {/* Time */}
                  <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
                    {checkin.timestamp}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
