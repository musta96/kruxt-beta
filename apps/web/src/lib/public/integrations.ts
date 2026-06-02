import type {
  DeviceConnection,
  DeviceSyncCursor,
  DeviceSyncJob,
  ExternalActivityImport,
  IntegrationProvider
} from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActiveIntegrationProvider = "apple_health" | "garmin";

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
  source_webhook_event_id?: string | null;
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

export interface ProviderState {
  provider: ActiveIntegrationProvider;
  label: string;
  copy: string;
  connection: DeviceConnection | null;
  latestSyncJob: DeviceSyncJob | null;
  cursor: DeviceSyncCursor | null;
  importsTotal: number;
  mappedImports: number;
  unmappedImports: number;
  latestImportAt: string | null;
  duplicateExternalActivityIds: string[];
}

export interface IntegrationsSnapshot {
  activeProviders: ActiveIntegrationProvider[];
  providerStates: ProviderState[];
  syncJobs: DeviceSyncJob[];
  imports: ExternalActivityImport[];
  hiddenUnsupportedConnectionCount: number;
  hiddenUnsupportedImportCount: number;
  activationReport: {
    connectedProviders: ActiveIntegrationProvider[];
    missingProviders: ActiveIntegrationProvider[];
    queuedOrRunningSyncJobCount: number;
    mappedImportCount: number;
    unmappedImportCount: number;
    mappingCoverage: number;
    ready: boolean;
  };
}

const ACTIVE_PROVIDERS: ActiveIntegrationProvider[] = ["apple_health", "garmin"];
const PROVIDER_COPY: Record<ActiveIntegrationProvider, { label: string; copy: string; scopes: string[] }> = {
  apple_health: {
    label: "Apple Health",
    copy: "First-class activity, heart-rate, and workout import for iOS testing.",
    scopes: ["workouts.read", "heart_rate.read", "activity.read"]
  },
  garmin: {
    label: "Garmin",
    copy: "Garmin Health API activity imports for endurance and hybrid training.",
    scopes: ["activities.read", "health.read"]
  }
};

async function requireUser(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }

  return data.user.id;
}

function assertActiveProvider(provider: IntegrationProvider): ActiveIntegrationProvider {
  if (!ACTIVE_PROVIDERS.includes(provider as ActiveIntegrationProvider)) {
    throw new Error("Only Apple Health and Garmin are available in this beta.");
  }

  return provider as ActiveIntegrationProvider;
}

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

function mapCursor(row: DeviceSyncCursorRow): DeviceSyncCursor {
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

function mapImport(row: ExternalActivityImportRow): ExternalActivityImport {
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

function duplicateImportIds(imports: ExternalActivityImport[]): string[] {
  const counts = new Map<string, number>();
  for (const item of imports) {
    counts.set(item.externalActivityId, (counts.get(item.externalActivityId) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([externalActivityId]) => externalActivityId)
    .sort();
}

function buildSnapshot(input: {
  connections: DeviceConnection[];
  syncJobs: DeviceSyncJob[];
  syncCursors: DeviceSyncCursor[];
  imports: ExternalActivityImport[];
}): IntegrationsSnapshot {
  const activeConnections = input.connections.filter((row) =>
    ACTIVE_PROVIDERS.includes(row.provider as ActiveIntegrationProvider)
  );
  const activeJobs = input.syncJobs.filter((row) => ACTIVE_PROVIDERS.includes(row.provider as ActiveIntegrationProvider));
  const activeCursors = input.syncCursors.filter((row) =>
    ACTIVE_PROVIDERS.includes(row.provider as ActiveIntegrationProvider)
  );
  const activeImports = input.imports.filter((row) =>
    ACTIVE_PROVIDERS.includes(row.provider as ActiveIntegrationProvider)
  );

  const providerStates = ACTIVE_PROVIDERS.map((provider) => {
    const connection = activeConnections.find((row) => row.provider === provider) ?? null;
    const providerJobs = activeJobs.filter((row) => row.provider === provider);
    const providerImports = activeImports.filter((row) => row.provider === provider);
    const mappedImports = providerImports.filter((row) => Boolean(row.mappedWorkoutId)).length;
    const copy = PROVIDER_COPY[provider];

    return {
      provider,
      label: copy.label,
      copy: copy.copy,
      connection,
      latestSyncJob: providerJobs[0] ?? null,
      cursor: connection ? activeCursors.find((row) => row.connectionId === connection.id) ?? null : null,
      importsTotal: providerImports.length,
      mappedImports,
      unmappedImports: providerImports.length - mappedImports,
      latestImportAt: providerImports[0]?.importedAt ?? null,
      duplicateExternalActivityIds: duplicateImportIds(providerImports)
    };
  });

  const connectedProviders = providerStates
    .filter((row) => row.connection?.status === "active")
    .map((row) => row.provider);
  const missingProviders = ACTIVE_PROVIDERS.filter((provider) => !connectedProviders.includes(provider));
  const queuedOrRunningSyncJobCount = activeJobs.filter((job) =>
    ["queued", "running", "retry_scheduled"].includes(job.status)
  ).length;
  const mappedImportCount = providerStates.reduce((total, row) => total + row.mappedImports, 0);
  const unmappedImportCount = providerStates.reduce((total, row) => total + row.unmappedImports, 0);
  const totalImports = mappedImportCount + unmappedImportCount;

  return {
    activeProviders: [...ACTIVE_PROVIDERS],
    providerStates,
    syncJobs: activeJobs,
    imports: activeImports,
    hiddenUnsupportedConnectionCount: input.connections.length - activeConnections.length,
    hiddenUnsupportedImportCount: input.imports.length - activeImports.length,
    activationReport: {
      connectedProviders,
      missingProviders,
      queuedOrRunningSyncJobCount,
      mappedImportCount,
      unmappedImportCount,
      mappingCoverage: totalImports > 0 ? mappedImportCount / totalImports : 1,
      ready:
        missingProviders.length === 0 &&
        queuedOrRunningSyncJobCount === 0 &&
        providerStates.every((row) => row.duplicateExternalActivityIds.length === 0)
    }
  };
}

async function listConnections(client: SupabaseClient, userId: string): Promise<DeviceConnection[]> {
  const { data, error } = await client
    .from("device_connections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message || "Unable to load device connections.");
  return (((data ?? []) as DeviceConnectionRow[]) ?? []).map(mapConnection);
}

async function listSyncJobs(client: SupabaseClient, userId: string): Promise<DeviceSyncJob[]> {
  const { data, error } = await client
    .from("device_sync_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message || "Unable to load sync jobs.");
  return (((data ?? []) as DeviceSyncJobRow[]) ?? []).map(mapSyncJob);
}

async function listImports(client: SupabaseClient, userId: string): Promise<ExternalActivityImport[]> {
  const { data, error } = await client
    .from("external_activity_imports")
    .select("*")
    .eq("user_id", userId)
    .order("imported_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message || "Unable to load imported activities.");
  return (((data ?? []) as ExternalActivityImportRow[]) ?? []).map(mapImport);
}

async function listCursors(
  client: SupabaseClient,
  userId: string,
  connectionIds: string[]
): Promise<DeviceSyncCursor[]> {
  if (connectionIds.length === 0) return [];

  const { data, error } = await client
    .from("device_sync_cursors")
    .select("*")
    .eq("user_id", userId)
    .in("connection_id", connectionIds);

  if (error) throw new Error(error.message || "Unable to load sync cursors.");
  return (((data ?? []) as DeviceSyncCursorRow[]) ?? []).map(mapCursor);
}

export async function loadIntegrationsSnapshot(client: SupabaseClient): Promise<IntegrationsSnapshot> {
  const userId = await requireUser(client);
  const [connections, syncJobs, imports] = await Promise.all([
    listConnections(client, userId),
    listSyncJobs(client, userId),
    listImports(client, userId)
  ]);
  const syncCursors = await listCursors(client, userId, connections.map((connection) => connection.id));

  return buildSnapshot({ connections, syncJobs, syncCursors, imports });
}

export async function connectIntegrationProvider(
  client: SupabaseClient,
  provider: IntegrationProvider
): Promise<IntegrationsSnapshot> {
  const userId = await requireUser(client);
  const activeProvider = assertActiveProvider(provider);
  const providerConfig = PROVIDER_COPY[activeProvider];

  const { data: connectionData, error: connectionError } = await client
    .from("device_connections")
    .upsert(
      {
        user_id: userId,
        provider: activeProvider,
        status: "active",
        provider_user_id: `${activeProvider}:${userId.slice(0, 8)}`,
        scopes: providerConfig.scopes,
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
        metadata: {
          betaConnector: true,
          connectedFrom: "web_member_app",
          oauthStatus: "pending_provider_handoff"
        }
      },
      { onConflict: "user_id,provider" }
    )
    .select("*")
    .single();

  if (connectionError) throw new Error(connectionError.message || "Unable to connect provider.");

  const connection = mapConnection(connectionData as DeviceConnectionRow);
  const { error: syncError } = await client.from("device_sync_jobs").insert({
    connection_id: connection.id,
    user_id: userId,
    provider: activeProvider,
    job_type: "pull_activities",
    status: "queued",
    cursor: {},
    requested_by: userId,
    source_webhook_event_id: null
  });

  if (syncError) throw new Error(syncError.message || "Unable to queue initial sync.");
  return loadIntegrationsSnapshot(client);
}

export async function disconnectIntegrationProvider(
  client: SupabaseClient,
  provider: IntegrationProvider
): Promise<IntegrationsSnapshot> {
  const userId = await requireUser(client);
  const activeProvider = assertActiveProvider(provider);
  const connections = await listConnections(client, userId);
  const target =
    connections.find((connection) => connection.provider === activeProvider && connection.status === "active") ??
    connections.find((connection) => connection.provider === activeProvider);

  if (!target) {
    throw new Error("Provider connection not found.");
  }

  const { error } = await client
    .from("device_connections")
    .update({ status: "revoked" })
    .eq("id", target.id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message || "Unable to disconnect provider.");
  return loadIntegrationsSnapshot(client);
}

export async function queueIntegrationSync(
  client: SupabaseClient,
  connectionId: string
): Promise<IntegrationsSnapshot> {
  const userId = await requireUser(client);
  const connections = await listConnections(client, userId);
  const connection = connections.find((row) => row.id === connectionId);

  if (!connection) throw new Error("Provider connection not found.");
  if (connection.status !== "active") throw new Error("Reconnect the provider before requesting a sync.");

  const activeProvider = assertActiveProvider(connection.provider);
  const { error } = await client.from("device_sync_jobs").insert({
    connection_id: connection.id,
    user_id: userId,
    provider: activeProvider,
    job_type: "pull_activities",
    status: "queued",
    cursor: {},
    requested_by: userId,
    source_webhook_event_id: null
  });

  if (error) throw new Error(error.message || "Unable to queue sync.");
  return loadIntegrationsSnapshot(client);
}
