import type { MemberWorkoutPlanStatus, RankTier, WorkoutType } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type RelationName = { name: string | null } | Array<{ name: string | null }> | null;

type WorkoutPlanRow = {
  id: string;
  gym_id: string;
  coach_user_id: string | null;
  title: string;
  goal: string | null;
  status: MemberWorkoutPlanStatus;
  starts_at: string | null;
  ends_at: string | null;
  plan_json: Record<string, unknown> | null;
  published_at?: string | null;
  version_number?: number | null;
  source?: string | null;
  updated_at: string;
  gyms: RelationName;
};

type CoachRow = {
  id: string;
  display_name: string | null;
  username: string | null;
};

type WorkoutRow = {
  id: string;
  gym_id: string | null;
  title: string;
  workout_type: WorkoutType;
  started_at: string;
  total_sets: number | null;
  total_volume_kg: number | string | null;
  is_pr: boolean | null;
  source: string | null;
};

type ProfileRow = {
  level: number | null;
  rank_tier: RankTier | null;
  xp_total: number | null;
  chain_days: number | null;
};

type MembershipRow = {
  gym_id: string;
  membership_status: string;
  role: string;
  gyms: RelationName;
};

type ClassBookingRow = {
  id: string;
  status: string;
  booked_at: string;
  checked_in_at: string | null;
  gym_classes:
    | {
        id: string;
        gym_id: string;
        title: string;
        starts_at: string;
        ends_at: string;
        status: string;
        gyms: RelationName;
      }
    | Array<{
        id: string;
        gym_id: string;
        title: string;
        starts_at: string;
        ends_at: string;
        status: string;
        gyms: RelationName;
      }>
    | null;
};

export interface PlanBlock {
  id: string;
  exercise: string;
  target: string;
  notes: string | null;
  tags: string[];
}

export interface PlanDay {
  id: string;
  label: string;
  focus: string | null;
  notes: string | null;
  blocks: PlanBlock[];
}

export interface MemberTrainingPlan {
  id: string;
  gymId: string;
  gymName: string | null;
  coachUserId: string | null;
  coachName: string | null;
  title: string;
  goal: string | null;
  status: MemberWorkoutPlanStatus;
  startsAt: string | null;
  endsAt: string | null;
  coachNotes: string | null;
  versionNumber: number;
  publishedAt: string | null;
  source: string;
  updatedAt: string;
  days: PlanDay[];
}

export interface PlannedClass {
  id: string;
  classId: string;
  gymId: string;
  gymName: string | null;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  checkedInAt: string | null;
}

export interface RecentPlanWorkout {
  id: string;
  gymId: string | null;
  title: string;
  workoutType: WorkoutType;
  startedAt: string;
  totalSets: number;
  totalVolumeKg: number;
  isPr: boolean;
  source: string | null;
}

export interface PlanMembershipContext {
  gymId: string;
  gymName: string | null;
  membershipStatus: string;
  role: string;
}

export interface PlanSnapshot {
  userId: string;
  rankTier: RankTier;
  level: number;
  xpTotal: number;
  chainDays: number;
  plans: MemberTrainingPlan[];
  activePlan: MemberTrainingPlan | null;
  currentDay: PlanDay | null;
  currentDayIndex: number;
  weeklyProgress: {
    plannedSessions: number;
    completedSessions: number;
    adherencePercent: number;
  };
  upcomingClasses: PlannedClass[];
  recentWorkouts: RecentPlanWorkout[];
  memberships: PlanMembershipContext[];
  futureWeeksLocked: boolean;
}

async function requireUser(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }

  return data.user.id;
}

function relationName(value: RelationName): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value.name ?? null;
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function compactText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function readText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = compactText(record[key]);
    if (value) return value;
  }

  return "";
}

function readOptionalText(record: Record<string, unknown>, keys: string[]): string | null {
  const value = readText(record, keys);
  return value || null;
}

function formatMetric(label: string, value: unknown): string | null {
  const text = compactText(value);
  return text ? `${label} ${text}` : null;
}

function normalizeBlock(rawBlock: unknown, index: number): PlanBlock | null {
  const record = asRecord(rawBlock);
  const exercise = readText(record, ["exercise", "exerciseName", "name", "title", "movement"]);
  if (!exercise) return null;

  const tags = [
    formatMetric("Sets", record.sets),
    formatMetric("Reps", record.reps),
    formatMetric("Load", record.load ?? record.weightKg ?? record.targetWeightKg),
    formatMetric("Duration", record.duration ?? record.durationSeconds),
    formatMetric("Tempo", record.tempo),
    formatMetric("Rest", record.rest)
  ].filter((value): value is string => Boolean(value));

  return {
    id: `${index}_${exercise.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    exercise,
    target: tags.length > 0 ? tags.join(" · ") : "Open target",
    notes: readOptionalText(record, ["notes", "coachNotes", "cue"]),
    tags
  };
}

function normalizeDay(rawDay: unknown, index: number): PlanDay | null {
  const record = asRecord(rawDay);
  const blocksSource =
    asArray(record.blocks).length > 0
      ? record.blocks
      : asArray(record.exercises).length > 0
        ? record.exercises
        : asArray(record.sessions);
  const blocks = asArray(blocksSource)
    .map((block, blockIndex) => normalizeBlock(block, blockIndex))
    .filter((block): block is PlanBlock => Boolean(block));

  const label = readText(record, ["label", "day", "name", "title"]) || `Day ${index + 1}`;
  const focus = readOptionalText(record, ["focus", "theme", "goal"]);

  if (blocks.length === 0 && !focus) {
    return null;
  }

  return {
    id: `${index}_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    label,
    focus,
    notes: readOptionalText(record, ["notes", "coachNotes"]),
    blocks
  };
}

function normalizePlanDays(planJson: Record<string, unknown>): PlanDay[] {
  const rawDays = planJson.days ?? planJson.week ?? planJson.schedule;
  const daySource = Array.isArray(rawDays)
    ? rawDays
    : rawDays && typeof rawDays === "object"
      ? Object.entries(rawDays as Record<string, unknown>).map(([label, value]) => ({
          ...(asRecord(value)),
          label
        }))
      : [];

  const parsedDays = daySource
    .map((day, index) => normalizeDay(day, index))
    .filter((day): day is PlanDay => Boolean(day));

  if (parsedDays.length > 0) {
    return parsedDays;
  }

  const fallbackBlocks = asArray(planJson.blocks).length > 0 ? planJson.blocks : planJson.exercises;
  const fallbackDay = normalizeDay({ label: "Day 1", blocks: fallbackBlocks }, 0);
  return fallbackDay ? [fallbackDay] : [];
}

function resolveCurrentDayIndex(plan: MemberTrainingPlan | null): number {
  if (!plan || plan.days.length === 0) return 0;
  if (!plan.startsAt) return 0;

  const start = new Date(`${plan.startsAt}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;

  const today = new Date();
  const diffDays = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
  return diffDays % plan.days.length;
}

function weekStart(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + mondayOffset);
  return next;
}

function mapPlan(row: WorkoutPlanRow, coachNames: Map<string, string>): MemberTrainingPlan {
  const planJson = row.plan_json ?? {};

  return {
    id: row.id,
    gymId: row.gym_id,
    gymName: relationName(row.gyms),
    coachUserId: row.coach_user_id,
    coachName: row.coach_user_id ? coachNames.get(row.coach_user_id) ?? null : null,
    title: row.title,
    goal: row.goal,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    coachNotes: readOptionalText(planJson, ["notes", "coachNotes"]),
    versionNumber: row.version_number ?? 1,
    publishedAt: row.published_at ?? null,
    source: row.source ?? "manual",
    updatedAt: row.updated_at,
    days: normalizePlanDays(planJson)
  };
}

function mapClassBooking(row: ClassBookingRow): PlannedClass | null {
  const klass = firstRelation(row.gym_classes);
  if (!klass) return null;

  return {
    id: row.id,
    classId: klass.id,
    gymId: klass.gym_id,
    gymName: relationName(klass.gyms),
    title: klass.title,
    status: row.status,
    startsAt: klass.starts_at,
    endsAt: klass.ends_at,
    checkedInAt: row.checked_in_at
  };
}

function sortPlans(left: MemberTrainingPlan, right: MemberTrainingPlan): number {
  const statusRank = (status: MemberWorkoutPlanStatus) => {
    if (status === "active") return 0;
    if (status === "draft") return 1;
    if (status === "paused") return 2;
    return 3;
  };

  const statusDelta = statusRank(left.status) - statusRank(right.status);
  if (statusDelta !== 0) return statusDelta;
  return Date.parse(right.publishedAt ?? right.updatedAt) - Date.parse(left.publishedAt ?? left.updatedAt);
}

export async function loadPlanSnapshot(client: SupabaseClient): Promise<PlanSnapshot> {
  const userId = await requireUser(client);
  const now = new Date();
  const weekStartAt = weekStart(now).toISOString();
  const nowIso = now.toISOString();

  const [profileResponse, plansResponse, workoutsResponse, membershipsResponse, bookingsResponse] =
    await Promise.all([
      client.from("profiles").select("level,rank_tier,xp_total,chain_days").eq("id", userId).maybeSingle(),
      client
        .from("gym_member_workout_plans")
        .select("id,gym_id,coach_user_id,title,goal,status,starts_at,ends_at,plan_json,published_at,version_number,source,updated_at,gyms(name)")
        .eq("member_user_id", userId)
        .in("status", ["draft", "active", "paused"])
        .order("updated_at", { ascending: false })
        .limit(20),
      client
        .from("workouts")
        .select("id,gym_id,title,workout_type,started_at,total_sets,total_volume_kg,is_pr,source")
        .eq("user_id", userId)
        .gte("started_at", new Date(now.getTime() - 30 * 86_400_000).toISOString())
        .order("started_at", { ascending: false })
        .limit(30),
      client
        .from("gym_memberships")
        .select("gym_id,membership_status,role,gyms(name)")
        .eq("user_id", userId)
        .in("membership_status", ["pending", "trial", "active", "paused"]),
      client
        .from("class_bookings")
        .select("id,status,booked_at,checked_in_at,gym_classes(id,gym_id,title,starts_at,ends_at,status,gyms(name))")
        .eq("user_id", userId)
        .in("status", ["booked", "waitlisted", "attended"])
        .order("booked_at", { ascending: false })
        .limit(24)
    ]);

  if (profileResponse.error) {
    throw new Error(profileResponse.error.message || "Unable to load plan profile.");
  }
  if (plansResponse.error) {
    throw new Error(plansResponse.error.message || "Unable to load training plans.");
  }
  if (workoutsResponse.error) {
    throw new Error(workoutsResponse.error.message || "Unable to load workout history.");
  }
  if (membershipsResponse.error) {
    throw new Error(membershipsResponse.error.message || "Unable to load gym memberships.");
  }
  if (bookingsResponse.error) {
    throw new Error(bookingsResponse.error.message || "Unable to load booked classes.");
  }

  const planRows = ((plansResponse.data ?? []) as WorkoutPlanRow[]) ?? [];
  const coachIds = Array.from(new Set(planRows.map((plan) => plan.coach_user_id).filter((id): id is string => Boolean(id))));
  const coachNames = new Map<string, string>();

  if (coachIds.length > 0) {
    const { data: coachData } = await client
      .from("profiles")
      .select("id,display_name,username")
      .in("id", coachIds);

    for (const coach of ((coachData ?? []) as CoachRow[]) ?? []) {
      coachNames.set(coach.id, coach.display_name || (coach.username ? `@${coach.username}` : "Coach"));
    }
  }

  const plans = planRows.map((plan) => mapPlan(plan, coachNames)).sort(sortPlans);
  const activePlan = plans[0] ?? null;
  const currentDayIndex = resolveCurrentDayIndex(activePlan);
  const currentDay = activePlan?.days[currentDayIndex] ?? activePlan?.days[0] ?? null;
  const recentWorkouts = (((workoutsResponse.data ?? []) as WorkoutRow[]) ?? []).map((workout) => ({
    id: workout.id,
    gymId: workout.gym_id,
    title: workout.title,
    workoutType: workout.workout_type,
    startedAt: workout.started_at,
    totalSets: workout.total_sets ?? 0,
    totalVolumeKg: numberValue(workout.total_volume_kg),
    isPr: Boolean(workout.is_pr),
    source: workout.source
  }));
  const completedThisWeek = recentWorkouts.filter((workout) => workout.startedAt >= weekStartAt).length;
  const plannedSessions = Math.max(activePlan?.days.length ?? 0, 1);

  return {
    userId,
    rankTier: ((profileResponse.data as ProfileRow | null)?.rank_tier ?? "initiate") as RankTier,
    level: (profileResponse.data as ProfileRow | null)?.level ?? 1,
    xpTotal: (profileResponse.data as ProfileRow | null)?.xp_total ?? 0,
    chainDays: (profileResponse.data as ProfileRow | null)?.chain_days ?? 0,
    plans,
    activePlan,
    currentDay,
    currentDayIndex,
    weeklyProgress: {
      plannedSessions,
      completedSessions: completedThisWeek,
      adherencePercent: Math.min(100, Math.round((completedThisWeek / plannedSessions) * 100))
    },
    upcomingClasses: (((bookingsResponse.data ?? []) as ClassBookingRow[]) ?? [])
      .map(mapClassBooking)
      .filter((booking): booking is PlannedClass => Boolean(booking))
      .filter((booking) => booking.endsAt >= nowIso)
      .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
      .slice(0, 8),
    recentWorkouts,
    memberships: (((membershipsResponse.data ?? []) as MembershipRow[]) ?? []).map((membership) => ({
      gymId: membership.gym_id,
      gymName: relationName(membership.gyms),
      membershipStatus: membership.membership_status,
      role: membership.role
    })),
    futureWeeksLocked: true
  };
}
