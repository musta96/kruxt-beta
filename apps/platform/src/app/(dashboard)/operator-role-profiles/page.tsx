"use client";

import Link from "next/link";
import { useRef } from "react";
import { usePlatformAuth } from "@/contexts/platform-auth-context";
import { OperatorMfa } from "@/components/operator-mfa";
import { OperatorRoleProfiles } from "@/components/operator-role-profiles";

export default function OperatorRoleProfilesPage() {
  const { supabase, user, session, platformRole, loading } = usePlatformAuth();
  const identity = useRef({ token: session?.access_token, revision: 0 });
  if (identity.current.token !== session?.access_token) {
    identity.current = { token: session?.access_token, revision: identity.current.revision + 1 };
  }
  if (loading || !user || !platformRole) return <p role="status">Checking operator access...</p>;
  return <main key={`${user.id}:${identity.current.revision}:${platformRole}`} className="min-w-0 space-y-5">
    <Link href="/operators" className="text-sm underline underline-offset-4">Back to operators</Link>
    <h1 className="text-2xl font-semibold">Operator role profiles</h1>
    <p className="max-w-prose text-sm text-muted-foreground">Profile scope: tenant, feature-flag, audit and system-health viewing. Other access remains governed by built-in roles and per-person overrides.</p>
    {platformRole === "founder" && <OperatorMfa client={supabase} viewerId={user.id} />}
    <OperatorRoleProfiles client={supabase} viewerId={user.id} />
  </main>;
}
