import React, {
  useCallback,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { ViewToken } from "react-native";
import { Avatar, EmptyState, ErrorState } from "@kruxt/ui";
import { darkTheme } from "@kruxt/ui/theme";
import { ProofVideoCard } from "./ProofVideoCard";
import type {
  ProofFeedRenderItem,
  ProofFeedSnapshot,
} from "../flows/phase4-proof-feed-ui";
import { createPhase4ProofFeedUiFlow } from "../flows/phase4-proof-feed-ui";

const theme = darkTheme;

const REACTIONS = [
  { type: "fire" as const, emoji: "\u{1F525}", label: "Fire" },
  { type: "fist" as const, emoji: "\u{1F44A}", label: "Respect" },
  { type: "shield" as const, emoji: "\u{1F6E1}️", label: "Shield" },
  { type: "clap" as const, emoji: "\u{1F44F}", label: "Clap" },
  { type: "crown" as const, emoji: "\u{1F451}", label: "Crown" },
];

type ReactionType = (typeof REACTIONS)[number]["type"];

const SCREEN_HEIGHT = Dimensions.get("window").height;

export function ProofFeedScreen() {
  const insets = useSafeAreaInsets();
  const flowRef = useRef(createPhase4ProofFeedUiFlow());
  const listRef = useRef<FlatList<ProofFeedRenderItem>>(null);

  const [snapshot, setSnapshot] = useState<ProofFeedSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Height of one full-bleed page. Measured from the list container so we
  // don't have to guess the bottom tab-bar height.
  const [pageHeight, setPageHeight] = useState(SCREEN_HEIGHT);

  // Which card is centered — only its video autoplays.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const onViewableItemsChangedRef = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.item) {
        setActiveKey((first.item as ProofFeedRenderItem).key);
      }
    },
  );
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 80 });

  // Comment sheet state
  const [commentSheetWorkoutId, setCommentSheetWorkoutId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  // Local optimistic reaction selection per workout (for instant rail feedback).
  const [pendingReaction, setPendingReaction] = useState<Record<string, ReactionType>>({});

  // Tracks whether the very first load has happened, so focus-refetch only
  // runs a silent refresh on *return* visits (e.g. after posting from Log).
  const hasLoadedRef = useRef(false);

  // Double-tap-to-react: per-card last-tap timestamps + a single burst overlay.
  const lastTapRef = useRef<Record<string, number>>({});
  const burstAnim = useRef(new Animated.Value(0)).current;
  const [burstId, setBurstId] = useState<string | null>(null);

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
    if (result.ok) setSnapshot(result.snapshot);
    setRefreshing(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!snapshot || !snapshot.pagination.hasMore || loadingMore) return;
    setLoadingMore(true);
    const result = await flowRef.current.loadMore(snapshot);
    if (result.ok) setSnapshot(result.snapshot);
    setLoadingMore(false);
  }, [snapshot, loadingMore]);

  const handleReaction = useCallback(
    async (workoutId: string, reactionType: ReactionType) => {
      setPendingReaction((prev) => ({ ...prev, [workoutId]: reactionType }));
      const result = await flowRef.current.reactToWorkout(workoutId, reactionType);
      if (result.ok) setSnapshot(result.snapshot);
    },
    [],
  );

  const triggerBurst = useCallback(
    (workoutId: string) => {
      setBurstId(workoutId);
      burstAnim.setValue(0);
      Animated.sequence([
        Animated.timing(burstAnim, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.timing(burstAnim, {
          toValue: 0,
          duration: 320,
          delay: 280,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => setBurstId(null));
      // Fire the 🔥 reaction (TikTok-style double-tap = fire).
      void handleReaction(workoutId, "fire");
    },
    [burstAnim, handleReaction],
  );

  const handleCardTap = useCallback(
    (workoutId: string) => {
      const now = Date.now();
      const last = lastTapRef.current[workoutId] ?? 0;
      if (now - last < 300) {
        lastTapRef.current[workoutId] = 0;
        triggerBurst(workoutId);
      } else {
        lastTapRef.current[workoutId] = now;
      }
    },
    [triggerBurst],
  );

  const openComments = useCallback((workoutId: string) => {
    setCommentDraft("");
    setCommentSheetWorkoutId(workoutId);
  }, []);

  const submitComment = useCallback(async () => {
    const workoutId = commentSheetWorkoutId;
    const text = commentDraft.trim();
    if (!workoutId || !text) return;
    setPostingComment(true);
    const result = await flowRef.current.commentOnWorkout(workoutId, text);
    if (result.ok) {
      setSnapshot(result.snapshot);
      setCommentDraft("");
      setCommentSheetWorkoutId(null);
    }
    setPostingComment(false);
  }, [commentSheetWorkoutId, commentDraft]);

  // Load on first focus; silently refresh on every return focus so a workout
  // just posted from the Log tab shows up without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        loadFeed();
      } else {
        refreshFeed();
      }
    }, [loadFeed, refreshFeed]),
  );

  const onListLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - pageHeight) > 1) setPageHeight(h);
  }, [pageHeight]);

  const getItemLayout = useCallback(
    (_data: ArrayLike<ProofFeedRenderItem> | null | undefined, index: number) => ({
      length: pageHeight,
      offset: pageHeight * index,
      index,
    }),
    [pageHeight],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ProofFeedRenderItem>) => {
      if (item.kind === "placeholder") {
        return (
          <View style={[styles.page, { height: pageHeight }]}>
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderIcon}>{"\u{1F6AB}"}</Text>
              <Text style={styles.placeholderText}>{item.message}</Text>
            </View>
          </View>
        );
      }

      const { actor, workout, engagement, createdAt } = item.item;
      const selected = pendingReaction[workout.id];
      const mediaUrl = workout.proofMediaThumbnailUrl ?? workout.proofMediaUrl;
      const hasMedia = Boolean(mediaUrl);
      const isVideo = workout.proofMediaType === "video";

      return (
        <View style={[styles.page, { height: pageHeight }]}>
          {isVideo && workout.proofMediaUrl ? (
            <>
              {/* Full-bleed video — autoplays only when this card is centered */}
              <ProofVideoCard
                uri={workout.proofMediaUrl}
                isActive={activeKey === item.key}
              />
              <View style={styles.mediaScrim} pointerEvents="none" />
            </>
          ) : hasMedia ? (
            <>
              {/* Full-bleed proof image */}
              <Image
                source={{ uri: mediaUrl as string }}
                style={styles.mediaBg}
                resizeMode="cover"
              />
              <View style={styles.mediaScrim} pointerEvents="none" />
            </>
          ) : (
            <>
              {/* Background accent glow (no media → stat-hero card) */}
              <View style={styles.glowTop} pointerEvents="none" />
              <View style={styles.glowBottom} pointerEvents="none" />
            </>
          )}

          {/* Double-tap zone — sits above the background, below the rail/meta
              (which render later in JSX and capture their own taps). */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => handleCardTap(workout.id)}
            accessibilityLabel="Double-tap to react with fire"
          />

          {/* Double-tap burst */}
          {burstId === workout.id && (
            <Animated.Text
              style={[
                styles.burst,
                {
                  opacity: burstAnim,
                  transform: [
                    {
                      scale: burstAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 1.7],
                      }),
                    },
                  ],
                },
              ]}
            >
              {"\u{1F525}"}
            </Animated.Text>
          )}

          {/* Top meta */}
          <View style={[styles.topMeta, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.brandMark}>PROOF</Text>
            {workout.visibility === "gym" && (
              <View style={styles.guildPill}>
                <Text style={styles.guildPillText}>GUILD</Text>
              </View>
            )}
          </View>

          {/* Center hero: the lift, big and proud */}
          <View style={styles.hero}>
            <Text style={styles.workoutTitle} numberOfLines={2}>
              {workout.title}
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{workout.totalSets}</Text>
                <Text style={styles.statLabel}>SETS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{formatVolume(workout.totalVolumeKg)}</Text>
                <Text style={styles.statLabel}>KG VOL</Text>
              </View>
              {typeof workout.isPr === "boolean" && workout.isPr && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, styles.prValue]}>PR</Text>
                    <Text style={styles.statLabel}>NEW</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Right reaction rail (TikTok-style vertical actions) */}
          <View style={[styles.rail, { bottom: insets.bottom + 120 }]}>
            {REACTIONS.map((r) => {
              const isSelected = selected === r.type;
              return (
                <Pressable
                  key={r.type}
                  onPress={() => handleReaction(workout.id, r.type)}
                  style={styles.railButton}
                  accessibilityLabel={`React with ${r.label}`}
                >
                  <View style={[styles.railIconWrap, isSelected && styles.railIconWrapActive]}>
                    <Text style={styles.railEmoji}>{r.emoji}</Text>
                  </View>
                </Pressable>
              );
            })}
            <View style={styles.railCountWrap}>
              <Text style={styles.railCount}>{engagement.reactionCount}</Text>
              <Text style={styles.railCountLabel}>hits</Text>
            </View>

            <Pressable
              onPress={() => openComments(workout.id)}
              style={styles.railButton}
              accessibilityLabel="Open comments"
            >
              <View style={styles.railIconWrap}>
                <Text style={styles.railEmoji}>{"\u{1F4AC}"}</Text>
              </View>
              <Text style={styles.railCount}>{engagement.commentCount}</Text>
            </Pressable>
          </View>

          {/* Bottom-left actor + caption */}
          <View style={[styles.bottomMeta, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.actorRow}>
              <Avatar
                theme={theme}
                name={actor.displayName ?? "Athlete"}
                uri={actor.avatarUrl}
                size="md"
              />
              <View style={styles.actorText}>
                <Text style={styles.actorName} numberOfLines={1}>
                  {actor.displayName ?? "Athlete"}
                </Text>
                <Text style={styles.timestamp}>{formatTimeAgo(createdAt)}</Text>
              </View>
            </View>
            <Text style={styles.chainLine}>{"⚡ Protect the chain."}</Text>
          </View>
        </View>
      );
    },
    [pageHeight, insets, pendingReaction, handleReaction, openComments, handleCardTap, burstId, burstAnim, activeKey],
  );

  // ---- States ----
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.centerFill, { paddingTop: insets.top }]}>
          <ActivityIndicator color={theme.colors.accentPrimary} size="large" />
          <Text style={styles.loadingText}>Loading the chain...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ErrorState
          theme={theme}
          title="Feed unavailable"
          message={error}
          onRetry={loadFeed}
        />
      </View>
    );
  }

  if (!snapshot || snapshot.renderItems.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <EmptyState
          theme={theme}
          title="No proof yet"
          message="Log your first workout and post the proof. No log, no legend."
          actionLabel="Log Workout"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={snapshot.renderItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        onLayout={onListLayout}
        getItemLayout={getItemLayout}
        pagingEnabled
        snapToInterval={pageHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshFeed}
            tintColor={theme.colors.accentPrimary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        onViewableItemsChanged={onViewableItemsChangedRef.current}
        viewabilityConfig={viewabilityConfigRef.current}
        windowSize={3}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        ListFooterComponent={
          loadingMore ? (
            <View style={[styles.footerLoader, { height: pageHeight }]}>
              <ActivityIndicator color={theme.colors.accentPrimary} />
            </View>
          ) : null
        }
      />

      {/* Comment sheet */}
      <Modal
        visible={commentSheetWorkoutId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentSheetWorkoutId(null)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setCommentSheetWorkoutId(null)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add to the thread</Text>
            <TextInput
              style={styles.sheetInput}
              placeholder="Drop your respect..."
              placeholderTextColor={theme.colors.textSecondary}
              value={commentDraft}
              onChangeText={setCommentDraft}
              multiline
              autoFocus
            />
            <Pressable
              onPress={submitComment}
              disabled={postingComment || commentDraft.trim().length === 0}
              style={[
                styles.sheetSubmit,
                (postingComment || commentDraft.trim().length === 0) && styles.sheetSubmitDisabled,
              ]}
            >
              <Text style={styles.sheetSubmitText}>
                {postingComment ? "Posting..." : "Post"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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

const ACCENT = "#35D0FF";
const BG = "#0E1116";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  loadingText: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#A7B1C2",
    letterSpacing: 0.4,
  },

  page: {
    width: "100%",
    backgroundColor: BG,
    justifyContent: "center",
    overflow: "hidden",
  },
  glowTop: {
    position: "absolute",
    top: -160,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: 360,
    backgroundColor: "rgba(53,208,255,0.10)",
  },
  glowBottom: {
    position: "absolute",
    bottom: -180,
    left: -140,
    width: 380,
    height: 380,
    borderRadius: 380,
    backgroundColor: "rgba(53,208,255,0.06)",
  },
  mediaBg: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  mediaScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(14,17,22,0.45)",
  },
  videoBadge: {
    position: "absolute",
    top: "46%",
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(14,17,22,0.5)",
    borderWidth: 1.5,
    borderColor: "rgba(244,246,248,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoBadgeText: {
    fontSize: 26,
    color: "#F4F6F8",
    marginLeft: 4,
  },
  burst: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    fontSize: 96,
    textAlign: "center",
    zIndex: 20,
    pointerEvents: "none",
  },

  topMeta: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandMark: {
    fontFamily: "Oswald",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 4,
    color: "rgba(244,246,248,0.55)",
  },
  guildPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(53,208,255,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  guildPillText: {
    fontFamily: "Sora",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: ACCENT,
  },

  hero: { paddingHorizontal: 28, alignItems: "flex-start" },
  workoutTitle: {
    fontFamily: "Oswald",
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "700",
    color: "#F4F6F8",
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 26,
    gap: 18,
  },
  stat: { alignItems: "flex-start" },
  statValue: {
    fontFamily: "Roboto Mono",
    fontSize: 36,
    fontWeight: "700",
    color: ACCENT,
  },
  prValue: { color: "#FFC85A" },
  statLabel: {
    fontFamily: "Sora",
    fontSize: 11,
    color: "#A7B1C2",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(141,153,174,0.2)",
    marginBottom: 4,
  },

  rail: {
    position: "absolute",
    right: 14,
    alignItems: "center",
    gap: 14,
  },
  railButton: { alignItems: "center", gap: 4 },
  railIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(141,153,174,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  railIconWrapActive: {
    backgroundColor: "rgba(53,208,255,0.18)",
    borderColor: ACCENT,
  },
  railEmoji: { fontSize: 24 },
  railCountWrap: { alignItems: "center", marginTop: -4 },
  railCount: {
    fontFamily: "Roboto Mono",
    fontSize: 13,
    fontWeight: "700",
    color: "#F4F6F8",
  },
  railCountLabel: {
    fontFamily: "Sora",
    fontSize: 9,
    color: "#A7B1C2",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  bottomMeta: {
    position: "absolute",
    left: 0,
    right: 80,
    bottom: 0,
    paddingHorizontal: 20,
  },
  actorRow: { flexDirection: "row", alignItems: "center" },
  actorText: { marginLeft: 12, flex: 1 },
  actorName: {
    fontFamily: "Sora",
    fontSize: 16,
    fontWeight: "700",
    color: "#F4F6F8",
  },
  timestamp: {
    fontFamily: "Sora",
    fontSize: 12,
    color: "#A7B1C2",
    marginTop: 1,
  },
  chainLine: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "rgba(53,208,255,0.85)",
    marginTop: 12,
    letterSpacing: 0.3,
  },

  placeholderCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  placeholderIcon: { fontSize: 32, opacity: 0.5 },
  placeholderText: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#A7B1C2",
    textAlign: "center",
  },

  footerLoader: { alignItems: "center", justifyContent: "center" },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheetWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: "#171C24",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "rgba(141,153,174,0.15)",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(141,153,174,0.4)",
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: "Oswald",
    fontSize: 18,
    fontWeight: "600",
    color: "#F4F6F8",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sheetInput: {
    fontFamily: "Sora",
    fontSize: 15,
    color: "#F4F6F8",
    backgroundColor: "rgba(141,153,174,0.08)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 72,
    textAlignVertical: "top",
  },
  sheetSubmit: {
    marginTop: 14,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  sheetSubmitDisabled: { opacity: 0.4 },
  sheetSubmitText: {
    fontFamily: "Sora",
    fontSize: 15,
    fontWeight: "700",
    color: "#0E1116",
  },
});
