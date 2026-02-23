import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ScanLine,
  FileCheck,
  CreditCard,
  Plug,
  ShieldCheck,
  HelpCircle,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

const navGroups = [
  {
    label: "Operations",
    items: [
      { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
      { to: "/admin/members", label: "Members", icon: Users },
      { to: "/admin/classes", label: "Classes", icon: CalendarDays },
      { to: "/admin/checkins", label: "Check-ins", icon: ScanLine },
    ],
  },
  {
    label: "Business",
    items: [
      { to: "/admin/waivers", label: "Waivers", icon: FileCheck },
      { to: "/admin/billing", label: "Billing", icon: CreditCard },
      { to: "/admin/integrations", label: "Integrations", icon: Plug },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/compliance", label: "Compliance", icon: ShieldCheck },
      { to: "/admin/support", label: "Support", icon: HelpCircle },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function AdminShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-4 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-display font-black text-primary-foreground">K</span>
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-foreground text-lg tracking-tight">
              KRUXT
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <div className="px-4 mb-2 text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-widest">
                  {group.label}
                </div>
              )}
              <ul className="flex flex-col gap-0.5 px-2">
                {group.items.map((item) => {
                  const isActive = item.end
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                        }`}
                        title={item.label}
                      >
                        <item.icon size={18} className="flex-shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-12 border-t border-sidebar-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
