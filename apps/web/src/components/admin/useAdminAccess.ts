"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { resolveAdminAccess, type AdminAccessState } from "@/lib/auth/access";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const INITIAL: AdminAccessState = {
  status: "loading",
  isAuthenticated: false,
  user: null,
  platformRole: null,
  staffGymIds: []
};

export function useAdminAccess() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [access, setAccess] = useState<AdminAccessState>(INITIAL);

  const refresh = useCallback(async () => {
    const next = await resolveAdminAccess(supabase);
    setAccess(next);
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const next = await resolveAdminAccess(supabase);
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
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/");
  }, [router, supabase]);

  const canManageGyms = access.platformRole === "founder";
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
