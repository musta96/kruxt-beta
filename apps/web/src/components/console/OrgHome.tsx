"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminAccess } from "@/components/admin/useAdminAccess";

export function OrgHome() {
  const { access, signOut } = useAdminAccess();

  return (
    <AdminShell
      access={access}
      scope="org"
      onSignOut={signOut}
      title="Organization Workspace"
      subtitle={access.user?.email ? `Signed in as ${access.user.email}` : undefined}
    >
      <div className="grid grid-2">
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Gym Leadership Console</h2>
          <p className="subheading">Manage your staff, roles, invites, and class operations for your gyms.</p>
          <ul>
            <li>View and update team memberships</li>
            <li>Send/revoke role-specific invites</li>
            <li>Manage recurring classes and scheduling</li>
          </ul>
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Accessible Gyms</h2>
          <ul>
            {access.staffGymIds.map((gymId) => (
              <li key={gymId}>{gymId}</li>
            ))}
            {access.staffGymIds.length === 0 && <li>No active gym memberships.</li>}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
