import type { SupabaseClient } from "@supabase/supabase-js";
import type { RankTier, ReactionType, WorkoutType, WorkoutVisibility } from "@kruxt/types";

import { KruxtAppError, throwIfError } from "./errors";

type FeedEventRow = {
  id: string;
  user_id: string;
  workout_id: string | null;
  event_type: string;
  caption: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type WorkoutRow = {
  id: string;
  user_id: string;
  gym_id: string | null;
  title: string;
  workout_type: WorkoutType;
  started_at: string;
  visibility: WorkoutVisibility;
  total_sets: number;
  total_volume_kg: number;
  is_pr: boolean;
};

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  rank_tier: RankTier;
  level: number;
  home_gym_id: string | null;
};

type SocialInteractionRow = {
  workout_id: string;
  interaction_type: "reaction" | "comment";
  reaction_type: ReactionType | null;
  actor_user_id: string;
};

type SocialConnectionFollowedRow = {
  followed_user_id: string;
};

type FeatureFlagRow = {
  enabled: boolean;
};

export interface FeedActorSnapshot {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  rankTier?: RankTier;
  level?: number;
}

export interface FeedWorkoutSnapshot {
  id: string;
  userId: string;
  gymId?: string | null;
  title: string;
  workoutType: WorkoutType;
  startedAt: string;
  visibility: WorkoutVisibility;
  totalSets: number;
  totalVolumeKg: number;
  isPr: boolean;
}

export interface FeedEngagementSnapshot {
  reactionCount: number;
  commentCount: number;
  viewerReaction?: ReactionType | null;
}

export interface RankedFeedItem {
  eventId: string;
  eventType: string;
  caption?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: FeedActorSnapshot;
  workout: FeedWorkoutSnapshot;
  engagement: FeedEngagementSnapshot;
  score: number;
  rankingSignals: {
    recency: number;
    engagement: number;
    socialBoost: number;
    gymBoost: number;
    selfBoost: number;
    experimentBoost: number;
  };
}

export interface ListHomeFeedOptions {
  limit?: number;
  scanLimit?: number;
}

function toActorFallback(userId: string): FeedActorSnapshot {
  const suffix = userId.replace(/-/g, "").slice(0, 8);
  return {
    userId,
    username: `user_${suffix}`,
    displayName: "KRUXT Athlete"
  };
}

function hoursSince(isoDate: string): number {
  const time = Date.parse(isoDate);
  if (Number.isNaN(time)) {
    return 999;
  }

  return Math.max(0, (Date.now() - time) / 3600000);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class FeedService {
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

  private async isPublicFeedBoostEnabled(): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", "public_feed_boost_enabled")
      .maybeSingle();

    throwIfError(error, "FEATURE_FLAG_READ_FAILED", "Unable to load feed experiment flag.");

    return Boolean((data as FeatureFlagRow | null)?.enabled);
  }

  async listHomeFeed(options: ListHomeFeedOptions = {}, userId?: string): Promise<RankedFeedItem[]> {
    const resolvedUserId = await this.resolveUserId(userId);
    const limit = clamp(options.limit ?? 25, 1, 60);
    const scanLimit = clamp(options.scanLimit ?? 120, limit, 250);

    const { data: eventsData, error: eventsError } = await this.supabase
      .from("feed_events")
      .select("id,user_id,workout_id,event_type,caption,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(scanLimit);

    throwIfError(eventsError, "FEED_EVENTS_READ_FAILED", "Unable to load feed events.");

    const events = (eventsData as FeedEventRow[]) ?? [];
    if (events.length === 0) {
      return [];
    }

    const workoutIds = Array.from(
      new Set(
        events
          .map((event) => event.workout_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    if (workoutIds.length === 0) {
      return [];
    }

    const actorIds = Array.from(new Set(events.map((event) => event.user_id)));

    const [
      workoutsResponse,
      actorsResponse,
      interactionsResponse,
      followingResponse,
      viewerProfileResponse,
      feedBoostEnabled
    ] = await Promise.all([
      this.supabase
        .from("workouts")
        .select("id,user_id,gym_id,title,workout_type,started_at,visibility,total_sets,total_volume_kg,is_pr")
        .in("id", workoutIds),
      this.supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,rank_tier,level,home_gym_id")
        .in("id", actorIds),
      this.supabase
        .from("social_interactions")
        .select("workout_id,interaction_type,reaction_type,actor_user_id")
        .in("workout_id", workoutIds),
      this.supabase
        .from("social_connections")
        .select("followed_user_id")
        .eq("follower_user_id", resolvedUserId)
        .eq("status", "accepted")
        .in("followed_user_id", actorIds),
      this.supabase
        .from("profiles")
        .select("id,home_gym_id")
        .eq("id", resolvedUserId)
        .maybeSingle(),
      this.isPublicFeedBoostEnabled()
    ]);

    throwIfError(workoutsResponse.error, "FEED_WORKOUTS_READ_FAILED", "Unable to load feed workouts.");
    throwIfError(actorsResponse.error, "FEED_ACTORS_READ_FAILED", "Unable to load feed actors.");
    throwIfError(interactionsResponse.error, "FEED_INTERACTIONS_READ_FAILED", "Unable to load feed interactions.");
    throwIfError(followingResponse.error, "FEED_FOLLOWING_READ_FAILED", "Unable to load following relationships.");
    throwIfError(viewerProfileResponse.error, "FEED_PROFILE_READ_FAILED", "Unable to load viewer profile.");

    const workoutById = new Map<string, WorkoutRow>();
    for (const workout of (workoutsResponse.data as WorkoutRow[]) ?? []) {
      workoutById.set(workout.id, workout);
    }

    const actorById = new Map<string, ProfileRow>();
    for (const actor of (actorsResponse.data as ProfileRow[]) ?? []) {
      actorById.set(actor.id, actor);
    }

    const followedActorIds = new Set<string>(
      ((followingResponse.data as SocialConnectionFollowedRow[]) ?? []).map((row) => row.followed_user_id)
    );

    const interactionRows = (interactionsResponse.data as SocialInteractionRow[]) ?? [];
    const interactionStatsByWorkout = new Map<
      string,
      {
        reactionCount: number;
        commentCount: number;
        viewerReaction: ReactionType | null;
      }
    >();

    for (const row of interactionRows) {
      const existing = interactionStatsByWorkout.get(row.workout_id) ?? {
        reactionCount: 0,
        commentCount: 0,
        viewerReaction: null
      };

      if (row.interaction_type === "reaction") {
        existing.reactionCount += 1;
        if (row.actor_user_id === resolvedUserId) {
          existing.viewerReaction = row.reaction_type;
        }
      } else if (row.interaction_type === "comment") {
        existing.commentCount += 1;
      }

      interactionStatsByWorkout.set(row.workout_id, existing);
    }

    const viewerHomeGymId = (viewerProfileResponse.data as { home_gym_id: string | null } | null)?.home_gym_id ?? null;

    const ranked: RankedFeedItem[] = [];

    for (const event of events) {
      if (!event.workout_id) {
        continue;
      }

      const workout = workoutById.get(event.workout_id);
      if (!workout) {
        continue;
      }

      const actor = actorById.get(event.user_id);
      const actorSnapshot: FeedActorSnapshot = actor
        ? {
            userId: actor.id,
            username: actor.username,
            displayName: actor.display_name,
            avatarUrl: actor.avatar_url,
            rankTier: actor.rank_tier,
            level: actor.level
          }
        : toActorFallback(event.user_id);

      const engagement = interactionStatsByWorkout.get(workout.id) ?? {
        reactionCount: 0,
        commentCount: 0,
        viewerReaction: null
      };

      const ageHours = hoursSince(event.created_at);
      const recency = clamp((72 - ageHours) / 72, 0, 1) * 100;
      const engagementSignal =
        engagement.reactionCount * 2 +
        engagement.commentCount * 3 +
        (workout.is_pr ? 10 : 0) +
        (event.event_type === "pr_verified" ? 8 : 0);
      const socialBoost = followedActorIds.has(event.user_id) ? 15 : 0;
      const gymBoost = viewerHomeGymId && workout.gym_id && viewerHomeGymId === workout.gym_id ? 8 : 0;
      const selfBoost = event.user_id === resolvedUserId ? 12 : 0;
      const experimentBoost =
        feedBoostEnabled && workout.visibility === "public"
          ? 5
          : 0;

      const score = recency + engagementSignal + socialBoost + gymBoost + selfBoost + experimentBoost;

      ranked.push({
        eventId: event.id,
        eventType: event.event_type,
        caption: event.caption,
        metadata: event.metadata ?? {},
        createdAt: event.created_at,
        actor: actorSnapshot,
        workout: {
          id: workout.id,
          userId: workout.user_id,
          gymId: workout.gym_id,
          title: workout.title,
          workoutType: workout.workout_type,
          startedAt: workout.started_at,
          visibility: workout.visibility,
          totalSets: workout.total_sets,
          totalVolumeKg: workout.total_volume_kg,
          isPr: workout.is_pr
        },
        engagement: {
          reactionCount: engagement.reactionCount,
          commentCount: engagement.commentCount,
          viewerReaction: engagement.viewerReaction
        },
        score,
        rankingSignals: {
          recency,
          engagement: engagementSignal,
          socialBoost,
          gymBoost,
          selfBoost,
          experimentBoost
        }
      });
    }

    ranked.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return b.createdAt.localeCompare(a.createdAt);
    });

    return ranked.slice(0, limit);
  }
}
