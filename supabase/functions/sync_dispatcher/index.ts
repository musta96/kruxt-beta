import { jsonResponse, parseJsonOr } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import {
  asRecord,
  asString,
  isActiveSyncProvider,
  isIntegrationProvider,
  isProviderEnabled,
  type IntegrationProvider
} from "../_shared/integrations.ts";

interface DispatcherInput {
  limit?: number;
  provider?: IntegrationProvider;
}

type DeviceSyncJobRow = {
  id: string;
  connection_id: string;
  user_id: string;
  provider: IntegrationProvider;
  job_type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "retry_scheduled";
  cursor: Record<string, unknown> | null;
  retry_count: number;
  next_retry_at: string | null;
  source_webhook_event_id: string | null;
};

type DeviceConnectionRow = {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  status: "active" | "revoked" | "expired" | "error";
  provider_user_id: string | null;
};

type WebhookEventRow = {
  id: string;
  provider: IntegrationProvider;
  event_type: string;
  payload_json: Record<string, unknown>;
  processing_status: "pending" | "processed" | "failed" | "ignored";
  received_at: string;
};

type ExternalActivityImportInsert = {
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
  raw_data: Record<string, unknown>;
};

class SyncProcessingError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }

  return null;
}

function asIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function extractActivities(payload: Record<string, unknown>): Record<string, unknown>[] {
  const rawActivities = payload.activities;
  if (Array.isArray(rawActivities)) {
    return rawActivities.map((entry) => asRecord(entry));
  }

  const activity = asRecord(payload.activity);
  if (Object.keys(activity).length > 0) {
    return [activity];
  }

  const hasId =
    asString(payload.external_activity_id) ??
    asString(payload.activity_id) ??
    asString(payload.id) ??
    asString(payload.uuid);

  if (hasId) {
    return [payload];
  }

  return [];
}

function normalizeActivity(
  job: DeviceSyncJobRow,
  event: WebhookEventRow,
  activity: Record<string, unknown>,
  activityIndex: number,
  payload: Record<string, unknown>
): ExternalActivityImportInsert {
  const externalActivityId =
    asString(activity.external_activity_id) ??
    asString(activity.activity_id) ??
    asString(activity.id) ??
    asString(activity.uuid) ??
    `${event.id}:${activityIndex + 1}`;

  return {
    user_id: job.user_id,
    connection_id: job.connection_id,
    provider: job.provider,
    external_activity_id: externalActivityId,
    activity_type:
      asString(activity.activity_type) ??
      asString(activity.type) ??
      asString(payload.activity_type) ??
      asString(event.event_type),
    started_at:
      asIsoTimestamp(activity.started_at) ??
      asIsoTimestamp(activity.start_time) ??
      asIsoTimestamp(payload.started_at) ??
      asIsoTimestamp(payload.start_time),
    ended_at:
      asIsoTimestamp(activity.ended_at) ??
      asIsoTimestamp(activity.end_time) ??
      asIsoTimestamp(payload.ended_at) ??
      asIsoTimestamp(payload.end_time),
    duration_seconds:
      asNumber(activity.duration_seconds) ??
      asNumber(activity.duration) ??
      asNumber(payload.duration_seconds) ??
      asNumber(payload.duration),
    distance_m: asNumber(activity.distance_m) ?? asNumber(activity.distance) ?? asNumber(payload.distance_m),
    calories: asNumber(activity.calories) ?? asNumber(payload.calories),
    average_hr: asNumber(activity.average_hr) ?? asNumber(activity.avg_hr) ?? asNumber(payload.average_hr),
    max_hr: asNumber(activity.max_hr) ?? asNumber(payload.max_hr),
    raw_data: {
      event_id: event.id,
      event_type: event.event_type,
      payload,
      activity
    }
  };
}

function eventMatchesConnection(payload: Record<string, unknown>, connection: DeviceConnectionRow): boolean {
  const connectionId = asString(payload.connection_id) ?? asString(payload.connectionId);
  const userId = asString(payload.user_id) ?? asString(payload.userId);
  const providerUserId = asString(payload.provider_user_id) ?? asString(payload.providerUserId);

  if (connectionId) {
    return connectionId === connection.id;
  }

  if (userId) {
    return userId === connection.user_id;
  }

  if (providerUserId && connection.provider_user_id) {
    return providerUserId === connection.provider_user_id;
  }

  return false;
}

function mergeCursorState(
  baseCursor: Record<string, unknown>,
  events: WebhookEventRow[],
  nowIso: string
): Record<string, unknown> {
  const merged = { ...baseCursor };

  for (const event of events) {
    const payload = asRecord(event.payload_json);
    Object.assign(merged, asRecord(payload.cursor));

    const nextCursor =
      asString(payload.next_cursor) ??
      asString(payload.nextCursor) ??
      asString(payload.sync_cursor) ??
      asString(payload.syncCursor);

    if (nextCursor) {
      merged.next_cursor = nextCursor;
    }
  }

  const lastEvent = events[events.length - 1];
  if (lastEvent) {
    merged.last_webhook_event_id = lastEvent.id;
    merged.last_webhook_received_at = lastEvent.received_at;
  }

  merged.updated_at = nowIso;
  return merged;
}

function calculateNextRetry(attempt: number, now: Date): string {
  const delayMinutes = Math.min(60, 5 * 2 ** Math.max(0, attempt - 1));
  return new Date(now.getTime() + delayMinutes * 60_000).toISOString();
}

async function insertOutboxEvent(
  supabase: ReturnType<typeof serviceClient>,
  eventType: string,
  aggregateId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("event_outbox").insert({
    event_type: eventType,
    aggregate_type: "device_sync_job",
    aggregate_id: aggregateId,
    payload
  });

  if (error) {
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await parseJsonOr<DispatcherInput>(request, {});
    if (body.provider && !isIntegrationProvider(body.provider)) {
      return jsonResponse({ error: "Unsupported provider." }, 400);
    }

    const limit = Math.min(Math.max(body.limit ?? 20, 1), 100);
    const now = new Date();
    const nowIso = now.toISOString();

    const supabase = serviceClient();
    let jobsQuery = supabase
      .from("device_sync_jobs")
      .select(
        "id,connection_id,user_id,provider,job_type,status,cursor,retry_count,next_retry_at,source_webhook_event_id"
      )
      .in("status", ["queued", "retry_scheduled"])
      .order("created_at", { ascending: true })
      .limit(limit);

    if (body.provider) {
      jobsQuery = jobsQuery.eq("provider", body.provider);
    }

    const { data: queuedJobs, error: fetchError } = await jobsQuery;
    if (fetchError) {
      throw fetchError;
    }

    const dueJobs = ((queuedJobs as DeviceSyncJobRow[]) ?? []).filter((job) => {
      if (job.status === "queued") {
        return true;
      }

      if (!job.next_retry_at) {
        return true;
      }

      return Date.parse(job.next_retry_at) <= now.getTime();
    });

    const processedJobIds: string[] = [];
    const retriedJobIds: string[] = [];
    const failedJobIds: string[] = [];

    for (const job of dueJobs) {
      const { data: claimedJob, error: claimError } = await supabase
        .from("device_sync_jobs")
        .update({
          status: "running",
          started_at: nowIso,
          finished_at: null,
          error_message: null
        })
        .eq("id", job.id)
        .in("status", ["queued", "retry_scheduled"])
        .select("id")
        .maybeSingle();

      if (claimError || !claimedJob) {
        continue;
      }

      try {
        const { data: connectionData, error: connectionError } = await supabase
          .from("device_connections")
          .select("id,user_id,provider,status,provider_user_id")
          .eq("id", job.connection_id)
          .maybeSingle();

        if (connectionError) {
          throw connectionError;
        }

        if (!connectionData) {
          throw new SyncProcessingError("Device connection was not found for sync job.", false);
        }

        const connection = connectionData as DeviceConnectionRow;
        if (connection.status !== "active") {
          throw new SyncProcessingError("Device connection is not active.", false);
        }

        if (connection.user_id !== job.user_id || connection.provider !== job.provider) {
          throw new SyncProcessingError("Sync job connection linkage is invalid.", false);
        }

        const providerEnabled = await isProviderEnabled(job.provider);
        if (!providerEnabled) {
          throw new SyncProcessingError(`Provider ${job.provider} is disabled by feature flag.`, false);
        }

        if (!isActiveSyncProvider(job.provider)) {
          throw new SyncProcessingError(`Provider ${job.provider} is not activated in this rollout window.`, false);
        }

        let events: WebhookEventRow[] = [];

        if (job.source_webhook_event_id) {
          const { data: sourceEventData, error: sourceEventError } = await supabase
            .from("integration_webhook_events")
            .select("id,provider,event_type,payload_json,processing_status,received_at")
            .eq("id", job.source_webhook_event_id)
            .in("processing_status", ["pending", "failed"])
            .maybeSingle();

          if (sourceEventError) {
            throw sourceEventError;
          }

          if (sourceEventData) {
            events = [sourceEventData as WebhookEventRow];
          }
        } else {
          const { data: pendingData, error: pendingError } = await supabase
            .from("integration_webhook_events")
            .select("id,provider,event_type,payload_json,processing_status,received_at")
            .eq("provider", job.provider)
            .eq("processing_status", "pending")
            .order("received_at", { ascending: true })
            .limit(100);

          if (pendingError) {
            throw pendingError;
          }

          events = ((pendingData as WebhookEventRow[]) ?? []).filter((event) =>
            eventMatchesConnection(asRecord(event.payload_json), connection)
          );
        }

        const importRows: ExternalActivityImportInsert[] = [];
        for (const event of events) {
          const payload = asRecord(event.payload_json);
          const activities = extractActivities(payload);

          for (let index = 0; index < activities.length; index += 1) {
            importRows.push(normalizeActivity(job, event, activities[index], index, payload));
          }
        }

        if (importRows.length > 0) {
          const { error: importError } = await supabase
            .from("external_activity_imports")
            .upsert(importRows, { onConflict: "user_id,provider,external_activity_id" });

          if (importError) {
            throw importError;
          }
        }

        const processedEventIds = events.map((event) => event.id);
        if (processedEventIds.length > 0) {
          const { error: processedUpdateError } = await supabase
            .from("integration_webhook_events")
            .update({
              processing_status: "processed",
              processed_at: nowIso,
              error_message: null,
              next_retry_at: null
            })
            .in("id", processedEventIds);

          if (processedUpdateError) {
            throw processedUpdateError;
          }
        }

        const mergedCursor = mergeCursorState(asRecord(job.cursor), events, nowIso);
        const latestEventId = events[events.length - 1]?.id ?? null;

        const { error: cursorError } = await supabase.from("device_sync_cursors").upsert(
          {
            connection_id: job.connection_id,
            user_id: job.user_id,
            provider: job.provider,
            cursor: mergedCursor,
            last_synced_at: nowIso,
            last_job_id: job.id,
            last_webhook_event_id: latestEventId,
            last_error: null
          },
          { onConflict: "connection_id" }
        );

        if (cursorError) {
          throw cursorError;
        }

        const { error: connectionUpdateError } = await supabase
          .from("device_connections")
          .update({
            last_synced_at: nowIso,
            last_error: null
          })
          .eq("id", job.connection_id);

        if (connectionUpdateError) {
          throw connectionUpdateError;
        }

        const { error: jobSuccessError } = await supabase
          .from("device_sync_jobs")
          .update({
            status: "succeeded",
            cursor: mergedCursor,
            error_message: null,
            next_retry_at: null,
            finished_at: nowIso
          })
          .eq("id", job.id);

        if (jobSuccessError) {
          throw jobSuccessError;
        }

        await insertOutboxEvent(supabase, "integration.sync_succeeded", job.id, {
          provider: job.provider,
          user_id: job.user_id,
          connection_id: job.connection_id,
          imported_count: importRows.length,
          processed_event_ids: processedEventIds
        });

        processedJobIds.push(job.id);
      } catch (error) {
        const typedError = error instanceof SyncProcessingError ? error : null;
        const retryable = typedError ? typedError.retryable : true;
        const attempt = job.retry_count + 1;
        const nextRetryAt = retryable && attempt <= 3 ? calculateNextRetry(attempt, now) : null;
        const nextStatus = nextRetryAt ? "retry_scheduled" : "failed";
        const message = String(error);

        const { error: jobFailureError } = await supabase
          .from("device_sync_jobs")
          .update({
            status: nextStatus,
            retry_count: attempt,
            next_retry_at: nextRetryAt,
            error_message: message,
            finished_at: nowIso
          })
          .eq("id", job.id);

        if (jobFailureError) {
          throw jobFailureError;
        }

        if (job.source_webhook_event_id) {
          const webhookPatch = nextRetryAt
            ? {
                processing_status: "pending",
                retry_count: attempt,
                next_retry_at: nextRetryAt,
                error_message: message
              }
            : {
                processing_status: "failed",
                retry_count: attempt,
                next_retry_at: null,
                error_message: message,
                processed_at: nowIso
              };

          const { error: webhookError } = await supabase
            .from("integration_webhook_events")
            .update(webhookPatch)
            .eq("id", job.source_webhook_event_id);

          if (webhookError) {
            throw webhookError;
          }
        }

        const { error: connectionError } = await supabase
          .from("device_connections")
          .update({ last_error: message })
          .eq("id", job.connection_id);

        if (connectionError) {
          throw connectionError;
        }

        const { error: cursorError } = await supabase.from("device_sync_cursors").upsert(
          {
            connection_id: job.connection_id,
            user_id: job.user_id,
            provider: job.provider,
            cursor: asRecord(job.cursor),
            last_job_id: job.id,
            last_error: message
          },
          { onConflict: "connection_id" }
        );

        if (cursorError) {
          throw cursorError;
        }

        await insertOutboxEvent(supabase, "integration.sync_failed", job.id, {
          provider: job.provider,
          user_id: job.user_id,
          connection_id: job.connection_id,
          retry_scheduled: Boolean(nextRetryAt),
          retry_count: attempt,
          next_retry_at: nextRetryAt,
          error: message
        });

        if (nextRetryAt) {
          retriedJobIds.push(job.id);
        } else {
          failedJobIds.push(job.id);
        }
      }
    }

    return jsonResponse({
      scannedCount: dueJobs.length,
      processedCount: processedJobIds.length,
      retriedCount: retriedJobIds.length,
      failedCount: failedJobIds.length,
      processedJobIds,
      retriedJobIds,
      failedJobIds
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
