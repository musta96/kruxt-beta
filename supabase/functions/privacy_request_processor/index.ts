import { jsonResponse, parseJsonOr } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { requireWorkerAuth } from "../_shared/worker-auth.ts";
import { z } from "npm:zod@3";

const PrivacyQueueSchema = z.object({
  triageLimit: z.number().int().min(1).max(200).optional(),
  overdueLimit: z.number().int().min(1).max(500).optional(),
  exportQueueLimit: z.number().int().min(1).max(200).optional(),
  exportClaimLimit: z.number().int().min(1).max(50).optional(),
  exportUrlTtlSeconds: z.number().int().min(300).max(3600).optional(),
  exportRetryDelaySeconds: z.number().int().min(60).max(86400).optional(),
  exportMaxRetries: z.number().int().min(1).max(20).optional(),
  deleteQueueLimit: z.number().int().min(1).max(200).optional(),
  deleteClaimLimit: z.number().int().min(1).max(50).optional(),
  deleteRetryDelaySeconds: z.number().int().min(60).max(86400).optional(),
  deleteMaxRetries: z.number().int().min(1).max(20).optional(),
});

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

const EXPORT_BUCKET = "privacy-exports";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type PrivacyClient = ReturnType<typeof serviceClient>;

// Deployment attestations only: operators must review the inventory outside this
// worker. Neither an environment setting nor this worker proves GDPR readiness.
function inventoryReady(attestation: string): boolean {
  const version = Deno.env.get("PRIVACY_REVIEWED_INVENTORY_VERSION");
  return typeof version === "string" && /^v[0-9]+(?:[._-][A-Za-z0-9]+)*$/.test(version)
    && version.length <= 64 && Deno.env.get(attestation) === version;
}

async function requireNoLegalHold(supabase: PrivacyClient, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("has_active_legal_hold", { p_user_id: userId });
  if (error || data !== false) throw new Error("legal_hold_clearance_required");
}

async function subjectExportPaths(supabase: PrivacyClient, userId: string): Promise<string[]> {
  if (!UUID.test(userId)) throw new Error("export_storage_scope_invalid");
  const paths: string[] = [];
  const folders = [userId];
  let entries = 0;
  // Fixed budget per scan: at most 26 lists, 500 entries, depth two. Fetch one
  // extra entry to detect truncation; never infer completeness from a full page.
  for (let index = 0; index < folders.length; index++) {
    const folder = folders[index];
    const { data, error } = await supabase.storage.from(EXPORT_BUCKET).list(folder, {
      limit: 101, offset: 0, sortBy: { column: "name", order: "asc" }
    });
    if (error || !Array.isArray(data)) throw new Error("export_storage_list_failed");
    entries += data.length;
    if (data.length > 100 || entries > 500) throw new Error("export_storage_scan_limit");
    for (const entry of data) {
      if (typeof entry.name !== "string") throw new Error("export_storage_scope_invalid");
      if (entry.id === null && index === 0 && UUID.test(entry.name)) {
        if (folders.length >= 26) throw new Error("export_storage_scan_limit");
        folders.push(`${userId}/${entry.name}`);
      } else if (typeof entry.id === "string" && index > 0
        && /^[0-9a-f-]{36}-[0-9]+\.json$/.test(entry.name)
        && UUID.test(entry.name.slice(0, 36))) {
        paths.push(`${folder}/${entry.name}`);
      } else {
        throw new Error("export_storage_scope_invalid");
      }
    }
  }
  return paths;
}

async function deleteSubjectExports(supabase: PrivacyClient, userId: string): Promise<void> {
  const paths = await subjectExportPaths(supabase, userId);
  for (let offset = 0; offset < paths.length; offset += 100) {
    await requireNoLegalHold(supabase, userId);
    const { error } = await supabase.storage.from(EXPORT_BUCKET).remove(paths.slice(offset, offset + 100));
    if (error) throw new Error("export_storage_remove_failed");
  }
  // A partial removal or newly visible package must not produce a fulfilled claim.
  if ((await subjectExportPaths(supabase, userId)).length) {
    throw new Error("export_storage_not_empty");
  }
}

async function cleanupExpiredExports(supabase: PrivacyClient): Promise<number> {
  const { data, error } = await supabase.from("privacy_export_jobs")
    .select("id,user_id,privacy_request_id,storage_bucket,storage_path")
    .eq("status", "succeeded").lt("signed_url_expires_at", new Date().toISOString())
    .not("storage_path", "is", null).order("signed_url_expires_at", { ascending: true }).limit(100);
  if (error || !Array.isArray(data)) throw new Error("export_expiry_scan_failed");
  let removed = 0;
  for (const job of data) {
    if (![job.id, job.user_id, job.privacy_request_id].every(id => typeof id === "string" && UUID.test(id))
      || job.storage_bucket !== EXPORT_BUCKET || typeof job.storage_path !== "string"
      || !job.storage_path.startsWith(`${job.user_id}/${job.privacy_request_id}/${job.id}-`)
      || !/^[0-9]+\.json$/.test(job.storage_path.slice(`${job.user_id}/${job.privacy_request_id}/${job.id}-`.length))) {
      throw new Error("export_expiry_scope_invalid");
    }
    // A hold preserves the package for operator review; it must not stop others' cleanup.
    const hold = await supabase.rpc("has_active_legal_hold", { p_user_id: job.user_id });
    if (hold.error || hold.data !== false) continue;
    const deletion = await supabase.storage.from(EXPORT_BUCKET).remove([job.storage_path]);
    if (deletion.error) throw new Error("export_expiry_remove_failed");
    const update = await supabase.from("privacy_export_jobs")
      .update({ storage_path: null, signed_url: null }).eq("id", job.id).eq("storage_path", job.storage_path);
    if (update.error) throw new Error("export_expiry_checkpoint_failed");
    removed++;
  }
  return removed;
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

  const denied = await requireWorkerAuth(request);
  if (denied) return denied;

  try {
    const raw = await parseJsonOr<unknown>(request, {});
    const parsed = PrivacyQueueSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResponse({
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      }, 400);
    }

    const supabase = serviceClient();
    const payload = parsed.data;
    const triageLimit = clamp(payload.triageLimit, 1, 200, 25);
    const overdueLimit = clamp(payload.overdueLimit, 1, 500, 100);
    const exportQueueLimit = clamp(payload.exportQueueLimit, 1, 200, 40);
    const exportClaimLimit = clamp(payload.exportClaimLimit, 1, 50, 8);
    const exportUrlTtlSeconds = clamp(payload.exportUrlTtlSeconds, 300, 3600, 3600);
    const exportRetryDelaySeconds = clamp(payload.exportRetryDelaySeconds, 60, 86400, 900);
    const exportMaxRetries = clamp(payload.exportMaxRetries, 1, 20, 5);
    const deleteQueueLimit = clamp(payload.deleteQueueLimit, 1, 200, 25);
    const deleteClaimLimit = clamp(payload.deleteClaimLimit, 1, 50, 6);
    const deleteRetryDelaySeconds = clamp(payload.deleteRetryDelaySeconds, 60, 86400, 900);
    const deleteMaxRetries = clamp(payload.deleteMaxRetries, 1, 20, 5);
    const exportEnabled = inventoryReady("PRIVACY_EXPORT_READY_INVENTORY_VERSION");
    const deleteEnabled = inventoryReady("PRIVACY_OPERATOR_REVIEWED_ERASURE_INVENTORY_VERSION");
    const expiredExportPackagesRemoved = exportEnabled || deleteEnabled
      ? await cleanupExpiredExports(supabase) : 0;

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

    const { data: queuedExportData, error: queueExportError } = exportEnabled ? await supabase.rpc("queue_privacy_export_jobs", {
      p_limit: exportQueueLimit
    }) : { data: 0, error: null };

    if (queueExportError) {
      throw queueExportError;
    }

    const { data: claimedExportData, error: claimExportError } = exportEnabled ? await supabase.rpc("claim_privacy_export_jobs", {
      p_limit: exportClaimLimit
    }) : { data: [], error: null };

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
      let uploadedPath: string | undefined;
      let failureCode = "export_generation_failed";
      try {
        await requireNoLegalHold(supabase, job.user_id);
        if (![job.user_id, job.privacy_request_id, job.id].every((id) => UUID.test(id))) {
          throw new Error("export_storage_scope_invalid");
        }
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
        const bucket = EXPORT_BUCKET;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, fileBytes, {
            contentType: "application/json; charset=utf-8",
            upsert: false
          });

        if (uploadError) {
          throw uploadError;
        }
        uploadedPath = path;
        failureCode = "export_signing_failed";

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
        failureCode = "export_completion_failed";

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
      } catch {
        let errorText = failureCode;
        if (uploadedPath) {
          try {
            await requireNoLegalHold(supabase, job.user_id);
            const { error } = await supabase.storage.from(EXPORT_BUCKET).remove([uploadedPath]);
            if (error) throw new Error("export_cleanup_failed");
          } catch {
            errorText = "export_cleanup_required";
          }
        }

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

    const { data: queuedDeleteData, error: queueDeleteError } = deleteEnabled ? await supabase.rpc("queue_privacy_delete_jobs", {
      p_limit: deleteQueueLimit
    }) : { data: 0, error: null };

    if (queueDeleteError) {
      throw queueDeleteError;
    }

    const { data: claimedDeleteData, error: claimDeleteError } = deleteEnabled ? await supabase.rpc("claim_privacy_delete_jobs", {
      p_limit: deleteClaimLimit
    }) : { data: [], error: null };

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
      let failureCode = "legal_hold_clearance_required";
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
        if (legalHoldData !== false) throw new Error("legal_hold_clearance_required");

        failureCode = "export_package_cleanup_required";
        await deleteSubjectExports(supabase, job.user_id);
        await requireNoLegalHold(supabase, job.user_id);
        failureCode = "anonymization_failed";

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

        failureCode = "erasure_completion_failed";
        const { error: completeDeleteError } = await supabase.rpc("complete_privacy_delete_job", {
          p_job_id: job.id,
          p_anonymization_summary: anonymizationSummary ?? {}
        });

        if (completeDeleteError) {
          throw completeDeleteError;
        }

        deleteSucceededJobIds.push(job.id);
      } catch {
        const errorText = failureCode;

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
      expiredExportPackagesRemoved,
      exportProcessing: {
        enabled: exportEnabled,
        state: exportEnabled ? "enabled_by_operator_attestation" : "disabled_inventory_review_required",
        requiredConfiguration: ["PRIVACY_REVIEWED_INVENTORY_VERSION", "PRIVACY_EXPORT_READY_INVENTORY_VERSION"]
      },
      deleteProcessing: {
        enabled: deleteEnabled,
        state: deleteEnabled ? "enabled_by_operator_attestation" : "disabled_operator_reviewed_erasure_required",
        requiredConfiguration: ["PRIVACY_REVIEWED_INVENTORY_VERSION", "PRIVACY_OPERATOR_REVIEWED_ERASURE_INVENTORY_VERSION"]
      },
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
  } catch {
    // Upstream errors may contain signed URLs, package contents, or credentials.
    return jsonResponse({ error: "Privacy queue processing failed." }, 500);
  }
});
