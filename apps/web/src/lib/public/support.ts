import type {
  CreateSupportTicketMessageInput,
  SupportAutomationRun,
  SupportTicket,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketStatus
} from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

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

type MembershipRow = {
  gym_id: string;
  role: string;
  membership_status: string;
  gyms: { name: string | null } | Array<{ name: string | null }> | null;
};

export interface SupportGymOption {
  gymId: string;
  gymName: string | null;
  role: string;
  membershipStatus: string;
}

export interface SupportSnapshot {
  tickets: SupportTicket[];
  selectedTicketId?: string;
  selectedTicket: SupportTicket | null;
  selectedTicketMessages: SupportTicketMessage[];
  selectedTicketAutomationRuns: SupportAutomationRun[];
  gymOptions: SupportGymOption[];
}

export interface SupportLoadOptions {
  selectedTicketId?: string;
  statuses?: SupportTicketStatus[];
  includeClosed?: boolean;
  search?: string;
}

function toObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Array<
    Record<string, unknown>
  >;
}

function relationName(value: MembershipRow["gyms"]): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value.name ?? null;
}

async function requireUser(client: SupabaseClient): Promise<{ id: string; email?: string }> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }

  return {
    id: data.user.id,
    email: data.user.email
  };
}

function mapTicket(row: SupportTicketRow): SupportTicket {
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

function mapMessage(row: SupportTicketMessageRow): SupportTicketMessage {
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

function mapAutomationRun(row: SupportAutomationRunRow): SupportAutomationRun {
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

async function loadGymOptions(client: SupabaseClient, userId: string): Promise<SupportGymOption[]> {
  const { data, error } = await client
    .from("gym_memberships")
    .select("gym_id,role,membership_status,gyms(name)")
    .eq("user_id", userId)
    .in("membership_status", ["pending", "trial", "active", "paused"]);

  if (error) throw new Error(error.message || "Unable to load support gym context.");

  return (((data ?? []) as MembershipRow[]) ?? []).map((membership) => ({
    gymId: membership.gym_id,
    gymName: relationName(membership.gyms),
    role: membership.role,
    membershipStatus: membership.membership_status
  }));
}

async function listTickets(
  client: SupabaseClient,
  userId: string,
  options: SupportLoadOptions
): Promise<SupportTicket[]> {
  const includeClosed = options.includeClosed ?? false;
  const statuses = options.statuses ?? [];
  const search = (options.search ?? "").trim();

  let query = client
    .from("support_tickets")
    .select("*")
    .eq("reporter_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(150);

  if (statuses.length > 0) {
    query = query.in("status", statuses);
  } else if (!includeClosed) {
    query = query.in("status", ["open", "triaged", "waiting_user", "in_progress", "waiting_approval"]);
  }

  if (search) {
    query = query.or(`subject.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message || "Unable to load support tickets.");

  return (((data ?? []) as SupportTicketRow[]) ?? []).map(mapTicket);
}

async function listMessages(client: SupabaseClient, ticketId: string): Promise<SupportTicketMessage[]> {
  const { data, error } = await client
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message || "Unable to load ticket messages.");
  return (((data ?? []) as SupportTicketMessageRow[]) ?? []).map(mapMessage);
}

async function listAutomationRuns(client: SupabaseClient, ticketId: string): Promise<SupportAutomationRun[]> {
  const { data, error } = await client
    .from("support_automation_runs")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message || "Unable to load support automation runs.");
  return (((data ?? []) as SupportAutomationRunRow[]) ?? []).map(mapAutomationRun);
}

function resolveSelectedTicketId(tickets: SupportTicket[], selectedTicketId?: string): string | undefined {
  if (selectedTicketId && tickets.some((ticket) => ticket.id === selectedTicketId)) {
    return selectedTicketId;
  }

  return tickets[0]?.id;
}

export async function loadSupportSnapshot(
  client: SupabaseClient,
  options: SupportLoadOptions = {}
): Promise<SupportSnapshot> {
  const user = await requireUser(client);
  const [tickets, gymOptions] = await Promise.all([
    listTickets(client, user.id, options),
    loadGymOptions(client, user.id)
  ]);
  const selectedTicketId = resolveSelectedTicketId(tickets, options.selectedTicketId);
  const [selectedTicketMessages, selectedTicketAutomationRuns] = selectedTicketId
    ? await Promise.all([listMessages(client, selectedTicketId), listAutomationRuns(client, selectedTicketId)])
    : [[], []];

  return {
    tickets,
    selectedTicketId,
    selectedTicket: selectedTicketId ? tickets.find((ticket) => ticket.id === selectedTicketId) ?? null : null,
    selectedTicketMessages,
    selectedTicketAutomationRuns,
    gymOptions
  };
}

export async function submitSupportTicket(
  client: SupabaseClient,
  input: {
    subject: string;
    description: string;
    gymId?: string | null;
    category?: string;
    priority?: SupportTicketPriority;
  }
): Promise<SupportSnapshot> {
  const user = await requireUser(client);
  const { data, error } = await client.rpc("submit_support_ticket", {
    p_subject: input.subject.trim(),
    p_description: input.description.trim(),
    p_gym_id: input.gymId || null,
    p_category: input.category?.trim() || "general",
    p_priority: input.priority ?? "normal",
    p_channel: "in_app",
    p_reporter_email: user.email ?? null,
    p_metadata: {
      submittedFrom: "web_member_app"
    }
  });

  if (error) throw new Error(error.message || "Unable to submit support ticket.");

  const ticket = mapTicket(data as SupportTicketRow);
  return loadSupportSnapshot(client, { selectedTicketId: ticket.id });
}

export async function createSupportTicketMessage(
  client: SupabaseClient,
  ticketId: string,
  input: CreateSupportTicketMessageInput
): Promise<SupportSnapshot> {
  const user = await requireUser(client);
  const { error } = await client.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    actor_type: input.actorType,
    actor_user_id: input.actorUserId ?? user.id,
    actor_label: input.actorLabel ?? null,
    is_internal: input.isInternal ?? false,
    body: input.body.trim(),
    attachments: input.attachments ?? [],
    metadata: input.metadata ?? {}
  });

  if (error) throw new Error(error.message || "Unable to send ticket reply.");
  return loadSupportSnapshot(client, { selectedTicketId: ticketId });
}
