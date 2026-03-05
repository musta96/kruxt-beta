"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { PlatformOperatorRole } from "@kruxt/types";

import { resolveAdminAccess, type AdminAccessState } from "@/lib/auth/access";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const INITIAL: AdminAccessState = {
  status: "loading",
  isAuthenticated: false,
  user: null,
  platformRole: null,
  staffGymIds: []
};

function RoleBadge({ role }: { role: PlatformOperatorRole | null }) {
  if (role === "founder") return <span className="badge badge-founder">Founder</span>;
  if (role) return <span className="badge badge-staff">{role}</span>;
  return <span className="badge badge-danger">No platform role</span>;
}

export function AdminHome() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [state, setState] = useState<AdminAccessState>(INITIAL);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const result = await resolveAdminAccess(supabase);
      if (!active) return;
      setState(result);
    };

    const listener = supabase.auth.onAuthStateChange(() => {
      if (!active) return;
      void load();
    });

    void load();

    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (state.status === "loading") {
    return (
      <main className="container">
        <div className="panel">
          <h1 className="heading">Admin Console</h1>
          <p className="subheading">Checking access...</p>
        </div>
      </main>
    );
  }

  if (!state.isAuthenticated || !state.user) {
    return (
      <main className="container">
        <div className="panel" style={{ maxWidth: 720 }}>
          <h1 className="heading">Sign-in required</h1>
          <p className="subheading">You must authenticate before opening the admin console.</p>
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => router.push("/")}>Go to sign in</button>
          </div>
        </div>
      </main>
    );
  }

  const isFounder = state.platformRole === "founder";
  const hasGymAccess = state.staffGymIds.length > 0;

  return (
    <main className="container">
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h1 className="heading">KRUXT Admin</h1>
            <p className="subheading">Signed in as {state.user.email}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <RoleBadge role={state.platformRole} />
            <button className="btn btn-danger" onClick={() => void handleSignOut()}>Sign out</button>
          </div>
        </div>
      </div>

      {isFounder ? (
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
            <h2 style={{ marginTop: 0 }}>Next Implementation Slice</h2>
            <p className="subheading">This is Milestone 1 scaffold. Next we wire real pages:</p>
            <ul>
              <li>/admin/gyms</li>
              <li>/admin/users</li>
              <li>/admin/invites</li>
              <li>/admin/classes</li>
            </ul>
          </section>
        </div>
      ) : hasGymAccess ? (
        <div className="grid grid-2">
          <section className="panel">
            <h2 style={{ marginTop: 0 }}>Organization Console</h2>
            <p className="subheading">Gym-scoped access for your assigned organizations.</p>
            <ul>
              <li>Staff role and member management</li>
              <li>Invites and onboarding</li>
              <li>Classes, check-ins, and waivers</li>
            </ul>
          </section>

          <section className="panel">
            <h2 style={{ marginTop: 0 }}>Accessible gyms</h2>
            <p className="subheading">Gym IDs from active memberships:</p>
            <ul>
              {state.staffGymIds.map((gymId) => (
                <li key={gymId}>{gymId}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <div className="panel" style={{ maxWidth: 760 }}>
          <h2 style={{ marginTop: 0 }}>Access not granted</h2>
          <p className="subheading">
            Your account is authenticated but has no founder role and no active leader/officer/coach gym membership.
          </p>
        </div>
      )}
    </main>
  );
}
