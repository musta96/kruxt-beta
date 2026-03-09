"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import { loadGuildOverview, loadGuildRoster, type GuildOverview, type GuildRosterItem } from "@/lib/public/guild";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

export function GuildScreen() {
  const { state, supabase } = usePublicSession();
  const [overview, setOverview] = useState<GuildOverview | null>(null);
  const [roster, setRoster] = useState<GuildRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGuild = useCallback(async () => {
    if (!state.user) return;

    try {
      setError(null);
      const nextOverview = await loadGuildOverview(supabase);
      setOverview(nextOverview);
      if (nextOverview.gymId) {
        const nextRoster = await loadGuildRoster(supabase, nextOverview.gymId, 24);
        setRoster(nextRoster);
      } else {
        setRoster([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load guild hall.");
    } finally {
      setLoading(false);
    }
  }, [state.user, supabase]);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;
    void loadGuild();
  }, [loadGuild, state.status, state.user]);

  return (
    <MemberShell
      title="Guild Hall"
      subtitle="Your primary gym, roster visibility, upcoming classes, and the operational pulse of your current guild."
    >
      {error ? <div className="status-banner status-danger">{error}</div> : null}

      {loading ? (
        <section className="section-stack">
          <article className="feed-card">
            <p className="feed-body">Loading guild hall…</p>
          </article>
        </section>
      ) : !overview?.gymId ? (
        <section className="section-stack">
          <article className="feed-card">
            <p className="feed-title">No guild linked yet</p>
            <p className="feed-body">
              Join a gym or accept an invite to unlock guild hall, roster visibility, classes, and rank surfaces.
            </p>
            <div className="stack-actions">
              <Link href="/profile" className="secondary-cta">
                Open profile
              </Link>
            </div>
          </article>
        </section>
      ) : (
        <>
          <section className="hero-card">
            <div>
              <p className="eyebrow">PRIMARY GUILD</p>
              <h2 className="section-title">{overview.gymName}</h2>
              <p className="section-copy">
                {overview.role} · {overview.membershipStatus} · {overview.isStaff ? "Staff access" : "Member access"}
              </p>
            </div>

            <div className="hero-stats">
              <div className="metric-card">
                <span className="metric-label">Roster</span>
                <strong className="metric-value">{overview.rosterCount}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Pending</span>
                <strong className="metric-value">{overview.pendingApprovals}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Upcoming classes</span>
                <strong className="metric-value">{overview.upcomingClasses}</strong>
              </div>
            </div>
          </section>

          <section className="split-card">
            <article className="glass-panel">
              <p className="eyebrow">PROGRESS</p>
              <h2 className="section-title">Member standing</h2>
              <dl className="feed-stat-row guild-stats-grid">
                <div>
                  <dt>Rank</dt>
                  <dd>{overview.rankTier}</dd>
                </div>
                <div>
                  <dt>Level</dt>
                  <dd>{overview.level}</dd>
                </div>
                <div>
                  <dt>XP</dt>
                  <dd>{overview.xpTotal}</dd>
                </div>
                <div>
                  <dt>Chain</dt>
                  <dd>{overview.chainDays} days</dd>
                </div>
              </dl>
            </article>

            <article className="glass-panel">
              <div className="profile-form-header">
                <div>
                  <p className="eyebrow">CALENDAR</p>
                  <h2 className="section-title">Upcoming classes</h2>
                </div>
                {overview.isStaff ? (
                  <Link href="/org/classes" className="secondary-cta">
                    Open org classes
                  </Link>
                ) : null}
              </div>
              <div className="rank-list">
                {overview.upcomingClassItems.length === 0 ? (
                  <p className="feed-body">No upcoming classes scheduled right now.</p>
                ) : (
                  overview.upcomingClassItems.map((item) => (
                    <div key={item.id} className="rank-row">
                      <div>
                        <strong>{item.title}</strong>
                        <p className="feed-body">{new Date(item.startsAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          <section className="glass-panel">
            <div className="profile-form-header">
              <div>
                <p className="eyebrow">ROSTER</p>
                <h2 className="section-title">Guild members</h2>
              </div>
              <button type="button" className="secondary-cta" onClick={() => void loadGuild()}>
                Refresh
              </button>
            </div>

            <div className="rank-list">
              {roster.map((member) => (
                <div key={member.membershipId} className="rank-row">
                  <div className="rank-position">{member.level}</div>
                  <div className="rank-row-body">
                    <strong>{member.displayName}</strong>
                    <p className="feed-body">
                      @{member.username} · {member.role} · {member.membershipStatus} · joined {formatDate(member.joinedAt)}
                    </p>
                  </div>
                  <span className="ghost-chip">{member.rankTier}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </MemberShell>
  );
}
