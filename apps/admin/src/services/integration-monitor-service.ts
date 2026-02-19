import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntegrationProvider } from "@kruxt/types";

import { KruxtAdminError, throwIfAdminError } from "./errors";
import { StaffAccessService } from "./staff-access-service";

type GymMembershipUserRow = {
  user_id: string;
};

type DeviceConnectionRow = {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  status: "active" | "revoked" | "expired" | "error";
  last_synced_at: string | null;
  last_error: string | null;
  updated_at: string;
};

type DeviceSyncJobRow = {
  id: string;
  connection_id: string;
  user_id: string;
  provider: IntegrationProvider;
  status: "queued" | "running" | "succeeded" | "failed" | "retry_scheduled";
  retry_count: number;
  next_retry_at: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
};

export interface IntegrationConnectionHealthRecord {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  status: "active" | "revoked" | "expired" | "error";
  lastSyncedAt?: string | null;
  lastError?: string | null;
  updatedAt: string;
  actor?: {
    userId: string;
    username: string;
    displayName: string;
  };
}

export interface IntegrationSyncFailureRecord {
  id: string;
  connectionId: string;
  userId: string;
  provider: IntegrationProvider;
  status: "failed" | "retry_scheduled";
  retryCount: number;
  nextRetryAt?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  actor?: {
    userId: string;
    username: string;
    displayName: string;
  };
}

export interface IntegrationMonitorSummary {
  gymId: string;
  monitoredMembers: number;
  totalConnections: number;
  activeConnections: number;
  unhealthyConnections: number;
  failingOrRetryingJobs: number;
}

export class IntegrationMonitorService {
  private readonly access: StaffAccessService;

  constructor(private readonly supabase: SupabaseClient) {
    this.access = new StaffAccessService(supabase);
  }

  private async listMonitoredUserIds(gymId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("gym_memberships")
      .select("user_id")
      .eq("gym_id", gymId)
      .in("membership_status", ["trial", "active"])
      .limit(1000);

    throwIfAdminError(error, "ADMIN_INTEGRATION_MEMBERS_READ_FAILED", "Unable to load gym members for monitoring.");

    return Array.from(new Set(((data as GymMembershipUserRow[]) ?? []).map((row) => row.user_id)));
  }

  private async listProfiles(userIds: string[]): Promise<Map<string, ProfileRow>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .from("profiles")
      .select("id,username,display_name")
      .in("id", userIds);

    throwIfAdminError(error, "ADMIN_INTEGRATION_PROFILES_READ_FAILED", "Unable to load profiles for integration monitor.");

    const byId = new Map<string, ProfileRow>();
    for (const row of (data as ProfileRow[]) ?? []) {
      byId.set(row.id, row);
    }

    return byId;
  }

  async listConnectionHealth(gymId: string, limit = 300): Promise<IntegrationConnectionHealthRecord[]> {
    await this.access.requireGymStaff(gymId);

    const userIds = await this.listMonitoredUserIds(gymId);
    if (userIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("device_connections")
      .select("id,user_id,provider,status,last_synced_at,last_error,updated_at")
      .in("user_id", userIds)
      .order("updated_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));

    throwIfAdminError(error, "ADMIN_INTEGRATION_CONNECTIONS_READ_FAILED", "Unable to load integration connections.");

    const rows = (data as DeviceConnectionRow[]) ?? [];
    const profileById = await this.listProfiles(rows.map((row) => row.user_id));

    return rows.map((row) => {
      const profile = profileById.get(row.user_id);
      return {
        id: row.id,
        userId: row.user_id,
        provider: row.provider,
        status: row.status,
        lastSyncedAt: row.last_synced_at,
        lastError: row.last_error,
        updatedAt: row.updated_at,
        actor: profile
          ? {
              userId: profile.id,
              username: profile.username,
              displayName: profile.display_name
            }
          : undefined
      };
    });
  }

  async listRecentSyncFailures(gymId: string, limit = 200): Promise<IntegrationSyncFailureRecord[]> {
    await this.access.requireGymStaff(gymId);

    const userIds = await this.listMonitoredUserIds(gymId);
    if (userIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("device_sync_jobs")
      .select(
        "id,connection_id,user_id,provider,status,retry_count,next_retry_at,error_message,started_at,finished_at,created_at"
      )
      .in("user_id", userIds)
      .in("status", ["failed", "retry_scheduled"])
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));

    throwIfAdminError(error, "ADMIN_INTEGRATION_SYNC_FAILURES_READ_FAILED", "Unable to load sync failure records.");

    const rows = (data as DeviceSyncJobRow[]) ?? [];
    const profileById = await this.listProfiles(rows.map((row) => row.user_id));

    return rows.map((row) => {
      const profile = profileById.get(row.user_id);
      return {
        id: row.id,
        connectionId: row.connection_id,
        userId: row.user_id,
        provider: row.provider,
        status: row.status === "failed" ? "failed" : "retry_scheduled",
        retryCount: row.retry_count,
        nextRetryAt: row.next_retry_at,
        errorMessage: row.error_message,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        createdAt: row.created_at,
        actor: profile
          ? {
              userId: profile.id,
              username: profile.username,
              displayName: profile.display_name
            }
          : undefined
      };
    });
  }

  async getSummary(gymId: string): Promise<IntegrationMonitorSummary> {
    await this.access.requireGymStaff(gymId);

    const userIds = await this.listMonitoredUserIds(gymId);
    if (userIds.length === 0) {
      return {
        gymId,
        monitoredMembers: 0,
        totalConnections: 0,
        activeConnections: 0,
        unhealthyConnections: 0,
        failingOrRetryingJobs: 0
      };
    }

    const [connections, failures] = await Promise.all([
      this.listConnectionHealth(gymId, 500),
      this.listRecentSyncFailures(gymId, 500)
    ]);

    const activeConnections = connections.filter((row) => row.status === "active").length;
    const unhealthyConnections = connections.filter((row) => row.status === "error" || Boolean(row.lastError)).length;

    return {
      gymId,
      monitoredMembers: userIds.length,
      totalConnections: connections.length,
      activeConnections,
      unhealthyConnections,
      failingOrRetryingJobs: failures.length
    };
  }
}
