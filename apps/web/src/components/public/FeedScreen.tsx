"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import { loadPublicFeed, type PublicFeedItem } from "@/lib/public/feed";

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
            </article>
          ))}
        </section>
      )}
    </MemberShell>
  );
}
