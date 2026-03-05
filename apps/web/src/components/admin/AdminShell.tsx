"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import type { AdminAccessState } from "@/lib/auth/access";

const FOUNDER_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/gyms", label: "Gyms" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/invites", label: "Invites" },
  { href: "/admin/classes", label: "Classes" }
];

const ORG_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/invites", label: "Invites" },
  { href: "/admin/classes", label: "Classes" }
];

export function AdminShell({
  access,
  title,
  subtitle,
  onSignOut,
  children
}: {
  access: AdminAccessState;
  title: string;
  subtitle?: string;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  if (access.status === "loading") {
    return (
      <main className="container">
        <div className="panel">
          <h1 className="heading">Admin Console</h1>
          <p className="subheading">Checking access...</p>
        </div>
      </main>
    );
  }

  if (!access.isAuthenticated || !access.user) {
    return (
      <main className="container">
        <div className="panel" style={{ maxWidth: 760 }}>
          <h1 className="heading">Sign-in required</h1>
          <p className="subheading">You must authenticate before opening the admin console.</p>
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => router.push("/")}>Go to sign in</button>
          </div>
        </div>
      </main>
    );
  }

  const isFounder = access.platformRole === "founder";
  const nav = isFounder ? FOUNDER_NAV : ORG_NAV;

  return (
    <main className="container">
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h1 className="heading" style={{ fontSize: "1.5rem" }}>{title}</h1>
            <p className="subheading">{subtitle ?? `Signed in as ${access.user.email}`}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`badge ${isFounder ? "badge-founder" : "badge-staff"}`}>
              {isFounder ? "Founder" : access.platformRole ?? "Staff"}
            </span>
            <button className="btn btn-danger" onClick={() => void onSignOut()}>Sign out</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`btn ${pathname === item.href ? "btn-primary" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {children}
    </main>
  );
}
