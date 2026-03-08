"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

import { resolveAdminAccess, type AdminAccessState } from "@/lib/auth/access";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface ProfileSummary {
  id: string;
  displayName: string | null;
  username: string | null;
}

interface PublicSessionState {
  status: "loading" | "ready";
  user: User | null;
  access: AdminAccessState | null;
  profile: ProfileSummary | null;
}

function mapProfileLabel(profile: ProfileSummary | null, email: string | undefined): string {
  if (profile?.displayName) return profile.displayName;
  if (profile?.username) return `@${profile.username}`;
  return email ?? "Member";
}

export function resolvePostAuthPath(access: AdminAccessState): string {
  if (access.platformRole === "founder") return "/admin";
  if (access.staffGymIds.length > 0) return "/org";
  return "/feed";
}

export function usePublicSession() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [state, setState] = useState<PublicSessionState>({
    status: "loading",
    user: null,
    access: null,
    profile: null
  });

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const access = await resolveAdminAccess(supabase);
      if (!active) return;

      if (!access.user) {
        setState({
          status: "ready",
          user: null,
          access,
          profile: null
        });
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,display_name,username")
        .eq("id", access.user.id)
        .maybeSingle();

      if (!active) return;

      setState({
        status: "ready",
        user: access.user,
        access,
        profile: profileData
          ? {
              id: profileData.id as string,
              displayName: (profileData.display_name as string | null | undefined) ?? null,
              username: (profileData.username as string | null | undefined) ?? null
            }
          : null
      });
    }

    const listener = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, _session: Session | null) => {
      if (!active) return;
      setState((current) => ({ ...current, status: "loading" }));
      void loadSession();
    });

    void loadSession();

    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return {
    supabase,
    state,
    signOut,
    displayLabel: mapProfileLabel(state.profile, state.user?.email)
  };
}
