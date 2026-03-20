import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Avatar,
  Badge,
  Card,
  CardSkeleton,
  EmptyState,
  ErrorState,
} from "@kruxt/ui";
import { darkTheme } from "@kruxt/ui/theme";
import type {
  ProofFeedRenderItem,
  ProofFeedSnapshot,
} from "../flows/phase4-proof-feed-ui";
import { createPhase4ProofFeedUiFlow } from "../flows/phase4-proof-feed-ui";

const theme = darkTheme;
const REACTIONS = [
  { type: "fist" as const, emoji: "\u{1F44A}" },
  { type: "fire" as const, emoji: "\u{1F525}" },
  { type: "shield" as const, emoji: "\u{1F6E1}\uFE0F" },
  { type: "clap" as const, emoji: "\u{1F44F}" },
  { type: "crown" as const, emoji: "\u{1F451}" },
];

export function ProofFeedScreen() {
  const flowRef = useRef(createPhase4ProofFeedUiFlow());
  const [snapshot, setSnapshot] = useState<ProofFeedSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [expandedThread, setExpandedThread] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await flowRef.current.load();
    if (result.ok) {
      setSnapshot(result.snapshot);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, []);

  const refreshFeed = useCallback(async () => {
    setRefreshing(true);
    const result = await flowRef.current.refresh();
    if (result.ok) {
      setSnapshot(result.snapshot);
    }
    setRefreshing(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!snapshot || !snapshot.pagination.hasMore || loadingMore) return;
    setLoadingMore(true);
    const result = await flowRef.current.loadMore(snapshot);
    if (result.ok) {
      setSnapshot(result.snapshot);
    }
    setLoadingMore(false);
  }, [snapshot, loadingMore]);

  const handleReaction = useCallback(
    async (workoutId: string, reactionType: (typeof REACTIONS)[number]["type"]) => {
      const result = await flowRef.current.reactToWorkout(workoutId, reactionType);
      if (result.ok) {
        setSnapshot(result.snapshot);
      }
    },
    [],
  );

  const handleComment = useCallback(
    async (workoutId: string) => {
      const text = commentDrafts[workoutId]?.trim();
      if (!text) return;
      const result = await flowRef.current.commentOnWorkout(workoutId, text);
      if (result.ok) {
        setSnapshot(result.snapshot);
        setCommentDrafts((prev) => ({ ...prev, [workoutId]: "" }));
      }
    },
    [commentDrafts],
  );

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const renderProofCard = useCallback(
    ({ item }: { item: ProofFeedRenderItem }) => {
      if (item.kind === "placeholder") {
        return (
          <Card theme={theme} style={styles.card}>
            <View style={styles.placeholderRow}>
              <Text style={styles.placeholderIcon}>{"\u{1F6AB}"}</Text>
              <Text style={styles.placeholderText}>{item.message}</Text>
            </View>
          </Card>
        );
      }

      const { actor, workout, reactionCounts, commentCount } = item.item;
      const totalReactions = Object.values(reactionCounts ?? {}).reduce(
        (sum: number, v: number) => sum + v,
        0,
      );

      return (
        <Card theme={theme} style={styles.card}>
          {/* Header: avatar + name + time */}
          <View style={styles.cardHeader}>
            <Avatar
              theme={theme}
              name={actor.displayName ?? "Athlete"}
              uri={actor.avatarUrl}
              size="md"
            />
            <View style={styles.cardHeaderText}>
              <Text style={styles.actorName} numberOfLines={1}>
                {actor.displayName ?? "Athlete"}
              </Text>
              <Text style={styles.timestamp}>
                {formatTimeAgo(workout.createdAt)}
              </Text>
            </View>
            {workout.visibility === "guild_only" && (
              <Badge theme={theme} label="Guild" variant="info" />
            )}
          </View>

          {/* Workout summary */}
          <View style={styles.workoutBody}>
            <Text style={styles.workoutTitle}>{workout.title}</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{workout.totalSets}</Text>
                <Text style={styles.statLabel}>sets</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {formatVolume(workout.totalVolumeKg)}
                </Text>
                <Text style={styles.statLabel}>kg</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {workout.durationMinutes ?? "--"}
                </Text>
                <Text style={styles.statLabel}>min</Text>
              </View>
              {workout.rpe && (
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{workout.rpe}</Text>
                  <Text style={styles.statLabel}>RPE</Text>
                </View>
              )}
            </View>
            {workout.notes ? (
              <Text style={styles.notes} numberOfLines={2}>
                {workout.notes}
              </Text>
            ) : null}
          </View>

          {/* Reaction bar */}
          <View style={styles.reactionBar}>
            {REACTIONS.map((r) => (
              <Pressable
                key={r.type}
                style={styles.reactionButton}
                onPress={() => handleReaction(workout.id, r.type)}
                accessibilityLabel={`React with ${r.type}`}
              >
                <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                {(reactionCounts?.[r.type] ?? 0) > 0 && (
                  <Text style={styles.reactionCount}>
                    {reactionCounts[r.type]}
                  </Text>
                )}
              </Pressable>
            ))}
            <Pressable
              style={styles.commentToggle}
              onPress={() =>
                setExpandedThread((prev) =>
                  prev === workout.id ? null : workout.id,
                )
              }
              accessibilityLabel="Toggle comments"
            >
              <Text style={styles.commentIcon}>{"\u{1F4AC}"}</Text>
              {commentCount > 0 && (
                <Text style={styles.reactionCount}>{commentCount}</Text>
              )}
            </Pressable>
          </View>

          {/* Comment input (expanded) */}
          {expandedThread === workout.id && (
            <View style={styles.commentSection}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add comment..."
                placeholderTextColor={theme.colors.textSecondary}
                value={commentDrafts[workout.id] ?? ""}
                onChangeText={(t) =>
                  setCommentDrafts((prev) => ({ ...prev, [workout.id]: t }))
                }
                onSubmitEditing={() => handleComment(workout.id)}
                returnKeyType="send"
              />
            </View>
          )}
        </Card>
      );
    },
    [handleReaction, handleComment, commentDrafts, expandedThread],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PROOF FEED</Text>
        </View>
        <View style={styles.skeletonList}>
          {Array.from({ length: 4 }).map((_, i) => (
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
          <Text style={styles.headerTitle}>PROOF FEED</Text>
        </View>
        <ErrorState
          theme={theme}
          title="Feed unavailable"
          message={error}
          onRetry={loadFeed}
        />
      </SafeAreaView>
    );
  }

  if (!snapshot || snapshot.renderItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PROOF FEED</Text>
        </View>
        <EmptyState
          theme={theme}
          title="No proof yet"
          message="Log your first workout and post the proof."
          actionLabel="Log Workout"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROOF FEED</Text>
        <Text style={styles.headerSubtitle}>
          {snapshot.microcopy.protectChain}
        </Text>
      </View>
      <FlatList
        data={snapshot.renderItems}
        renderItem={renderProofCard}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshFeed}
            tintColor={theme.colors.accentPrimary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              color={theme.colors.accentPrimary}
              style={styles.loadingMore}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function formatVolume(kg: number | null | undefined): string {
  if (!kg) return "0";
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
  return String(Math.round(kg));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E1116",
  },
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
  headerSubtitle: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#A7B1C2",
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 10,
  },
  actorName: {
    fontFamily: "Sora",
    fontSize: 15,
    fontWeight: "600",
    color: "#F4F6F8",
  },
  timestamp: {
    fontFamily: "Sora",
    fontSize: 12,
    color: "#A7B1C2",
    marginTop: 1,
  },
  workoutBody: {
    marginTop: 12,
  },
  workoutTitle: {
    fontFamily: "Oswald",
    fontSize: 20,
    fontWeight: "600",
    color: "#F4F6F8",
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 20,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    fontFamily: "Roboto Mono",
    fontSize: 22,
    fontWeight: "700",
    color: "#35D0FF",
  },
  statLabel: {
    fontFamily: "Sora",
    fontSize: 11,
    color: "#A7B1C2",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  notes: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#A7B1C2",
    marginTop: 8,
    fontStyle: "italic",
  },
  reactionBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(141,153,174,0.1)",
    gap: 4,
  },
  reactionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(141,153,174,0.08)",
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontFamily: "Roboto Mono",
    fontSize: 12,
    color: "#A7B1C2",
    marginLeft: 4,
  },
  commentToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(141,153,174,0.08)",
    marginLeft: "auto",
  },
  commentIcon: {
    fontSize: 16,
  },
  commentSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(141,153,174,0.06)",
  },
  commentInput: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#F4F6F8",
    backgroundColor: "rgba(141,153,174,0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  placeholderRow: {
    flexDirection: "row",
    alignItems: "center",
    opacity: 0.5,
  },
  placeholderIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  placeholderText: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#A7B1C2",
    flex: 1,
  },
  skeletonList: {
    padding: 16,
    gap: 16,
  },
  skeletonCard: {
    height: 200,
  },
  loadingMore: {
    paddingVertical: 20,
  },
});
