"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
