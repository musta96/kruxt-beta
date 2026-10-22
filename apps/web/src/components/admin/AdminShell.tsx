"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";

import { RequiredConsentReview } from "@/components/consent/RequiredConsentReview";
import type { AdminAccessState } from "@/lib/auth/access";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const FOUNDER_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/gyms", label: "Gyms" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/invites", label: "Invites" },
  { href: "/admin/classes", label: "Classes" }
];

const ORG_NAV = [
  { href: "/org", label: "Overview" },
  { href: "/org/users", label: "Users" },
  { href: "/org/invites", label: "Invites" },
  { href: "/org/classes", label: "Classes" }
];

export function AdminShell({
  access,
  scope,
  title,
  subtitle,
  onSignOut,
  children
}: {
  access: AdminAccessState;
  scope: "founder" | "org";
  title: string;
  subtitle?: string;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

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

  if (access.status === "error") {
    return (
      <main className="container">
        <div className="panel" style={{ maxWidth: 760 }}>
          <h1 className="heading">Access check unavailable</h1>
          <p className="subheading">{access.error || "KRUXT could not safely validate this account."}</p>
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
            <button className="btn" onClick={() => void onSignOut()}>Sign out</button>
          </div>
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

  if (access.status === "activation_required" || access.status === "disabled") {
    return (
      <main className="container">
        <div className="panel" style={{ maxWidth: 760 }}>
          <h1 className="heading">
            {access.status === "activation_required" ? "Account activation required" : "Account disabled"}
          </h1>
          <p className="subheading">
            {access.status === "activation_required"
              ? "Complete the verified invite activation flow before opening this workspace."
              : "This account cannot open KRUXT workspaces."}
          </p>
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {access.status === "activation_required" ? (
              <button className="btn btn-primary" onClick={() => router.push("/activate-invite")}>
                Complete activation
              </button>
            ) : null}
            <button className="btn" onClick={() => void onSignOut()}>Sign out</button>
          </div>
        </div>
      </main>
    );
  }

  if (access.status === "consent_required") {
    return (
      <RequiredConsentReview
        client={supabase}
        userId={access.user.id}
        onComplete={() => router.replace("/")}
        onSignOut={() => void onSignOut()}
        variant="standalone"
      />
    );
  }

  const isPlatformOperator = Boolean(access.platformRole);
  const hasGymAccess = access.staffGymIds.length > 0;
  const nav = scope === "founder" ? FOUNDER_NAV : ORG_NAV;

  if (scope === "founder" && !isPlatformOperator) {
    return (
      <main className="container">
        <div className="panel" style={{ maxWidth: 760 }}>
          <h1 className="heading">Platform access required</h1>
          <p className="subheading">This area is reserved for KRUXT platform operators.</p>
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {hasGymAccess && (
              <button className="btn btn-primary" onClick={() => router.push("/org")}>
                Open organization workspace
              </button>
            )}
            <button className="btn" onClick={() => router.push("/")}>Back to sign in</button>
          </div>
        </div>
      </main>
    );
  }

  if (scope === "org" && !isPlatformOperator && !hasGymAccess) {
    return (
      <main className="container">
        <div className="panel" style={{ maxWidth: 760 }}>
          <h1 className="heading">Organization access required</h1>
          <p className="subheading">This account has no active gym staff memberships yet.</p>
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => router.push("/")}>Back to sign in</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h1 className="heading" style={{ fontSize: "1.5rem" }}>{title}</h1>
            <p className="subheading">{subtitle ?? `Signed in as ${access.user.email}`}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`badge ${isPlatformOperator ? "badge-founder" : "badge-staff"}`}>
              {scope === "founder" ? "Platform Area" : isPlatformOperator ? "Platform" : "Gym Staff"}
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
