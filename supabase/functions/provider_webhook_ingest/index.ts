import { parseJson, jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import {
  asRecord,
  asString,
  isActiveSyncProvider,
  isIntegrationProvider,
  isProviderEnabled,
  normalizeWebhookEventId,
  sha256Hex,
  type IntegrationProvider
} from "../_shared/integrations.ts";

interface WebhookPayload {
  provider: IntegrationProvider;
  providerEventId?: string;
  eventType: string;
  payload?: Record<string, unknown>;
  payloadHash?: string;
  userId?: string;
  connectionId?: string;
  providerUserId?: string;
}

type WebhookEventRow = {
  id: string;
  provider_event_id: string;
  payload_hash: string;
  processing_status: "pending" | "processed" | "failed" | "ignored";
};

type ConnectionTargetRow = {
  id: string;
  user_id: string;
  provider_user_id: string | null;
};

function isUniqueViolation(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : null;
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message) : "";

  return code === "23505" || message.toLowerCase().includes("duplicate");
}

async function findExistingWebhookEvent(
  supabase: ReturnType<typeof serviceClient>,
  provider: IntegrationProvider,
  providerEventId: string,
  payloadHash: string
): Promise<WebhookEventRow | null> {
  const byEventId = await supabase
    .from("integration_webhook_events")
    .select("id,provider_event_id,payload_hash,processing_status")
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId)
    .maybeSingle();

  if (!byEventId.error && byEventId.data) {
    return byEventId.data as WebhookEventRow;
  }

  const byHash = await supabase
    .from("integration_webhook_events")
    .select("id,provider_event_id,payload_hash,processing_status")
    .eq("provider", provider)
    .eq("payload_hash", payloadHash)
    .maybeSingle();

  if (byHash.error) {
    throw byHash.error;
  }

  return (byHash.data as WebhookEventRow | null) ?? null;
}

async function resolveTargetConnections(
  supabase: ReturnType<typeof serviceClient>,
  provider: IntegrationProvider,
  hints: { connectionId: string | null; userId: string | null; providerUserId: string | null }
): Promise<ConnectionTargetRow[]> {
  let query = supabase
    .from("device_connections")
    .select("id,user_id,provider_user_id")
    .eq("provider", provider)
    .eq("status", "active")
    .limit(25);

  if (hints.connectionId) {
    query = query.eq("id", hints.connectionId);
  } else if (hints.userId) {
    query = query.eq("user_id", hints.userId);
  } else if (hints.providerUserId) {
    query = query.eq("provider_user_id", hints.providerUserId);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data as ConnectionTargetRow[]) ?? [];
}

async function markWebhookIgnored(
  supabase: ReturnType<typeof serviceClient>,
  webhookEventId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from("integration_webhook_events")
    .update({
      processing_status: "ignored",
      processed_at: new Date().toISOString(),
      error_message: reason
    })
    .eq("id", webhookEventId);

  if (error) {
    throw error;
  }
}

function deriveJobCursor(payload: Record<string, unknown>): Record<string, unknown> {
  const cursor: Record<string, unknown> = {
    ...asRecord(payload.cursor)
  };

  const nextCursor =
    asString(payload.next_cursor) ??
    asString(payload.nextCursor) ??
    asString(payload.sync_cursor) ??
    asString(payload.syncCursor);

  if (nextCursor) {
    cursor.next_cursor = nextCursor;
  }

  return cursor;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await parseJson<WebhookPayload>(request);
    if (!isIntegrationProvider(body.provider)) {
      return jsonResponse({ accepted: false, error: "Unsupported provider." }, 400);
    }

    const eventType = asString(body.eventType);
    if (!eventType) {
      return jsonResponse({ accepted: false, error: "eventType is required." }, 400);
    }

    const payload = asRecord(body.payload);
    const payloadHash = asString(body.payloadHash) ?? (await sha256Hex(payload));
    const providerEventId = normalizeWebhookEventId(body.provider, asString(body.providerEventId), payloadHash);
    const providerEnabled = await isProviderEnabled(body.provider);

    const webhookRow = {
      provider: body.provider,
      provider_event_id: providerEventId,
      event_type: eventType,
      payload_hash: payloadHash,
      payload_json: payload,
      processing_status: providerEnabled ? "pending" : "ignored",
      processed_at: providerEnabled ? null : new Date().toISOString()
    };

    const supabase = serviceClient();
    let webhookEvent: WebhookEventRow | null = null;
    let duplicate = false;

    const { data: insertedData, error: insertError } = await supabase
      .from("integration_webhook_events")
      .insert(webhookRow)
      .select("id,provider_event_id,payload_hash,processing_status")
      .single();

    if (insertError) {
      if (!isUniqueViolation(insertError)) {
        throw insertError;
      }

      duplicate = true;
      webhookEvent = await findExistingWebhookEvent(supabase, body.provider, providerEventId, payloadHash);
      if (!webhookEvent) {
        throw insertError;
      }
    } else {
      webhookEvent = insertedData as WebhookEventRow;
    }

    if (!providerEnabled) {
      return jsonResponse({
        accepted: true,
        duplicate,
        providerEnabled: false,
        queuedJobs: 0,
        webhookEventId: webhookEvent.id
      });
    }

    if (!isActiveSyncProvider(body.provider)) {
      await markWebhookIgnored(
        supabase,
        webhookEvent.id,
        `Provider ${body.provider} is not activated in this rollout window.`
      );

      return jsonResponse({
        accepted: true,
        duplicate,
        providerEnabled: true,
        queuedJobs: 0,
        webhookEventId: webhookEvent.id
      });
    }

    if (webhookEvent.processing_status !== "pending") {
      const { error: reactivateError } = await supabase
        .from("integration_webhook_events")
        .update({
          processing_status: "pending",
          processed_at: null,
          error_message: null,
          next_retry_at: null
        })
        .eq("id", webhookEvent.id);

      if (reactivateError) {
        throw reactivateError;
      }
    }

    const hints = {
      connectionId: asString(body.connectionId) ?? asString(payload.connection_id) ?? asString(payload.connectionId),
      userId: asString(body.userId) ?? asString(payload.user_id) ?? asString(payload.userId),
      providerUserId:
        asString(body.providerUserId) ??
        asString(payload.provider_user_id) ??
        asString(payload.providerUserId)
    };

    const connections = await resolveTargetConnections(supabase, body.provider, hints);
    if (connections.length === 0) {
      await markWebhookIgnored(supabase, webhookEvent.id, "No active connection matched webhook payload.");

      return jsonResponse({
        accepted: true,
        duplicate,
        providerEnabled: true,
        queuedJobs: 0,
        webhookEventId: webhookEvent.id
      });
    }

    const cursor = deriveJobCursor(payload);
    const jobs = connections.map((connection) => ({
      connection_id: connection.id,
      user_id: connection.user_id,
      provider: body.provider,
      job_type: "webhook_pull",
      status: "queued",
      cursor,
      requested_by: null,
      source_webhook_event_id: webhookEvent.id
    }));

    const { data: queuedRows, error: queueError } = await supabase
      .from("device_sync_jobs")
      .upsert(jobs, { onConflict: "connection_id,source_webhook_event_id", ignoreDuplicates: true })
      .select("id");

    if (queueError) {
      throw queueError;
    }

    return jsonResponse({
      accepted: true,
      duplicate,
      providerEnabled: true,
      queuedJobs: (queuedRows ?? []).length,
      matchedConnections: connections.length,
      webhookEventId: webhookEvent.id
    });
  } catch (error) {
    return jsonResponse({ accepted: false, error: String(error) }, 500);
  }
});
