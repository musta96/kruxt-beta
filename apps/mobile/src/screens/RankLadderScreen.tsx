import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Avatar,
  Badge,
  Card,
  CardSkeleton,
  Chip,
  EmptyState,
  ErrorState,
  StatCard,
} from "@kruxt/ui";
import { darkTheme } from "@kruxt/ui/theme";

const theme = darkTheme;

type TimeframeKey = "weekly" | "monthly" | "all_time";
type ScopeKey = "global" | "gym" | "exercise";

const TIMEFRAMES: { key: TimeframeKey; label: string }[] = [
  { key: "weekly", label: "This Week" },
  { key: "monthly", label: "This Month" },
  { key: "all_time", label: "All Time" },
];

const SCOPES: { key: ScopeKey; label: string }[] = [
  { key: "global", label: "Global" },
  { key: "gym", label: "My Gym" },
  { key: "exercise", label: "Exercise" },
];

interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  metric: string;
  isCurrentUser: boolean;
}

interface RankSnapshot {
  myRank: number | null;
  myTier: string;
  myChainDays: number;
  myXpTotal: number;
  entries: LeaderboardEntry[];
}

export function RankLadderScreen() {
  const [snapshot, setSnapshot] = useState<RankSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeKey>("weekly");
  const [scope, setScope] = useState<ScopeKey>("global");

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Will wire to rank-trials flow
      setLoading(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load rankings");
      setLoading(false);
    }
  }, [timeframe, scope]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  }, [loadLeaderboard]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>RANK LADDER</Text>
          <Text style={styles.headerSubtitle}>Rank is earned weekly.</Text>
        </View>
        <View style={styles.skeletonList}>
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} theme={theme} style={styles.skeletonRow} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>RANK LADDER</Text>
        </View>
        <ErrorState
          theme={theme}
          title="Rankings unavailable"
          message={error}
          onRetry={loadLeaderboard}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={snapshot?.entries ?? []}
        keyExtractor={(item) => item.userId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accentPrimary}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>RANK LADDER</Text>
              <Text style={styles.headerSubtitle}>Rank is earned weekly.</Text>
            </View>

            {/* My rank summary */}
            <View style={styles.myRankSection}>
              <View style={styles.myRankCircle}>
                <Text style={styles.myRankNumber}>
                  {snapshot?.myRank ?? "--"}
                </Text>
                <Text style={styles.myRankLabel}>YOUR RANK</Text>
              </View>
              <View style={styles.myRankStats}>
                <StatCard
                  theme={theme}
                  label="Chain"
                  value={String(snapshot?.myChainDays ?? 0)}
                  unit="days"
                  style={styles.miniStat}
                  variant="compact"
                />
                <StatCard
                  theme={theme}
                  label="XP"
                  value={formatXP(snapshot?.myXpTotal ?? 0)}
                  style={styles.miniStat}
                  variant="compact"
                />
              </View>
            </View>

            {/* Tier badge */}
            {snapshot?.myTier && (
              <View style={styles.tierRow}>
                <Badge
                  theme={theme}
                  label={snapshot.myTier}
                  variant="accent"
                />
              </View>
            )}

            {/* Scope filter */}
            <View style={styles.filterSection}>
              <View style={styles.chipRow}>
                {SCOPES.map((s) => (
                  <Chip
                    key={s.key}
                    theme={theme}
                    label={s.label}
                    selected={scope === s.key}
                    onPress={() => setScope(s.key)}
                  />
                ))}
              </View>
              <View style={[styles.chipRow, { marginTop: 8 }]}>
                {TIMEFRAMES.map((tf) => (
                  <Chip
                    key={tf.key}
                    theme={theme}
                    label={tf.label}
                    selected={timeframe === tf.key}
                    onPress={() => setTimeframe(tf.key)}
                  />
                ))}
              </View>
            </View>

            {/* Top 3 podium */}
            <View style={styles.podium}>
              {(snapshot?.entries ?? []).slice(0, 3).map((entry, i) => (
                <PodiumCard key={entry.userId} entry={entry} position={i} />
              ))}
            </View>

            <Text style={styles.leaderboardTitle}>FULL RANKINGS</Text>
          </>
        }
        renderItem={({ item }) => <RankRow entry={item} />}
        ListEmptyComponent={
          <EmptyState
            theme={theme}
            title="No rankings yet"
            message="Start logging workouts to appear on the leaderboard."
          />
        }
      />
    </SafeAreaView>
  );
}

function PodiumCard({
  entry,
  position,
}: {
  entry: LeaderboardEntry;
  position: number;
}) {
  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
  const heights = [120, 100, 90];

  return (
    <View style={[styles.podiumCard, { height: heights[position] }]}>
      <Text style={styles.podiumMedal}>{medals[position]}</Text>
      <Avatar
        theme={darkTheme}
        name={entry.displayName}
        uri={entry.avatarUrl}
        size="sm"
      />
      <Text style={styles.podiumName} numberOfLines={1}>
        {entry.displayName}
      </Text>
      <Text style={styles.podiumScore}>
        {formatScore(entry.score, entry.metric)}
      </Text>
    </View>
  );
}

function RankRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <View
      style={[
        styles.rankRow,
        entry.isCurrentUser && styles.rankRowHighlighted,
      ]}
    >
      <View style={styles.rankPosition}>
        <Text
          style={[
            styles.rankNumber,
            entry.rank <= 3 && styles.rankNumberTop,
          ]}
        >
          {entry.rank}
        </Text>
      </View>
      <Avatar
        theme={darkTheme}
        name={entry.displayName}
        uri={entry.avatarUrl}
        size="sm"
      />
      <View style={styles.rankInfo}>
        <Text style={styles.rankName} numberOfLines={1}>
          {entry.displayName}
          {entry.isCurrentUser ? " (You)" : ""}
        </Text>
      </View>
      <Text style={styles.rankScore}>
        {formatScore(entry.score, entry.metric)}
      </Text>
    </View>
  );
}

function formatScore(score: number, metric: string): string {
  if (score >= 10000) return `${(score / 1000).toFixed(1)}k`;
  return String(Math.round(score));
}

function formatXP(xp: number): string {
  if (xp >= 10000) return `${(xp / 1000).toFixed(1)}k`;
  return String(xp);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E1116" },
  header: {
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: "Oswald",
    fontSize: 28,
    fontWeight: "700",
    color: "#F4F6F8",
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#A7B1C2",
    marginTop: 2,
  },
  listContent: { padding: 16, paddingBottom: 100 },
  // My rank
  myRankSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 16,
  },
  myRankCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "#35D0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  myRankNumber: {
    fontFamily: "Roboto Mono",
    fontSize: 32,
    fontWeight: "700",
    color: "#35D0FF",
  },
  myRankLabel: {
    fontFamily: "Sora",
    fontSize: 8,
    color: "#A7B1C2",
    letterSpacing: 1,
    marginTop: -2,
  },
  myRankStats: { flex: 1, gap: 8 },
  miniStat: {},
  tierRow: { marginBottom: 20, alignItems: "flex-start" },
  // Filters
  filterSection: { marginBottom: 20 },
  chipRow: { flexDirection: "row", gap: 8 },
  // Podium
  podium: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 24,
  },
  podiumCard: {
    flex: 1,
    backgroundColor: "#171C24",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(53,208,255,0.15)",
  },
  podiumMedal: { fontSize: 24, marginBottom: 4 },
  podiumName: {
    fontFamily: "Sora",
    fontSize: 11,
    color: "#F4F6F8",
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  podiumScore: {
    fontFamily: "Roboto Mono",
    fontSize: 14,
    fontWeight: "700",
    color: "#35D0FF",
    marginTop: 2,
  },
  // Full rankings
  leaderboardTitle: {
    fontFamily: "Oswald",
    fontSize: 16,
    fontWeight: "600",
    color: "#A7B1C2",
    letterSpacing: 2,
    marginBottom: 12,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(141,153,174,0.06)",
  },
  rankRowHighlighted: {
    backgroundColor: "rgba(53,208,255,0.06)",
    borderRadius: 10,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  rankPosition: { width: 36, alignItems: "center" },
  rankNumber: {
    fontFamily: "Roboto Mono",
    fontSize: 16,
    fontWeight: "700",
    color: "#A7B1C2",
  },
  rankNumberTop: { color: "#FFC85A" },
  rankInfo: { flex: 1, marginLeft: 10 },
  rankName: { fontFamily: "Sora", fontSize: 14, fontWeight: "600", color: "#F4F6F8" },
  rankScore: {
    fontFamily: "Roboto Mono",
    fontSize: 16,
    fontWeight: "700",
    color: "#35D0FF",
  },
  skeletonList: { padding: 16, gap: 12 },
  skeletonRow: { height: 60 },
});
