"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminAccess } from "@/components/admin/useAdminAccess";

export default function AdminClassesPage() {
  const { access, signOut } = useAdminAccess();

  return (
    <AdminShell
      access={access}
      onSignOut={signOut}
      title="Classes"
      subtitle="Class scheduling UI will land in the next implementation slice"
    >
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Next slice: Class Scheduler</h2>
        <p className="subheading">
          This page will include recurring scheduling, coach assignment, per-location templates, and capacity rules.
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
