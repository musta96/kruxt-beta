"use client";

import { useMemo } from "react";
import {
  createAdminSupabaseClient,
  GymAdminService,
  B2BOpsService,
  IntegrationMonitorService,
  CustomizationSupportService,
  PlatformControlPlaneService,
} from "@/services";

/**
 * Returns memoized service instances backed by the singleton Supabase client.
 * Safe to call in any client component — services are only created once.
 */
export function useServices() {
  return useMemo(() => {
    const supabase = createAdminSupabaseClient();
    return {
      supabase,
      gym: new GymAdminService(supabase),
      ops: new B2BOpsService(supabase),
      integrations: new IntegrationMonitorService(supabase),
      customization: new CustomizationSupportService(supabase),
      platform: new PlatformControlPlaneService(supabase),
    };
  }, []);
}
