"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface SettingSection {
  id: string;
  title: string;
  description: string;
  fields: { label: string; value: string; type: "text" | "toggle" | "select" }[];
}

const sections: SettingSection[] = [
  {
    id: "platform",
    title: "Platform Identity",
    description: "Core platform configuration and branding.",
    fields: [
      { label: "Platform Name", value: "KRUXT", type: "text" },
      { label: "Support Email", value: "support@kruxt.io", type: "text" },
      { label: "Platform URL", value: "https://platform.kruxt.io", type: "text" },
    ],
  },
  {
    id: "security",
    title: "Security & Authentication",
    description: "Auth policies, session management, and MFA enforcement.",
    fields: [
      { label: "Enforce MFA for Operators", value: "Enabled", type: "toggle" },
      { label: "Session Timeout", value: "4 hours", type: "select" },
      { label: "IP Allowlist", value: "Disabled", type: "toggle" },
      { label: "Max Support Session Duration", value: "72 hours", type: "select" },
    ],
  },
  {
    id: "billing",
    title: "Billing & Plans",
    description: "Default pricing, trial settings, and billing behavior.",
    fields: [
      { label: "Default Trial Length", value: "14 days", type: "select" },
      { label: "Auto-suspend on Failed Payment", value: "After 3 retries", type: "select" },
      { label: "Grace Period", value: "7 days", type: "select" },
      { label: "Revenue Share (Partner)", value: "20%", type: "text" },
    ],
  },
  {
    id: "data",
    title: "Data & Privacy",
    description: "Data retention, anonymization, and compliance settings.",
    fields: [
      { label: "Data Retention Period", value: "36 months", type: "select" },
      { label: "Auto-anonymize Churned Members", value: "Enabled", type: "toggle" },
      { label: "Require Approval for Data Exports", value: "Enabled", type: "toggle" },
      { label: "GDPR Compliance Mode", value: "Enabled", type: "toggle" },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Platform alert routing and escalation policies.",
    fields: [
      { label: "Critical Alerts Channel", value: "Slack #kruxt-alerts", type: "text" },
      { label: "Daily Digest Email", value: "Enabled", type: "toggle" },
      { label: "Escalation Timeout", value: "30 minutes", type: "select" },
    ],
  },
];

export default function SettingsPage() {
  const [expandedId, setExpandedId] = useState<string | null>("platform");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-kruxt-headline">Platform Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Global platform configuration. Changes here affect all gym tenants.
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const expanded = expandedId === section.id;
          return (
            <div key={section.id} className="rounded-card border border-border bg-kruxt-surface overflow-hidden">
              <button
                onClick={() => setExpandedId(expanded ? null : section.id)}
                className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-kruxt-panel/30"
              >
                <div>
                  <h3 className="font-medium text-foreground">{section.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
                </div>
                <svg
                  className={cn("h-5 w-5 text-muted-foreground transition-transform", expanded && "rotate-180")}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {expanded && (
                <div className="border-t border-border px-5 py-4 space-y-4">
                  {section.fields.map((field) => (
                    <div key={field.label} className="flex items-center justify-between">
                      <label className="text-sm text-foreground">{field.label}</label>
                      {field.type === "toggle" ? (
                        <div
                          className={cn(
                            "flex h-6 w-11 items-center rounded-full px-0.5 transition-colors cursor-pointer",
                            field.value === "Enabled" ? "bg-kruxt-success" : "bg-kruxt-panel"
                          )}
                        >
                          <div
                            className={cn(
                              "h-5 w-5 rounded-full bg-white transition-transform shadow-sm",
                              field.value === "Enabled" ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </div>
                      ) : (
                        <span className="rounded-md border border-border bg-kruxt-panel px-3 py-1.5 text-sm text-foreground">
                          {field.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Danger zone */}
      <div className="rounded-card border border-kruxt-danger/30 bg-kruxt-danger/5 p-5">
        <h3 className="font-medium text-kruxt-danger">Danger Zone</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Irreversible actions that affect all tenants.
        </p>
        <div className="mt-4 flex gap-3">
          <button className="rounded-button border border-kruxt-danger/30 px-4 py-2 text-sm font-medium text-kruxt-danger transition-colors hover:bg-kruxt-danger/10">
            Force Maintenance Mode
          </button>
          <button className="rounded-button border border-kruxt-danger/30 px-4 py-2 text-sm font-medium text-kruxt-danger transition-colors hover:bg-kruxt-danger/10">
            Purge Expired Data
          </button>
        </div>
      </div>
    </div>
  );
}
