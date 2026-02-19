import {
  createAdminSupabaseClient,
  IntegrationMonitorService,
  type IntegrationConnectionHealthRecord,
  type IntegrationMonitorSummary,
  type IntegrationSyncFailureRecord
} from "../services";

export interface Phase6IntegrationMonitorSnapshot {
  summary: IntegrationMonitorSummary;
  connections: IntegrationConnectionHealthRecord[];
  recentFailures: IntegrationSyncFailureRecord[];
}

export const phase6IntegrationMonitorChecklist = [
  "Load monitored member count",
  "Load device connection health",
  "Load recent failed/retrying sync jobs"
] as const;

export function createPhase6IntegrationMonitorFlow() {
  const supabase = createAdminSupabaseClient();
  const monitor = new IntegrationMonitorService(supabase);

  return {
    checklist: phase6IntegrationMonitorChecklist,
    load: async (gymId: string): Promise<Phase6IntegrationMonitorSnapshot> => {
      const [summary, connections, recentFailures] = await Promise.all([
        monitor.getSummary(gymId),
        monitor.listConnectionHealth(gymId, 200),
        monitor.listRecentSyncFailures(gymId, 120)
      ]);

      return {
        summary,
        connections,
        recentFailures
      };
    }
  };
}
