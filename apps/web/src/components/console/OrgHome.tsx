"use client";

import { useEffect, useState } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminAccess } from "@/components/admin/useAdminAccess";
import { listGyms, type GymRecord } from "@/lib/admin/data";

export function OrgHome() {
  const { access, signOut, supabase, allowedGymIds } = useAdminAccess();
  const [gyms, setGyms] = useState<GymRecord[]>([]);

  useEffect(() => {
    if (access.status !== "ready" || !access.isAuthenticated) return;

    let active = true;

    async function loadGyms() {
      try {
        const rows = await listGyms(supabase, allowedGymIds);
        if (!active) return;
        setGyms(rows);
      } catch {
        if (!active) return;
        setGyms([]);
      }
    }

    void loadGyms();

    return () => {
      active = false;
    };
  }, [access.isAuthenticated, access.status, allowedGymIds, supabase]);

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
            {gyms.map((gym) => (
              <li key={gym.id}>
                {gym.name}
                {gym.city ? ` · ${gym.city}` : ""}
              </li>
            ))}
            {gyms.length === 0 && <li>No active gym memberships.</li>}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
