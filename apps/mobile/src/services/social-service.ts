import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BlockUserInput,
  CommentInput,
  FollowUserInput,
  ReactionInput,
  ReportTargetType,
  RespondFollowRequestInput,
  SocialConnection,
  SocialConnectionStatus,
  SocialInteraction,
  UserReportInput
} from "@kruxt/types";

import { KruxtAppError, throwIfError } from "./errors";

type SocialConnectionRow = {
  id: string;
  follower_user_id: string;
  followed_user_id: string;
  status: SocialConnectionStatus;
  created_at: string;
  updated_at: string;
};

type SocialInteractionRow = {
  id: string;
  workout_id: string;
  actor_user_id: string;
  interaction_type: SocialInteraction["interactionType"];
  reaction_type: SocialInteraction["reactionType"];
  comment_text: string | null;
  parent_interaction_id: string | null;
  created_at: string;
  updated_at: string;
};

type UserBlockRow = {
  id: string;
  blocker_user_id: string;
  blocked_user_id: string;
  reason: string | null;
  created_at: string;
};

type UserReportRow = {
  id: string;
  reporter_user_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export interface UserBlockRecord {
  id: string;
  blockerUserId: string;
  blockedUserId: string;
  reason?: string | null;
  createdAt: string;
}

export interface UserReportRecord {
  id: string;
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function mapConnection(row: SocialConnectionRow): SocialConnection {
  return {
    id: row.id,
    followerUserId: row.follower_user_id,
    followedUserId: row.followed_user_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInteraction(row: SocialInteractionRow): SocialInteraction {
  return {
    id: row.id,
    workoutId: row.workout_id,
    actorUserId: row.actor_user_id,
    interactionType: row.interaction_type,
    reactionType: row.reaction_type,
    commentText: row.comment_text,
    parentInteractionId: row.parent_interaction_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapBlock(row: UserBlockRow): UserBlockRecord {
  return {
    id: row.id,
    blockerUserId: row.blocker_user_id,
    blockedUserId: row.blocked_user_id,
    reason: row.reason,
    createdAt: row.created_at
  };
}

function mapReport(row: UserReportRow): UserReportRecord {
  return {
    id: row.id,
    reporterUserId: row.reporter_user_id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SocialService {
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

  private async assertNoBlockRelationship(currentUserId: string, targetUserId: string): Promise<void> {
    const filter = [
      `and(blocker_user_id.eq.${currentUserId},blocked_user_id.eq.${targetUserId})`,
      `and(blocker_user_id.eq.${targetUserId},blocked_user_id.eq.${currentUserId})`
    ].join(",");

    const { data, error } = await this.supabase
      .from("user_blocks")
      .select("id,blocker_user_id,blocked_user_id")
      .or(filter)
      .limit(1)
      .maybeSingle();

    throwIfError(error, "SOCIAL_BLOCK_CHECK_FAILED", "Unable to validate block state.");

    if (!data) {
      return;
    }

    const row = data as Pick<UserBlockRow, "blocker_user_id" | "blocked_user_id">;
    if (row.blocker_user_id === currentUserId) {
      throw new KruxtAppError("SOCIAL_BLOCKED_BY_SELF", "Unblock this user before creating social interactions.");
    }

    throw new KruxtAppError("SOCIAL_BLOCKED_BY_TARGET", "This user has blocked you.");
  }

  async listFollowing(userId: string, limit = 100): Promise<SocialConnection[]> {
    const { data, error } = await this.supabase
      .from("social_connections")
      .select("*")
      .eq("follower_user_id", userId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(limit);

    throwIfError(error, "SOCIAL_LIST_FOLLOWING_FAILED", "Unable to list following.");

    return ((data as SocialConnectionRow[]) ?? []).map(mapConnection);
  }

  async listFollowers(userId: string, limit = 100): Promise<SocialConnection[]> {
    const { data, error } = await this.supabase
      .from("social_connections")
      .select("*")
      .eq("followed_user_id", userId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(limit);

    throwIfError(error, "SOCIAL_LIST_FOLLOWERS_FAILED", "Unable to list followers.");

    return ((data as SocialConnectionRow[]) ?? []).map(mapConnection);
  }

  async listIncomingFollowRequests(userId?: string, limit = 50): Promise<SocialConnection[]> {
    const resolvedUserId = await this.resolveUserId(userId);

    const { data, error } = await this.supabase
      .from("social_connections")
      .select("*")
      .eq("followed_user_id", resolvedUserId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    throwIfError(error, "SOCIAL_LIST_REQUESTS_FAILED", "Unable to list incoming follow requests.");

    return ((data as SocialConnectionRow[]) ?? []).map(mapConnection);
  }

  async requestFollow(input: FollowUserInput, userId?: string): Promise<SocialConnection> {
    const followerUserId = await this.resolveUserId(userId);

    if (followerUserId === input.followedUserId) {
      throw new KruxtAppError("SOCIAL_SELF_FOLLOW_FORBIDDEN", "You cannot follow yourself.");
    }

    await this.assertNoBlockRelationship(followerUserId, input.followedUserId);

    const { data: existingData, error: existingError } = await this.supabase
      .from("social_connections")
      .select("*")
      .eq("follower_user_id", followerUserId)
      .eq("followed_user_id", input.followedUserId)
      .maybeSingle();

    throwIfError(existingError, "SOCIAL_REQUEST_LOOKUP_FAILED", "Unable to check existing follow state.");

    const existing = existingData as SocialConnectionRow | null;
    if (existing) {
      if (existing.status === "blocked") {
        throw new KruxtAppError("SOCIAL_REQUEST_BLOCKED", "This follow relationship is blocked.");
      }

      return mapConnection(existing);
    }

    const { data, error } = await this.supabase
      .from("social_connections")
      .insert({
        follower_user_id: followerUserId,
        followed_user_id: input.followedUserId,
        status: "pending"
      })
      .select("*")
      .single();

    throwIfError(error, "SOCIAL_REQUEST_CREATE_FAILED", "Unable to send follow request.");

    return mapConnection(data as SocialConnectionRow);
  }

  async respondToFollowRequest(input: RespondFollowRequestInput, userId?: string): Promise<SocialConnection> {
    const resolvedUserId = await this.resolveUserId(userId);

    const { data, error } = await this.supabase
      .from("social_connections")
      .update({ status: input.status })
      .eq("id", input.connectionId)
      .eq("followed_user_id", resolvedUserId)
      .select("*")
      .single();

    throwIfError(error, "SOCIAL_REQUEST_RESPOND_FAILED", "Unable to respond to follow request.");

    return mapConnection(data as SocialConnectionRow);
  }

  async cancelFollowing(followedUserId: string, userId?: string): Promise<void> {
    const resolvedUserId = await this.resolveUserId(userId);

    const { error } = await this.supabase
      .from("social_connections")
      .delete()
      .eq("follower_user_id", resolvedUserId)
      .eq("followed_user_id", followedUserId);

    throwIfError(error, "SOCIAL_UNFOLLOW_FAILED", "Unable to unfollow user.");
  }

  async removeFollower(followerUserId: string, userId?: string): Promise<void> {
    const resolvedUserId = await this.resolveUserId(userId);

    const { error } = await this.supabase
      .from("social_connections")
      .delete()
      .eq("follower_user_id", followerUserId)
      .eq("followed_user_id", resolvedUserId);

    throwIfError(error, "SOCIAL_REMOVE_FOLLOWER_FAILED", "Unable to remove follower.");
  }

  async addReaction(input: ReactionInput, userId?: string): Promise<SocialInteraction> {
    const actorUserId = await this.resolveUserId(userId);

    const { data: existingData, error: existingError } = await this.supabase
      .from("social_interactions")
      .select("*")
      .eq("workout_id", input.workoutId)
      .eq("actor_user_id", actorUserId)
      .eq("interaction_type", "reaction")
      .maybeSingle();

    throwIfError(existingError, "SOCIAL_REACTION_LOOKUP_FAILED", "Unable to load existing reaction.");

    const existing = existingData as SocialInteractionRow | null;
    if (existing) {
      const { data, error } = await this.supabase
        .from("social_interactions")
        .update({
          reaction_type: input.reactionType,
          comment_text: null,
          parent_interaction_id: null
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      throwIfError(error, "SOCIAL_REACTION_UPDATE_FAILED", "Unable to update reaction.");

      return mapInteraction(data as SocialInteractionRow);
    }

    const { data, error } = await this.supabase
      .from("social_interactions")
      .insert({
        workout_id: input.workoutId,
        actor_user_id: actorUserId,
        interaction_type: "reaction",
        reaction_type: input.reactionType
      })
      .select("*")
      .single();

    throwIfError(error, "SOCIAL_REACTION_CREATE_FAILED", "Unable to add reaction.");

    return mapInteraction(data as SocialInteractionRow);
  }

  async removeReaction(workoutId: string, userId?: string): Promise<void> {
    const actorUserId = await this.resolveUserId(userId);

    const { error } = await this.supabase
      .from("social_interactions")
      .delete()
      .eq("workout_id", workoutId)
      .eq("actor_user_id", actorUserId)
      .eq("interaction_type", "reaction");

    throwIfError(error, "SOCIAL_REACTION_DELETE_FAILED", "Unable to remove reaction.");
  }

  async addComment(input: CommentInput, userId?: string): Promise<SocialInteraction> {
    const actorUserId = await this.resolveUserId(userId);
    const commentText = input.commentText.trim();

    if (commentText.length === 0) {
      throw new KruxtAppError("SOCIAL_COMMENT_EMPTY", "Comment cannot be empty.");
    }

    const { data, error } = await this.supabase
      .from("social_interactions")
      .insert({
        workout_id: input.workoutId,
        actor_user_id: actorUserId,
        interaction_type: "comment",
        comment_text: commentText,
        parent_interaction_id: input.parentInteractionId ?? null
      })
      .select("*")
      .single();

    throwIfError(error, "SOCIAL_COMMENT_CREATE_FAILED", "Unable to post comment.");

    return mapInteraction(data as SocialInteractionRow);
  }

  async deleteInteraction(interactionId: string): Promise<void> {
    const { error } = await this.supabase
      .from("social_interactions")
      .delete()
      .eq("id", interactionId);

    throwIfError(error, "SOCIAL_INTERACTION_DELETE_FAILED", "Unable to delete interaction.");
  }

  async listWorkoutInteractions(workoutId: string, limit = 200): Promise<SocialInteraction[]> {
    const { data, error } = await this.supabase
      .from("social_interactions")
      .select("*")
      .eq("workout_id", workoutId)
      .order("created_at", { ascending: true })
      .limit(limit);

    throwIfError(error, "SOCIAL_INTERACTIONS_READ_FAILED", "Unable to load workout interactions.");

    return ((data as SocialInteractionRow[]) ?? []).map(mapInteraction);
  }

  async blockUser(input: BlockUserInput, userId?: string): Promise<UserBlockRecord> {
    const blockerUserId = await this.resolveUserId(userId);

    if (blockerUserId === input.blockedUserId) {
      throw new KruxtAppError("SOCIAL_BLOCK_SELF_FORBIDDEN", "You cannot block yourself.");
    }

    const { data, error } = await this.supabase
      .from("user_blocks")
      .upsert(
        {
          blocker_user_id: blockerUserId,
          blocked_user_id: input.blockedUserId,
          reason: input.reason ?? null
        },
        { onConflict: "blocker_user_id,blocked_user_id" }
      )
      .select("*")
      .single();

    throwIfError(error, "SOCIAL_BLOCK_CREATE_FAILED", "Unable to block user.");

    const inverseFilter = [
      `and(follower_user_id.eq.${blockerUserId},followed_user_id.eq.${input.blockedUserId})`,
      `and(follower_user_id.eq.${input.blockedUserId},followed_user_id.eq.${blockerUserId})`
    ].join(",");

    const { error: cleanupError } = await this.supabase
      .from("social_connections")
      .delete()
      .or(inverseFilter);

    throwIfError(cleanupError, "SOCIAL_BLOCK_CLEANUP_FAILED", "Unable to cleanup social connection after block.");

    return mapBlock(data as UserBlockRow);
  }

  async unblockUser(blockedUserId: string, userId?: string): Promise<void> {
    const blockerUserId = await this.resolveUserId(userId);

    const { error } = await this.supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_user_id", blockerUserId)
      .eq("blocked_user_id", blockedUserId);

    throwIfError(error, "SOCIAL_UNBLOCK_FAILED", "Unable to unblock user.");
  }

  async listMyBlocks(userId?: string): Promise<UserBlockRecord[]> {
    const blockerUserId = await this.resolveUserId(userId);

    const { data, error } = await this.supabase
      .from("user_blocks")
      .select("*")
      .eq("blocker_user_id", blockerUserId)
      .order("created_at", { ascending: false });

    throwIfError(error, "SOCIAL_BLOCKS_READ_FAILED", "Unable to load blocked users.");

    return ((data as UserBlockRow[]) ?? []).map(mapBlock);
  }

  async createReport(input: UserReportInput, userId?: string): Promise<UserReportRecord> {
    const reporterUserId = await this.resolveUserId(userId);

    const reason = input.reason.trim();
    if (reason.length === 0) {
      throw new KruxtAppError("SOCIAL_REPORT_REASON_REQUIRED", "Report reason is required.");
    }

    const { data, error } = await this.supabase
      .from("user_reports")
      .insert({
        reporter_user_id: reporterUserId,
        target_type: input.targetType,
        target_id: input.targetId,
        reason,
        details: input.details ?? null
      })
      .select("*")
      .single();

    throwIfError(error, "SOCIAL_REPORT_CREATE_FAILED", "Unable to submit report.");

    return mapReport(data as UserReportRow);
  }

  async listMyReports(userId?: string, limit = 100): Promise<UserReportRecord[]> {
    const reporterUserId = await this.resolveUserId(userId);

    const { data, error } = await this.supabase
      .from("user_reports")
      .select("*")
      .eq("reporter_user_id", reporterUserId)
      .order("created_at", { ascending: false })
      .limit(limit);

    throwIfError(error, "SOCIAL_REPORTS_READ_FAILED", "Unable to load reports.");

    return ((data as UserReportRow[]) ?? []).map(mapReport);
  }
}
