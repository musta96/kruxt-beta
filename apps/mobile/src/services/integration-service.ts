import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DeviceConnection,
  DeviceSyncCursor,
  DeviceSyncJob,
  ExternalActivityImport,
  IntegrationConnectionStatus,
  IntegrationProvider,
  QueueDeviceSyncJobInput,
  UpsertDeviceConnectionInput
} from "@kruxt/types";

import { KruxtAppError, throwIfError } from "./errors";

type DeviceConnectionRow = {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  status: DeviceConnection["status"];
  provider_user_id: string | null;
  scopes: string[] | null;
  token_expires_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type DeviceSyncJobRow = {
  id: string;
  connection_id: string;
  user_id: string;
  provider: IntegrationProvider;
  job_type: string;
  status: DeviceSyncJob["status"];
  cursor: Record<string, unknown> | null;
  requested_by: string | null;
  retry_count: number;
  next_retry_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  source_webhook_event_id: string | null;
  created_at: string;
  updated_at: string;
};

type DeviceSyncCursorRow = {
  id: string;
  connection_id: string;
  user_id: string;
  provider: IntegrationProvider;
  cursor: Record<string, unknown> | null;
  last_synced_at: string | null;
  last_job_id: string | null;
  last_webhook_event_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type ExternalActivityImportRow = {
  id: string;
  user_id: string;
  connection_id: string;
  provider: IntegrationProvider;
  external_activity_id: string;
  activity_type: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  distance_m: number | null;
  calories: number | null;
  average_hr: number | null;
  max_hr: number | null;
  raw_data: Record<string, unknown> | null;
  mapped_workout_id: string | null;
  imported_at: string;
  created_at: string;
};

type ConnectionLookupRow = {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  status: IntegrationConnectionStatus;
};

function mapConnection(row: DeviceConnectionRow): DeviceConnection {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    status: row.status,
    providerUserId: row.provider_user_id,
    scopes: row.scopes ?? [],
    tokenExpiresAt: row.token_expires_at,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSyncJob(row: DeviceSyncJobRow): DeviceSyncJob {
  return {
    id: row.id,
    connectionId: row.connection_id,
    userId: row.user_id,
    provider: row.provider,
    jobType: row.job_type,
    status: row.status,
    cursor: row.cursor ?? {},
    requestedBy: row.requested_by,
    retryCount: row.retry_count,
    nextRetryAt: row.next_retry_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorMessage: row.error_message,
    sourceWebhookEventId: row.source_webhook_event_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSyncCursor(row: DeviceSyncCursorRow): DeviceSyncCursor {
  return {
    id: row.id,
    connectionId: row.connection_id,
    userId: row.user_id,
    provider: row.provider,
    cursor: row.cursor ?? {},
    lastSyncedAt: row.last_synced_at,
    lastJobId: row.last_job_id,
    lastWebhookEventId: row.last_webhook_event_id,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapExternalImport(row: ExternalActivityImportRow): ExternalActivityImport {
  return {
    id: row.id,
    userId: row.user_id,
    connectionId: row.connection_id,
    provider: row.provider,
    externalActivityId: row.external_activity_id,
    activityType: row.activity_type,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    distanceM: row.distance_m,
    calories: row.calories,
    averageHr: row.average_hr,
    maxHr: row.max_hr,
    rawData: row.raw_data ?? {},
    mappedWorkoutId: row.mapped_workout_id,
    importedAt: row.imported_at,
    createdAt: row.created_at
  };
}

export class IntegrationService {
  constructor(private readonly supabase: SupabaseClient) {}

  private async resolveConnectionForUser(userId: string, connectionId: string): Promise<ConnectionLookupRow> {
    const { data, error } = await this.supabase
      .from("device_connections")
      .select("id,user_id,provider,status")
      .eq("id", connectionId)
      .eq("user_id", userId)
      .maybeSingle();

    throwIfError(error, "INTEGRATION_CONNECTION_LOOKUP_FAILED", "Unable to resolve device connection.");

    if (!data) {
      throw new KruxtAppError("INTEGRATION_CONNECTION_NOT_FOUND", "Device connection not found.");
    }

    return data as ConnectionLookupRow;
  }

  async listConnections(userId: string, provider?: IntegrationProvider, limit = 20): Promise<DeviceConnection[]> {
    let query = this.supabase
      .from("device_connections")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (provider) {
      query = query.eq("provider", provider);
    }

    const { data, error } = await query;
    throwIfError(error, "INTEGRATION_CONNECTIONS_READ_FAILED", "Unable to load device connections.");

    return ((data as DeviceConnectionRow[]) ?? []).map(mapConnection);
  }

  async upsertConnection(userId: string, input: UpsertDeviceConnectionInput): Promise<DeviceConnection> {
    const { data, error } = await this.supabase
      .from("device_connections")
      .upsert(
        {
          user_id: userId,
          provider: input.provider,
          status: input.status ?? "active",
          provider_user_id: input.providerUserId ?? null,
          scopes: input.scopes ?? [],
          access_token_encrypted: input.accessTokenEncrypted ?? null,
          refresh_token_encrypted: input.refreshTokenEncrypted ?? null,
          token_expires_at: input.tokenExpiresAt ?? null,
          metadata: input.metadata ?? {}
        },
        { onConflict: "user_id,provider" }
      )
      .select("*")
      .single();

    throwIfError(error, "INTEGRATION_CONNECTION_UPSERT_FAILED", "Unable to save device connection.");

    return mapConnection(data as DeviceConnectionRow);
  }

  async updateConnectionStatus(
    userId: string,
    connectionId: string,
    status: IntegrationConnectionStatus
  ): Promise<DeviceConnection> {
    await this.resolveConnectionForUser(userId, connectionId);

    const { data, error } = await this.supabase
      .from("device_connections")
      .update({ status })
      .eq("id", connectionId)
      .eq("user_id", userId)
      .select("*")
      .single();

    throwIfError(error, "INTEGRATION_CONNECTION_STATUS_UPDATE_FAILED", "Unable to update device connection status.");

    return mapConnection(data as DeviceConnectionRow);
  }

  async queueSyncJob(userId: string, input: QueueDeviceSyncJobInput): Promise<DeviceSyncJob> {
    const connection = await this.resolveConnectionForUser(userId, input.connectionId);

    if (connection.status !== "active") {
      throw new KruxtAppError("INTEGRATION_CONNECTION_INACTIVE", "Device connection is not active.");
    }

    const { data, error } = await this.supabase
      .from("device_sync_jobs")
      .insert({
        connection_id: connection.id,
        user_id: userId,
        provider: connection.provider,
        job_type: input.jobType ?? "pull_activities",
        status: "queued",
        cursor: input.cursor ?? {},
        requested_by: userId,
        source_webhook_event_id: input.sourceWebhookEventId ?? null
      })
      .select("*")
      .single();

    throwIfError(error, "INTEGRATION_SYNC_JOB_QUEUE_FAILED", "Unable to queue sync job.");

    return mapSyncJob(data as DeviceSyncJobRow);
  }

  async listSyncJobs(userId: string, provider?: IntegrationProvider, limit = 50): Promise<DeviceSyncJob[]> {
    let query = this.supabase
      .from("device_sync_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (provider) {
      query = query.eq("provider", provider);
    }

    const { data, error } = await query;
    throwIfError(error, "INTEGRATION_SYNC_JOBS_READ_FAILED", "Unable to load sync jobs.");

    return ((data as DeviceSyncJobRow[]) ?? []).map(mapSyncJob);
  }

  async getSyncCursor(userId: string, connectionId: string): Promise<DeviceSyncCursor | null> {
    await this.resolveConnectionForUser(userId, connectionId);

    const { data, error } = await this.supabase
      .from("device_sync_cursors")
      .select("*")
      .eq("connection_id", connectionId)
      .eq("user_id", userId)
      .maybeSingle();

    throwIfError(error, "INTEGRATION_CURSOR_READ_FAILED", "Unable to load sync cursor.");

    return data ? mapSyncCursor(data as DeviceSyncCursorRow) : null;
  }

  async listImportedActivities(
    userId: string,
    provider?: IntegrationProvider,
    limit = 100
  ): Promise<ExternalActivityImport[]> {
    let query = this.supabase
      .from("external_activity_imports")
      .select("*")
      .eq("user_id", userId)
      .order("imported_at", { ascending: false })
      .limit(limit);

    if (provider) {
      query = query.eq("provider", provider);
    }

    const { data, error } = await query;
    throwIfError(error, "INTEGRATION_IMPORTS_READ_FAILED", "Unable to load imported activities.");

    return ((data as ExternalActivityImportRow[]) ?? []).map(mapExternalImport);
  }
}
