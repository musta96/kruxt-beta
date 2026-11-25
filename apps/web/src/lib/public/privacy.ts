import type {
  PrivacyRequest,
  PrivacyRequestStatus,
  PrivacyRequestType,
  RequiredConsentGap
} from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type PrivacyRequestRow = {
  id: string;
  user_id: string;
  request_type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  reason: string | null;
  submitted_at: string;
  due_at: string;
  triaged_at: string | null;
  in_progress_at: string | null;
  resolved_at: string | null;
  response_location: string | null;
  response_expires_at: string | null;
  response_content_type: string | null;
  response_bytes: number | null;
  handled_by: string | null;
  notes: string | null;
  sla_breached_at: string | null;
  created_at: string;
  updated_at: string;
};

type ConsentGapRow = {
  consent_type: RequiredConsentGap["consentType"];
  required_policy_version_id: string | null;
  required_policy_version: string | null;
  reason: RequiredConsentGap["reason"];
};

export interface PrivacySnapshot {
  consentStatusUnavailable: boolean;
  hasRequiredConsents: boolean;
  missingRequiredConsents: RequiredConsentGap[];
  openRequests: PrivacyRequest[];
  recentRequests: PrivacyRequest[];
  downloadableExports: PrivacyRequest[];
  overdueOpenCount: number;
}

const OPEN_STATUSES: PrivacyRequestStatus[] = ["submitted", "triaged", "in_progress", "in_review"];
const REQUEST_TYPES = new Set(["access", "export", "delete", "rectify", "restrict_processing"]);
const ERROR_COPY = {
  load: "Unable to load privacy requests.",
  submit: "Unable to submit privacy request.",
  auth: "Authentication required.",
  type: "Choose a valid privacy request type.",
  reason: "Privacy request reason must be no more than 2000 characters."
};
const knownErrors = new WeakMap<Error, string>();

function privacyError(kind: keyof typeof ERROR_COPY): Error {
  const error = new Error(ERROR_COPY[kind]);
  knownErrors.set(error, ERROR_COPY[kind]);
  return error;
}

export function privacyErrorMessage(error: unknown, operation: "load" | "submit"): string {
  return (error instanceof Error && knownErrors.get(error)) || ERROR_COPY[operation];
}

async function requireUser(client: SupabaseClient): Promise<string> {
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user?.id) throw privacyError("auth");
    return data.user.id;
  } catch {
    throw privacyError("auth");
  }
}

function safeResponseLocation(row: PrivacyRequestRow): string | null {
  const expiry = Date.parse(row.response_expires_at ?? "");
  if (!Number.isFinite(expiry) || expiry <= Date.now() || !row.response_location) return null;
  try {
    const url = new URL(row.response_location);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function mapPrivacyRequest(row: PrivacyRequestRow): PrivacyRequest {
  return {
    id: row.id,
    userId: row.user_id,
    requestType: row.request_type,
    status: row.status,
    reason: row.reason,
    submittedAt: row.submitted_at,
    dueAt: row.due_at,
    triagedAt: row.triaged_at,
    inProgressAt: row.in_progress_at,
    resolvedAt: row.resolved_at,
    responseLocation: safeResponseLocation(row),
    responseExpiresAt: row.response_expires_at,
    responseContentType: row.response_content_type,
    responseBytes: row.response_bytes,
    handledBy: row.handled_by,
    notes: row.notes,
    slaBreachedAt: row.sla_breached_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapConsentGap(row: ConsentGapRow): RequiredConsentGap {
  return {
    consentType: row.consent_type,
    requiredPolicyVersionId: row.required_policy_version_id,
    requiredPolicyVersion: row.required_policy_version,
    reason: row.reason
  };
}

async function listRequests(
  client: SupabaseClient,
  userId: string,
  options: { openOnly?: boolean; exportsOnly?: boolean; limit?: number } = {}
): Promise<PrivacyRequest[]> {
  let query = client
    .from("privacy_requests")
    .select(
      "id,user_id,request_type,status,reason,submitted_at,due_at,triaged_at,in_progress_at,resolved_at,response_location,response_expires_at,response_content_type,response_bytes,handled_by,notes,sla_breached_at,created_at,updated_at"
    )
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(options.limit ?? 80);

  if (options.openOnly) {
    query = query.in("status", OPEN_STATUSES);
  }

  if (options.exportsOnly) {
    query = query.in("request_type", ["access", "export"]).eq("status", "fulfilled").not("response_location", "is", null);
  }

  const { data, error } = await query;
  if (error) throw privacyError("load");

  return (((data ?? []) as PrivacyRequestRow[]) ?? []).map(mapPrivacyRequest);
}

async function consentResponse(client: SupabaseClient, name: string, userId: string) {
  try {
    return await client.rpc(name, { p_user_id: userId });
  } catch {
    return { data: null, error: true };
  }
}

async function loadSnapshot(client: SupabaseClient): Promise<PrivacySnapshot> {
  const userId = await requireUser(client);
  const [hasConsentsResponse, consentGapsResponse, openRequests, recentRequests, downloadableExports] =
    await Promise.all([
      consentResponse(client, "user_has_required_consents", userId),
      consentResponse(client, "list_missing_required_consents", userId),
      listRequests(client, userId, { openOnly: true, limit: 30 }),
      listRequests(client, userId, { limit: 80 }),
      listRequests(client, userId, { exportsOnly: true, limit: 12 })
    ]);

  const gaps = consentGapsResponse.data;
  const validGaps = Array.isArray(gaps) && gaps.every(gap => gap &&
    ["terms", "privacy", "health_data_processing"].includes(gap.consent_type) &&
    typeof gap.reason === "string" &&
    (gap.required_policy_version_id === null || typeof gap.required_policy_version_id === "string") &&
    (gap.required_policy_version === null || typeof gap.required_policy_version === "string"));
  const consentStatusUnavailable = Boolean(hasConsentsResponse.error || consentGapsResponse.error ||
    typeof hasConsentsResponse.data !== "boolean" || !validGaps);

  const now = Date.now();
  const overdueOpenCount = openRequests.filter((request) => {
    if (request.slaBreachedAt) return true;
    const dueAt = Date.parse(request.dueAt);
    return Number.isFinite(dueAt) && dueAt < now;
  }).length;

  return {
    consentStatusUnavailable,
    hasRequiredConsents: !consentStatusUnavailable && hasConsentsResponse.data === true,
    missingRequiredConsents: consentStatusUnavailable ? [] : ((consentGapsResponse.data ?? []) as ConsentGapRow[]).map(mapConsentGap),
    openRequests,
    recentRequests,
    downloadableExports: downloadableExports.filter((request) => request.responseLocation !== null),
    overdueOpenCount
  };
}

export async function loadPrivacySnapshot(client: SupabaseClient): Promise<PrivacySnapshot> {
  try {
    return await loadSnapshot(client);
  } catch (error) {
    throw knownErrors.has(error as Error) ? error : privacyError("load");
  }
}

export async function submitPrivacyRequest(
  client: SupabaseClient,
  input: { requestType: PrivacyRequestType; reason?: string }
): Promise<string> {
  try {
    await requireUser(client);
    if (!input || !REQUEST_TYPES.has(input.requestType)) throw privacyError("type");
    if (input.reason !== undefined && (typeof input.reason !== "string" || input.reason.length > 2000)) {
      throw privacyError("reason");
    }
    const { data, error } = await client.rpc("submit_privacy_request", {
      p_request_type: input.requestType,
      p_reason: input.reason?.trim() || null
    });
    if (error || typeof data !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data) ||
        data === "00000000-0000-0000-0000-000000000000") {
      throw privacyError("submit");
    }
    return data;
  } catch (error) {
    throw knownErrors.has(error as Error) ? error : privacyError("submit");
  }
}
