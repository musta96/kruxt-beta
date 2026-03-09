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
  id: string;
  workout_id: string;
  parent_interaction_id: string | null;
  interaction_type: "reaction" | "comment";
  reaction_type: ReactionType | null;
  comment_text: string | null;
  actor_user_id: string;
  created_at: string;
};

type WorkoutProofMediaRow = {
  id: string;
  workout_id: string;
  storage_bucket: string;
  storage_path: string;
  media_kind: "image" | "video";
  mime_type: string;
  sort_order: number;
};

export interface PublicFeedProofMedia {
  id: string;
  mediaKind: "image" | "video";
  mimeType: string;
  url: string;
  sortOrder: number;
}

export interface PublicFeedItem {
  id: string;
  workoutId: string | null;
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
  proofMedia: PublicFeedProofMedia[];
  isOwn: boolean;
}

export interface PublicFeedComment {
  id: string;
  workoutId: string;
  actorUserId: string;
  actorLabel: string;
  actorUsername: string | null;
  commentText: string;
  createdAt: string;
  isOwn: boolean;
}

async function requireUser(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }

  return data.user.id;
}

function isMissingWorkoutProofMediaRelation(error: { message?: string | null } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("workout_proof_media") && (message.includes("does not exist") || message.includes("find"));
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

  const [profilesResponse, workoutsResponse, interactionsResponse, proofMediaResponse] = await Promise.all([
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
          .select("id,workout_id,parent_interaction_id,interaction_type,reaction_type,comment_text,actor_user_id,created_at")
          .in("workout_id", workoutIds)
      : Promise.resolve({ data: [] as InteractionRow[] | null, error: null }),
    workoutIds.length > 0
      ? client
          .from("workout_proof_media")
          .select("id,workout_id,storage_bucket,storage_path,media_kind,mime_type,sort_order")
          .in("workout_id", workoutIds)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as WorkoutProofMediaRow[] | null, error: null })
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
  if (proofMediaResponse.error && !isMissingWorkoutProofMediaRelation(proofMediaResponse.error)) {
    throw new Error(proofMediaResponse.error.message || "Unable to load workout proof media.");
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
  const proofMediaRows = proofMediaResponse.error
    ? []
    : (((proofMediaResponse.data ?? []) as WorkoutProofMediaRow[]) ?? []);
  const signedMediaUrls = new Map<string, string>();

  if (proofMediaRows.length > 0) {
    const signedResults = await Promise.all(
      proofMediaRows.map(async (media) => {
        const { data, error } = await client.storage.from(media.storage_bucket).createSignedUrl(media.storage_path, 3600);
        if (error || !data?.signedUrl) {
          return null;
        }

        return {
          id: media.id,
          url: data.signedUrl
        };
      })
    );

    for (const signed of signedResults) {
      if (signed) {
        signedMediaUrls.set(signed.id, signed.url);
      }
    }
  }

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

  const proofMediaByWorkoutId = new Map<string, PublicFeedProofMedia[]>();
  for (const media of proofMediaRows) {
    const url = signedMediaUrls.get(media.id);
    if (!url) continue;

    const next = proofMediaByWorkoutId.get(media.workout_id) ?? [];
    next.push({
      id: media.id,
      mediaKind: media.media_kind,
      mimeType: media.mime_type,
      url,
      sortOrder: media.sort_order
    });
    proofMediaByWorkoutId.set(media.workout_id, next);
  }

  return events.map((event) => {
    const actor = profileMap.get(event.user_id);
    const workout = event.workout_id ? workoutMap.get(event.workout_id) : null;
    const gym = workout?.gym_id ? gymMap.get(workout.gym_id) : null;
    const engagement = workout ? interactionStats.get(workout.id) : null;

    return {
      id: event.id,
      workoutId: event.workout_id,
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
      proofMedia: event.workout_id ? proofMediaByWorkoutId.get(event.workout_id) ?? [] : [],
      isOwn: event.user_id === viewerUserId
    };
  });
}

export async function loadWorkoutComments(
  client: SupabaseClient,
  workoutId: string,
  viewerUserId: string
): Promise<PublicFeedComment[]> {
  const { data, error } = await client
    .from("social_interactions")
    .select("id,workout_id,parent_interaction_id,interaction_type,reaction_type,comment_text,actor_user_id,created_at")
    .eq("workout_id", workoutId)
    .eq("interaction_type", "comment")
    .is("parent_interaction_id", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Unable to load comments.");
  }

  const comments = ((data ?? []) as InteractionRow[]) ?? [];
  if (comments.length === 0) {
    return [];
  }

  const actorIds = Array.from(new Set(comments.map((item) => item.actor_user_id)));
  const { data: profilesData, error: profilesError } = await client
    .from("profiles")
    .select("id,display_name,username")
    .in("id", actorIds);

  if (profilesError) {
    throw new Error(profilesError.message || "Unable to load comment authors.");
  }

  const profileMap = new Map<string, ProfileRow>(
    ((((profilesData ?? []) as ProfileRow[]) ?? []).map((profile) => [profile.id, profile]))
  );

  return comments.map((comment) => {
    const actor = profileMap.get(comment.actor_user_id);

    return {
      id: comment.id,
      workoutId: comment.workout_id,
      actorUserId: comment.actor_user_id,
      actorLabel: actor?.display_name || actor?.username || "KRUXT Athlete",
      actorUsername: actor?.username ?? null,
      commentText: comment.comment_text ?? "",
      createdAt: comment.created_at,
      isOwn: comment.actor_user_id === viewerUserId
    };
  });
}

export async function setWorkoutReaction(
  client: SupabaseClient,
  input: {
    workoutId: string;
    reactionType: ReactionType;
  }
): Promise<void> {
  const actorUserId = await requireUser(client);

  const { data: existingData, error: existingError } = await client
    .from("social_interactions")
    .select("id")
    .eq("workout_id", input.workoutId)
    .eq("actor_user_id", actorUserId)
    .eq("interaction_type", "reaction")
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Unable to load existing reaction.");
  }

  const existingId = (existingData as { id: string } | null)?.id ?? null;

  if (existingId) {
    const { error } = await client
      .from("social_interactions")
      .update({
        reaction_type: input.reactionType,
        comment_text: null,
        parent_interaction_id: null
      })
      .eq("id", existingId);

    if (error) {
      throw new Error(error.message || "Unable to update reaction.");
    }

    return;
  }

  const { error } = await client.from("social_interactions").insert({
    workout_id: input.workoutId,
    actor_user_id: actorUserId,
    interaction_type: "reaction",
    reaction_type: input.reactionType
  });

  if (error) {
    throw new Error(error.message || "Unable to add reaction.");
  }
}

export async function removeWorkoutReaction(client: SupabaseClient, workoutId: string): Promise<void> {
  const actorUserId = await requireUser(client);

  const { error } = await client
    .from("social_interactions")
    .delete()
    .eq("workout_id", workoutId)
    .eq("actor_user_id", actorUserId)
    .eq("interaction_type", "reaction");

  if (error) {
    throw new Error(error.message || "Unable to remove reaction.");
  }
}

export async function createWorkoutComment(
  client: SupabaseClient,
  input: {
    workoutId: string;
    commentText: string;
  }
): Promise<void> {
  const actorUserId = await requireUser(client);
  const commentText = input.commentText.trim();

  if (!commentText) {
    throw new Error("Comment cannot be empty.");
  }

  const { error } = await client.from("social_interactions").insert({
    workout_id: input.workoutId,
    actor_user_id: actorUserId,
    interaction_type: "comment",
    comment_text: commentText,
    parent_interaction_id: null
  });

  if (error) {
    throw new Error(error.message || "Unable to post comment.");
  }
}

export async function deleteWorkoutComment(client: SupabaseClient, commentId: string): Promise<void> {
  const actorUserId = await requireUser(client);

  const { error } = await client
    .from("social_interactions")
    .delete()
    .eq("id", commentId)
    .eq("actor_user_id", actorUserId)
    .eq("interaction_type", "comment");

  if (error) {
    throw new Error(error.message || "Unable to delete comment.");
  }
}
