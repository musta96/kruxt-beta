"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminAccess } from "@/components/admin/useAdminAccess";

export function AdminHome() {
  const { access, signOut } = useAdminAccess();

  return (
    <AdminShell
      access={access}
      scope="founder"
      onSignOut={signOut}
      title="KRUXT Admin"
      subtitle={access.user?.email ? `Signed in as ${access.user.email}` : undefined}
    >
      <div className="grid grid-2">
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Founder Control Plane</h2>
          <p className="subheading">Global visibility and controls across all gyms.</p>
          <ul>
            <li>Manage gyms and ownership</li>
            <li>Update subscriptions and compliance settings</li>
            <li>Review platform-level KPIs and support actions</li>
          </ul>
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Live Founder Routes</h2>
          <p className="subheading">Now available in this web app:</p>
          <ul>
            <li>/admin/gyms</li>
            <li>/admin/users</li>
            <li>/admin/invites</li>
            <li>/admin/classes</li>
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
