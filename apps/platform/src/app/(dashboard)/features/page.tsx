"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface FeatureOverride {
  id: string;
  flag: string;
  description: string;
  globalDefault: boolean;
  overrides: { gym: string; value: boolean }[];
}

const mockFlags: FeatureOverride[] = [
  { id: "ff_01", flag: "proof_feed", description: "Social proof feed with workout photos and videos", globalDefault: true, overrides: [] },
  { id: "ff_02", flag: "guild_hall", description: "Team/guild leaderboard and challenges", globalDefault: true, overrides: [{ gym: "Flex Zone Studio", value: false }] },
  { id: "ff_03", flag: "rank_ladder", description: "XP-based ranking system with tiers", globalDefault: true, overrides: [] },
  { id: "ff_04", flag: "workout_templates", description: "Pre-built workout templates and programs", globalDefault: true, overrides: [] },
  { id: "ff_05", flag: "advanced_analytics", description: "Advanced gym analytics with custom views", globalDefault: false, overrides: [{ gym: "CrossFit Apex", value: true }, { gym: "Peak Performance", value: true }] },
  { id: "ff_06", flag: "automation_playbooks", description: "Automated member engagement workflows", globalDefault: false, overrides: [{ gym: "CrossFit Apex", value: true }] },
  { id: "ff_07", flag: "partner_marketplace", description: "Third-party app marketplace for gyms", globalDefault: false, overrides: [] },
  { id: "ff_08", flag: "data_export", description: "Member data export and partner sharing", globalDefault: true, overrides: [{ gym: "Rebel Fitness Co.", value: false }] },
  { id: "ff_09", flag: "waivers_v2", description: "Digital waivers with e-signature (v2)", globalDefault: true, overrides: [] },
  { id: "ff_10", flag: "billing_retry", description: "Automated billing retry and dunning", globalDefault: true, overrides: [] },
  { id: "ff_11", flag: "multi_location", description: "Multi-location gym management", globalDefault: false, overrides: [] },
  { id: "ff_12", flag: "api_access", description: "Public API access for gym integrations", globalDefault: false, overrides: [{ gym: "Peak Performance", value: true }] },
  { id: "ff_13", flag: "custom_branding", description: "White-label branding for gym apps", globalDefault: false, overrides: [] },
  { id: "ff_14", flag: "member_challenges", description: "Time-limited fitness challenges", globalDefault: true, overrides: [] },
];

export default function FeaturesPage() {
  const [search, setSearch] = useState("");
  const [showOverridesOnly, setShowOverridesOnly] = useState(false);

  const filtered = mockFlags.filter((f) => {
    if (search && !f.flag.includes(search.toLowerCase()) && !f.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (showOverridesOnly && f.overrides.length === 0) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-kruxt-headline">Feature Overrides</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control feature flag rollout globally and per-gym. {mockFlags.length} flags defined.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-kruxt-surface px-3 py-1.5">
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flags..."
            className="w-48 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowOverridesOnly(!showOverridesOnly)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            showOverridesOnly
              ? "border-kruxt-platform/40 bg-kruxt-platform/10 text-kruxt-platform"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          Overrides only ({mockFlags.filter((f) => f.overrides.length > 0).length})
        </button>
      </div>

      {/* Flag list */}
      <div className="space-y-3">
        {filtered.map((flag) => (
          <div key={flag.id} className="rounded-card border border-border bg-kruxt-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <code className="rounded-md bg-kruxt-panel px-2 py-1 text-xs font-kruxt-mono text-kruxt-accent">
                  {flag.flag}
                </code>
                <p className="text-sm text-foreground">{flag.description}</p>
              </div>
              <div className="flex items-center gap-3">
                {flag.overrides.length > 0 && (
                  <span className="rounded-badge bg-kruxt-platform/20 px-2 py-0.5 text-[10px] font-bold text-kruxt-platform">
                    {flag.overrides.length} override{flag.overrides.length > 1 ? "s" : ""}
                  </span>
                )}
                <div
                  className={cn(
                    "flex h-6 w-11 items-center rounded-full px-0.5 transition-colors cursor-pointer",
                    flag.globalDefault ? "bg-kruxt-success" : "bg-kruxt-panel"
                  )}
                >
                  <div
                    className={cn(
                      "h-5 w-5 rounded-full bg-white transition-transform shadow-sm",
                      flag.globalDefault ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </div>
              </div>
            </div>

            {flag.overrides.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {flag.overrides.map((o) => (
                  <span
                    key={o.gym}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-badge border px-2 py-0.5 text-[11px]",
                      o.value
                        ? "border-kruxt-success/30 bg-kruxt-success/10 text-kruxt-success"
                        : "border-kruxt-danger/30 bg-kruxt-danger/10 text-kruxt-danger"
                    )}
                  >
                    {o.gym}: {o.value ? "ON" : "OFF"}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
