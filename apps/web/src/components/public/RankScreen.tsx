"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const updatingChallenge = useRef(false);
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
    }
  }, [state.user, supabase]);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;
    void loadRank();
  }, [loadRank, state.status, state.user]);

  async function handleToggleChallenge(challengeId: string, joined: boolean, completed: boolean) {
    if (completed || updatingChallenge.current) return;
    updatingChallenge.current = true;
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
      await loadRank();
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update challenge status.");
    } finally {
      updatingChallenge.current = false;
      setUpdatingChallengeId(null);
    }
  }

  return (
    <MemberShell
      title="Rank Ladder"
      subtitle="Weekly leaderboards and recorded challenge participation."
    >
      {error ? <div role="alert" className="status-banner status-danger">{error}</div> : null}
      {success ? <div role="status" className="status-banner status-success">{success}</div> : null}

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
              <button type="button" className="secondary-cta" disabled={updatingChallengeId !== null} onClick={() => void loadRank()}>
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
                  <div className="feed-card-header" style={{ flexWrap: "wrap" }}>
                    <div>
                      <p className="feed-meta">{challenge.challengeType}</p>
                      <h3 className="feed-title">{challenge.title}</h3>
                    </div>
                    {challenge.completed ? (
                      <span className="ghost-chip">Completed</span>
                    ) : (
                      <button
                        type="button"
                        className={`ghost-chip ${challenge.joined ? "is-selected" : ""}`}
                        disabled={updatingChallengeId !== null}
                        aria-label={`${challenge.joined ? "Leave" : "Join"} challenge: ${challenge.title}`}
                        onClick={() => void handleToggleChallenge(challenge.id, challenge.joined, challenge.completed)}
                      >
                        {updatingChallengeId === challenge.id ? "Updating..." : challenge.joined ? "Leave challenge" : "Join challenge"}
                      </button>
                    )}
                  </div>

                  {challenge.description ? <p className="feed-body">{challenge.description}</p> : null}
                  {challenge.completed ? <p className="supporting-copy">Completed entries cannot be left.</p> : null}
                  {challenge.joined && !challenge.completed ? <p className="supporting-copy">Leaving removes your entry and score.</p> : null}

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
