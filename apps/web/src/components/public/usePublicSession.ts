"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

import { ensureProfileExistsForUser, resolveAdminAccess, type AdminAccessState } from "@/lib/auth/access";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface ProfileSummary {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
}

interface PublicSessionState {
  status: "loading" | "access_blocked" | "consent_required" | "error" | "ready";
  user: User | null;
  access: AdminAccessState | null;
  profile: ProfileSummary | null;
  error: string | null;
}

function mapProfileLabel(profile: ProfileSummary | null, email: string | undefined): string {
  if (profile?.displayName) return profile.displayName;
  if (profile?.username) return `@${profile.username}`;
  return email ?? "Member";
}

const PUBLIC_SESSION_REFRESH_EVENT = "kruxt-public-session-refresh";

export function broadcastPublicSessionRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PUBLIC_SESSION_REFRESH_EVENT));
}

export function resolvePostAuthPath(access: AdminAccessState): string {
  if (access.activationStatus === "pending_activation" || access.activationStatus === "disabled") {
    return "/activate-invite";
  }
  if (access.platformRole) return "/admin";
  if (access.staffGymIds.length > 0) return "/org";
  return "/feed";
}

export function usePublicSession() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [state, setState] = useState<PublicSessionState>({
    status: "loading",
    user: null,
    access: null,
    profile: null,
    error: null
  });

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        if (!active) return;
        setState({
          status: "error",
          user: authData.user ?? null,
          access: null,
          profile: null,
          error: authError.message || "Unable to validate your session."
        });
        return;
      }

      if (authData.user) {
        try {
          await ensureProfileExistsForUser(supabase, {
            userId: authData.user.id,
            email: authData.user.email ?? "member@kruxt.app",
            username:
              typeof authData.user.user_metadata.username === "string"
                ? authData.user.user_metadata.username
                : undefined,
            displayName:
              typeof authData.user.user_metadata.display_name === "string"
                ? authData.user.user_metadata.display_name
                : undefined
          });
        } catch (profileError) {
          if (!active) return;
          setState({
            status: "error",
            user: authData.user,
            access: null,
            profile: null,
            error: profileError instanceof Error ? profileError.message : "Unable to prepare your profile."
          });
          return;
        }
      }

      const access = await resolveAdminAccess(supabase);
      if (!active) return;

      if (!access.user) {
        setState({
          status: access.status === "error" ? "error" : "ready",
          user: null,
          access,
          profile: null,
          error: access.error
        });
        return;
      }

      if (access.status === "error") {
        setState({
          status: "error",
          user: access.user,
          access,
          profile: null,
          error: access.error || "Unable to validate account access."
        });
        return;
      }

      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id,display_name,username,avatar_url")
          .eq("id", access.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        setState({
          status: access.status === "activation_required" || access.status === "disabled"
            ? "access_blocked"
            : access.status === "consent_required"
              ? "consent_required"
              : "ready",
          user: access.user,
          access,
          profile: profileData
            ? {
                id: profileData.id as string,
                displayName: (profileData.display_name as string | null | undefined) ?? null,
                username: (profileData.username as string | null | undefined) ?? null,
                avatarUrl: (profileData.avatar_url as string | null | undefined) ?? null
              }
            : null,
          error: null
        });
      } catch (profileError) {
        if (!active) return;
        setState({
          status: "error",
          user: access.user,
          access,
          profile: null,
          error: profileError instanceof Error ? profileError.message : "Unable to prepare your profile."
        });
      }
    }

    const listener = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, _session: Session | null) => {
      if (!active) return;
      setState((current) => ({ ...current, status: "loading" }));
      void loadSession();
    });

    const handleRefresh = () => {
      if (!active) return;
      setState((current) => ({ ...current, status: "loading" }));
      void loadSession();
    };

    window.addEventListener(PUBLIC_SESSION_REFRESH_EVENT, handleRefresh);

    void loadSession();

    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
      window.removeEventListener(PUBLIC_SESSION_REFRESH_EVENT, handleRefresh);
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refresh() {
    setState((current) => ({ ...current, status: "loading" }));
    await new Promise<void>((resolve) => {
      const handler = () => resolve();
      broadcastPublicSessionRefresh();
      window.setTimeout(handler, 0);
    });
  }

  return {
    supabase,
    state,
    signOut,
    refresh,
    displayLabel: mapProfileLabel(state.profile, state.user?.email)
  };
}
