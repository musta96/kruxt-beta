import type { SupabaseClient } from "@supabase/supabase-js";
import type { PrivacyRequest, SubmitPrivacyRequestInput } from "@kruxt/types";

import { KruxtAppError, throwIfError } from "./errors";

type PrivacyRequestRow = {
  id: string;
  user_id: string;
  request_type: PrivacyRequest["requestType"];
  status: PrivacyRequest["status"];
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

export interface ListPrivacyRequestsOptions {
  openOnly?: boolean;
  limit?: number;
}

const OPEN_PRIVACY_STATUSES: PrivacyRequest["status"][] = [
  "submitted",
  "triaged",
  "in_progress",
  "in_review"
];

export class PrivacyRequestService {
  constructor(private readonly supabase: SupabaseClient) {}

  private async getById(userId: string, requestId: string): Promise<PrivacyRequest> {
    const { data, error } = await this.supabase
      .from("privacy_requests")
      .select(
        "id,user_id,request_type,status,reason,submitted_at,due_at,triaged_at,in_progress_at,resolved_at,response_location,response_expires_at,response_content_type,response_bytes,handled_by,notes,sla_breached_at,created_at,updated_at"
      )
      .eq("id", requestId)
      .eq("user_id", userId)
      .maybeSingle();

    throwIfError(error, "PRIVACY_REQUEST_READ_FAILED", "Unable to load privacy request.");

    if (!data) {
      throw new KruxtAppError("PRIVACY_REQUEST_NOT_FOUND", "Privacy request not found.");
    }

    return mapPrivacyRequest(data as PrivacyRequestRow);
  }

  async submit(userId: string, input: SubmitPrivacyRequestInput): Promise<PrivacyRequest> {
    const { data, error } = await this.supabase.rpc("submit_privacy_request", {
      p_request_type: input.requestType,
      p_reason: input.reason?.trim() || null
    });

    throwIfError(error, "PRIVACY_REQUEST_SUBMIT_FAILED", "Unable to submit privacy request.");

    if (!data || typeof data !== "string") {
      throw new KruxtAppError(
        "PRIVACY_REQUEST_SUBMIT_NO_ID",
        "Privacy request submission completed without an id."
      );
    }

    return this.getById(userId, data);
  }

  async listMine(userId: string, options: ListPrivacyRequestsOptions = {}): Promise<PrivacyRequest[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

    let query = this.supabase
      .from("privacy_requests")
      .select(
        "id,user_id,request_type,status,reason,submitted_at,due_at,triaged_at,in_progress_at,resolved_at,response_location,response_expires_at,response_content_type,response_bytes,handled_by,notes,sla_breached_at,created_at,updated_at"
      )
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false })
      .limit(limit);

    if (options.openOnly) {
      query = query.in("status", OPEN_PRIVACY_STATUSES);
    }

    const { data, error } = await query;
    throwIfError(error, "PRIVACY_REQUEST_LIST_FAILED", "Unable to load privacy requests.");

    return ((data as PrivacyRequestRow[]) ?? []).map(mapPrivacyRequest);
  }

  async listDownloadableExports(userId: string, limit = 20): Promise<PrivacyRequest[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const { data, error } = await this.supabase
      .from("privacy_requests")
      .select(
        "id,user_id,request_type,status,reason,submitted_at,due_at,triaged_at,in_progress_at,resolved_at,response_location,response_expires_at,response_content_type,response_bytes,handled_by,notes,sla_breached_at,created_at,updated_at"
      )
      .eq("user_id", userId)
      .in("request_type", ["access", "export"])
      .eq("status", "fulfilled")
      .not("response_location", "is", null)
      .order("resolved_at", { ascending: false })
      .limit(safeLimit);

    throwIfError(error, "PRIVACY_EXPORT_LIST_FAILED", "Unable to load downloadable exports.");

    return ((data as PrivacyRequestRow[]) ?? []).map(mapPrivacyRequest);
  }
}
