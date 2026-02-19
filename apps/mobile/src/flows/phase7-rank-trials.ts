import type { Challenge, Leaderboard } from "@kruxt/types";

import {
  CompetitionService,
  createMobileSupabaseClient,
  type ChallengeParticipantWithActor,
  type LeaderboardEntryWithActor
} from "../services";

export interface Phase7RankTrialsOptions {
  gymId?: string;
  leaderboardLimit?: number;
  leaderboardEntriesPerBoard?: number;
  challengeLimit?: number;
}

export interface RankedBoardSnapshot {
  leaderboard: Leaderboard;
  entries: LeaderboardEntryWithActor[];
}

export interface ChallengeTrialSnapshot {
  challenge: Challenge;
  leaderboard: ChallengeParticipantWithActor[];
}

export interface Phase7RankTrialsSnapshot {
  weeklyBoards: RankedBoardSnapshot[];
  activeChallenges: Challenge[];
  joinedChallenges: Challenge[];
  joinedChallengeScoreboards: ChallengeTrialSnapshot[];
}

export const phase7RankTrialsChecklist = [
  "Load active weekly leaderboards",
  "Load leaderboard entries with actor snapshots",
  "Load active challenges/trials",
  "Load joined challenge scoreboards"
] as const;

export function createPhase7RankTrialsFlow() {
  const supabase = createMobileSupabaseClient();
  const competition = new CompetitionService(supabase);

  return {
    checklist: phase7RankTrialsChecklist,
    load: async (userId: string, options: Phase7RankTrialsOptions = {}): Promise<Phase7RankTrialsSnapshot> => {
      const leaderboardLimit = Math.min(Math.max(options.leaderboardLimit ?? 8, 1), 24);
      const entriesLimit = Math.min(Math.max(options.leaderboardEntriesPerBoard ?? 25, 1), 100);
      const challengeLimit = Math.min(Math.max(options.challengeLimit ?? 12, 1), 40);

      const [activeChallenges, joinedChallenges, weeklyBoards] = await Promise.all([
        competition.listChallenges({ activeOnly: true, joinedOnly: false, gymId: options.gymId, limit: challengeLimit }, userId),
        competition.listChallenges({ activeOnly: true, joinedOnly: true, gymId: options.gymId, limit: challengeLimit }, userId),
        competition.listLeaderboards({
          timeframe: "weekly",
          activeOnly: true,
          gymId: options.gymId,
          limit: leaderboardLimit
        })
      ]);

      const boardEntries = await Promise.all(
        weeklyBoards.map(async (leaderboard) => ({
          leaderboard,
          entries: await competition.listLeaderboardEntries(leaderboard.id, entriesLimit)
        }))
      );

      const joinedChallengeScoreboards = await Promise.all(
        joinedChallenges.slice(0, 6).map(async (challenge) => ({
          challenge,
          leaderboard: await competition.listChallengeParticipants(challenge.id, 30)
        }))
      );

      return {
        weeklyBoards: boardEntries,
        activeChallenges,
        joinedChallenges,
        joinedChallengeScoreboards
      };
    }
  };
}
