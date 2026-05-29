"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { cn } from "@/lib/utils";
import { usePlatformAuth } from "@/contexts/platform-auth-context";

function FullPageLoader({ label }: { label: string }) {
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
      <div className="flex min-h-screen items-center justify-center bg-kruxt-bg p-6">
        <div className="max-w-md rounded-card border border-border bg-kruxt-surface p-6 text-center">
          <p className="text-sm font-semibold text-foreground">Platform access required</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This account is signed in, but it is not an active KRUXT platform operator.
          </p>
        </div>
      </div>
    );
  }

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
          sidebarCollapsed ? "ml-16" : "ml-64"
        )}
      >
        {children}
      </main>
    </div>
  );
}
