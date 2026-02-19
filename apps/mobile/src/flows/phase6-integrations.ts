import type {
  DeviceConnection,
  DeviceSyncCursor,
  DeviceSyncJob,
  ExternalActivityImport,
  IntegrationProvider
} from "@kruxt/types";

import { createMobileSupabaseClient, IntegrationService } from "../services";

export interface Phase6IntegrationsSnapshot {
  connections: DeviceConnection[];
  syncJobs: DeviceSyncJob[];
  syncCursors: DeviceSyncCursor[];
  imports: ExternalActivityImport[];
}

export const phase6IntegrationsChecklist = [
  "Load connected providers",
  "Load recent sync jobs",
  "Load per-connection cursor state",
  "Load imported activities snapshot"
] as const;

export function createPhase6IntegrationsFlow() {
  const supabase = createMobileSupabaseClient();
  const integrations = new IntegrationService(supabase);

  return {
    checklist: phase6IntegrationsChecklist,
    load: async (userId: string, provider?: IntegrationProvider): Promise<Phase6IntegrationsSnapshot> => {
      const [connections, syncJobs, imports] = await Promise.all([
        integrations.listConnections(userId, provider, 20),
        integrations.listSyncJobs(userId, provider, 50),
        integrations.listImportedActivities(userId, provider, 100)
      ]);

      const cursorRows = await Promise.all(
        connections.map((connection) => integrations.getSyncCursor(userId, connection.id))
      );

      return {
        connections,
        syncJobs,
        syncCursors: cursorRows.filter((row): row is DeviceSyncCursor => Boolean(row)),
        imports
      };
    }
  };
}
