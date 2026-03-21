"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactionType } from "@kruxt/types";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import {
  createWorkoutComment,
  deleteWorkoutComment,
  loadPublicFeed,
  loadWorkoutComments,
  removeWorkoutReaction,
  setWorkoutReaction,
  type PublicFeedComment,
  type PublicFeedItem
} from "@/lib/public/feed";

const REACTION_OPTIONS: Array<{ value: ReactionType; label: string }> = [
  { value: "fist", label: "Fist" },
  { value: "fire", label: "Fire" },
  { value: "shield", label: "Shield" },
  { value: "clap", label: "Clap" },
  { value: "crown", label: "Crown" }
];

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function FeedScreen() {
  const { state, supabase, displayLabel } = usePublicSession();
  const [items, setItems] = useState<PublicFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingWorkoutIds, setPendingWorkoutIds] = useState<Record<string, boolean>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentsByWorkoutId, setCommentsByWorkoutId] = useState<Record<string, PublicFeedComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});

  const loadFeed = useCallback(async () => {
    if (!state.user) return;

    try {
      setError(null);
      const nextItems = await loadPublicFeed(supabase, state.user.id, 20);
      setItems(nextItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load proof feed.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.user, supabase]);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;
    void loadFeed();
  }, [loadFeed, state.status, state.user]);

  const stats = useMemo(() => {
    const ownLogs = items.filter((item) => item.isOwn).length;
    const prCount = items.filter((item) => item.isPr || item.eventType === "pr_verified").length;
    const visibleGyms = new Set(items.map((item) => item.gymName).filter(Boolean)).size;

    return {
      ownLogs,
      prCount,
      visibleGyms
    };
  }, [items]);

  async function handleReaction(item: PublicFeedItem, reactionType: ReactionType) {
    if (!item.workoutId || !state.user) return;

    setPendingWorkoutIds((current) => ({ ...current, [item.workoutId!]: true }));
    setError(null);

    try {
      const isRemoving = item.viewerReaction === reactionType;
      if (isRemoving) {
        await removeWorkoutReaction(supabase, item.workoutId);
      } else {
        await setWorkoutReaction(supabase, {
          workoutId: item.workoutId,
          reactionType
        });
      }

      setItems((current) =>
        current.map((entry) => {
          if (entry.workoutId !== item.workoutId) return entry;

          const hadReaction = Boolean(entry.viewerReaction);
          const removingCurrent = entry.viewerReaction === reactionType;

          return {
            ...entry,
            viewerReaction: removingCurrent ? null : reactionType,
            reactionCount: removingCurrent
              ? Math.max(0, entry.reactionCount - 1)
              : hadReaction
                ? entry.reactionCount
                : entry.reactionCount + 1
          };
        })
      );
    } catch (reactionError) {
      setError(reactionError instanceof Error ? reactionError.message : "Unable to update reaction.");
    } finally {
      setPendingWorkoutIds((current) => ({ ...current, [item.workoutId!]: false }));
    }
  }

  async function ensureCommentsLoaded(item: PublicFeedItem) {
    if (!item.workoutId || !state.user) return;
    if (commentsByWorkoutId[item.workoutId]) return;

    setCommentsLoading((current) => ({ ...current, [item.workoutId!]: true }));

    try {
      const comments = await loadWorkoutComments(supabase, item.workoutId, state.user.id);
      setCommentsByWorkoutId((current) => ({ ...current, [item.workoutId!]: comments }));
    } catch (commentsError) {
      setError(commentsError instanceof Error ? commentsError.message : "Unable to load comments.");
    } finally {
      setCommentsLoading((current) => ({ ...current, [item.workoutId!]: false }));
    }
  }

  async function handleToggleComments(item: PublicFeedItem) {
    if (!item.workoutId) return;

    const nextOpen = !openComments[item.workoutId];
    setOpenComments((current) => ({ ...current, [item.workoutId!]: nextOpen }));

    if (nextOpen) {
      await ensureCommentsLoaded(item);
    }
  }

  async function handleSubmitComment(item: PublicFeedItem) {
    if (!item.workoutId || !state.user) return;

    const commentText = (commentDrafts[item.workoutId] ?? "").trim();
    if (!commentText) {
      setError("Comment cannot be empty.");
      return;
    }

    setCommentSubmitting((current) => ({ ...current, [item.workoutId!]: true }));
    setError(null);

    try {
      await createWorkoutComment(supabase, {
        workoutId: item.workoutId,
        commentText
      });

      const comments = await loadWorkoutComments(supabase, item.workoutId, state.user.id);
      setCommentsByWorkoutId((current) => ({ ...current, [item.workoutId!]: comments }));
      setCommentDrafts((current) => ({ ...current, [item.workoutId!]: "" }));
      setItems((current) =>
        current.map((entry) =>
          entry.workoutId === item.workoutId
            ? {
                ...entry,
                commentCount: entry.commentCount + 1
              }
            : entry
        )
      );
      setOpenComments((current) => ({ ...current, [item.workoutId!]: true }));
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "Unable to post comment.");
    } finally {
      setCommentSubmitting((current) => ({ ...current, [item.workoutId!]: false }));
    }
  }

  async function handleDeleteComment(item: PublicFeedItem, commentId: string) {
    if (!item.workoutId || !state.user) return;

    setError(null);

    try {
      await deleteWorkoutComment(supabase, commentId);
      setCommentsByWorkoutId((current) => ({
        ...current,
        [item.workoutId!]: (current[item.workoutId!] ?? []).filter((comment) => comment.id !== commentId)
      }));
      setItems((current) =>
        current.map((entry) =>
          entry.workoutId === item.workoutId
            ? {
                ...entry,
                commentCount: Math.max(0, entry.commentCount - 1)
              }
            : entry
        )
      );
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete comment.");
    }
  }

  return (
    <MemberShell
      title="Proof Feed"
      subtitle="Recent workout activity, proof events, and what your gym community is actually logging right now."
    >
      <section className="hero-card">
        <div>
          <p className="eyebrow">LIVE FEED</p>
          <h2 className="section-title">Your training record is now wired to live data.</h2>
          <p className="section-copy">
            Signed in as {displayLabel}. This feed now reads the live workout and proof event tables instead of
            placeholder content.
          </p>
          <div className="stack-actions">
            <Link href="/log" className="primary-cta">
              Log workout
            </Link>
            <button
              className="secondary-cta"
              type="button"
              onClick={() => {
                setRefreshing(true);
                void loadFeed();
              }}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh feed"}
            </button>
          </div>
        </div>

        <div className="hero-stats">
          <div className="metric-card">
            <span className="metric-label">Your events</span>
            <strong className="metric-value">{stats.ownLogs}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">PR events</span>
            <strong className="metric-value">{stats.prCount}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Gyms visible</span>
            <strong className="metric-value">{stats.visibleGyms}</strong>
          </div>
        </div>
      </section>

      {error ? <div className="status-banner status-danger">{error}</div> : null}

      {loading ? (
        <section className="section-stack">
          <article className="feed-card">
            <p className="feed-body">Loading live workout events…</p>
          </article>
        </section>
      ) : items.length === 0 ? (
        <section className="section-stack">
          <article className="feed-card">
            <p className="feed-title">No feed activity yet</p>
            <p className="feed-body">
              Once workouts are logged, proof events will appear here. Use the workout logger to create the first one.
            </p>
          </article>
        </section>
      ) : (
        <section className="section-stack">
          {items.map((item) => (
            <article key={item.id} className="feed-card">
              <div className="feed-card-header">
                <div>
                  <p className="feed-meta">
                    {item.gymName ? `${item.gymName} · ` : ""}
                    {formatDate(item.createdAt)}
                  </p>
                  <h3 className="feed-title">{item.workoutTitle ?? item.eventType.replace(/_/g, " ")}</h3>
                </div>
                <div className="feed-card-chips">
                  {item.workoutType ? <span className="ghost-chip">{item.workoutType}</span> : null}
                  {item.visibility ? <span className="ghost-chip">{item.visibility}</span> : null}
                  {item.isPr ? <span className="ghost-chip is-selected">PR</span> : null}
                </div>
              </div>

              <div className="feed-actor-row">
                <strong>{item.actorLabel}</strong>
                {item.actorUsername ? <span className="feed-body">@{item.actorUsername}</span> : null}
                {item.isOwn ? <span className="identity-chip">You</span> : null}
              </div>

              {item.caption ? <p className="feed-body">{item.caption}</p> : null}

              {item.proofMedia.length > 0 ? (
                <div className="proof-media-grid">
                  {item.proofMedia.map((media) =>
                    media.mediaKind === "video" ? (
                      <video key={media.id} className="proof-media-tile" controls preload="metadata">
                        <source src={media.url} type={media.mimeType} />
                      </video>
                    ) : (
                      <img
                        key={media.id}
                        className="proof-media-tile"
                        src={media.url}
                        alt={`${item.actorLabel} workout proof`}
                      />
                    )
                  )}
                </div>
              ) : null}

              <dl className="feed-stat-row">
                <div>
                  <dt>Sets</dt>
                  <dd>{item.totalSets}</dd>
                </div>
                <div>
                  <dt>Volume</dt>
                  <dd>{item.totalVolumeKg} kg</dd>
                </div>
                <div>
                  <dt>Engagement</dt>
                  <dd>
                    {item.reactionCount} reactions · {item.commentCount} comments
                  </dd>
                </div>
              </dl>

              {item.workoutId ? (
                <>
                  <div className="feed-actions-row">
                    <div className="reaction-row">
                      {REACTION_OPTIONS.map((reaction) => (
                        <button
                          key={reaction.value}
                          type="button"
                          className={`ghost-chip ${item.viewerReaction === reaction.value ? "is-selected" : ""}`}
                          disabled={Boolean(pendingWorkoutIds[item.workoutId!])}
                          onClick={() => {
                            void handleReaction(item, reaction.value);
                          }}
                        >
                          {reaction.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      className={`ghost-chip ${openComments[item.workoutId] ? "is-selected" : ""}`}
                      onClick={() => {
                        void handleToggleComments(item);
                      }}
                    >
                      {openComments[item.workoutId] ? "Hide comments" : `Comments (${item.commentCount})`}
                    </button>
                  </div>

                  {openComments[item.workoutId] ? (
                    <div className="comments-panel">
                      {commentsLoading[item.workoutId] ? (
                        <p className="feed-body">Loading comments…</p>
                      ) : (commentsByWorkoutId[item.workoutId] ?? []).length === 0 ? (
                        <p className="feed-body">No comments yet. Be the first one.</p>
                      ) : (
                        <div className="comments-list">
                          {(commentsByWorkoutId[item.workoutId] ?? []).map((comment) => (
                            <div key={comment.id} className="comment-card">
                              <div className="comment-header">
                                <div>
                                  <strong>{comment.actorLabel}</strong>
                                  {comment.actorUsername ? (
                                    <span className="feed-body comment-username">@{comment.actorUsername}</span>
                                  ) : null}
                                </div>
                                <div className="comment-header-actions">
                                  <span className="feed-meta comment-meta">{formatDate(comment.createdAt)}</span>
                                  {comment.isOwn ? (
                                    <button
                                      type="button"
                                      className="comment-delete"
                                      onClick={() => {
                                        void handleDeleteComment(item, comment.id);
                                      }}
                                    >
                                      Delete
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              <p className="feed-body comment-body">{comment.commentText}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="comment-composer">
                        <textarea
                          className="input comment-input"
                          value={commentDrafts[item.workoutId] ?? ""}
                          onChange={(event) =>
                            setCommentDrafts((current) => ({
                              ...current,
                              [item.workoutId!]: event.target.value
                            }))
                          }
                          placeholder="Add a comment..."
                        />
                        <button
                          type="button"
                          className="primary-cta"
                          disabled={Boolean(commentSubmitting[item.workoutId])}
                          onClick={() => {
                            void handleSubmitComment(item);
                          }}
                        >
                          {commentSubmitting[item.workoutId] ? "Posting..." : "Post comment"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </MemberShell>
  );
}
