"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { GymOnboardingForm } from "@/components/gym-onboarding-form";
import { useAuth } from "@/contexts/auth-context";
import { useGym } from "@/contexts/gym-context";
import { cn } from "@/lib/utils";

function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-kruxt-bg">
      <div className="flex items-center gap-3 text-muted-foreground">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            className="opacity-25"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm">{label ?? "Loading…"}</span>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const { loading: gymLoading, noGymFound } = useGym();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // 1) Auth still resolving
  if (authLoading) {
    return <FullPageLoader label="Checking session…" />;
  }

  // 2) Not authed → redirect (placeholder while replace runs)
  if (!user) {
    return <FullPageLoader label="Redirecting to sign in…" />;
  }

  // 3) Auth'd but gym membership still loading
  if (gymLoading) {
    return <FullPageLoader label="Loading your gym…" />;
  }

  // 4) Auth'd but no gym linked
  if (noGymFound) {
    return <GymOnboardingForm />;
  }

  // 5) All set — render the dashboard
  return (
    <div className="min-h-screen bg-kruxt-bg">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <TopBar
        sidebarCollapsed={sidebarCollapsed}
        onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main
        className={cn(
          "min-h-[calc(100vh-4rem)] p-6 transition-all duration-200",
          sidebarCollapsed ? "ml-16" : "ml-60"
        )}
      >
        {children}
      </main>
    </div>
  );
}
