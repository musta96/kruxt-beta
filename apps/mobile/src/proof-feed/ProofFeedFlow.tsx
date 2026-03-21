import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ReactionType, SocialInteraction, UserReportInput } from "@kruxt/types";
import type { RankedFeedItem } from "../services";
import { Avatar, Badge, IconButton } from "../design-system";
import { ErrorBanner, Spinner } from "../design-system";
import type { FeedUiState, ProofFeedServices } from "./types";
import { REACTION_OPTIONS } from "./types";

// ─── State management ──────────────────────────────────────────────────────
type Action =
  | { type: "LOAD_START" }
  | { type: "REFRESH_START" }
  | { type: "LOAD_OK"; items: RankedFeedItem[]; hiddenBlockedActorCount: number; blockedUsers: any[]; myReports: any[] }
  | { type: "LOAD_ERR"; message: string }
  | { type: "SET_THREAD"; workoutId: string; interactions: SocialInteraction[] }
  | { type: "CLOSE_THREAD" }
  | { type: "SET_COMMENT_DRAFT"; workoutId: string; text: string }
  | { type: "MUTATION_START"; key: string }
  | { type: "MUTATION_END"; key: string };

function initialState(): FeedUiState {
  return {
    status: "idle",
    items: [],
    hiddenBlockedActorCount: 0,
    blockedUsers: [],
    myReports: [],
    error: null,
    activeThread: null,
    commentDrafts: {},
    pendingMutations: new Set(),
  };
}

function reducer(state: FeedUiState, action: Action): FeedUiState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, status: "loading", error: null };
    case "REFRESH_START":
      return { ...state, status: "refreshing", error: null };
    case "LOAD_OK":
      return {
        ...state,
        status: "loaded",
        items: action.items,
        hiddenBlockedActorCount: action.hiddenBlockedActorCount,
        blockedUsers: action.blockedUsers,
        myReports: action.myReports,
        error: null,
      };
    case "LOAD_ERR":
      return { ...state, status: "error", error: action.message };
    case "SET_THREAD":
      return { ...state, activeThread: { workoutId: action.workoutId, interactions: action.interactions } };
    case "CLOSE_THREAD":
      return { ...state, activeThread: null };
    case "SET_COMMENT_DRAFT":
      return { ...state, commentDrafts: { ...state.commentDrafts, [action.workoutId]: action.text } };
    case "MUTATION_START": {
      const next = new Set(state.pendingMutations);
      next.add(action.key);
      return { ...state, pendingMutations: next };
    }
    case "MUTATION_END": {
      const next = new Set(state.pendingMutations);
      next.delete(action.key);
      return { ...state, pendingMutations: next };
    }
    default:
      return state;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatDuration(startedAt: string): string {
  const hours = Math.max(0, (Date.now() - Date.parse(startedAt)) / 3600000);
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)}kg`;
}

// ─── Skeleton card ─────────────────────────────────────────────────────────
function FeedSkeletonCard() {
  return (
    <div className="panel p-4 flex flex-col gap-3" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-full" />
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="skeleton h-3.5 w-1/3" />
          <div className="skeleton h-3 w-1/4" />
        </div>
      </div>
      <div className="skeleton h-4 w-3/4" />
      <div className="skeleton h-3 w-full" />
      <div className="flex gap-4 pt-1">
        <div className="skeleton h-8 w-16 rounded-md" />
        <div className="skeleton h-8 w-16 rounded-md" />
        <div className="skeleton h-8 w-16 rounded-md" />
      </div>
    </div>
  );
}

// ─── Feed Card ─────────────────────────────────────────────────────────────
function FeedCard({
  item,
  onReact,
  onOpenThread,
  onOverflow,
  isPending,
}: {
  item: RankedFeedItem;
  onReact: (workoutId: string, type: ReactionType | null) => void;
  onOpenThread: (workoutId: string) => void;
  onOverflow: (item: RankedFeedItem) => void;
  isPending: boolean;
}) {
  const [showReactions, setShowReactions] = useState(false);

  return (
    <article className="panel overflow-hidden">
      {/* Identity row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Avatar
          src={item.actor.avatarUrl}
          alt={item.actor.displayName}
          fallback={item.actor.displayName[0]}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">
              {item.actor.displayName}
            </span>
            {item.actor.rankTier && (
              <Badge variant="ion">{item.actor.rankTier}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>@{item.actor.username}</span>
            <span>·</span>
            <span>{formatDuration(item.createdAt)}</span>
          </div>
        </div>
        {/* Overflow menu */}
        <IconButton
          label="More actions"
          size="sm"
          onClick={() => onOverflow(item)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </IconButton>
      </div>

      {/* Workout summary */}
      <div className="px-4 py-2">
        <h3 className="text-base font-display font-bold text-foreground">
          {item.workout.title}
        </h3>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <Badge variant="steel">{item.workout.workoutType}</Badge>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {item.workout.totalSets} sets
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {formatVolume(item.workout.totalVolumeKg)}
          </span>
          {item.workout.isPr && (
            <Badge variant="warning">🏅 PR</Badge>
          )}
          {item.eventType === "pr_verified" && (
            <Badge variant="ion">⚔️ Verified</Badge>
          )}
        </div>
      </div>

      {/* Caption */}
      {item.caption && (
        <p className="px-4 py-1 text-sm text-secondary-foreground leading-relaxed">
          {item.caption}
        </p>
      )}

      {/* Social action bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-border mt-2">
        {/* Reaction button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowReactions(!showReactions)}
            disabled={isPending}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              item.engagement.viewerReaction
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            aria-label="React"
          >
            {item.engagement.viewerReaction
              ? REACTION_OPTIONS.find((r) => r.type === item.engagement.viewerReaction)?.emoji ?? "✊"
              : "✊"}
            <span className="font-mono tabular-nums">{item.engagement.reactionCount || ""}</span>
          </button>

          {/* Reaction picker */}
          {showReactions && (
            <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-popover border border-border rounded-lg p-1.5 shadow-lg z-10">
              {REACTION_OPTIONS.map((r) => (
                <button
                  key={r.type}
                  type="button"
                  onClick={() => {
                    onReact(
                      item.workout.id,
                      item.engagement.viewerReaction === r.type ? null : r.type
                    );
                    setShowReactions(false);
                  }}
                  disabled={isPending}
                  className={`w-9 h-9 rounded-md flex items-center justify-center text-lg transition-all active:scale-90 ${
                    item.engagement.viewerReaction === r.type
                      ? "bg-primary/20 ring-1 ring-primary"
                      : "hover:bg-muted"
                  }`}
                  aria-label={r.label}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Comment button */}
        <button
          type="button"
          onClick={() => onOpenThread(item.workout.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Comments"
        >
          💬
          <span className="font-mono tabular-nums">{item.engagement.commentCount || ""}</span>
        </button>

        <div className="flex-1" />

        {/* Visibility badge */}
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-display">
          {item.workout.visibility}
        </span>
      </div>
    </article>
  );
}

// ─── Comment thread panel ──────────────────────────────────────────────────
function ThreadPanel({
  workoutId,
  interactions,
  commentDraft,
  onDraftChange,
  onSubmit,
  onClose,
  isPending,
}: {
  workoutId: string;
  interactions: SocialInteraction[];
  commentDraft: string;
  onDraftChange: (text: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close thread"
        >
          ✕
        </button>
        <span className="font-display font-bold text-foreground text-sm">Comments</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {interactions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No comments yet. Be the first.
          </p>
        )}
        {interactions
          .filter((i) => i.interactionType === "comment")
          .map((interaction) => (
            <div
              key={interaction.id}
              className={`flex flex-col gap-0.5 ${
                interaction.parentInteractionId ? "ml-8" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {interaction.actorUserId.slice(0, 8)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDuration(interaction.createdAt)}
                </span>
              </div>
              <p className="text-sm text-secondary-foreground">{interaction.commentText}</p>
            </div>
          ))}
      </div>

      {/* Compose bar */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-t border-border"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }}
      >
        <input
          type="text"
          value={commentDraft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Add a comment..."
          className="input-field flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && commentDraft.trim()) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || !commentDraft.trim()}
          className="btn-compact bg-primary text-primary-foreground disabled:opacity-40"
        >
          {isPending ? <Spinner size={14} /> : "Send"}
        </button>
      </div>
    </div>
  );
}

// ─── Overflow menu ─────────────────────────────────────────────────────────
function OverflowSheet({
  item,
  onBlock,
  onReport,
  onClose,
}: {
  item: RankedFeedItem;
  onBlock: () => void;
  onReport: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card border-t border-border rounded-t-2xl p-4 space-y-1"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs text-muted-foreground font-display uppercase tracking-wider px-2 pb-2">
          {item.actor.displayName}
        </p>
        <button
          type="button"
          onClick={onReport}
          className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          🚩 Report content
        </button>
        <button
          type="button"
          onClick={onBlock}
          className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          🚫 Block {item.actor.displayName}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full text-center py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mt-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Blocked content placeholder ───────────────────────────────────────────
function BlockedPlaceholder() {
  return (
    <div className="panel p-4 flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Content hidden.</p>
    </div>
  );
}

// ─── Main flow ─────────────────────────────────────────────────────────────
export function ProofFeedFlow({ services }: { services: ProofFeedServices }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [overflowItem, setOverflowItem] = useState<RankedFeedItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isRefreshing = useRef(false);

  // ─── Load feed ─────────────────────────────────────────────────────────
  const loadFeed = useCallback(
    async (isRefresh = false) => {
      dispatch({ type: isRefresh ? "REFRESH_START" : "LOAD_START" });
      const result = await services.load();
      if (result.ok === false) {
        dispatch({ type: "LOAD_ERR", message: (result as { ok: false; error: { message: string } }).error.message });
        return;
      }
      dispatch({
        type: "LOAD_OK",
        items: result.snapshot.feed,
        hiddenBlockedActorCount: result.snapshot.hiddenBlockedActorCount,
        blockedUsers: result.snapshot.blockedUsers,
        myReports: result.snapshot.myReports,
      });
    },
    [services]
  );

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // ─── Pull to refresh ──────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      const scrollTop = scrollRef.current?.scrollTop ?? 0;
      if (dy > 80 && scrollTop <= 0 && !isRefreshing.current) {
        isRefreshing.current = true;
        loadFeed(true).finally(() => {
          isRefreshing.current = false;
        });
      }
    },
    [loadFeed]
  );

  // ─── Reactions ─────────────────────────────────────────────────────────
  const handleReact = useCallback(
    async (workoutId: string, reactionType: ReactionType | null) => {
      const key = `react-${workoutId}`;
      dispatch({ type: "MUTATION_START", key });
      await services.react(workoutId, reactionType);
      dispatch({ type: "MUTATION_END", key });
      loadFeed(true);
    },
    [services, loadFeed]
  );

  // ─── Comments ──────────────────────────────────────────────────────────
  const openThread = useCallback(
    async (workoutId: string) => {
      const interactions = await services.loadThread(workoutId);
      dispatch({ type: "SET_THREAD", workoutId, interactions });
    },
    [services]
  );

  const submitComment = useCallback(async () => {
    if (!state.activeThread) return;
    const { workoutId } = state.activeThread;
    const text = (state.commentDrafts[workoutId] ?? "").trim();
    if (!text) return;

    const key = `comment-${workoutId}`;
    dispatch({ type: "MUTATION_START", key });
    await services.comment(workoutId, text);
    dispatch({ type: "SET_COMMENT_DRAFT", workoutId, text: "" });
    dispatch({ type: "MUTATION_END", key });

    // Refresh thread
    const interactions = await services.loadThread(workoutId);
    dispatch({ type: "SET_THREAD", workoutId, interactions });
    loadFeed(true);
  }, [state.activeThread, state.commentDrafts, services, loadFeed]);

  // ─── Moderation ────────────────────────────────────────────────────────
  const handleBlock = useCallback(async () => {
    if (!overflowItem) return;
    const key = `block-${overflowItem.actor.userId}`;
    dispatch({ type: "MUTATION_START", key });
    await services.block(overflowItem.actor.userId);
    dispatch({ type: "MUTATION_END", key });
    setOverflowItem(null);
    loadFeed(true);
  }, [overflowItem, services, loadFeed]);

  const handleReport = useCallback(async () => {
    if (!overflowItem) return;
    const input: UserReportInput = {
      targetType: "workout",
      targetId: overflowItem.workout.id,
      reason: "Reported from feed",
    };
    const key = `report-${overflowItem.workout.id}`;
    dispatch({ type: "MUTATION_START", key });
    await services.report(input);
    dispatch({ type: "MUTATION_END", key });
    setOverflowItem(null);
    loadFeed(true);
  }, [overflowItem, services, loadFeed]);

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div
      ref={scrollRef}
      className="flex flex-col min-h-full"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-black text-foreground tracking-tight">
              Proof Feed
            </h1>
            <p className="text-[10px] text-primary font-display font-semibold">
              Post the proof.
            </p>
          </div>
          {state.status === "refreshing" && <Spinner size={16} />}
        </div>
      </header>

      {/* Pull indicator */}
      {state.status === "refreshing" && (
        <div className="flex justify-center py-2">
          <span className="text-xs text-muted-foreground font-display">Refreshing…</span>
        </div>
      )}

      {/* Loading skeleton */}
      {state.status === "loading" && (
        <div className="flex flex-col gap-3 p-4">
          <FeedSkeletonCard />
          <FeedSkeletonCard />
          <FeedSkeletonCard />
          <FeedSkeletonCard />
        </div>
      )}

      {/* Error */}
      {state.status === "error" && (
        <div className="p-4">
          <ErrorBanner message={state.error ?? "Unable to load feed."} onRetry={() => loadFeed()} />
        </div>
      )}

      {/* Empty state */}
      {state.status === "loaded" && state.items.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="text-4xl">🔥</span>
          <p className="text-sm font-display font-bold text-foreground">No proof yet.</p>
          <p className="text-xs text-muted-foreground">Protect the chain. Rank decays without receipts.</p>
        </div>
      )}

      {/* Feed cards */}
      {(state.status === "loaded" || state.status === "refreshing") && state.items.length > 0 && (
        <div className="flex flex-col gap-3 p-4">
          {state.items.map((item) => (
            <FeedCard
              key={item.eventId}
              item={item}
              onReact={handleReact}
              onOpenThread={openThread}
              onOverflow={setOverflowItem}
              isPending={state.pendingMutations.has(`react-${item.workout.id}`)}
            />
          ))}

          {/* Bottom brand copy */}
          <p className="text-center text-[10px] text-muted-foreground font-display py-4">
            Protect the chain. · Rank decays without receipts.
          </p>
        </div>
      )}

      {/* Thread panel */}
      {state.activeThread && (
        <ThreadPanel
          workoutId={state.activeThread.workoutId}
          interactions={state.activeThread.interactions}
          commentDraft={state.commentDrafts[state.activeThread.workoutId] ?? ""}
          onDraftChange={(text) =>
            dispatch({ type: "SET_COMMENT_DRAFT", workoutId: state.activeThread!.workoutId, text })
          }
          onSubmit={submitComment}
          onClose={() => dispatch({ type: "CLOSE_THREAD" })}
          isPending={state.pendingMutations.has(`comment-${state.activeThread.workoutId}`)}
        />
      )}

      {/* Overflow sheet */}
      {overflowItem && (
        <OverflowSheet
          item={overflowItem}
          onBlock={handleBlock}
          onReport={handleReport}
          onClose={() => setOverflowItem(null)}
        />
      )}
    </div>
  );
}
