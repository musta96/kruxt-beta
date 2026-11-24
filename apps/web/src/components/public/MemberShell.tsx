"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Rss, Dumbbell, Building2, UserRound, LogOut, Library, UsersRound, Trophy, Plug, ShieldCheck, CircleHelp, ChevronDown, ArrowUpRight } from "lucide-react";

import { RequiredConsentReview } from "@/components/consent/RequiredConsentReview";
import { resolveBackoffice, usePublicSession } from "@/components/public/usePublicSession";
import { canManagePrivacy } from "@/lib/auth/privacy-access";
import { MemberAccessFrame } from "@/components/public/MemberAccessFrame";
import { memberSignInPath } from "@/lib/auth/member-return";

const MEMBER_NAV = [
  { href: "/plan", label: "Plan", icon: CalendarDays, routes: ["/plan", "/library"] },
  { href: "/feed", label: "Feed", icon: Rss, routes: ["/feed", "/guild", "/rank"] },
  { href: "/log", label: "Log", icon: Dumbbell, routes: ["/log"] },
  { href: "/gyms", label: "Gyms", icon: Building2, routes: ["/gyms", "/join"] },
  { href: "/profile", label: "Profile", icon: UserRound, routes: ["/profile", "/privacy", "/support", "/integrations"] }
];
const MORE_NAV = [
  { href: "/library", label: "Session library", icon: Library }, { href: "/guild", label: "My community", icon: UsersRound },
  { href: "/rank", label: "Challenges & progress", icon: Trophy }, { href: "/integrations", label: "Connections", icon: Plug },
  { href: "/privacy", label: "Privacy", icon: ShieldCheck }, { href: "/support", label: "Help", icon: CircleHelp }
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
  const { supabase, state, signOut, refresh, displayLabel } = usePublicSession();

  const handleConsentSignOut = () => {
    void signOut().then(() => router.push("/"));
  };
  const goToSignIn = () => router.push(memberSignInPath(window.location.pathname + window.location.search));

  if (state.status === "loading") {
    return (
      <MemberAccessFrame loading>
            <h1 className="mobile-title">Loading your space</h1>
            <p className="mobile-copy">Checking session and account access.</p>
      </MemberAccessFrame>
    );
  }

  if (state.error || state.status === "error") {
    return (
      <MemberAccessFrame>
        <h1 className="mobile-title">Account setup unavailable</h1>
        <p className="mobile-copy">We couldn't check your account access. Try again, or sign in again.</p>
        <div className="stack-actions">
          <button className="primary-cta" onClick={() => void refresh()}>Retry</button>
          {state.user ? <button className="secondary-cta" onClick={handleConsentSignOut}>Sign out</button>
            : <button className="secondary-cta" onClick={goToSignIn}>Go to sign in</button>}
        </div>
      </MemberAccessFrame>
    );
  }

  if (!state.user || !state.access?.isAuthenticated) {
    return (
      <MemberAccessFrame>
            <h1 className="mobile-title">Sign in required</h1>
            <p className="mobile-copy">Sign in to continue to your member workspace.</p>
            <div className="stack-actions">
              <button className="primary-cta" onClick={goToSignIn}>
                Go to sign in
              </button>
            </div>
      </MemberAccessFrame>
    );
  }

  if (state.access.activationStatus === "pending_activation" || state.access.activationStatus === "disabled") {
    return (
      <MemberAccessFrame>
            <h1 className="mobile-title">
              {state.access.activationStatus === "disabled" ? "Profile disabled" : "Activation required"}
            </h1>
            <p className="mobile-copy">
              {state.access.activationStatus === "disabled"
                ? "This profile cannot access the app. Ask the gym or KRUXT team to send a new invite."
                : "Set your password from the activation screen before using the member app."}
            </p>
            <div className="stack-actions">
              {state.access.activationStatus === "pending_activation" && (
                <button className="primary-cta" onClick={() => router.push("/activate-invite")}>
                  Complete activation
                </button>
              )}
              <button
                className="secondary-cta"
                onClick={() => {
                  void signOut().then(() => router.push("/"));
                }}
              >
                Sign out
              </button>
            </div>
      </MemberAccessFrame>
    );
  }

  if (state.status === "consent_required" && pathname === "/privacy" && canManagePrivacy(state)) {
    return (
      <main className="app-shell member-workspace member-privacy-only">
        <a className="member-skip" href="#member-content">Skip to content</a>
        <div className="mobile-frame member-privacy-frame">
          <header className="mobile-topbar">
            <div>
              <Link href="/plan" className="member-brand" aria-label="KRUXT policy review">KRUXT</Link>
              <h1 className="mobile-title">{title}</h1>
              <p className="mobile-copy">{subtitle}</p>
            </div>
            <button type="button" className="member-icon-button" aria-label="Sign out" title="Sign out" onClick={handleConsentSignOut}><LogOut size={18} aria-hidden="true" /></button>
          </header>
          <p className="member-privacy-notice">Policy review is still pending. You can submit and track your data requests here without accepting policies.</p>
          <Link href="/plan" className="member-privacy-return">Return to policy review</Link>
          <section id="member-content" tabIndex={-1} className="mobile-content">{children}</section>
        </div>
      </main>
    );
  }

  if (state.status === "consent_required") {
    return (
      <RequiredConsentReview
        client={supabase}
        userId={state.user.id}
        onComplete={refresh}
        onSignOut={handleConsentSignOut}
        variant="standalone"
      />
    );
  }

  const backoffice = resolveBackoffice(state.access);

  return (
    <main className="app-shell member-workspace">
      <a className="member-skip" href="#member-content">Skip to content</a>
      <div className="member-layout">
        <aside className="member-rail">
          <Link href="/plan" className="member-brand member-rail-brand" aria-label="KRUXT member home">KRUXT</Link>
          <nav className="mobile-nav" aria-label="Primary">
            {MEMBER_NAV.map((item) => {
              const active = item.routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
              return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`mobile-nav-link ${active ? "is-active" : ""}`}>
                <item.icon size={20} aria-hidden="true" /><span>{item.label}</span>
              </Link>;
            })}
          </nav>
          <nav className="member-secondary-nav" aria-label="Member tools">
            {MORE_NAV.map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}><item.icon size={18} aria-hidden="true" /><span>{item.label}</span></Link>)}
          </nav>
          <div className="member-account">
            {backoffice && <a href={backoffice.url} className="member-workspace-switch">{backoffice.label} <ArrowUpRight size={16} aria-hidden="true" /></a>}
            <div className="member-account-row">
              <Link href="/profile" className="member-account-profile"><UserRound size={20} aria-hidden="true" /><span title={displayLabel}>{displayLabel}</span></Link>
              <button type="button" className="member-icon-button" aria-label="Sign out" title="Sign out" onClick={handleConsentSignOut}><LogOut size={18} aria-hidden="true" /></button>
            </div>
          </div>
        </aside>
        <div className="mobile-frame member-main">
        <header className="mobile-topbar">
          <div>
            <Link href="/plan" className="member-brand member-mobile-brand" aria-label="KRUXT member home">KRUXT</Link>
            <h1 className="mobile-title">{title}</h1>
            <p className="mobile-copy">{subtitle}</p>
          </div>
          <div className="mobile-topbar-actions">
            <Link href="/profile" className="member-profile-shortcut" aria-label={`Your profile: ${displayLabel}`} title={displayLabel}><UserRound size={20} aria-hidden="true" /></Link>
            <button
              className="member-icon-button member-mobile-signout"
              aria-label="Sign out"
              title="Sign out"
              onClick={handleConsentSignOut}
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <details className="member-more member-mobile-tools" key={pathname}>
          <summary>More <ChevronDown size={16} aria-hidden="true" /></summary>
          <nav aria-label="Member tools">{MORE_NAV.map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}><item.icon size={18} aria-hidden="true" />{item.label}</Link>)}{backoffice && <a href={backoffice.url}><ArrowUpRight size={18} aria-hidden="true" />{backoffice.label}</a>}</nav>
        </details>
        <section id="member-content" tabIndex={-1} className="mobile-content">{children}</section>
        </div>
      </div>
    </main>
  );
}
