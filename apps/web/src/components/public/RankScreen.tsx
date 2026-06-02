"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import { joinChallenge, leaveChallenge, loadRankOverview, type RankOverview } from "@/lib/public/rank";
import { loadAchievementSnapshot, type AchievementSnapshot } from "@/lib/public/achievements";

export function RankScreen() {
  const { state, supabase } = usePublicSession();
  const [overview, setOverview] = useState<RankOverview | null>(null);
  const [achievements, setAchievements] = useState<AchievementSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingChallengeId, setUpdatingChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadRank = useCallback(async () => {
    if (!state.user) return;

    try {
      setError(null);
      const [nextOverview, nextAchievements] = await Promise.all([
        loadRankOverview(supabase),
        loadAchievementSnapshot(supabase).catch(() => null)
      ]);
      setOverview(nextOverview);
      setAchievements(nextAchievements);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load rank overview.");
    } finally {
      setLoading(false);
      setUpdatingChallengeId(null);
    }
  }, [state.user, supabase]);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;
    void loadRank();
  }, [loadRank, state.status, state.user]);

  async function handleToggleChallenge(challengeId: string, joined: boolean) {
    setUpdatingChallengeId(challengeId);
    setError(null);
    setSuccess(null);

    try {
      if (joined) {
        await leaveChallenge(supabase, challengeId);
        setSuccess("Challenge left.");
      } else {
        await joinChallenge(supabase, challengeId);
        setSuccess("Challenge joined.");
      }
      await loadRank();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update challenge status.");
      setUpdatingChallengeId(null);
    }
  }

  return (
    <MemberShell
      title="Rank Ladder"
      subtitle="Weekly boards, active challenges, and the competition surface that sits on top of your logged training."
    >
      {error ? <div className="status-banner status-danger">{error}</div> : null}
      {success ? <div className="status-banner status-success">{success}</div> : null}

      {loading ? (
        <section className="section-stack">
          <article className="feed-card">
            <p className="feed-body">Loading rank ladders…</p>
          </article>
        </section>
      ) : (
        <>
          <section className="glass-panel">
            <div className="profile-form-header">
              <div>
                <p className="eyebrow">STATUS IDENTITY</p>
                <h2 className="section-title">Rank is backed by proof, not cosmetics</h2>
              </div>
              <span className="ghost-chip">
                {achievements ? `${achievements.rankTier} · ${achievements.xpTotal} XP` : "Proof loading"}
              </span>
            </div>
            <div className="achievement-grid">
              {(achievements?.cards ?? [])
                .filter((achievement) => achievement.groupVisible)
                .slice(0, 4)
                .map((achievement) => (
                  <Link key={achievement.id} href={achievement.proofHref} className="achievement-card">
                    <div className="content-card-header">
                      <div>
                        <p className="eyebrow">{achievement.status}</p>
                        <h3 className="feed-title">{achievement.title}</h3>
                      </div>
                      <span className="rank-score">
                        {achievement.progress}/{achievement.target}
                      </span>
                    </div>
                    <p className="supporting-copy">{achievement.evidenceLabel}</p>
                    <div className="achievement-progress">
                      <span style={{ width: `${Math.min(100, (achievement.progress / achievement.target) * 100)}%` }} />
                    </div>
                  </Link>
                ))}
            </div>
          </section>

          <section className="glass-panel">
            <div className="profile-form-header">
              <div>
                <p className="eyebrow">WEEKLY BOARDS</p>
                <h2 className="section-title">Leaderboards</h2>
              </div>
              <button type="button" className="secondary-cta" onClick={() => void loadRank()}>
                Refresh
              </button>
            </div>

            <div className="board-grid">
              {(overview?.weeklyBoards ?? []).map((board) => (
                <article key={board.id} className="feed-card">
                  <div className="feed-card-header">
                    <div>
                      <p className="feed-meta">
                        {board.scope} · {board.metric}
                      </p>
                      <h3 className="feed-title">{board.name}</h3>
                    </div>
                    <span className="ghost-chip">{board.timeframe}</span>
                  </div>

                  <div className="rank-list">
                    {board.entries.map((entry) => (
                      <div key={entry.id} className={`rank-row ${entry.isViewer ? "is-highlight" : ""}`}>
                        <div className="rank-position">#{entry.rank}</div>
                        <div className="rank-row-body">
                          <strong>{entry.actor?.displayName ?? "KRUXT Athlete"}</strong>
                          <p className="feed-body">
                            @{entry.actor?.username ?? "member"} · {entry.actor?.rankTier ?? "initiate"} · lvl{" "}
                            {entry.actor?.level ?? 1}
                          </p>
                        </div>
                        <div className="rank-score">{entry.score}</div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="glass-panel">
            <div className="profile-form-header">
              <div>
                <p className="eyebrow">ACTIVE CHALLENGES</p>
                <h2 className="section-title">Trials</h2>
              </div>
            </div>

            <div className="board-grid">
              {(overview?.activeChallenges ?? []).map((challenge) => (
                <article key={challenge.id} className="feed-card">
                  <div className="feed-card-header">
                    <div>
                      <p className="feed-meta">{challenge.challengeType}</p>
                      <h3 className="feed-title">{challenge.title}</h3>
                    </div>
                    <button
                      type="button"
                      className={`ghost-chip ${challenge.joined ? "is-selected" : ""}`}
                      disabled={updatingChallengeId === challenge.id}
                      onClick={() => void handleToggleChallenge(challenge.id, challenge.joined)}
                    >
                      {updatingChallengeId === challenge.id ? "Updating..." : challenge.joined ? "Joined" : "Join"}
                    </button>
                  </div>

                  {challenge.description ? <p className="feed-body">{challenge.description}</p> : null}

                  <dl className="feed-stat-row">
                    <div>
                      <dt>Points / unit</dt>
                      <dd>{challenge.pointsPerUnit}</dd>
                    </div>
                    <div>
                      <dt>Your score</dt>
                      <dd>{challenge.viewerScore ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Ends</dt>
                      <dd>{new Date(challenge.endsAt).toLocaleDateString()}</dd>
                    </div>
                  </dl>

                  <div className="rank-list">
                    {challenge.leaderboard.map((entry) => (
                      <div key={entry.id} className={`rank-row ${entry.isViewer ? "is-highlight" : ""}`}>
                        <div className="rank-position">#{entry.rank}</div>
                        <div className="rank-row-body">
                          <strong>{entry.actor?.displayName ?? "KRUXT Athlete"}</strong>
                          <p className="feed-body">@{entry.actor?.username ?? "member"}</p>
                        </div>
                        <div className="rank-score">{entry.score}</div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </MemberShell>
  );
}
