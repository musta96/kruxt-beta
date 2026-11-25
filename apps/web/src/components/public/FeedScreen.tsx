"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { HandFist, Flame, Shield, Hand, Crown, RefreshCw, MessageCircle } from "lucide-react";
import type { ReactionType } from "@kruxt/types";

import { MemberShell } from "@/components/public/MemberShell";
import { FeedConnections } from "@/components/public/FeedConnections";
import { usePublicSession } from "@/components/public/usePublicSession";
import {
  createWorkoutComment,
  deleteWorkoutComment,
  loadPublicFeed,
  loadWorkoutComments,
  removeWorkoutReaction,
  setWorkoutReaction,
  blockFeedActor,
  reportFeedWorkout,
  requestFeedFollow,
  type PublicFeedComment,
  type PublicFeedItem
} from "@/lib/public/feed";

const REACTION_OPTIONS = [
  { value: "fist", label: "Fist", icon: HandFist },
  { value: "fire", label: "Fire", icon: Flame },
  { value: "shield", label: "Shield", icon: Shield },
  { value: "clap", label: "Clap", icon: Hand },
  { value: "crown", label: "Crown", icon: Crown }
] as const;

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function FeedScreen() {
  const { state, supabase } = usePublicSession();
  const feedId = useId();
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
  const [mode, setMode] = useState<"following" | "gym" | "recent">("following");
  const [notice, setNotice] = useState<string | null>(null);
  const [safetyPending, setSafetyPending] = useState(false);
  const [reportReason, setReportReason] = useState("Privacy concern");
  const [connectionsRevision, setConnectionsRevision] = useState(0);
  const feedRevision = useRef(0);
  const safetyBusy = useRef(false);
  const locallyBlocked = useRef(new Set<string>());

  useEffect(() => { locallyBlocked.current.clear(); }, [state.user?.id]);

  const loadFeed = useCallback(async () => {
    if (!state.user) return;
    const revision = ++feedRevision.current;

    try {
      setError(null);
      const nextItems = await loadPublicFeed(supabase, state.user.id, 20, mode);
      if (revision !== feedRevision.current) return;
      setItems(nextItems.filter((item) => !locallyBlocked.current.has(item.actorUserId)));
    } catch (loadError) {
      if (revision !== feedRevision.current) return;
      setItems([]);
      setError(loadError instanceof Error ? loadError.message : "Unable to load proof feed.");
    } finally {
      if (revision === feedRevision.current) { setLoading(false); setRefreshing(false); }
    }
  }, [state.user, supabase, mode]);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;
    setLoading(true);
    setItems([]);
    setCommentsByWorkoutId({});
    void loadFeed();
    return () => { feedRevision.current += 1; };
  }, [loadFeed, state.status, state.user]);

  async function handleSafety(item: PublicFeedItem, action: "follow" | "block" | "report") {
    if (safetyBusy.current || !state.user) return;
    const revision = feedRevision.current;
    if (action === "block" && !window.confirm(`Block ${item.actorLabel}? Their activity will be hidden from your feed.`)) return;
    safetyBusy.current = true;
    setSafetyPending(true); setError(null); setNotice(null);
    try {
      if (action === "follow") {
        const status = await requestFeedFollow(supabase, item.actorUserId, state.user.id);
        if (revision !== feedRevision.current) return;
        setConnectionsRevision((value) => value + 1);
        setNotice(status === "accepted" ? "You already follow this account." : "Follow request pending. Following includes accepted connections.");
      } else if (action === "block") {
        await blockFeedActor(supabase, item.actorUserId, state.user.id);
        if (revision !== feedRevision.current) return;
        locallyBlocked.current.add(item.actorUserId);
        setConnectionsRevision((value) => value + 1);
        setItems((current) => current.filter((entry) => entry.actorUserId !== item.actorUserId));
        setCommentsByWorkoutId((current) => Object.fromEntries(Object.entries(current).map(([id, comments]) => [id, comments.filter((comment) => comment.actorUserId !== item.actorUserId)])));
        setNotice("Account blocked. Their activity is hidden from your feed.");
      } else if (item.workoutId) {
        await reportFeedWorkout(supabase, item.workoutId, reportReason, state.user.id);
        if (revision !== feedRevision.current) return;
        setNotice("Report submitted for review.");
      }
    } catch (actionError) {
      if (revision !== feedRevision.current) return;
      setError(actionError instanceof Error ? actionError.message : "Action unavailable. Retry.");
    } finally {
      safetyBusy.current = false; setSafetyPending(false);
    }
  }

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
    const revision = feedRevision.current;

    try {
      const comments = await loadWorkoutComments(supabase, item.workoutId, state.user.id);
      if (revision !== feedRevision.current) return;
      setCommentsByWorkoutId((current) => ({ ...current, [item.workoutId!]: comments.filter((comment) => !locallyBlocked.current.has(comment.actorUserId)) }));
    } catch (commentsError) {
      if (revision !== feedRevision.current) return;
      setError(commentsError instanceof Error ? commentsError.message : "Unable to load comments.");
    } finally {
      if (revision === feedRevision.current) setCommentsLoading((current) => ({ ...current, [item.workoutId!]: false }));
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
    const revision = feedRevision.current;

    try {
      await createWorkoutComment(supabase, {
        workoutId: item.workoutId,
        commentText
      });

      const comments = await loadWorkoutComments(supabase, item.workoutId, state.user.id);
      if (revision !== feedRevision.current) return;
      setCommentsByWorkoutId((current) => ({ ...current, [item.workoutId!]: comments.filter((comment) => !locallyBlocked.current.has(comment.actorUserId)) }));
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
      if (revision !== feedRevision.current) return;
      setError(commentError instanceof Error ? commentError.message : "Unable to post comment.");
    } finally {
      if (revision === feedRevision.current) setCommentSubmitting((current) => ({ ...current, [item.workoutId!]: false }));
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
      title="Feed"
      subtitle="Training, progress, and people you care about."
    >
      <section className="feed-toolbar">
          <div className="feed-tabs" role="group" aria-label="Feed view">
            {([{ id: "following", label: "Following" }, { id: "gym", label: "My gym" }, { id: "recent", label: "Recent" }] as const).map((view) => <button key={view.id} type="button" aria-pressed={mode === view.id} onClick={() => setMode(view.id)}>{view.label}</button>)}
          </div>
          <div className="stack-actions">
            <Link href="/library" className="secondary-cta">Discover sessions</Link>
            <button
              className="secondary-cta feed-refresh feed-icon-button"
              type="button"
              aria-label={refreshing ? "Refreshing feed" : "Refresh feed"}
              title={refreshing ? "Refreshing feed" : "Refresh feed"}
              aria-busy={refreshing}
              onClick={() => {
                setRefreshing(true);
                void loadFeed();
              }}
              disabled={refreshing}
            >
              <RefreshCw size={18} aria-hidden="true" />
            </button>
          </div>
      </section>

      <FeedConnections key={`${state.user?.id}:${connectionsRevision}`} client={supabase} onChange={() => {
        locallyBlocked.current.clear();
        void loadFeed();
      }} />

      {error ? <div role="alert" className="status-banner status-danger">{error}</div> : null}
      {notice ? <p role="status" className="status-banner">{notice}</p> : null}

      {loading ? (
        <section className="section-stack">
          <article className="feed-card">
            <p className="feed-body">Loading live workout events…</p>
          </article>
        </section>
      ) : !error && items.length === 0 ? (
        <section className="section-stack">
          <article className="feed-card">
            <p className="feed-title">No feed activity yet</p>
            <p className="feed-body">
              {mode === "following" ? "Activity from you and your accepted connections appears here. Find people in Recent, or start your next session." : mode === "gym" ? "Activity appears here for your active gym memberships when members choose to share." : "No activity is available right now."}
            </p>
            <Link href="/plan" className="primary-cta">Open my plan</Link>
          </article>
        </section>
      ) : (
        <section className="section-stack">
          {items.map((item, itemIndex) => {
            const itemId = `${feedId}-post-${itemIndex}`;
            const workoutHeading = item.workoutTitle ?? item.eventType.replace(/_/g, " ");
            return (
            <article key={item.id} className="feed-card">
              <header className="feed-post-header">
                <div className="feed-actor-row">
                  <strong className="feed-actor-name">{item.actorLabel}</strong>
                  {item.actorUsername ? <span className="feed-body feed-actor-username">@{item.actorUsername}</span> : null}
                  {item.isOwn ? <span className="identity-chip">You</span> : null}
                </div>
                <p className="feed-meta feed-post-meta">
                  <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  {item.gymName ? <span className="feed-post-gym"> · {item.gymName}</span> : null}
                </p>
              </header>

              <div className="feed-card-header feed-workout-header">
                <h3 className="feed-title feed-workout-title">{workoutHeading}</h3>
                <div className="feed-card-chips">
                  {item.workoutType ? <span className="ghost-chip">{item.workoutType}</span> : null}
                  {item.visibility ? <span className="ghost-chip">{item.visibility}</span> : null}
                  {item.isPr ? <span className="ghost-chip is-selected">PR</span> : null}
                </div>
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
                          aria-label={reaction.label}
                          title={reaction.label}
                          aria-pressed={item.viewerReaction === reaction.value}
                          className={`ghost-chip ${item.viewerReaction === reaction.value ? "is-selected" : ""}`}
                          disabled={Boolean(pendingWorkoutIds[item.workoutId!])}
                          onClick={() => {
                            void handleReaction(item, reaction.value);
                          }}
                        >
                          <reaction.icon size={18} aria-hidden="true" />
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      className={`ghost-chip feed-comments-toggle feed-icon-button ${openComments[item.workoutId] ? "is-selected" : ""}`}
                      aria-label={openComments[item.workoutId] ? "Hide comments" : `Comments (${item.commentCount})`}
                      title={openComments[item.workoutId] ? "Hide comments" : `Comments (${item.commentCount})`}
                      aria-expanded={Boolean(openComments[item.workoutId])}
                      aria-controls={openComments[item.workoutId] ? `${itemId}-comments` : undefined}
                      onClick={() => {
                        void handleToggleComments(item);
                      }}
                    >
                      <MessageCircle size={18} aria-hidden="true" />
                      <span className="feed-comment-count" aria-hidden="true">{item.commentCount}</span>
                    </button>
                  </div>

                  {openComments[item.workoutId] ? (
                    <div id={`${itemId}-comments`} className="comments-panel">
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

                      <label className="label feed-comment-label" htmlFor={`${itemId}-comment`}>
                        Comment on {item.actorLabel}&apos;s {workoutHeading}
                      </label>
                      <div className="comment-composer">
                        <textarea
                          id={`${itemId}-comment`}
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
              {!item.isOwn ? <details className="feed-safety"><summary>Account & safety</summary>
                <div className="feed-safety-actions">
                <button type="button" className="secondary-cta" disabled={safetyPending} onClick={() => void handleSafety(item, "follow")}>Request to follow {item.actorLabel}</button>
                <button type="button" className="secondary-cta" disabled={safetyPending} onClick={() => void handleSafety(item, "block")}>Block account</button>
                {item.workoutId ? <div className="feed-report"><label className="label" htmlFor={`${itemId}-report`}>Report reason</label><select id={`${itemId}-report`} className="input" value={reportReason} onChange={(event) => setReportReason(event.target.value)}>{["Harassment", "Unsafe content", "Spam", "Privacy concern", "Other"].map((reason) => <option key={reason}>{reason}</option>)}</select><button type="button" className="secondary-cta" disabled={safetyPending} onClick={() => void handleSafety(item, "report")}>Report workout</button></div> : null}
                </div>
              </details> : null}
            </article>
            );
          })}
        </section>
      )}
    </MemberShell>
  );
}
