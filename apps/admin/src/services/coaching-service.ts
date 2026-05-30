import type { SupabaseClient } from "@supabase/supabase-js";
import type { MembershipStatus, MemberWorkoutPlanStatus } from "@kruxt/types";

import { KruxtAdminError, throwIfAdminError } from "./errors";
import { StaffAccessService } from "./staff-access-service";

type CapabilityRow = {
  capability_key: string;
  effective_bool: boolean | null;
  source: string | null;
  template_key: string | null;
  template_name: string | null;
  impact_count: number | null;
};

type AthleteSummaryRow = {
  membership_id: string;
  member_user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  membership_status: MembershipStatus;
  membership_plan_id: string | null;
  membership_plan_name: string | null;
  last_session_at: string | null;
  next_session_at: string | null;
  adherence_percent: number | string | null;
  needs_attention: boolean | null;
  needs_attention_reasons: string[] | null;
  unread_messages: number | null;
  latest_plan_id: string | null;
  latest_plan_title: string | null;
  latest_plan_status: string | null;
  latest_plan_updated_at: string | null;
  last_workout_at: string | null;
  checkins_30d: number | null;
  workouts_30d: number | null;
};

type PlanTemplateRow = {
  id: string;
  gym_id: string;
  coach_user_id: string;
  title: string;
  goal: string | null;
  plan_json: Record<string, unknown>;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
};

type RpcRecord = Record<string, unknown>;

export interface CoachingCapabilityStatus {
  enabled: boolean;
  source?: string | null;
  templateKey?: string | null;
  templateName?: string | null;
  impactCount: number;
}

export interface CoachingAthleteSummary {
  membershipId: string;
  memberUserId: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  membershipStatus: MembershipStatus;
  membershipPlanId?: string | null;
  membershipPlanName?: string | null;
  lastSessionAt?: string | null;
  nextSessionAt?: string | null;
  adherencePercent: number;
  needsAttention: boolean;
  needsAttentionReasons: string[];
  unreadMessages: number;
  latestPlanId?: string | null;
  latestPlanTitle?: string | null;
  latestPlanStatus?: string | null;
  latestPlanUpdatedAt?: string | null;
  lastWorkoutAt?: string | null;
  checkins30d: number;
  workouts30d: number;
}

export interface CoachingWorkspaceProfile {
  membershipId?: string;
  memberUserId: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  membershipStatus?: MembershipStatus;
  membershipPlanId?: string | null;
  membershipPlanName?: string | null;
}

export interface CoachingWorkspaceStats {
  checkins30d?: number;
  workouts30d?: number;
  prs90d?: number;
  latestWorkoutAt?: string | null;
  completedSessions30d?: number;
  scheduledSessions30d?: number;
}

export interface CoachingWorkspacePlan {
  id: string;
  title: string;
  goal?: string | null;
  status: MemberWorkoutPlanStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  planJson: Record<string, unknown>;
  versionNumber?: number;
  publishedAt?: string | null;
  source?: string | null;
  updatedAt: string;
}

export interface CoachingWorkspaceMessage {
  id: string;
  senderUserId: string;
  messageType: "direct" | "broadcast" | "system";
  body?: string | null;
  attachmentType?: string | null;
  attachmentRef: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
}

export interface CoachingWorkspaceSession {
  id: string;
  staffShiftId?: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "confirmed" | "completed" | "missed" | "cancelled";
  notes?: string | null;
  createdAt: string;
}

export interface CoachingWorkspaceNote {
  id: string;
  noteType: string;
  title: string;
  body: string;
  visibility: "coach_private" | "member_visible";
  sensitive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoachingWorkspaceGoal {
  id: string;
  title: string;
  metricKey?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  dueAt?: string | null;
  status: "active" | "achieved" | "paused" | "archived";
  updatedAt: string;
}

export interface CoachingWorkspaceSwap {
  id: string;
  workoutPlanId: string;
  exercisePath: Record<string, unknown>;
  originalExercise: string;
  replacementExercise: string;
  reason?: string | null;
  createdAt: string;
}

export interface CoachingWorkspaceActivityItem {
  type: "checkin" | "workout";
  id: string;
  title: string;
  occurredAt: string;
  detail?: string | null;
}

export interface CoachingWorkspaceDetail {
  masked: boolean;
  profile: CoachingWorkspaceProfile;
  stats: CoachingWorkspaceStats;
  plans: CoachingWorkspacePlan[];
  messages: CoachingWorkspaceMessage[];
  sessions: CoachingWorkspaceSession[];
  notes: CoachingWorkspaceNote[];
  goals: CoachingWorkspaceGoal[];
  exerciseSwaps: CoachingWorkspaceSwap[];
  activity: CoachingWorkspaceActivityItem[];
}

export interface CoachingPlanTemplate {
  id: string;
  gymId: string;
  coachUserId: string;
  title: string;
  goal?: string | null;
  planJson: Record<string, unknown>;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoachingPlanExercise {
  day: string;
  exercise: string;
  sets?: string;
  reps?: string;
  load?: string;
  tempo?: string;
  rest?: string;
  notes?: string;
}

export interface PublishCoachingPlanInput {
  memberUserId: string;
  title: string;
  goal?: string;
  exercises: CoachingPlanExercise[];
  notes?: string;
  workoutPlanId?: string | null;
  source?: "manual" | "template" | "ai_draft" | "import";
}

export interface SwapExerciseInput {
  memberUserId: string;
  workoutPlanId: string;
  exercisePath: Record<string, unknown>;
  originalExercise: string;
  replacementExercise: string;
  reason?: string;
}

export interface ScheduleSessionInput {
  memberUserId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  notes?: string;
}

export interface CreateNoteInput {
  memberUserId: string;
  title: string;
  body: string;
  noteType?: string;
  visibility?: "coach_private" | "member_visible";
}

export interface UpsertGoalInput {
  memberUserId: string;
  title: string;
  metricKey?: string;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string;
  dueAt?: string | null;
  goalId?: string | null;
}

export interface SaveTemplateInput {
  title: string;
  goal?: string;
  exercises: CoachingPlanExercise[];
  notes?: string;
  isShared?: boolean;
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? Number(parsed) : 0;
}

function mapAthlete(row: AthleteSummaryRow): CoachingAthleteSummary {
  return {
    membershipId: row.membership_id,
    memberUserId: row.member_user_id,
    displayName: row.display_name,
    username: row.username,
    avatarUrl: row.avatar_url,
    membershipStatus: row.membership_status,
    membershipPlanId: row.membership_plan_id,
    membershipPlanName: row.membership_plan_name,
    lastSessionAt: row.last_session_at,
    nextSessionAt: row.next_session_at,
    adherencePercent: toNumber(row.adherence_percent),
    needsAttention: Boolean(row.needs_attention),
    needsAttentionReasons: row.needs_attention_reasons ?? [],
    unreadMessages: row.unread_messages ?? 0,
    latestPlanId: row.latest_plan_id,
    latestPlanTitle: row.latest_plan_title,
    latestPlanStatus: row.latest_plan_status,
    latestPlanUpdatedAt: row.latest_plan_updated_at,
    lastWorkoutAt: row.last_workout_at,
    checkins30d: row.checkins_30d ?? 0,
    workouts30d: row.workouts_30d ?? 0,
  };
}

function mapTemplate(row: PlanTemplateRow): CoachingPlanTemplate {
  return {
    id: row.id,
    gymId: row.gym_id,
    coachUserId: row.coach_user_id,
    title: row.title,
    goal: row.goal,
    planJson: row.plan_json ?? {},
    isShared: row.is_shared,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function planJsonFromExercises(
  exercises: CoachingPlanExercise[],
  notes?: string
): Record<string, unknown> {
  const normalized = exercises
    .map((exercise, index) => ({
      day: exercise.day.trim() || "Day 1",
      exercise: exercise.exercise.trim(),
      sets: exercise.sets?.trim() || undefined,
      reps: exercise.reps?.trim() || undefined,
      load: exercise.load?.trim() || undefined,
      tempo: exercise.tempo?.trim() || undefined,
      rest: exercise.rest?.trim() || undefined,
      notes: exercise.notes?.trim() || undefined,
      order: index + 1,
    }))
    .filter((exercise) => exercise.exercise.length > 0);

  const days = normalized.reduce<Record<string, typeof normalized>>((acc, exercise) => {
    acc[exercise.day] = acc[exercise.day] ?? [];
    acc[exercise.day].push(exercise);
    return acc;
  }, {});

  return {
    notes: notes?.trim() || undefined,
    days: Object.entries(days).map(([label, blocks]) => ({
      label,
      blocks: blocks.map(({ day: _day, ...block }) => block),
    })),
  };
}

function normalizeDetail(value: unknown): CoachingWorkspaceDetail {
  const detail = (value ?? {}) as Partial<CoachingWorkspaceDetail>;
  return {
    masked: Boolean(detail.masked),
    profile: detail.profile ?? { memberUserId: "", displayName: "Private athlete" },
    stats: detail.stats ?? {},
    plans: detail.plans ?? [],
    messages: detail.messages ?? [],
    sessions: detail.sessions ?? [],
    notes: detail.notes ?? [],
    goals: detail.goals ?? [],
    exerciseSwaps: detail.exerciseSwaps ?? [],
    activity: detail.activity ?? [],
  };
}

export class CoachingService {
  private readonly access: StaffAccessService;

  constructor(private readonly supabase: SupabaseClient) {
    this.access = new StaffAccessService(supabase);
  }

  async getCapabilityStatus(gymId: string): Promise<CoachingCapabilityStatus> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .rpc("platform_get_gym_capabilities", { p_gym_id: gymId });

    throwIfAdminError(error, "ADMIN_COACHING_CAPABILITY_FAILED", "Unable to load coaching workspace entitlement.");

    const row = ((data as CapabilityRow[]) ?? []).find(
      (item) => item.capability_key === "private_coaching_workspace"
    );

    return {
      enabled: Boolean(row?.effective_bool),
      source: row?.source,
      templateKey: row?.template_key,
      templateName: row?.template_name,
      impactCount: row?.impact_count ?? 0,
    };
  }

  async listMyAthletes(gymId: string): Promise<CoachingAthleteSummary[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .rpc("coach_list_my_athletes", { p_gym_id: gymId });

    throwIfAdminError(error, "ADMIN_COACHING_ATHLETES_FAILED", "Unable to load your athletes.");

    return ((data as AthleteSummaryRow[]) ?? []).map(mapAthlete);
  }

  async getAthleteWorkspace(gymId: string, memberUserId: string): Promise<CoachingWorkspaceDetail> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .rpc("coach_get_athlete_private_workspace", {
        p_gym_id: gymId,
        p_member_user_id: memberUserId,
      })
      .single();

    throwIfAdminError(error, "ADMIN_COACHING_ATHLETE_DETAIL_FAILED", "Unable to load athlete workspace.");

    return normalizeDetail(data);
  }

  async listPlanTemplates(gymId: string): Promise<CoachingPlanTemplate[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .rpc("coach_list_plan_templates", { p_gym_id: gymId });

    throwIfAdminError(error, "ADMIN_COACHING_TEMPLATES_FAILED", "Unable to load plan templates.");

    return ((data as PlanTemplateRow[]) ?? []).map(mapTemplate);
  }

  async publishWorkoutPlan(gymId: string, input: PublishCoachingPlanInput): Promise<RpcRecord> {
    await this.access.requireGymStaff(gymId);

    const title = input.title.trim();
    if (!title) {
      throw new KruxtAdminError("ADMIN_COACHING_PLAN_TITLE_REQUIRED", "Plan title is required.");
    }
    if (input.exercises.every((exercise) => exercise.exercise.trim().length === 0)) {
      throw new KruxtAdminError("ADMIN_COACHING_PLAN_EMPTY", "Add at least one exercise before publishing.");
    }

    const { data, error } = await this.supabase
      .rpc("coach_publish_workout_plan", {
        p_gym_id: gymId,
        p_member_user_id: input.memberUserId,
        p_title: title,
        p_goal: input.goal?.trim() || null,
        p_plan_json: planJsonFromExercises(input.exercises, input.notes),
        p_workout_plan_id: input.workoutPlanId || null,
        p_source: input.source ?? "manual",
      })
      .single();

    throwIfAdminError(error, "ADMIN_COACHING_PLAN_PUBLISH_FAILED", "Unable to publish workout plan.");

    return (data ?? {}) as RpcRecord;
  }

  async swapExercise(gymId: string, input: SwapExerciseInput): Promise<RpcRecord> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .rpc("coach_swap_workout_plan_exercise", {
        p_gym_id: gymId,
        p_workout_plan_id: input.workoutPlanId,
        p_member_user_id: input.memberUserId,
        p_exercise_path: input.exercisePath,
        p_original_exercise: input.originalExercise,
        p_replacement_exercise: input.replacementExercise,
        p_reason: input.reason?.trim() || null,
      })
      .single();

    throwIfAdminError(error, "ADMIN_COACHING_SWAP_FAILED", "Unable to swap exercise.");

    return (data ?? {}) as RpcRecord;
  }

  async sendMessage(
    gymId: string,
    memberUserId: string,
    body: string,
    attachment?: { type: string; ref: Record<string, unknown> }
  ): Promise<RpcRecord> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .rpc("coach_send_athlete_message", {
        p_gym_id: gymId,
        p_member_user_id: memberUserId,
        p_body: body.trim() || null,
        p_attachment_type: attachment?.type ?? null,
        p_attachment_ref: attachment?.ref ?? {},
        p_message_type: "direct",
      })
      .single();

    throwIfAdminError(error, "ADMIN_COACHING_MESSAGE_FAILED", "Unable to send message.");

    return (data ?? {}) as RpcRecord;
  }

  async scheduleSession(gymId: string, input: ScheduleSessionInput): Promise<RpcRecord> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .rpc("coach_schedule_private_session", {
        p_gym_id: gymId,
        p_member_user_id: input.memberUserId,
        p_title: input.title.trim() || "1:1 coaching session",
        p_starts_at: input.startsAt,
        p_ends_at: input.endsAt,
        p_notes: input.notes?.trim() || null,
      })
      .single();

    throwIfAdminError(error, "ADMIN_COACHING_SESSION_FAILED", "Unable to schedule private session.");

    return (data ?? {}) as RpcRecord;
  }

  async createNote(gymId: string, input: CreateNoteInput): Promise<RpcRecord> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .rpc("coach_create_athlete_note", {
        p_gym_id: gymId,
        p_member_user_id: input.memberUserId,
        p_title: input.title.trim(),
        p_body: input.body.trim(),
        p_note_type: input.noteType ?? "session_note",
        p_visibility: input.visibility ?? "coach_private",
      })
      .single();

    throwIfAdminError(error, "ADMIN_COACHING_NOTE_FAILED", "Unable to save athlete note.");

    return (data ?? {}) as RpcRecord;
  }

  async upsertGoal(gymId: string, input: UpsertGoalInput): Promise<RpcRecord> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .rpc("coach_upsert_athlete_goal", {
        p_gym_id: gymId,
        p_member_user_id: input.memberUserId,
        p_title: input.title.trim(),
        p_metric_key: input.metricKey?.trim() || null,
        p_target_value: input.targetValue ?? null,
        p_current_value: input.currentValue ?? null,
        p_unit: input.unit?.trim() || null,
        p_due_at: input.dueAt || null,
        p_goal_id: input.goalId || null,
      })
      .single();

    throwIfAdminError(error, "ADMIN_COACHING_GOAL_FAILED", "Unable to save athlete goal.");

    return (data ?? {}) as RpcRecord;
  }

  async savePlanTemplate(gymId: string, input: SaveTemplateInput): Promise<CoachingPlanTemplate> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .rpc("coach_save_plan_template", {
        p_gym_id: gymId,
        p_title: input.title.trim(),
        p_goal: input.goal?.trim() || null,
        p_plan_json: planJsonFromExercises(input.exercises, input.notes),
        p_is_shared: input.isShared ?? false,
      })
      .single();

    throwIfAdminError(error, "ADMIN_COACHING_TEMPLATE_SAVE_FAILED", "Unable to save plan template.");

    const row = data as PlanTemplateRow | null;
    if (!row) {
      throw new KruxtAdminError("ADMIN_COACHING_TEMPLATE_SAVE_FAILED", "Unable to save plan template.");
    }

    return mapTemplate(row);
  }
}
