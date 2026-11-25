"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
const emptySession = (status: PublicSessionState["status"]): PublicSessionState => ({
  status, user: null, access: null, profile: null, error: null
});
const SESSION_CHECK_ERROR = "We couldn't check your account access. Try again or sign in again.";

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
    let generation = 0;
    let authTimer: ReturnType<typeof setTimeout> | undefined;

    async function loadSession() {
      const ticket = ++generation;
      const current = () => active && ticket === generation;
      setState(emptySession("loading"));
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (!current()) return;
        if (authError) {
          if (authError.name === "AuthSessionMissingError" || ["session_not_found", "session_expired", "refresh_token_not_found"].includes(authError.code ?? "")) {
            setState(emptySession("ready"));
            return;
          }
          throw new Error("Session check unavailable.");
        }
        if (!authData.user) {
          setState(emptySession("ready"));
          return;
        }
        await ensureProfileExistsForUser(supabase, {
          userId: authData.user.id,
          email: authData.user.email ?? "member@kruxt.app",
          username: typeof authData.user.user_metadata.username === "string" ? authData.user.user_metadata.username : undefined,
          displayName: typeof authData.user.user_metadata.display_name === "string" ? authData.user.user_metadata.display_name : undefined
        });
        if (!current()) return;
        const access = await resolveAdminAccess(supabase);
        if (!current()) return;
        if (!access.isAuthenticated || access.user?.id !== authData.user.id || access.status === "error") {
          throw new Error("Account check unavailable.");
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id,display_name,username,avatar_url")
          .eq("id", access.user.id)
          .maybeSingle();

        if (!current()) return;
        if (profileError || !profileData || profileData.id !== access.user.id) throw new Error("Profile unavailable.");

        setState({
          status: access.status === "activation_required" || access.status === "disabled"
            ? "access_blocked"
            : access.status === "consent_required"
              ? "consent_required"
              : "ready",
          user: access.user,
          access,
          profile: {
            id: profileData.id as string,
            displayName: (profileData.display_name as string | null | undefined) ?? null,
            username: (profileData.username as string | null | undefined) ?? null,
            avatarUrl: (profileData.avatar_url as string | null | undefined) ?? null
          },
          error: null
        });
      } catch {
        if (current()) setState({ ...emptySession("error"), error: SESSION_CHECK_ERROR });
      }
    }

    const listener = supabase.auth.onAuthStateChange((event: AuthChangeEvent, _session: Session | null) => {
      if (!active) return;
      generation++;
      clearTimeout(authTimer);
      if (event === "SIGNED_OUT") {
        setState(emptySession("ready"));
        return;
      }
      setState(emptySession("loading"));
      // Leave the Auth callback before starting asynchronous SDK calls.
      authTimer = setTimeout(() => { if (active) void loadSession(); }, 0);
    });

    const handleRefresh = () => {
      if (!active) return;
      clearTimeout(authTimer);
      void loadSession();
    };

    window.addEventListener(PUBLIC_SESSION_REFRESH_EVENT, handleRefresh);

    void loadSession();

    return () => {
      active = false;
      generation++;
      clearTimeout(authTimer);
      listener.data.subscription.unsubscribe();
      window.removeEventListener(PUBLIC_SESSION_REFRESH_EVENT, handleRefresh);
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const refresh = useCallback(async () => {
    await new Promise<void>((resolve) => {
      const handler = () => resolve();
      broadcastPublicSessionRefresh();
      window.setTimeout(handler, 0);
    });
  }, []);

  return {
    supabase,
    state,
    signOut,
    refresh,
    displayLabel: mapProfileLabel(state.profile, state.user?.email)
  };
}
