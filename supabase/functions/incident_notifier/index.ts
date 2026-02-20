import { jsonResponse, parseJsonOr } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

type IncidentNotificationChannel = "email" | "webhook";
type IncidentDeliveryMode = "drill" | "live";

interface IncidentNotifierPayload {
  claimLimit?: number;
  retryDelaySeconds?: number;
  maxRetries?: number;
  forceDrill?: boolean;
}

interface ClaimedIncidentNotificationJob {
  id: string;
  incident_id: string;
  channel: IncidentNotificationChannel;
  destination: string;
  template_key: string;
  payload: Record<string, unknown>;
  delivery_mode: IncidentDeliveryMode;
  provider: string;
  attempt_count: number;
}

interface JobFailureResult {
  status?: string;
  finalFailure?: boolean;
}

interface DeliveryResult {
  channel: IncidentNotificationChannel;
  provider: string;
  destination: string;
  mode: IncidentDeliveryMode;
  delivered: boolean;
  summary: string;
  metadata: Record<string, unknown>;
}

interface OutboundNotifier {
  readonly channel: IncidentNotificationChannel;
  send(job: ClaimedIncidentNotificationJob, options: { forceDrill: boolean }): Promise<DeliveryResult>;
}

class EmailStubNotifier implements OutboundNotifier {
  readonly channel = "email" as const;

  async send(job: ClaimedIncidentNotificationJob, options: { forceDrill: boolean }): Promise<DeliveryResult> {
    const mode: IncidentDeliveryMode = options.forceDrill ? "drill" : job.delivery_mode;
    const delivered = false;

    return {
      channel: this.channel,
      provider: "stub",
      destination: job.destination,
      mode,
      delivered,
      summary:
        mode === "drill"
          ? "Drill mode stub executed (no external email sent)."
          : "Live mode stub executed (external email provider not configured).",
      metadata: {
        templateKey: job.template_key,
        payloadPreviewKeys: Object.keys(job.payload ?? {}),
        liveProviderConfigured: false
      }
    };
  }
}

class WebhookStubNotifier implements OutboundNotifier {
  readonly channel = "webhook" as const;

  async send(job: ClaimedIncidentNotificationJob, options: { forceDrill: boolean }): Promise<DeliveryResult> {
    const mode: IncidentDeliveryMode = options.forceDrill ? "drill" : job.delivery_mode;
    const delivered = false;

    return {
      channel: this.channel,
      provider: "stub",
      destination: job.destination,
      mode,
      delivered,
      summary:
        mode === "drill"
          ? "Drill mode stub executed (no external webhook call made)."
          : "Live mode stub executed (external webhook sender not configured).",
      metadata: {
        templateKey: job.template_key,
        payloadPreviewKeys: Object.keys(job.payload ?? {}),
        liveProviderConfigured: false
      }
    };
  }
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value as number), min), max);
}

function getNotifier(channel: IncidentNotificationChannel): OutboundNotifier {
  if (channel === "email") {
    return new EmailStubNotifier();
  }

  return new WebhookStubNotifier();
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = serviceClient();
    const payload = await parseJsonOr<IncidentNotifierPayload>(request, {});
    const claimLimit = clamp(payload.claimLimit, 1, 100, 20);
    const retryDelaySeconds = clamp(payload.retryDelaySeconds, 60, 86400, 900);
    const maxRetries = clamp(payload.maxRetries, 1, 20, 5);
    const forceDrill = Boolean(payload.forceDrill);

    const { data: claimedData, error: claimError } = await supabase.rpc("claim_incident_notification_jobs", {
      p_limit: claimLimit
    });

    if (claimError) {
      throw claimError;
    }

    const claimedJobs = (claimedData ?? []) as ClaimedIncidentNotificationJob[];
    const succeededJobIds: string[] = [];
    const failedJobIds: string[] = [];
    const retryScheduledJobIds: string[] = [];
    const finalFailedJobIds: string[] = [];
    const errors: Array<{ jobId: string; error: string }> = [];

    for (const job of claimedJobs) {
      try {
        const notifier = getNotifier(job.channel);
        const deliveryResult = await notifier.send(job, { forceDrill });

        const { error: completeError } = await supabase.rpc("complete_incident_notification_job", {
          p_job_id: job.id,
          p_response_payload: {
            notifier: deliveryResult.provider,
            channel: deliveryResult.channel,
            destination: deliveryResult.destination,
            mode: deliveryResult.mode,
            delivered: deliveryResult.delivered,
            summary: deliveryResult.summary,
            metadata: deliveryResult.metadata,
            processed_at: new Date().toISOString()
          }
        });

        if (completeError) {
          throw completeError;
        }

        succeededJobIds.push(job.id);
      } catch (jobError) {
        const errorText = jobError instanceof Error ? jobError.message : String(jobError);

        const { data: failureResultData, error: failureResultError } = await supabase.rpc(
          "fail_incident_notification_job",
          {
            p_job_id: job.id,
            p_error: errorText,
            p_retry_delay_seconds: retryDelaySeconds,
            p_max_retries: maxRetries
          }
        );

        failedJobIds.push(job.id);
        errors.push({ jobId: job.id, error: errorText });

        if (failureResultError) {
          finalFailedJobIds.push(job.id);
          continue;
        }

        const failureResult = (failureResultData ?? {}) as JobFailureResult;

        if (failureResult.finalFailure || failureResult.status === "failed") {
          finalFailedJobIds.push(job.id);
        } else {
          retryScheduledJobIds.push(job.id);
        }
      }
    }

    return jsonResponse({
      claimedCount: claimedJobs.length,
      succeededCount: succeededJobIds.length,
      failedCount: failedJobIds.length,
      retryScheduledCount: retryScheduledJobIds.length,
      finalFailedCount: finalFailedJobIds.length,
      forceDrill,
      succeededJobIds,
      failedJobIds,
      retryScheduledJobIds,
      finalFailedJobIds,
      errors
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
