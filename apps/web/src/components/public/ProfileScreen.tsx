"use client";

import Link from "next/link";

import { MemberShell } from "@/components/public/MemberShell";
import { resolvePostAuthPath, usePublicSession } from "@/components/public/usePublicSession";

export function ProfileScreen() {
  const { state, displayLabel } = usePublicSession();

  const backofficePath = state.access ? resolvePostAuthPath(state.access) : null;
  const showBackofficeLink = backofficePath === "/admin" || backofficePath === "/org";

  return (
    <MemberShell
      title="Profile"
      subtitle="Account identity, linked access, and the member settings area that will drive personal preferences."
    >
      <section className="split-card">
        <article className="glass-panel">
          <p className="eyebrow">ACCOUNT</p>
          <h2 className="section-title">{displayLabel}</h2>
          <dl className="data-list">
            <div>
              <dt>Email</dt>
              <dd>{state.user?.email ?? "—"}</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>{state.profile?.username ? `@${state.profile.username}` : "Not set"}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>
                {state.access?.platformRole === "founder"
                  ? "Founder"
                  : state.access?.staffGymIds.length
                  ? "Gym staff"
                  : "Member"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="glass-panel">
          <p className="eyebrow">NEXT</p>
          <h2 className="section-title">Member settings</h2>
          <ul className="checklist">
            <li>Avatar upload wired to Supabase storage</li>
            <li>Notification preferences</li>
            <li>Privacy and consent controls</li>
            <li>Connected gym memberships</li>
          </ul>
          {showBackofficeLink && (
            <div className="stack-actions">
              <Link href={backofficePath} className="secondary-cta">
                Open {backofficePath === "/admin" ? "founder console" : "organization workspace"}
              </Link>
            </div>
          )}
        </article>
      </section>
    </MemberShell>
  );
}
