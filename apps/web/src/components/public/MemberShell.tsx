"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { resolvePostAuthPath, usePublicSession } from "@/components/public/usePublicSession";

const MEMBER_NAV = [
  { href: "/feed", label: "Feed" },
  { href: "/log", label: "Log" },
  { href: "/guild", label: "Guild" },
  { href: "/rank", label: "Rank" },
  { href: "/profile", label: "Profile" }
];

export function MemberShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, signOut, displayLabel } = usePublicSession();

  if (state.status === "loading") {
    return (
      <main className="app-shell">
        <div className="mobile-frame">
          <section className="glass-panel">
            <p className="eyebrow">KRUXT</p>
            <h1 className="mobile-title">Loading your space</h1>
            <p className="mobile-copy">Checking session and account access.</p>
          </section>
        </div>
      </main>
    );
  }

  if (!state.user || !state.access?.isAuthenticated) {
    return (
      <main className="app-shell">
        <div className="mobile-frame">
          <section className="glass-panel">
            <p className="eyebrow">KRUXT</p>
            <h1 className="mobile-title">Sign in required</h1>
            <p className="mobile-copy">This member space is available only after authentication.</p>
            <div className="stack-actions">
              <button className="primary-cta" onClick={() => router.push("/")}>
                Go to sign in
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const adminPath = resolvePostAuthPath(state.access);
  const hasBackofficeAccess = adminPath === "/admin" || adminPath === "/org";

  return (
    <main className="app-shell">
      <div className="mobile-frame">
        <header className="mobile-topbar">
          <div>
            <p className="eyebrow">KRUXT MEMBER</p>
            <h1 className="mobile-title">{title}</h1>
            <p className="mobile-copy">{subtitle}</p>
          </div>
          <div className="mobile-topbar-actions">
            <span className="identity-chip">{displayLabel}</span>
            {hasBackofficeAccess && (
              <Link href={adminPath} className="ghost-chip">
                {adminPath === "/admin" ? "Founder" : "Org"}
              </Link>
            )}
            <button
              className="ghost-chip"
              onClick={() => {
                void signOut().then(() => router.push("/"));
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="mobile-content">{children}</section>

        <nav className="mobile-nav" aria-label="Primary">
          {MEMBER_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-nav-link ${pathname === item.href ? "is-active" : ""}`}
            >
              <span className="mobile-nav-dot" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
