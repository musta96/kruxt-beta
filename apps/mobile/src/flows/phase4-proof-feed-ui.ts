import type {
  ReactionType,
  SocialInteraction,
  SocialConnection,
  UserReportInput
} from "@kruxt/types";

import {
  createMobileSupabaseClient,
  FeedService,
  KruxtAppError,
  SocialService,
  type RankedFeedItem,
  type UserBlockRecord,
  type UserReportRecord
} from "../services";
import { phase4SocialFeedChecklist } from "./phase4-social-feed";

export type ProofFeedUiStep = "feed" | "reaction" | "comment" | "moderation";

export interface ProofFeedSnapshot {
  feed: RankedFeedItem[];
  hiddenBlockedActorCount: number;
  blockedUsers: UserBlockRecord[];
  incomingFollowRequests: SocialConnection[];
  myReports: UserReportRecord[];
}

export interface ProofFeedUiError {
  code: string;
  step: ProofFeedUiStep;
  message: string;
  recoverable: boolean;
}

export interface ProofFeedLoadSuccess {
  ok: true;
  snapshot: ProofFeedSnapshot;
}

export interface ProofFeedLoadFailure {
  ok: false;
  error: ProofFeedUiError;
}

export type ProofFeedLoadResult = ProofFeedLoadSuccess | ProofFeedLoadFailure;

export interface ProofFeedMutationSuccess {
  ok: true;
  snapshot: ProofFeedSnapshot;
  reaction?: SocialInteraction;
  comment?: SocialInteraction;
  thread?: SocialInteraction[];
  block?: UserBlockRecord;
  report?: UserReportRecord;
}

export interface ProofFeedMutationFailure {
  ok: false;
  error: ProofFeedUiError;
}

export type ProofFeedMutationResult = ProofFeedMutationSuccess | ProofFeedMutationFailure;

export const phase4ProofFeedUiChecklist = [
  ...phase4SocialFeedChecklist,
  "Persist reactions and comments with immediate state refresh",
  "Hide blocked actors from feed cards and interaction threads",
  "Create moderation records from report actions"
] as const;

function mapErrorStep(code: string): ProofFeedUiStep {
  if (code.startsWith("FEED_") || code === "AUTH_REQUIRED" || code === "AUTH_GET_USER_FAILED") {
    return "feed";
  }

  if (code.includes("REACTION")) {
    return "reaction";
  }

  if (code.includes("COMMENT") || code === "SOCIAL_INTERACTIONS_READ_FAILED") {
    return "comment";
  }

  return "moderation";
}

function mapErrorMessage(code: string, fallback: string): string {
  if (code === "SOCIAL_COMMENT_EMPTY") {
    return "Comment cannot be empty.";
  }

  if (code === "SOCIAL_BLOCKED_BY_TARGET") {
    return "This athlete has blocked you.";
  }

  if (code === "SOCIAL_BLOCK_SELF_FORBIDDEN") {
    return "You cannot block your own profile.";
  }

  if (code === "SOCIAL_REPORT_REASON_REQUIRED") {
    return "Add a reason before sending the report.";
  }

  return fallback;
}

function mapUiError(error: unknown): ProofFeedUiError {
  const appError =
    error instanceof KruxtAppError
      ? error
      : new KruxtAppError("PROOF_FEED_UI_ACTION_FAILED", "Unable to complete feed action.", error);

  return {
    code: appError.code,
    step: mapErrorStep(appError.code),
    message: mapErrorMessage(appError.code, appError.message),
    recoverable: appError.code !== "AUTH_REQUIRED"
  };
}

function filterBlockedActors<T extends { actorUserId: string }>(
  rows: T[],
  blockedActorIds: Set<string>
): T[] {
  return rows.filter((row) => !blockedActorIds.has(row.actorUserId));
}

export function createPhase4ProofFeedUiFlow() {
  const supabase = createMobileSupabaseClient();
  const feed = new FeedService(supabase);
  const social = new SocialService(supabase);

  const loadSnapshot = async (userId?: string): Promise<ProofFeedSnapshot> => {
    const [rankedFeed, blockedUsers, incomingFollowRequests, myReports] = await Promise.all([
      feed.listHomeFeed({ limit: 30, scanLimit: 150 }, userId),
      social.listMyBlocks(userId),
      social.listIncomingFollowRequests(userId, 50),
      social.listMyReports(userId, 30)
    ]);

    const blockedActorIds = new Set(blockedUsers.map((row) => row.blockedUserId));
    const visibleFeed = rankedFeed.filter((item) => !blockedActorIds.has(item.actor.userId));

    return {
      feed: visibleFeed,
      hiddenBlockedActorCount: rankedFeed.length - visibleFeed.length,
      blockedUsers,
      incomingFollowRequests,
      myReports
    };
  };

  const runMutation = async (
    mutate: () => Promise<Partial<ProofFeedMutationSuccess>>,
    userId?: string
  ): Promise<ProofFeedMutationResult> => {
    try {
      const mutationPayload = await mutate();
      const snapshot = await loadSnapshot(userId);

      return {
        ok: true,
        snapshot,
        ...mutationPayload
      };
    } catch (error) {
      return {
        ok: false,
        error: mapUiError(error)
      };
    }
  };

  return {
    checklist: [...phase4ProofFeedUiChecklist],
    load: async (userId?: string): Promise<ProofFeedLoadResult> => {
      try {
        return {
          ok: true,
          snapshot: await loadSnapshot(userId)
        };
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    },
    loadWorkoutThread: async (workoutId: string, userId?: string): Promise<SocialInteraction[]> => {
      const [interactions, blockedUsers] = await Promise.all([
        social.listWorkoutInteractions(workoutId, 200),
        social.listMyBlocks(userId)
      ]);
      const blockedActorIds = new Set(blockedUsers.map((row) => row.blockedUserId));

      return filterBlockedActors(
        interactions.map((interaction) => ({
          ...interaction,
          actorUserId: interaction.actorUserId
        })),
        blockedActorIds
      );
    },
    reactToWorkout: async (
      workoutId: string,
      reactionType: ReactionType | null,
      userId?: string
    ): Promise<ProofFeedMutationResult> =>
      runMutation(async () => {
        if (!reactionType) {
          await social.removeReaction(workoutId, userId);
          return {};
        }

        const reaction = await social.addReaction({ workoutId, reactionType }, userId);
        return { reaction };
      }, userId),
    commentOnWorkout: async (
      workoutId: string,
      commentText: string,
      options: { parentInteractionId?: string; userId?: string } = {}
    ): Promise<ProofFeedMutationResult> =>
      runMutation(async () => {
        const comment = await social.addComment(
          {
            workoutId,
            commentText,
            parentInteractionId: options.parentInteractionId
          },
          options.userId
        );

        const [thread, blockedUsers] = await Promise.all([
          social.listWorkoutInteractions(workoutId, 200),
          social.listMyBlocks(options.userId)
        ]);
        const blockedActorIds = new Set(blockedUsers.map((row) => row.blockedUserId));
        const filteredThread = filterBlockedActors(
          thread.map((interaction) => ({
            ...interaction,
            actorUserId: interaction.actorUserId
          })),
          blockedActorIds
        );

        return {
          comment,
          thread: filteredThread
        };
      }, options.userId),
    blockActor: async (
      blockedUserId: string,
      reason?: string,
      userId?: string
    ): Promise<ProofFeedMutationResult> =>
      runMutation(async () => {
        const block = await social.blockUser({ blockedUserId, reason }, userId);
        return { block };
      }, userId),
    unblockActor: async (blockedUserId: string, userId?: string): Promise<ProofFeedMutationResult> =>
      runMutation(async () => {
        await social.unblockUser(blockedUserId, userId);
        return {};
      }, userId),
    reportContent: async (
      input: UserReportInput,
      userId?: string
    ): Promise<ProofFeedMutationResult> =>
      runMutation(async () => {
        const report = await social.createReport(input, userId);
        return { report };
      }, userId)
  };
}
