import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
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
  EmptyState,
  ErrorState,
  StatCard,
} from "@kruxt/ui";
import { darkTheme } from "@kruxt/ui/theme";

const theme = darkTheme;

interface GymInfo {
  id: string;
  name: string;
  logoUrl?: string;
  memberCount: number;
  activeTodayCount: number;
}

interface RosterMember {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  rankTier: string;
  chainDays: number;
  lastWorkoutAt: string | null;
}

interface GuildSnapshot {
  gym: GymInfo;
  roster: RosterMember[];
  myMembership: {
    role: string;
    joinedAt: string;
  } | null;
}

export function GuildHallScreen() {
  const [snapshot, setSnapshot] = useState<GuildSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGuild = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Will wire to createGuildHallFlow().load() once context is available
      // For now show the UI shell
      setLoading(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load guild");
      setLoading(false);
    }
  }, []);

  const refreshGuild = useCallback(async () => {
    setRefreshing(true);
    await loadGuild();
    setRefreshing(false);
  }, [loadGuild]);

  useEffect(() => {
    loadGuild();
  }, [loadGuild]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>GUILD HALL</Text>
        </View>
        <View style={styles.skeletonList}>
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} theme={theme} style={styles.skeletonCard} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>GUILD HALL</Text>
        </View>
        <ErrorState
          theme={theme}
          title="Guild unavailable"
          message={error}
          onRetry={loadGuild}
        />
      </SafeAreaView>
    );
  }

  // Empty / no gym state
  if (!snapshot) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>GUILD HALL</Text>
        </View>
        <EmptyState
          theme={theme}
          title="No guild yet"
          message="Join a gym during onboarding to unlock your Guild Hall."
          actionLabel="Find a Gym"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={snapshot.roster}
        keyExtractor={(item) => item.userId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshGuild}
            tintColor={theme.colors.accentPrimary}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Guild header */}
            <View style={styles.guildHeader}>
              <View style={styles.guildLogoPlaceholder}>
                <Text style={styles.guildLogoText}>
                  {snapshot.gym.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.guildInfo}>
                <Text style={styles.guildName}>{snapshot.gym.name}</Text>
                <Text style={styles.guildMeta}>
                  {snapshot.gym.memberCount} members
                </Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <StatCard
                theme={theme}
                label="Members"
                value={String(snapshot.gym.memberCount)}
                style={styles.statCard}
              />
              <StatCard
                theme={theme}
                label="Active Today"
                value={String(snapshot.gym.activeTodayCount)}
                style={styles.statCard}
                trend="up"
                trendLabel="+3"
              />
            </View>

            {/* Roster header */}
            <Text style={styles.rosterTitle}>ROSTER</Text>
          </>
        }
        renderItem={({ item }) => (
          <RosterRow member={item} />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyRoster}>
            No guild members yet. Invite your training partners!
          </Text>
        }
      />
    </SafeAreaView>
  );
}

function RosterRow({ member }: { member: RosterMember }) {
  return (
    <View style={styles.rosterRow}>
      <Avatar
        theme={darkTheme}
        name={member.displayName}
        uri={member.avatarUrl}
        size="md"
      />
      <View style={styles.rosterInfo}>
        <Text style={styles.rosterName} numberOfLines={1}>
          {member.displayName}
        </Text>
        <View style={styles.rosterMeta}>
          <Badge
            theme={darkTheme}
            label={member.rankTier}
            variant="accent"
            size="sm"
          />
          <Text style={styles.chainBadge}>
            {"\u{1F525}"} {member.chainDays}d chain
          </Text>
        </View>
      </View>
      <View style={styles.rosterRight}>
        {member.role !== "member" && (
          <Badge theme={darkTheme} label={member.role} variant="info" size="sm" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E1116" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(141,153,174,0.1)",
  },
  headerTitle: {
    fontFamily: "Oswald",
    fontSize: 28,
    fontWeight: "700",
    color: "#F4F6F8",
    letterSpacing: 2,
  },
  listContent: { padding: 16, paddingBottom: 100 },
  guildHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  guildLogoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#35D0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  guildLogoText: {
    fontFamily: "Oswald",
    fontSize: 28,
    fontWeight: "700",
    color: "#0E1116",
  },
  guildInfo: { marginLeft: 14, flex: 1 },
  guildName: {
    fontFamily: "Oswald",
    fontSize: 24,
    fontWeight: "700",
    color: "#F4F6F8",
    letterSpacing: 1,
  },
  guildMeta: { fontFamily: "Sora", fontSize: 13, color: "#A7B1C2", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: { flex: 1 },
  rosterTitle: {
    fontFamily: "Oswald",
    fontSize: 16,
    fontWeight: "600",
    color: "#A7B1C2",
    letterSpacing: 2,
    marginBottom: 12,
  },
  rosterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(141,153,174,0.06)",
  },
  rosterInfo: { flex: 1, marginLeft: 12 },
  rosterName: {
    fontFamily: "Sora",
    fontSize: 15,
    fontWeight: "600",
    color: "#F4F6F8",
  },
  rosterMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  chainBadge: { fontFamily: "Sora", fontSize: 12, color: "#FFC85A" },
  rosterRight: { alignItems: "flex-end" },
  emptyRoster: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#A7B1C2",
    textAlign: "center",
    padding: 40,
  },
  skeletonList: { padding: 16, gap: 16 },
  skeletonCard: { height: 100 },
});
