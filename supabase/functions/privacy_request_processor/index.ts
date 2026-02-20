import { jsonResponse, parseJsonOr } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

interface PrivacyQueuePayload {
  triageLimit?: number;
  overdueLimit?: number;
  exportQueueLimit?: number;
  exportClaimLimit?: number;
  exportUrlTtlSeconds?: number;
  exportRetryDelaySeconds?: number;
  exportMaxRetries?: number;
  deleteQueueLimit?: number;
  deleteClaimLimit?: number;
  deleteRetryDelaySeconds?: number;
  deleteMaxRetries?: number;
}

interface ClaimedPrivacyExportJob {
  id: string;
  privacy_request_id: string;
  user_id: string;
  retry_count: number;
}

interface ClaimedPrivacyDeleteJob {
  id: string;
  privacy_request_id: string;
  user_id: string;
  retry_count: number;
}

interface FailureResult {
  status?: string;
  finalFailure?: boolean;
}

function normalizeSignedUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!supabaseUrl) {
    return url;
  }

  const normalizedPath = url.startsWith("/") ? url : `/${url}`;
  if (normalizedPath.startsWith("/storage/v1/")) {
    return `${supabaseUrl}${normalizedPath}`;
  }

  return `${supabaseUrl}/storage/v1${normalizedPath}`;
}

function estimateRecordCount(payload: unknown): number {
  if (!payload || typeof payload !== "object") {
    return 0;
  }

  let total = 0;
  const record = payload as Record<string, unknown>;
  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      total += value.length;
      continue;
    }

    if (value && typeof value === "object") {
      total += 1;
    }
  }

  return total;
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value as number), min), max);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = serviceClient();
    const payload = await parseJsonOr<PrivacyQueuePayload>(request, {});
    const triageLimit = clamp(payload.triageLimit, 1, 200, 25);
    const overdueLimit = clamp(payload.overdueLimit, 1, 500, 100);
    const exportQueueLimit = clamp(payload.exportQueueLimit, 1, 200, 40);
    const exportClaimLimit = clamp(payload.exportClaimLimit, 1, 50, 8);
    const exportUrlTtlSeconds = clamp(payload.exportUrlTtlSeconds, 300, 604800, 86400);
    const exportRetryDelaySeconds = clamp(payload.exportRetryDelaySeconds, 60, 86400, 900);
    const exportMaxRetries = clamp(payload.exportMaxRetries, 1, 20, 5);
    const deleteQueueLimit = clamp(payload.deleteQueueLimit, 1, 200, 25);
    const deleteClaimLimit = clamp(payload.deleteClaimLimit, 1, 50, 6);
    const deleteRetryDelaySeconds = clamp(payload.deleteRetryDelaySeconds, 60, 86400, 900);
    const deleteMaxRetries = clamp(payload.deleteMaxRetries, 1, 20, 5);

    const { data, error } = await supabase.rpc("process_privacy_request_queue", {
      p_triage_limit: triageLimit,
      p_overdue_limit: overdueLimit
    });

    if (error) {
      throw error;
    }

    const result = (data ?? {}) as {
      triagedCount?: number;
      overdueMarkedCount?: number;
      triagedRequestIds?: string[];
      overdueRequestIds?: string[];
    };

    const { data: queuedExportData, error: queueExportError } = await supabase.rpc("queue_privacy_export_jobs", {
      p_limit: exportQueueLimit
    });

    if (queueExportError) {
      throw queueExportError;
    }

    const { data: claimedExportData, error: claimExportError } = await supabase.rpc("claim_privacy_export_jobs", {
      p_limit: exportClaimLimit
    });

    if (claimExportError) {
      throw claimExportError;
    }

    const claimedJobs = (claimedExportData ?? []) as ClaimedPrivacyExportJob[];
    const exportSucceededJobIds: string[] = [];
    const exportFailedJobIds: string[] = [];
    const exportRetryScheduledJobIds: string[] = [];
    const exportFinalFailedJobIds: string[] = [];
    const exportErrors: Array<{ jobId: string; error: string }> = [];

    for (const job of claimedJobs) {
      try {
        const { data: exportPayload, error: exportPayloadError } = await supabase.rpc(
          "build_privacy_export_payload",
          { p_user_id: job.user_id }
        );

        if (exportPayloadError) {
          throw exportPayloadError;
        }

        const serializedPayload = JSON.stringify(exportPayload ?? {}, null, 2);
        const fileBytes = new TextEncoder().encode(serializedPayload);
        const path = `${job.user_id}/${job.privacy_request_id}/${job.id}-${Date.now()}.json`;
        const bucket = "privacy-exports";

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, fileBytes, {
            contentType: "application/json; charset=utf-8",
            upsert: true
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, exportUrlTtlSeconds);

        if (signedError) {
          throw signedError;
        }

        const signedUrl = signedData?.signedUrl;
        if (!signedUrl) {
          throw new Error("Signed URL generation returned no URL.");
        }

        const signedUrlExpiresAt = new Date(Date.now() + exportUrlTtlSeconds * 1000).toISOString();
        const estimatedRecordCount = estimateRecordCount(exportPayload);

        const { error: completeError } = await supabase.rpc("complete_privacy_export_job", {
          p_job_id: job.id,
          p_storage_bucket: bucket,
          p_storage_path: path,
          p_signed_url: normalizeSignedUrl(signedUrl),
          p_signed_url_expires_at: signedUrlExpiresAt,
          p_file_bytes: fileBytes.byteLength,
          p_record_count: estimatedRecordCount,
          p_content_type: "application/json"
        });

        if (completeError) {
          throw completeError;
        }

        exportSucceededJobIds.push(job.id);
      } catch (jobError) {
        const errorText = jobError instanceof Error ? jobError.message : String(jobError);

        const { data: failureResultData, error: failureResultError } = await supabase.rpc(
          "fail_privacy_export_job",
          {
            p_job_id: job.id,
            p_error: errorText,
            p_retry_delay_seconds: exportRetryDelaySeconds,
            p_max_retries: exportMaxRetries
          }
        );

        exportFailedJobIds.push(job.id);
        exportErrors.push({ jobId: job.id, error: errorText });

        if (failureResultError) {
          exportFinalFailedJobIds.push(job.id);
          continue;
        }

        const failureResult = (failureResultData ?? {}) as FailureResult;

        if (failureResult.finalFailure || failureResult.status === "failed") {
          exportFinalFailedJobIds.push(job.id);
        } else {
          exportRetryScheduledJobIds.push(job.id);
        }
      }
    }

    const { data: queuedDeleteData, error: queueDeleteError } = await supabase.rpc("queue_privacy_delete_jobs", {
      p_limit: deleteQueueLimit
    });

    if (queueDeleteError) {
      throw queueDeleteError;
    }

    const { data: claimedDeleteData, error: claimDeleteError } = await supabase.rpc("claim_privacy_delete_jobs", {
      p_limit: deleteClaimLimit
    });

    if (claimDeleteError) {
      throw claimDeleteError;
    }

    const claimedDeleteJobs = (claimedDeleteData ?? []) as ClaimedPrivacyDeleteJob[];
    const deleteSucceededJobIds: string[] = [];
    const deleteFailedJobIds: string[] = [];
    const deleteRetryScheduledJobIds: string[] = [];
    const deleteFinalFailedJobIds: string[] = [];
    const deleteErrors: Array<{ jobId: string; error: string }> = [];

    for (const job of claimedDeleteJobs) {
      try {
        const { data: legalHoldData, error: legalHoldError } = await supabase.rpc("has_active_legal_hold", {
          p_user_id: job.user_id
        });

        if (legalHoldError) {
          throw legalHoldError;
        }

        if (Boolean(legalHoldData)) {
          const holdError = "Active legal hold blocks delete fulfillment.";

          const { data: holdFailureData, error: holdFailureError } = await supabase.rpc(
            "fail_privacy_delete_job",
            {
              p_job_id: job.id,
              p_error: holdError,
              p_retry_delay_seconds: deleteRetryDelaySeconds,
              p_max_retries: deleteMaxRetries,
              p_force_final: true
            }
          );

          deleteFailedJobIds.push(job.id);
          deleteErrors.push({ jobId: job.id, error: holdError });

          if (holdFailureError) {
            deleteFinalFailedJobIds.push(job.id);
            continue;
          }

          const holdFailureResult = (holdFailureData ?? {}) as FailureResult;

          if (holdFailureResult.finalFailure || holdFailureResult.status === "failed") {
            deleteFinalFailedJobIds.push(job.id);
          } else {
            deleteRetryScheduledJobIds.push(job.id);
          }

          continue;
        }

        const { data: anonymizationSummary, error: anonymizationError } = await supabase.rpc(
          "apply_user_anonymization",
          {
            p_user_id: job.user_id,
            p_privacy_request_id: job.privacy_request_id
          }
        );

        if (anonymizationError) {
          throw anonymizationError;
        }

        const { error: completeDeleteError } = await supabase.rpc("complete_privacy_delete_job", {
          p_job_id: job.id,
          p_anonymization_summary: anonymizationSummary ?? {}
        });

        if (completeDeleteError) {
          throw completeDeleteError;
        }

        deleteSucceededJobIds.push(job.id);
      } catch (jobError) {
        const errorText = jobError instanceof Error ? jobError.message : String(jobError);

        const { data: failureResultData, error: failureResultError } = await supabase.rpc(
          "fail_privacy_delete_job",
          {
            p_job_id: job.id,
            p_error: errorText,
            p_retry_delay_seconds: deleteRetryDelaySeconds,
            p_max_retries: deleteMaxRetries,
            p_force_final: false
          }
        );

        deleteFailedJobIds.push(job.id);
        deleteErrors.push({ jobId: job.id, error: errorText });

        if (failureResultError) {
          deleteFinalFailedJobIds.push(job.id);
          continue;
        }

        const failureResult = (failureResultData ?? {}) as FailureResult;

        if (failureResult.finalFailure || failureResult.status === "failed") {
          deleteFinalFailedJobIds.push(job.id);
        } else {
          deleteRetryScheduledJobIds.push(job.id);
        }
      }
    }

    return jsonResponse({
      triagedCount: result.triagedCount ?? 0,
      overdueMarkedCount: result.overdueMarkedCount ?? 0,
      triagedRequestIds: result.triagedRequestIds ?? [],
      overdueRequestIds: result.overdueRequestIds ?? [],
      queuedExportCount: Number(queuedExportData ?? 0),
      claimedExportCount: claimedJobs.length,
      exportSucceededCount: exportSucceededJobIds.length,
      exportFailedCount: exportFailedJobIds.length,
      exportRetryScheduledCount: exportRetryScheduledJobIds.length,
      exportFinalFailedCount: exportFinalFailedJobIds.length,
      exportSucceededJobIds,
      exportFailedJobIds,
      exportRetryScheduledJobIds,
      exportFinalFailedJobIds,
      exportErrors,
      queuedDeleteCount: Number(queuedDeleteData ?? 0),
      claimedDeleteCount: claimedDeleteJobs.length,
      deleteSucceededCount: deleteSucceededJobIds.length,
      deleteFailedCount: deleteFailedJobIds.length,
      deleteRetryScheduledCount: deleteRetryScheduledJobIds.length,
      deleteFinalFailedCount: deleteFinalFailedJobIds.length,
      deleteSucceededJobIds,
      deleteFailedJobIds,
      deleteRetryScheduledJobIds,
      deleteFinalFailedJobIds,
      deleteErrors
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
