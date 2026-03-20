import type { GuildHallSnapshot, GuildRosterMember } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

import { GymService } from "../services";

export interface GuildHallFlowOutput {
  snapshot: GuildHallSnapshot;
  roster: GuildRosterMember[];
}

export const guildHallChecklist = [
  "Resolve primary guild membership",
  "Load rank and chain progress",
  "Load guild roster",
  "Surface pending approvals for staff"
] as const;

export function createGuildHallFlow(supabase: SupabaseClient) {
  const gyms = new GymService(supabase);

  return {
    checklist: guildHallChecklist,
    load: async (userId: string): Promise<GuildHallFlowOutput> => {
      const snapshot = await gyms.getGuildHallSnapshot(userId);
      const roster = snapshot.gymId
        ? await gyms.listGuildRoster(snapshot.gymId, 60)
        : [];

      return { snapshot, roster };
    }
  };
}
