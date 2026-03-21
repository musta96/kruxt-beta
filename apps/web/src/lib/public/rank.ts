import type {
  ChallengeType,
  LeaderboardMetric,
  LeaderboardScope,
  LeaderboardTimeframe,
  RankTier
} from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type ChallengeRow = {
  id: string;
  creator_user_id: string;
  gym_id: string | null;
  title: string;
  description: string | null;
  challenge_type: ChallengeType;
  visibility: string;
  starts_at: string;
  ends_at: string;
  points_per_unit: number;
  created_at: string;
  updated_at: string;
};

type ParticipantRow = {
  id: string;
  challenge_id: string;
  user_id: string;
  score: number;
  completed: boolean;
  joined_at: string;
  updated_at: string;
};

type LeaderboardRow = {
  id: string;
  name: string;
  scope: LeaderboardScope;
  scope_gym_id: string | null;
  metric: LeaderboardMetric;
  timeframe: LeaderboardTimeframe;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

type LeaderboardEntryRow = {
  id: string;
  leaderboard_id: string;
  user_id: string;
  rank: number;
  score: number;
  details: Record<string, unknown> | null;
  calculated_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  rank_tier: RankTier | null;
  level: number | null;
};

type MembershipRow = {
  gym_id: string;
  membership_status: string;
};

export interface RankedActor {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  rankTier: RankTier;
  level: number;
}

export interface RankedEntry {
  id: string;
  rank: number;
  score: number;
  calculatedAt: string;
  actor: RankedActor | null;
  isViewer: boolean;
}

export interface RankedBoard {
  id: string;
  name: string;
  scope: LeaderboardScope;
  metric: LeaderboardMetric;
  timeframe: LeaderboardTimeframe;
  startsAt: string;
  endsAt: string;
  entries: RankedEntry[];
}

export interface ChallengeCard {
  id: string;
  title: string;
  description: string | null;
  challengeType: ChallengeType;
  gymId: string | null;
  startsAt: string;
  endsAt: string;
  pointsPerUnit: number;
  joined: boolean;
  viewerScore: number | null;
  completed: boolean;
  leaderboard: RankedEntry[];
}

export interface RankOverview {
  viewerUserId: string;
  homeGymId: string | null;
  weeklyBoards: RankedBoard[];
  activeChallenges: ChallengeCard[];
}

async function requireUser(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }

  return data.user.id;
}

function toActor(profile: ProfileRow | undefined): RankedActor | null {
  if (!profile) return null;
  return {
    userId: profile.id,
    displayName: profile.display_name || profile.username || "KRUXT Athlete",
    username: profile.username || "member",
    avatarUrl: profile.avatar_url ?? null,
    rankTier: profile.rank_tier ?? "initiate",
    level: profile.level ?? 1
  };
}

export async function loadRankOverview(client: SupabaseClient): Promise<RankOverview> {
  const viewerUserId = await requireUser(client);
  const nowIso = new Date().toISOString();

  const { data: membershipData, error: membershipError } = await client
    .from("gym_memberships")
    .select("gym_id,membership_status")
    .eq("user_id", viewerUserId)
    .in("membership_status", ["trial", "active"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (membershipError) {
    throw new Error(membershipError.message || "Unable to load membership context.");
  }

  const homeGymId = ((((membershipData ?? []) as MembershipRow[]) ?? [])[0]?.gym_id as string | undefined) ?? null;

  let leaderboardQuery = client
    .from("leaderboards")
    .select("id,name,scope,scope_gym_id,metric,timeframe,starts_at,ends_at,is_active")
    .eq("is_active", true)
    .eq("timeframe", "weekly")
    .order("starts_at", { ascending: false })
    .limit(6);

  if (homeGymId) {
    leaderboardQuery = leaderboardQuery.or(`scope_gym_id.is.null,scope_gym_id.eq.${homeGymId}`);
  }

  let challengeQuery = client
    .from("challenges")
    .select("id,creator_user_id,gym_id,title,description,challenge_type,visibility,starts_at,ends_at,points_per_unit,created_at,updated_at")
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(8);

  if (homeGymId) {
    challengeQuery = challengeQuery.or(`gym_id.is.null,gym_id.eq.${homeGymId}`);
  }

  const [leaderboardsResponse, challengesResponse] = await Promise.all([leaderboardQuery, challengeQuery]);

  if (leaderboardsResponse.error) {
    throw new Error(leaderboardsResponse.error.message || "Unable to load leaderboards.");
  }
  if (challengesResponse.error) {
    throw new Error(challengesResponse.error.message || "Unable to load challenges.");
  }

  const leaderboards = ((leaderboardsResponse.data ?? []) as LeaderboardRow[]) ?? [];
  const challenges = ((challengesResponse.data ?? []) as ChallengeRow[]) ?? [];

  const boardEntriesResponse = await Promise.all(
    leaderboards.map(async (board) => {
      const { data, error } = await client
        .from("leaderboard_entries")
        .select("id,leaderboard_id,user_id,rank,score,details,calculated_at")
        .eq("leaderboard_id", board.id)
        .order("rank", { ascending: true })
        .limit(12);

      if (error) {
        throw new Error(error.message || `Unable to load entries for ${board.name}.`);
      }

      return { board, entries: ((data ?? []) as LeaderboardEntryRow[]) ?? [] };
    })
  );

  const challengeIds = challenges.map((challenge) => challenge.id);
  const [{ data: joinedData, error: joinedError }, challengeBoards] = await Promise.all([
    challengeIds.length > 0
      ? client
          .from("challenge_participants")
          .select("id,challenge_id,user_id,score,completed,joined_at,updated_at")
          .eq("user_id", viewerUserId)
          .in("challenge_id", challengeIds)
      : Promise.resolve({ data: [] as ParticipantRow[] | null, error: null }),
    Promise.all(
      challenges.map(async (challenge) => {
        const { data, error } = await client
          .from("challenge_participants")
          .select("id,challenge_id,user_id,score,completed,joined_at,updated_at")
          .eq("challenge_id", challenge.id)
          .order("score", { ascending: false })
          .order("updated_at", { ascending: true })
          .limit(10);

        if (error) {
          throw new Error(error.message || `Unable to load scoreboard for ${challenge.title}.`);
        }

        return { challengeId: challenge.id, entries: ((data ?? []) as ParticipantRow[]) ?? [] };
      })
    )
  ]);

  if (joinedError) {
    throw new Error(joinedError.message || "Unable to load joined challenges.");
  }

  const allUserIds = new Set<string>();
  for (const board of boardEntriesResponse) {
    for (const entry of board.entries) allUserIds.add(entry.user_id);
  }
  for (const board of challengeBoards) {
    for (const entry of board.entries) allUserIds.add(entry.user_id);
  }

  const profilesResponse =
    allUserIds.size > 0
      ? await client
          .from("profiles")
          .select("id,username,display_name,avatar_url,rank_tier,level")
          .in("id", Array.from(allUserIds))
      : { data: [] as ProfileRow[] | null, error: null };

  if (profilesResponse.error) {
    throw new Error(profilesResponse.error.message || "Unable to load ranked profiles.");
  }

  const profileMap = new Map<string, ProfileRow>(
    ((((profilesResponse.data ?? []) as ProfileRow[]) ?? []).map((profile) => [profile.id, profile]))
  );
  const joinedMap = new Map<string, ParticipantRow>(
    ((((joinedData ?? []) as ParticipantRow[]) ?? []).map((row) => [row.challenge_id, row]))
  );
  const challengeBoardMap = new Map<string, ParticipantRow[]>(
    challengeBoards.map((board) => [board.challengeId, board.entries])
  );

  return {
    viewerUserId,
    homeGymId,
    weeklyBoards: boardEntriesResponse.map(({ board, entries }) => ({
      id: board.id,
      name: board.name,
      scope: board.scope,
      metric: board.metric,
      timeframe: board.timeframe,
      startsAt: board.starts_at,
      endsAt: board.ends_at,
      entries: entries.map((entry) => ({
        id: entry.id,
        rank: entry.rank,
        score: Number(entry.score),
        calculatedAt: entry.calculated_at,
        actor: toActor(profileMap.get(entry.user_id)),
        isViewer: entry.user_id === viewerUserId
      }))
    })),
    activeChallenges: challenges.map((challenge) => {
      const joined = joinedMap.get(challenge.id);
      const leaderboard = (challengeBoardMap.get(challenge.id) ?? []).map((entry, index) => ({
        id: entry.id,
        rank: index + 1,
        score: Number(entry.score),
        calculatedAt: entry.updated_at,
        actor: toActor(profileMap.get(entry.user_id)),
        isViewer: entry.user_id === viewerUserId
      }));

      return {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        challengeType: challenge.challenge_type,
        gymId: challenge.gym_id,
        startsAt: challenge.starts_at,
        endsAt: challenge.ends_at,
        pointsPerUnit: challenge.points_per_unit,
        joined: Boolean(joined),
        viewerScore: joined ? Number(joined.score) : null,
        completed: joined?.completed ?? false,
        leaderboard
      };
    })
  };
}

export async function joinChallenge(client: SupabaseClient, challengeId: string): Promise<void> {
  const { error } = await client.rpc("join_challenge", {
    p_challenge_id: challengeId
  });

  if (error) {
    throw new Error(error.message || "Unable to join challenge.");
  }
}

export async function leaveChallenge(client: SupabaseClient, challengeId: string): Promise<void> {
  const { error } = await client.rpc("leave_challenge", {
    p_challenge_id: challengeId
  });

  if (error) {
    throw new Error(error.message || "Unable to leave challenge.");
  }
}
