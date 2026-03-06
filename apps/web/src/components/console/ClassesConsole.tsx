"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminAccess } from "@/components/admin/useAdminAccess";

export function ClassesConsole({ scope }: { scope: "founder" | "org" }) {
  const { access, signOut } = useAdminAccess();

  return (
    <AdminShell
      access={access}
      scope={scope}
      onSignOut={signOut}
      title="Classes"
      subtitle={
        scope === "founder"
          ? "Founder view for class operations rollout"
          : "Organization class operations and scheduling"
      }
    >
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Class Scheduler</h2>
        <p className="subheading">
          This is the shared class module entry point for both founder and organization workspaces.
        </p>
        <ul>
          <li>Course template picker by location</li>
          <li>Coach eligibility filters from staff roster</li>
          <li>Recurring rules with calendar preview</li>
          <li>Capacity and duration defaults by course</li>
        </ul>
      </div>
    </AdminShell>
  );
}
