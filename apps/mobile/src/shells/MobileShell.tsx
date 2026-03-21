import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Flame,
  Dumbbell,
  Shield,
  Trophy,
  User,
} from "lucide-react";

const tabs = [
  { to: "/feed", label: "Proof Feed", icon: Flame },
  { to: "/log", label: "Log", icon: Dumbbell },
  { to: "/guild", label: "Guild Hall", icon: Shield },
  { to: "/rank", label: "Rank", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
];

export default function MobileShell() {
  const location = useLocation();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur-md border-t border-border z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {tabs.map((tab) => {
            const isActive = location.pathname.startsWith(tab.to);
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-0"
                aria-label={tab.label}
              >
                <tab.icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={`transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-[10px] font-display font-semibold transition-colors truncate ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 w-8 h-0.5 rounded-full bg-primary" />
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
