import type { ReactionType, WorkoutType, WorkoutVisibility } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type FeedEventRow = {
  id: string;
  user_id: string;
  workout_id: string | null;
  event_type: string;
  caption: string | null;
  created_at: string;
};

type ProfileRow = {
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
  visibility: WorkoutVisibility;
  total_sets: number;
  total_volume_kg: number;
  is_pr: boolean;
};

type GymRow = {
  id: string;
  name: string;
};

type InteractionRow = {
  workout_id: string;
  interaction_type: "reaction" | "comment";
  reaction_type: ReactionType | null;
  actor_user_id: string;
};

export interface PublicFeedItem {
  id: string;
  actorLabel: string;
  actorUsername: string | null;
  workoutTitle: string | null;
  workoutType: WorkoutType | null;
  gymName: string | null;
  visibility: WorkoutVisibility | null;
  totalSets: number;
  totalVolumeKg: number;
  isPr: boolean;
  eventType: string;
  caption: string | null;
  createdAt: string;
  reactionCount: number;
  commentCount: number;
  viewerReaction: ReactionType | null;
  isOwn: boolean;
}

export async function loadPublicFeed(
  client: SupabaseClient,
  viewerUserId: string,
  limit = 20
): Promise<PublicFeedItem[]> {
  const { data: eventsData, error: eventsError } = await client
    .from("feed_events")
    .select("id,user_id,workout_id,event_type,caption,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (eventsError) {
    throw new Error(eventsError.message || "Unable to load feed.");
  }

  const events = (eventsData as FeedEventRow[] | null) ?? [];
  if (events.length === 0) {
    return [];
  }

  const actorIds = Array.from(new Set(events.map((item) => item.user_id)));
  const workoutIds = Array.from(
    new Set(events.map((item) => item.workout_id).filter((value): value is string => Boolean(value)))
  );

  const [profilesResponse, workoutsResponse, interactionsResponse] = await Promise.all([
    actorIds.length > 0
      ? client.from("profiles").select("id,display_name,username").in("id", actorIds)
      : Promise.resolve({ data: [] as ProfileRow[] | null, error: null }),
    workoutIds.length > 0
      ? client
          .from("workouts")
          .select("id,gym_id,title,workout_type,started_at,visibility,total_sets,total_volume_kg,is_pr")
          .in("id", workoutIds)
      : Promise.resolve({ data: [] as WorkoutRow[] | null, error: null }),
    workoutIds.length > 0
      ? client
          .from("social_interactions")
          .select("workout_id,interaction_type,reaction_type,actor_user_id")
          .in("workout_id", workoutIds)
      : Promise.resolve({ data: [] as InteractionRow[] | null, error: null })
  ]);

  if (profilesResponse.error) {
    throw new Error(profilesResponse.error.message || "Unable to load feed actors.");
  }
  if (workoutsResponse.error) {
    throw new Error(workoutsResponse.error.message || "Unable to load workouts.");
  }
  if (interactionsResponse.error) {
    throw new Error(interactionsResponse.error.message || "Unable to load feed engagement.");
  }

  const workouts = (workoutsResponse.data as WorkoutRow[] | null) ?? [];
  const gymIds = Array.from(
    new Set(workouts.map((item) => item.gym_id).filter((value): value is string => Boolean(value)))
  );

  const gymsResponse =
    gymIds.length > 0
      ? await client.from("gyms").select("id,name").in("id", gymIds)
      : { data: [] as GymRow[] | null, error: null };

  if (gymsResponse.error) {
    throw new Error(gymsResponse.error.message || "Unable to load gyms.");
  }

  const profileMap = new Map<string, ProfileRow>(
    (((profilesResponse.data ?? []) as ProfileRow[]) ?? []).map((profile) => [profile.id, profile])
  );
  const workoutMap = new Map<string, WorkoutRow>(workouts.map((workout) => [workout.id, workout]));
  const gymMap = new Map<string, GymRow>(
    ((((gymsResponse.data ?? []) as GymRow[]) ?? []).map((gym) => [gym.id, gym]))
  );

  const interactions = ((interactionsResponse.data ?? []) as InteractionRow[]) ?? [];
  const interactionStats = new Map<
    string,
    {
      reactionCount: number;
      commentCount: number;
      viewerReaction: ReactionType | null;
    }
  >();

  for (const interaction of interactions) {
    const existing = interactionStats.get(interaction.workout_id) ?? {
      reactionCount: 0,
      commentCount: 0,
      viewerReaction: null
    };

    if (interaction.interaction_type === "reaction") {
      existing.reactionCount += 1;
      if (interaction.actor_user_id === viewerUserId) {
        existing.viewerReaction = interaction.reaction_type;
      }
    } else if (interaction.interaction_type === "comment") {
      existing.commentCount += 1;
    }

    interactionStats.set(interaction.workout_id, existing);
  }

  return events.map((event) => {
    const actor = profileMap.get(event.user_id);
    const workout = event.workout_id ? workoutMap.get(event.workout_id) : null;
    const gym = workout?.gym_id ? gymMap.get(workout.gym_id) : null;
    const engagement = workout ? interactionStats.get(workout.id) : null;

    return {
      id: event.id,
      actorLabel: actor?.display_name || actor?.username || "KRUXT Athlete",
      actorUsername: actor?.username ?? null,
      workoutTitle: workout?.title ?? null,
      workoutType: workout?.workout_type ?? null,
      gymName: gym?.name ?? null,
      visibility: workout?.visibility ?? null,
      totalSets: workout?.total_sets ?? 0,
      totalVolumeKg: workout?.total_volume_kg ?? 0,
      isPr: Boolean(workout?.is_pr),
      eventType: event.event_type,
      caption: event.caption,
      createdAt: workout?.started_at ?? event.created_at,
      reactionCount: engagement?.reactionCount ?? 0,
      commentCount: engagement?.commentCount ?? 0,
      viewerReaction: engagement?.viewerReaction ?? null,
      isOwn: event.user_id === viewerUserId
    };
  });
}
