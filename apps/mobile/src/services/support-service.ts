import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
  CreateSupportTicketMessageInput,
  SubmitSupportTicketInput,
  SupportAutomationRun,
  SupportTicket,
  SupportTicketMessage,
  SupportTicketStatus
} from "@kruxt/types";

import { KruxtAppError, throwIfError } from "./errors";

type SupportTicketRow = {
  id: string;
  ticket_number: number | string;
  gym_id: string | null;
  reporter_user_id: string | null;
  reporter_email: string | null;
  channel: SupportTicket["channel"];
  category: string;
  priority: SupportTicket["priority"];
  status: SupportTicket["status"];
  subject: string;
  description: string;
  affected_surface: string | null;
  impacted_users_count: number;
  requires_human_approval: boolean;
  owner_user_id: string | null;
  ai_summary: string | null;
  ai_triage_labels: string[] | null;
  ai_recommended_actions: unknown;
  ai_confidence: number | null;
  last_customer_reply_at: string | null;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type SupportTicketMessageRow = {
  id: string;
  ticket_id: string;
  actor_type: SupportTicketMessage["actorType"];
  actor_user_id: string | null;
  actor_label: string | null;
  is_internal: boolean;
  body: string;
  attachments: unknown;
  metadata: Record<string, unknown>;
  created_at: string;
};

type SupportAutomationRunRow = {
  id: string;
  ticket_id: string;
  agent_name: string;
  trigger_source: string;
  run_status: SupportAutomationRun["runStatus"];
  requires_approval: boolean;
  approval_status: SupportAutomationRun["approvalStatus"];
  plan_json: Record<string, unknown>;
  proposed_changes: unknown;
  approved_by: string | null;
  approved_at: string | null;
  executed_at: string | null;
  notification_sent_at: string | null;
  result_summary: string | null;
  result_payload: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export interface SupportTicketListOptions {
  statuses?: SupportTicketStatus[];
  includeClosed?: boolean;
  gymId?: string;
  search?: string;
  limit?: number;
}

function toObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => item as Record<string, unknown>);
}

function mapSupportTicket(row: SupportTicketRow): SupportTicket {
  return {
    id: row.id,
    ticketNumber: Number(row.ticket_number),
    gymId: row.gym_id,
    reporterUserId: row.reporter_user_id,
    reporterEmail: row.reporter_email,
    channel: row.channel,
    category: row.category,
    priority: row.priority,
    status: row.status,
    subject: row.subject,
    description: row.description,
    affectedSurface: row.affected_surface,
    impactedUsersCount: row.impacted_users_count,
    requiresHumanApproval: row.requires_human_approval,
    ownerUserId: row.owner_user_id,
    aiSummary: row.ai_summary,
    aiTriageLabels: row.ai_triage_labels ?? [],
    aiRecommendedActions: toObjectArray(row.ai_recommended_actions),
    aiConfidence: row.ai_confidence,
    lastCustomerReplyAt: row.last_customer_reply_at,
    firstResponseDueAt: row.first_response_due_at,
    resolutionDueAt: row.resolution_due_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSupportTicketMessage(row: SupportTicketMessageRow): SupportTicketMessage {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    actorType: row.actor_type,
    actorUserId: row.actor_user_id,
    actorLabel: row.actor_label,
    isInternal: row.is_internal,
    body: row.body,
    attachments: toObjectArray(row.attachments),
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  };
}

function mapSupportAutomationRun(row: SupportAutomationRunRow): SupportAutomationRun {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    agentName: row.agent_name,
    triggerSource: row.trigger_source,
    runStatus: row.run_status,
    requiresApproval: row.requires_approval,
    approvalStatus: row.approval_status,
    planJson: row.plan_json ?? {},
    proposedChanges: toObjectArray(row.proposed_changes),
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    executedAt: row.executed_at,
    notificationSentAt: row.notification_sent_at,
    resultSummary: row.result_summary,
    resultPayload: row.result_payload ?? {},
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SupportService {
  constructor(private readonly supabase: SupabaseClient) {}

  private async getCurrentUser(): Promise<User> {
    const { data, error } = await this.supabase.auth.getUser();
    throwIfError(error, "SUPPORT_AUTH_READ_FAILED", "Unable to read support user.");

    if (!data.user) {
      throw new KruxtAppError("SUPPORT_AUTH_REQUIRED", "Sign in is required for support actions.");
    }

    return data.user;
  }

  async listMyTickets(options: SupportTicketListOptions = {}): Promise<SupportTicket[]> {
    const user = await this.getCurrentUser();

    const statuses = options.statuses ?? [];
    const includeClosed = options.includeClosed ?? false;
    const limit = Math.min(Math.max(options.limit ?? 150, 1), 500);
    const search = (options.search ?? "").trim();

    let query = this.supabase
      .from("support_tickets")
      .select("*")
      .eq("reporter_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options.gymId) {
      query = query.eq("gym_id", options.gymId);
    }

    if (statuses.length > 0) {
      query = query.in("status", statuses);
    } else if (!includeClosed) {
      query = query.in("status", ["open", "triaged", "waiting_user", "in_progress", "waiting_approval"]);
    }

    if (search.length > 0) {
      query = query.or(`subject.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;
    throwIfError(error, "SUPPORT_TICKETS_READ_FAILED", "Unable to load support tickets.");

    return ((data as SupportTicketRow[]) ?? []).map(mapSupportTicket);
  }

  async submitTicket(input: SubmitSupportTicketInput): Promise<SupportTicket> {
    const { data, error } = await this.supabase.rpc("submit_support_ticket", {
      p_subject: input.subject,
      p_description: input.description,
      p_gym_id: input.gymId ?? null,
      p_category: input.category ?? "general",
      p_priority: input.priority ?? "normal",
      p_channel: input.channel ?? "in_app",
      p_reporter_email: input.reporterEmail ?? null,
      p_metadata: input.metadata ?? {}
    });

    throwIfError(error, "SUPPORT_TICKET_SUBMIT_FAILED", "Unable to submit support ticket.");

    const row = data as SupportTicketRow | null;
    if (!row) {
      throw new KruxtAppError("SUPPORT_TICKET_SUBMIT_EMPTY", "Support ticket submission returned no row.");
    }

    return mapSupportTicket(row);
  }

  async listTicketMessages(ticketId: string, limit = 500): Promise<SupportTicketMessage[]> {
    const { data, error } = await this.supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 1000));

    throwIfError(error, "SUPPORT_MESSAGES_READ_FAILED", "Unable to load support messages.");
    return ((data as SupportTicketMessageRow[]) ?? []).map(mapSupportTicketMessage);
  }

  async createTicketMessage(ticketId: string, input: CreateSupportTicketMessageInput): Promise<SupportTicketMessage> {
    const user = await this.getCurrentUser();

    const payload = {
      ticket_id: ticketId,
      actor_type: input.actorType,
      actor_user_id: input.actorUserId ?? user.id,
      actor_label: input.actorLabel ?? null,
      is_internal: input.isInternal ?? false,
      body: input.body,
      attachments: input.attachments ?? [],
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("support_ticket_messages")
      .insert(payload)
      .select("*")
      .single();

    throwIfError(error, "SUPPORT_MESSAGE_CREATE_FAILED", "Unable to create support message.");
    return mapSupportTicketMessage(data as SupportTicketMessageRow);
  }

  async listTicketAutomationRuns(ticketId: string, limit = 200): Promise<SupportAutomationRun[]> {
    const { data, error } = await this.supabase
      .from("support_automation_runs")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));

    throwIfError(error, "SUPPORT_AUTOMATION_RUNS_READ_FAILED", "Unable to load support automation runs.");
    return ((data as SupportAutomationRunRow[]) ?? []).map(mapSupportAutomationRun);
  }

  async approveAutomationRun(runId: string, approve: boolean, note?: string): Promise<SupportAutomationRun> {
    const { data, error } = await this.supabase.rpc("approve_support_automation_run", {
      p_run_id: runId,
      p_approve: approve,
      p_note: note ?? null
    });

    throwIfError(error, "SUPPORT_AUTOMATION_RUN_APPROVAL_FAILED", "Unable to update automation approval.");

    const row = data as SupportAutomationRunRow | null;
    if (!row) {
      throw new KruxtAppError("SUPPORT_AUTOMATION_RUN_APPROVAL_EMPTY", "Automation approval returned no row.");
    }

    return mapSupportAutomationRun(row);
  }
}
