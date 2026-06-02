import type { RankTier, WorkoutType } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileProgressRow = {
  xp_total: number | null;
  level: number | null;
  rank_tier: RankTier | null;
  chain_days: number | null;
  last_workout_at: string | null;
};

type WorkoutProofRow = {
  id: string;
  workout_type: WorkoutType;
  started_at: string;
  total_sets: number | null;
  total_volume_kg: number | string | null;
  is_pr: boolean | null;
  visibility: string;
  source: string | null;
};

type ChallengeParticipantRow = {
  id: string;
  challenge_id: string;
  score: number | string | null;
  completed: boolean | null;
  updated_at: string;
};

type FeedEventRow = {
  id: string;
  workout_id: string | null;
  created_at: string;
};

type PlanRow = {
  id: string;
  status: string;
  published_at: string | null;
  updated_at: string;
};

export interface AchievementCard {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  status: "locked" | "in_progress" | "earned";
  evidenceLabel: string;
  proofHref: string;
  groupVisible: boolean;
}

export interface AchievementSnapshot {
  level: number;
  rankTier: RankTier;
  xpTotal: number;
  chainDays: number;
  workoutCount: number;
  prCount: number;
  proofPostCount: number;
  challengeCount: number;
  completedChallengeCount: number;
  modalityCount: number;
  cards: AchievementCard[];
}

async function requireUser(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }

  return data.user.id;
}

function numberValue(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function achievement(input: Omit<AchievementCard, "status">): AchievementCard {
  const progress = Math.max(0, input.progress);
  const target = Math.max(1, input.target);

  return {
    ...input,
    progress,
    target,
    status: progress >= target ? "earned" : progress > 0 ? "in_progress" : "locked"
  };
}

export async function loadAchievementSnapshot(client: SupabaseClient): Promise<AchievementSnapshot> {
  const userId = await requireUser(client);
  const since = new Date(Date.now() - 180 * 86_400_000).toISOString();

  const [profileResponse, workoutsResponse, feedResponse, challengeResponse, plansResponse] = await Promise.all([
    client
      .from("profiles")
      .select("xp_total,level,rank_tier,chain_days,last_workout_at")
      .eq("id", userId)
      .maybeSingle(),
    client
      .from("workouts")
      .select("id,workout_type,started_at,total_sets,total_volume_kg,is_pr,visibility,source")
      .eq("user_id", userId)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(250),
    client
      .from("feed_events")
      .select("id,workout_id,created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(250),
    client
      .from("challenge_participants")
      .select("id,challenge_id,score,completed,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(60),
    client
      .from("gym_member_workout_plans")
      .select("id,status,published_at,updated_at")
      .eq("member_user_id", userId)
      .in("status", ["draft", "active", "paused"])
      .order("updated_at", { ascending: false })
      .limit(20)
  ]);

  if (profileResponse.error) {
    throw new Error(profileResponse.error.message || "Unable to load profile progress.");
  }
  if (workoutsResponse.error) {
    throw new Error(workoutsResponse.error.message || "Unable to load workout proof.");
  }
  if (feedResponse.error) {
    throw new Error(feedResponse.error.message || "Unable to load proof posts.");
  }
  if (challengeResponse.error) {
    throw new Error(challengeResponse.error.message || "Unable to load challenge progress.");
  }
  if (plansResponse.error) {
    throw new Error(plansResponse.error.message || "Unable to load plan progress.");
  }

  const profile = (profileResponse.data as ProfileProgressRow | null) ?? null;
  const workouts = ((workoutsResponse.data ?? []) as WorkoutProofRow[]) ?? [];
  const feedEvents = ((feedResponse.data ?? []) as FeedEventRow[]) ?? [];
  const challenges = ((challengeResponse.data ?? []) as ChallengeParticipantRow[]) ?? [];
  const plans = ((plansResponse.data ?? []) as PlanRow[]) ?? [];

  const workoutCount = workouts.length;
  const proofPostCount = feedEvents.length;
  const prCount = workouts.filter((workout) => workout.is_pr).length;
  const publicProofCount = workouts.filter((workout) => workout.visibility === "public").length;
  const modalityCount = new Set(workouts.map((workout) => workout.workout_type)).size;
  const totalVolume = workouts.reduce((sum, workout) => sum + numberValue(workout.total_volume_kg), 0);
  const completedChallengeCount = challenges.filter((challenge) => challenge.completed).length;
  const activePlanCount = plans.filter((plan) => plan.status === "active").length;

  const cards = [
    achievement({
      id: "proof-starter",
      title: "Proof Starter",
      description: "Log a workout that can become a KRUXT proof post.",
      progress: workoutCount,
      target: 1,
      evidenceLabel: `${workoutCount} logged workouts in 180 days`,
      proofHref: "/feed",
      groupVisible: true
    }),
    achievement({
      id: "public-proof",
      title: "Public Proof",
      description: "Make training visible enough to build social trust.",
      progress: publicProofCount,
      target: 5,
      evidenceLabel: `${publicProofCount} public workouts`,
      proofHref: "/feed",
      groupVisible: true
    }),
    achievement({
      id: "streak-week",
      title: "Streak Week",
      description: "Keep the chain alive for a full week.",
      progress: profile?.chain_days ?? 0,
      target: 7,
      evidenceLabel: `${profile?.chain_days ?? 0} chain days`,
      proofHref: "/profile",
      groupVisible: true
    }),
    achievement({
      id: "pr-verified",
      title: "PR Verified",
      description: "Hit a workout marked as a personal record.",
      progress: prCount,
      target: 1,
      evidenceLabel: `${prCount} PR workouts`,
      proofHref: "/rank",
      groupVisible: true
    }),
    achievement({
      id: "hybrid-engine",
      title: "Hybrid Engine",
      description: "Show range across multiple modalities.",
      progress: modalityCount,
      target: 3,
      evidenceLabel: `${modalityCount} workout types`,
      proofHref: "/log",
      groupVisible: true
    }),
    achievement({
      id: "tonnage-base",
      title: "Tonnage Base",
      description: "Accumulate measurable strength work.",
      progress: Math.round(totalVolume),
      target: 10_000,
      evidenceLabel: `${Math.round(totalVolume).toLocaleString()} kg total volume`,
      proofHref: "/log",
      groupVisible: false
    }),
    achievement({
      id: "trial-participant",
      title: "Trial Participant",
      description: "Join KRUXT group competition instead of training alone.",
      progress: challenges.length,
      target: 1,
      evidenceLabel: `${challenges.length} joined trials`,
      proofHref: "/rank",
      groupVisible: true
    }),
    achievement({
      id: "plan-backed",
      title: "Plan Backed",
      description: "Use a structured plan as the operating system for training.",
      progress: activePlanCount,
      target: 1,
      evidenceLabel: `${activePlanCount} active plans`,
      proofHref: "/plan",
      groupVisible: false
    }),
    achievement({
      id: "proof-feed-builder",
      title: "Feed Builder",
      description: "Contribute proof that teammates can react to and trust.",
      progress: proofPostCount,
      target: 10,
      evidenceLabel: `${proofPostCount} proof feed events`,
      proofHref: "/feed",
      groupVisible: true
    }),
    achievement({
      id: "trial-finisher",
      title: "Trial Finisher",
      description: "Finish a joined challenge.",
      progress: completedChallengeCount,
      target: 1,
      evidenceLabel: `${completedChallengeCount} completed trials`,
      proofHref: "/rank",
      groupVisible: true
    })
  ];

  return {
    level: profile?.level ?? 1,
    rankTier: profile?.rank_tier ?? "initiate",
    xpTotal: profile?.xp_total ?? 0,
    chainDays: profile?.chain_days ?? 0,
    workoutCount,
    prCount,
    proofPostCount,
    challengeCount: challenges.length,
    completedChallengeCount,
    modalityCount,
    cards
  };
}
