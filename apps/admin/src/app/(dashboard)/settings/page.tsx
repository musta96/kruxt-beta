"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/loading-skeleton";

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: JSX.Element;
}

const sections: SettingsSection[] = [
  {
    id: "gym",
    title: "Gym Profile",
    description: "Name, logo, address, operating hours, and contact info.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    id: "staff",
    title: "Staff & Roles",
    description: "Manage admin accounts, coaches, and permission levels.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    id: "membership",
    title: "Membership Plans",
    description: "Configure plan tiers, pricing, trial periods, and billing cycles.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Email templates, push notification settings, and alert rules.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
  },
  {
    id: "branding",
    title: "Branding & Theme",
    description: "Customize colors, logo, and the member-facing app experience.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
  },
  {
    id: "security",
    title: "Security",
    description: "Two-factor enforcement, session timeout, and API key management.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
];

export default function SettingsPage() {
  const [loading] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure your gym platform."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
            className={`w-full text-left rounded-card border p-5 transition-all ${
              activeSection === section.id
                ? "border-kruxt-accent/40 bg-kruxt-accent/5"
                : "border-border bg-card hover:bg-kruxt-panel/30"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
                activeSection === section.id
                  ? "bg-kruxt-accent/15 text-kruxt-accent"
                  : "bg-kruxt-panel text-muted-foreground"
              }`}>
                {section.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {section.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {section.description}
                </p>
              </div>
              <svg
                className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${
                  activeSection === section.id ? "rotate-90" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>

            {/* Expanded placeholder */}
            {activeSection === section.id && (
              <div className="mt-4 rounded-lg border border-border bg-kruxt-panel/30 p-4">
                <p className="text-xs text-muted-foreground">
                  Configuration panel for <span className="font-medium text-foreground">{section.title}</span> will be available once the admin backend services are connected.
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="inline-flex items-center rounded-full bg-kruxt-accent/10 px-2 py-0.5 text-[10px] font-medium text-kruxt-accent">
                    Coming Soon
                  </span>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Danger zone */}
      <div className="rounded-card border border-kruxt-danger/30 bg-kruxt-danger/5 p-5">
        <h3 className="text-sm font-semibold text-kruxt-danger font-kruxt-headline">
          Danger Zone
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Irreversible actions. Proceed with extreme caution.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="rounded-button border border-kruxt-danger/40 px-3 py-1.5 text-xs font-medium text-kruxt-danger transition-colors hover:bg-kruxt-danger/10">
            Reset All Member Data
          </button>
          <button className="rounded-button border border-kruxt-danger/40 px-3 py-1.5 text-xs font-medium text-kruxt-danger transition-colors hover:bg-kruxt-danger/10">
            Delete Gym Account
          </button>
        </div>
      </div>
    </div>
  );
}
