"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { cn } from "@/lib/utils";
import { MobileNavigation } from "@/components/navigation-shell";
import { usePlatformAuth } from "@/contexts/platform-auth-context";
import { PlatformAccessRecovery, PlatformLoginLinks } from "@/components/platform-access-recovery";

function FullPageLoader({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center bg-kruxt-bg">
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
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, platformRole, loading: authLoading } = usePlatformAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, router, user]);

  if (authLoading) {
    return <FullPageLoader label="Checking platform access..." />;
  }

  if (!user) {
    return <FullPageLoader label="Redirecting to sign in..." />;
  }

  if (!platformRole) {
    return (
      <div className="platform-login flex min-h-screen items-center justify-center bg-kruxt-bg p-6">
        <div className="w-full max-w-sm space-y-7">
          <PlatformAccessRecovery />
          <PlatformLoginLinks />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-kruxt-bg">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-kruxt-accent focus:p-3 focus:text-kruxt-bg">Skip to content</a>
      <MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Sidebar mobile collapsed={false} onToggle={() => setMobileOpen(false)} />
      </MobileNavigation>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <TopBar
        sidebarCollapsed={sidebarCollapsed}
        mobileOpen={mobileOpen}
        onMenuToggle={() => setMobileOpen(true)}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "min-w-0 min-h-[calc(100vh-4rem)] p-4 sm:p-6 transition-all duration-200",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
        )}
      >
        {children}
      </main>
    </div>
  );
}
