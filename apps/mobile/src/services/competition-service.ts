import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Challenge,
  ChallengeParticipant,
  CreateChallengeInput,
  JoinChallengeInput,
  Leaderboard,
  LeaderboardEntry,
  ListLeaderboardsInput,
  RankTier,
  SubmitChallengeProgressInput,
  UpdateChallengeInput
} from "@kruxt/types";

import { KruxtAppError, throwIfError } from "./errors";

type ChallengeRow = {
  id: string;
  creator_user_id: string;
  gym_id: string | null;
  title: string;
  description: string | null;
  challenge_type: Challenge["challengeType"];
  visibility: Challenge["visibility"];
  starts_at: string;
  ends_at: string;
  points_per_unit: number;
  created_at: string;
  updated_at: string;
};

type ChallengeParticipantRow = {
  id: string;
  challenge_id: string;
  user_id: string;
  score: number;
  completed: boolean;
  joined_at: string;
  updated_at: string;
};

type LeaderboardRow = {
  id: string;
  name: string;
  scope: Leaderboard["scope"];
  scope_gym_id: string | null;
  scope_exercise_id: string | null;
  scope_challenge_id: string | null;
  metric: Leaderboard["metric"];
  timeframe: Leaderboard["timeframe"];
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type LeaderboardEntryRow = {
  id: string;
  leaderboard_id: string;
  user_id: string;
  rank: number;
  score: number;
  details: Record<string, unknown> | null;
  calculated_at: string;
};

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  rank_tier: RankTier;
  level: number;
};

export interface ChallengeParticipantWithActor extends ChallengeParticipant {
  actor?: {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    rankTier: RankTier;
    level: number;
  };
}

export interface LeaderboardEntryWithActor extends LeaderboardEntry {
  actor?: {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    rankTier: RankTier;
    level: number;
  };
}

export interface ListChallengesOptions {
  activeOnly?: boolean;
  joinedOnly?: boolean;
  gymId?: string;
  limit?: number;
}

function mapChallenge(row: ChallengeRow): Challenge {
  return {
    id: row.id,
    creatorUserId: row.creator_user_id,
    gymId: row.gym_id,
    title: row.title,
    description: row.description,
    challengeType: row.challenge_type,
    visibility: row.visibility,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    pointsPerUnit: row.points_per_unit,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapChallengeParticipant(row: ChallengeParticipantRow): ChallengeParticipant {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    userId: row.user_id,
    score: Number(row.score),
    completed: row.completed,
    joinedAt: row.joined_at,
    updatedAt: row.updated_at
  };
}

function mapLeaderboard(row: LeaderboardRow): Leaderboard {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    scopeGymId: row.scope_gym_id,
    scopeExerciseId: row.scope_exercise_id,
    scopeChallengeId: row.scope_challenge_id,
    metric: row.metric,
    timeframe: row.timeframe,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapLeaderboardEntry(row: LeaderboardEntryRow): LeaderboardEntry {
  return {
    id: row.id,
    leaderboardId: row.leaderboard_id,
    userId: row.user_id,
    rank: row.rank,
    score: Number(row.score),
    details: row.details ?? {},
    calculatedAt: row.calculated_at
  };
}

export class CompetitionService {
  constructor(private readonly supabase: SupabaseClient) {}

  private async resolveUserId(userId?: string): Promise<string> {
    if (userId) {
      return userId;
    }

    const { data, error } = await this.supabase.auth.getUser();
    throwIfError(error, "AUTH_GET_USER_FAILED", "Unable to resolve current user.");

    if (!data.user) {
      throw new KruxtAppError("AUTH_REQUIRED", "Authentication required.");
    }

    return data.user.id;
  }

  async listChallenges(options: ListChallengesOptions = {}, userId?: string): Promise<Challenge[]> {
    const resolvedUserId = await this.resolveUserId(userId);
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

    let query = this.supabase
      .from("challenges")
      .select("*")
      .order("starts_at", { ascending: true })
      .limit(limit);

    if (options.gymId) {
      query = query.eq("gym_id", options.gymId);
    }

    if (options.activeOnly ?? true) {
      const nowIso = new Date().toISOString();
      query = query.lte("starts_at", nowIso).gt("ends_at", nowIso);
    }

    const { data, error } = await query;
    throwIfError(error, "CHALLENGES_LIST_FAILED", "Unable to load challenges.");

    const challenges = ((data as ChallengeRow[]) ?? []).map(mapChallenge);
    if (!(options.joinedOnly ?? false) || challenges.length === 0) {
      return challenges;
    }

    const challengeIds = challenges.map((challenge) => challenge.id);
    const { data: joinedData, error: joinedError } = await this.supabase
      .from("challenge_participants")
      .select("challenge_id")
      .eq("user_id", resolvedUserId)
      .in("challenge_id", challengeIds);

    throwIfError(joinedError, "CHALLENGES_JOINED_LOOKUP_FAILED", "Unable to filter joined challenges.");

    const joinedIds = new Set(((joinedData as Array<{ challenge_id: string }>) ?? []).map((row) => row.challenge_id));
    return challenges.filter((challenge) => joinedIds.has(challenge.id));
  }

  async createChallenge(input: CreateChallengeInput, userId?: string): Promise<Challenge> {
    const creatorUserId = await this.resolveUserId(userId);

    const { data, error } = await this.supabase
      .from("challenges")
      .insert({
        creator_user_id: creatorUserId,
        gym_id: input.gymId ?? null,
        title: input.title,
        description: input.description ?? null,
        challenge_type: input.challengeType,
        visibility: input.visibility ?? "public",
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        points_per_unit: input.pointsPerUnit ?? 1
      })
      .select("*")
      .single();

    throwIfError(error, "CHALLENGE_CREATE_FAILED", "Unable to create challenge.");

    return mapChallenge(data as ChallengeRow);
  }

  async updateChallenge(challengeId: string, input: UpdateChallengeInput): Promise<Challenge> {
    const payload = {
      gym_id: input.gymId,
      title: input.title,
      description: input.description,
      challenge_type: input.challengeType,
      visibility: input.visibility,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      points_per_unit: input.pointsPerUnit
    };

    const { data, error } = await this.supabase
      .from("challenges")
      .update(payload)
      .eq("id", challengeId)
      .select("*")
      .single();

    throwIfError(error, "CHALLENGE_UPDATE_FAILED", "Unable to update challenge.");

    return mapChallenge(data as ChallengeRow);
  }

  async joinChallenge(input: JoinChallengeInput): Promise<string> {
    const { data, error } = await this.supabase.rpc("join_challenge", {
      p_challenge_id: input.challengeId
    });

    throwIfError(error, "CHALLENGE_JOIN_FAILED", "Unable to join challenge.");

    const participantId = data as string | null;
    if (!participantId) {
      throw new KruxtAppError("CHALLENGE_JOIN_NO_ID", "Challenge join completed without participant id.");
    }

    return participantId;
  }

  async leaveChallenge(challengeId: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc("leave_challenge", {
      p_challenge_id: challengeId
    });

    throwIfError(error, "CHALLENGE_LEAVE_FAILED", "Unable to leave challenge.");

    return Boolean(data);
  }

  async submitChallengeProgress(input: SubmitChallengeProgressInput): Promise<number> {
    const { data, error } = await this.supabase.rpc("submit_challenge_progress", {
      p_challenge_id: input.challengeId,
      p_score_delta: input.scoreDelta,
      p_mark_completed: input.markCompleted ?? false
    });

    throwIfError(error, "CHALLENGE_PROGRESS_FAILED", "Unable to submit challenge progress.");

    return Number(data ?? 0);
  }

  async listChallengeParticipants(challengeId: string, limit = 100): Promise<ChallengeParticipantWithActor[]> {
    const boundedLimit = Math.min(Math.max(limit, 1), 500);
    const { data, error } = await this.supabase
      .from("challenge_participants")
      .select("*")
      .eq("challenge_id", challengeId)
      .order("score", { ascending: false })
      .order("updated_at", { ascending: true })
      .limit(boundedLimit);

    throwIfError(error, "CHALLENGE_PARTICIPANTS_READ_FAILED", "Unable to load challenge participants.");

    const participants = ((data as ChallengeParticipantRow[]) ?? []).map(mapChallengeParticipant);
    if (participants.length === 0) {
      return [];
    }

    const userIds = participants.map((entry) => entry.userId);
    const { data: profileData, error: profileError } = await this.supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url,rank_tier,level")
      .in("id", userIds);

    throwIfError(profileError, "CHALLENGE_PARTICIPANT_PROFILES_READ_FAILED", "Unable to load participant profiles.");

    const profileById = new Map<string, ProfileRow>();
    for (const profile of (profileData as ProfileRow[]) ?? []) {
      profileById.set(profile.id, profile);
    }

    return participants.map((entry) => {
      const profile = profileById.get(entry.userId);
      return {
        ...entry,
        actor: profile
          ? {
              userId: profile.id,
              username: profile.username,
              displayName: profile.display_name,
              avatarUrl: profile.avatar_url,
              rankTier: profile.rank_tier,
              level: profile.level
            }
          : undefined
      };
    });
  }

  async listLeaderboards(input: ListLeaderboardsInput = {}): Promise<Leaderboard[]> {
    const limit = Math.min(Math.max(input.limit ?? 40, 1), 200);
    let query = this.supabase
      .from("leaderboards")
      .select("*")
      .order("starts_at", { ascending: false })
      .limit(limit);

    if (input.activeOnly ?? true) {
      query = query.eq("is_active", true);
    }

    if (input.scope) {
      query = query.eq("scope", input.scope);
    }

    if (input.metric) {
      query = query.eq("metric", input.metric);
    }

    if (input.timeframe) {
      query = query.eq("timeframe", input.timeframe);
    }

    if (input.gymId) {
      query = query.eq("scope_gym_id", input.gymId);
    }

    if (input.exerciseId) {
      query = query.eq("scope_exercise_id", input.exerciseId);
    }

    if (input.challengeId) {
      query = query.eq("scope_challenge_id", input.challengeId);
    }

    const { data, error } = await query;
    throwIfError(error, "LEADERBOARDS_LIST_FAILED", "Unable to load leaderboards.");

    return ((data as LeaderboardRow[]) ?? []).map(mapLeaderboard);
  }

  async listLeaderboardEntries(leaderboardId: string, limit = 100): Promise<LeaderboardEntryWithActor[]> {
    const boundedLimit = Math.min(Math.max(limit, 1), 500);
    const { data, error } = await this.supabase
      .from("leaderboard_entries")
      .select("*")
      .eq("leaderboard_id", leaderboardId)
      .order("rank", { ascending: true })
      .limit(boundedLimit);

    throwIfError(error, "LEADERBOARD_ENTRIES_READ_FAILED", "Unable to load leaderboard entries.");

    const entries = ((data as LeaderboardEntryRow[]) ?? []).map(mapLeaderboardEntry);
    if (entries.length === 0) {
      return [];
    }

    const userIds = entries.map((entry) => entry.userId);
    const { data: profileData, error: profileError } = await this.supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url,rank_tier,level")
      .in("id", userIds);

    throwIfError(profileError, "LEADERBOARD_PROFILES_READ_FAILED", "Unable to load leaderboard profiles.");

    const profileById = new Map<string, ProfileRow>();
    for (const profile of (profileData as ProfileRow[]) ?? []) {
      profileById.set(profile.id, profile);
    }

    return entries.map((entry) => {
      const profile = profileById.get(entry.userId);
      return {
        ...entry,
        actor: profile
          ? {
              userId: profile.id,
              username: profile.username,
              displayName: profile.display_name,
              avatarUrl: profile.avatar_url,
              rankTier: profile.rank_tier,
              level: profile.level
            }
          : undefined
      };
    });
  }

  async rebuildLeaderboard(leaderboardId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc("rebuild_leaderboard_scope", {
      p_leaderboard_id: leaderboardId
    });

    throwIfError(error, "LEADERBOARD_REBUILD_FAILED", "Unable to rebuild leaderboard.");

    return Number(data ?? 0);
  }
}
