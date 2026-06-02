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
  hasRequiredConsents: boolean;
  missingRequiredConsents: RequiredConsentGap[];
  openRequests: PrivacyRequest[];
  recentRequests: PrivacyRequest[];
  downloadableExports: PrivacyRequest[];
  overdueOpenCount: number;
}

const OPEN_STATUSES: PrivacyRequestStatus[] = ["submitted", "triaged", "in_progress", "in_review"];

async function requireUser(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }

  return data.user.id;
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
    responseLocation: row.response_location,
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
  if (error) throw new Error(error.message || "Unable to load privacy requests.");

  return (((data ?? []) as PrivacyRequestRow[]) ?? []).map(mapPrivacyRequest);
}

export async function loadPrivacySnapshot(client: SupabaseClient): Promise<PrivacySnapshot> {
  const userId = await requireUser(client);
  const [hasConsentsResponse, consentGapsResponse, openRequests, recentRequests, downloadableExports] =
    await Promise.all([
      client.rpc("user_has_required_consents", { p_user_id: userId }),
      client.rpc("list_missing_required_consents", { p_user_id: userId }),
      listRequests(client, userId, { openOnly: true, limit: 30 }),
      listRequests(client, userId, { limit: 80 }),
      listRequests(client, userId, { exportsOnly: true, limit: 12 })
    ]);

  if (hasConsentsResponse.error) {
    throw new Error(hasConsentsResponse.error.message || "Unable to validate required consents.");
  }
  if (consentGapsResponse.error) {
    throw new Error(consentGapsResponse.error.message || "Unable to load consent gaps.");
  }

  const now = Date.now();
  const overdueOpenCount = openRequests.filter((request) => {
    if (request.slaBreachedAt) return true;
    const dueAt = Date.parse(request.dueAt);
    return Number.isFinite(dueAt) && dueAt < now;
  }).length;

  return {
    hasRequiredConsents: Boolean(hasConsentsResponse.data),
    missingRequiredConsents: (((consentGapsResponse.data ?? []) as ConsentGapRow[]) ?? []).map(mapConsentGap),
    openRequests,
    recentRequests,
    downloadableExports,
    overdueOpenCount
  };
}

export async function submitPrivacyRequest(
  client: SupabaseClient,
  input: { requestType: PrivacyRequestType; reason?: string }
): Promise<PrivacySnapshot> {
  const userId = await requireUser(client);
  const { error } = await client.rpc("submit_privacy_request", {
    p_request_type: input.requestType,
    p_reason: input.reason?.trim() || null
  });

  if (error) throw new Error(error.message || "Unable to submit privacy request.");

  const [hasConsentsResponse, consentGapsResponse, openRequests, recentRequests, downloadableExports] =
    await Promise.all([
      client.rpc("user_has_required_consents", { p_user_id: userId }),
      client.rpc("list_missing_required_consents", { p_user_id: userId }),
      listRequests(client, userId, { openOnly: true, limit: 30 }),
      listRequests(client, userId, { limit: 80 }),
      listRequests(client, userId, { exportsOnly: true, limit: 12 })
    ]);

  if (hasConsentsResponse.error) {
    throw new Error(hasConsentsResponse.error.message || "Unable to validate required consents.");
  }
  if (consentGapsResponse.error) {
    throw new Error(consentGapsResponse.error.message || "Unable to load consent gaps.");
  }

  const now = Date.now();
  return {
    hasRequiredConsents: Boolean(hasConsentsResponse.data),
    missingRequiredConsents: (((consentGapsResponse.data ?? []) as ConsentGapRow[]) ?? []).map(mapConsentGap),
    openRequests,
    recentRequests,
    downloadableExports,
    overdueOpenCount: openRequests.filter((request) => {
      if (request.slaBreachedAt) return true;
      const dueAt = Date.parse(request.dueAt);
      return Number.isFinite(dueAt) && dueAt < now;
    }).length
  };
}
