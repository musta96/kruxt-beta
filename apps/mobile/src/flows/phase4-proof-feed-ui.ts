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
export type ProofFeedModerationMode = "hide" | "placeholder";

export interface ProofFeedLoadInput {
  cursor?: string | null;
  limit?: number;
  scanLimit?: number;
  moderationMode?: ProofFeedModerationMode;
}

export interface ProofFeedPagination {
  cursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  scanLimit: number;
}

export interface ProofFeedModerationSummary {
  hiddenBlockedActorCount: number;
  hiddenReportedByViewerCount: number;
  placeholderCount: number;
}

export interface ProofFeedUiMicrocopy {
  postProof: string;
  protectChain: string;
  rankDecay: string;
}

export interface ProofFeedPlaceholderItem {
  kind: "placeholder";
  key: string;
  reason: "blocked_actor" | "reported_by_viewer";
  message: string;
}

export interface ProofFeedEventItem {
  kind: "event";
  key: string;
  item: RankedFeedItem;
}

export type ProofFeedRenderItem = ProofFeedEventItem | ProofFeedPlaceholderItem;

export interface ProofFeedSnapshot {
  feed: RankedFeedItem[];
  renderItems: ProofFeedRenderItem[];
  hiddenBlockedActorCount: number;
  blockedUsers: UserBlockRecord[];
  incomingFollowRequests: SocialConnection[];
  myReports: UserReportRecord[];
  pagination: ProofFeedPagination;
  moderationMode: ProofFeedModerationMode;
  moderationSummary: ProofFeedModerationSummary;
  refreshedAt: string;
  skeletonCardCount: number;
  pullToRefreshEnabled: true;
  infiniteScrollEnabled: true;
  microcopy: ProofFeedUiMicrocopy;
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

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 40;
const DEFAULT_SCAN_LIMIT = 160;
const MAX_SCAN_LIMIT = 250;

const PROOF_FEED_MICROCOPY: ProofFeedUiMicrocopy = {
  postProof: "Post the proof.",
  protectChain: "Protect the chain.",
  rankDecay: "Rank decays without receipts."
};

export const phase4ProofFeedUiChecklist = [
  ...phase4SocialFeedChecklist,
  "Persist reactions and comments with immediate state refresh",
  "Hide blocked actors from feed cards and interaction threads",
  "Create moderation records from report actions",
  "Support pull-to-refresh and cursor-based infinite pagination"
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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

  if (code === "PROOF_FEED_CURSOR_INVALID") {
    return "Feed cursor is invalid. Pull to refresh and retry.";
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

function paginateRankedFeed(
  items: RankedFeedItem[],
  input: Required<Pick<ProofFeedLoadInput, "cursor" | "limit">>
): {
  pageItems: RankedFeedItem[];
  hasMore: boolean;
  nextCursor: string | null;
} {
  let startIndex = 0;

  if (input.cursor) {
    const byEventIndex = items.findIndex((item) => item.eventId === input.cursor);
    if (byEventIndex >= 0) {
      startIndex = byEventIndex + 1;
    } else {
      const byCreatedAtIndex = items.findIndex((item) => item.createdAt < input.cursor!);
      if (byCreatedAtIndex >= 0) {
        startIndex = byCreatedAtIndex;
      } else {
        throw new KruxtAppError("PROOF_FEED_CURSOR_INVALID", "Unable to resolve feed cursor.");
      }
    }
  }

  const pageItems = items.slice(startIndex, startIndex + input.limit);
  const hasMore = startIndex + input.limit < items.length;
  const nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].eventId : null;

  return {
    pageItems,
    hasMore,
    nextCursor
  };
}

function buildModerationSets(reports: UserReportRecord[]): {
  reportedWorkoutIds: Set<string>;
  reportedProfileIds: Set<string>;
} {
  const reportedWorkoutIds = new Set<string>();
  const reportedProfileIds = new Set<string>();

  for (const report of reports) {
    if (report.targetType === "workout") {
      reportedWorkoutIds.add(report.targetId);
    }

    if (report.targetType === "profile") {
      reportedProfileIds.add(report.targetId);
    }
  }

  return {
    reportedWorkoutIds,
    reportedProfileIds
  };
}

function applyModeration(
  pageItems: RankedFeedItem[],
  blockedActorIds: Set<string>,
  reportedWorkoutIds: Set<string>,
  reportedProfileIds: Set<string>,
  moderationMode: ProofFeedModerationMode
): {
  feed: RankedFeedItem[];
  renderItems: ProofFeedRenderItem[];
  summary: ProofFeedModerationSummary;
} {
  const feed: RankedFeedItem[] = [];
  const renderItems: ProofFeedRenderItem[] = [];

  let hiddenBlockedActorCount = 0;
  let hiddenReportedByViewerCount = 0;
  let placeholderCount = 0;

  for (const item of pageItems) {
    const blocked = blockedActorIds.has(item.actor.userId);
    const reportedByViewer =
      reportedWorkoutIds.has(item.workout.id) || reportedProfileIds.has(item.actor.userId);

    if (!blocked && !reportedByViewer) {
      feed.push(item);
      renderItems.push({
        kind: "event",
        key: item.eventId,
        item
      });
      continue;
    }

    if (blocked) {
      hiddenBlockedActorCount += 1;
    }

    if (reportedByViewer) {
      hiddenReportedByViewerCount += 1;
    }

    if (moderationMode === "placeholder") {
      placeholderCount += 1;
      renderItems.push({
        kind: "placeholder",
        key: `${item.eventId}:placeholder`,
        reason: blocked ? "blocked_actor" : "reported_by_viewer",
        message: blocked
          ? "Content hidden because this athlete is blocked."
          : "Content hidden because you reported it."
      });
    }
  }

  return {
    feed,
    renderItems,
    summary: {
      hiddenBlockedActorCount,
      hiddenReportedByViewerCount,
      placeholderCount
    }
  };
}

function dedupeFeed(items: RankedFeedItem[]): RankedFeedItem[] {
  const seen = new Set<string>();
  const deduped: RankedFeedItem[] = [];

  for (const item of items) {
    if (seen.has(item.eventId)) {
      continue;
    }
    seen.add(item.eventId);
    deduped.push(item);
  }

  return deduped;
}

function dedupeRenderItems(items: ProofFeedRenderItem[]): ProofFeedRenderItem[] {
  const seen = new Set<string>();
  const deduped: ProofFeedRenderItem[] = [];

  for (const item of items) {
    if (seen.has(item.key)) {
      continue;
    }
    seen.add(item.key);
    deduped.push(item);
  }

  return deduped;
}

export function createPhase4ProofFeedUiFlow() {
  const supabase = createMobileSupabaseClient();
  const feed = new FeedService(supabase);
  const social = new SocialService(supabase);

  const loadSnapshot = async (
    input: ProofFeedLoadInput = {},
    userId?: string
  ): Promise<ProofFeedSnapshot> => {
    const limit = clamp(input.limit ?? DEFAULT_PAGE_LIMIT, 1, MAX_PAGE_LIMIT);
    const scanLimit = clamp(input.scanLimit ?? DEFAULT_SCAN_LIMIT, limit, MAX_SCAN_LIMIT);
    const moderationMode = input.moderationMode ?? "hide";
    const cursor = input.cursor ?? null;

    const [rankedFeed, blockedUsers, incomingFollowRequests, myReports] = await Promise.all([
      feed.listHomeFeed({ limit: scanLimit, scanLimit }, userId),
      social.listMyBlocks(userId),
      social.listIncomingFollowRequests(userId, 50),
      social.listMyReports(userId, 30)
    ]);

    const blockedActorIds = new Set(blockedUsers.map((row) => row.blockedUserId));
    const moderationSets = buildModerationSets(myReports);

    const page = paginateRankedFeed(rankedFeed, { cursor, limit });
    const moderatedPage = applyModeration(
      page.pageItems,
      blockedActorIds,
      moderationSets.reportedWorkoutIds,
      moderationSets.reportedProfileIds,
      moderationMode
    );

    return {
      feed: moderatedPage.feed,
      renderItems: moderatedPage.renderItems,
      hiddenBlockedActorCount: moderatedPage.summary.hiddenBlockedActorCount,
      blockedUsers,
      incomingFollowRequests,
      myReports,
      pagination: {
        cursor,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        limit,
        scanLimit
      },
      moderationMode,
      moderationSummary: moderatedPage.summary,
      refreshedAt: new Date().toISOString(),
      skeletonCardCount: Math.min(limit, 6),
      pullToRefreshEnabled: true,
      infiniteScrollEnabled: true,
      microcopy: { ...PROOF_FEED_MICROCOPY }
    };
  };

  const runMutation = async (
    mutate: () => Promise<Partial<ProofFeedMutationSuccess>>,
    userId?: string
  ): Promise<ProofFeedMutationResult> => {
    try {
      const mutationPayload = await mutate();
      const snapshot = await loadSnapshot({}, userId);

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
    microcopy: { ...PROOF_FEED_MICROCOPY },
    load: async (input: ProofFeedLoadInput = {}, userId?: string): Promise<ProofFeedLoadResult> => {
      try {
        return {
          ok: true,
          snapshot: await loadSnapshot(input, userId)
        };
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    },
    refresh: async (userId?: string): Promise<ProofFeedLoadResult> => {
      try {
        return {
          ok: true,
          snapshot: await loadSnapshot({ cursor: null }, userId)
        };
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    },
    loadMore: async (
      currentSnapshot: ProofFeedSnapshot,
      userId?: string
    ): Promise<ProofFeedLoadResult> => {
      if (!currentSnapshot.pagination.hasMore || !currentSnapshot.pagination.nextCursor) {
        return {
          ok: true,
          snapshot: currentSnapshot
        };
      }

      try {
        const nextSnapshot = await loadSnapshot(
          {
            cursor: currentSnapshot.pagination.nextCursor,
            limit: currentSnapshot.pagination.limit,
            scanLimit: currentSnapshot.pagination.scanLimit,
            moderationMode: currentSnapshot.moderationMode
          },
          userId
        );

        return {
          ok: true,
          snapshot: {
            ...nextSnapshot,
            feed: dedupeFeed([...currentSnapshot.feed, ...nextSnapshot.feed]),
            renderItems: dedupeRenderItems([
              ...currentSnapshot.renderItems,
              ...nextSnapshot.renderItems
            ]),
            hiddenBlockedActorCount:
              currentSnapshot.hiddenBlockedActorCount + nextSnapshot.hiddenBlockedActorCount,
            moderationSummary: {
              hiddenBlockedActorCount:
                currentSnapshot.moderationSummary.hiddenBlockedActorCount +
                nextSnapshot.moderationSummary.hiddenBlockedActorCount,
              hiddenReportedByViewerCount:
                currentSnapshot.moderationSummary.hiddenReportedByViewerCount +
                nextSnapshot.moderationSummary.hiddenReportedByViewerCount,
              placeholderCount:
                currentSnapshot.moderationSummary.placeholderCount +
                nextSnapshot.moderationSummary.placeholderCount
            }
          }
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
