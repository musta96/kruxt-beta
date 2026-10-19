"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ensureProfileExistsForUser, resolveAdminAccess, type AdminAccessState } from "@/lib/auth/access";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const INITIAL: AdminAccessState = {
  status: "loading",
  isAuthenticated: false,
  user: null,
  activationStatus: null,
  platformRole: null,
  staffGymIds: [],
  hasRequiredConsents: false,
  error: null
};

export function useAdminAccess() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [access, setAccess] = useState<AdminAccessState>(INITIAL);

  const loadAccess = useCallback(async (): Promise<AdminAccessState> => {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      try {
        await ensureProfileExistsForUser(supabase, {
          userId: data.user.id,
          email: data.user.email ?? "member@kruxt.app",
          username:
            typeof data.user.user_metadata.username === "string" ? data.user.user_metadata.username : undefined,
          displayName:
            typeof data.user.user_metadata.display_name === "string"
              ? data.user.user_metadata.display_name
              : undefined
        });
      } catch (profileError) {
        return {
          status: "error",
          isAuthenticated: true,
          user: data.user,
          activationStatus: null,
          platformRole: null,
          staffGymIds: [],
          hasRequiredConsents: false,
          error: profileError instanceof Error ? profileError.message : "Unable to prepare your profile."
        };
      }
    }

    return resolveAdminAccess(supabase);
  }, [supabase]);

  const refresh = useCallback(async () => {
    const next = await loadAccess();
    setAccess(next);
  }, [loadAccess]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const next = await loadAccess();
      if (!active) return;
      setAccess(next);
    };

    const listener = supabase.auth.onAuthStateChange(() => {
      if (!active) return;
      void run();
    });

    void run();

    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
    };
  }, [loadAccess, supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/");
  }, [router, supabase]);

  const canManageGyms = Boolean(access.platformRole);
  const allowedGymIds = canManageGyms ? null : access.staffGymIds;

  return {
    supabase,
    access,
    refresh,
    signOut,
    canManageGyms,
    allowedGymIds
  };
}
