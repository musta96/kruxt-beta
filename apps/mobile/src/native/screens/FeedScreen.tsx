import { useCallback, useEffect, useState } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, Heading, InlineButton, Pill, ScreenScroll, SectionTitle } from "../ui";
import { palette, spacing } from "../theme";
import { useNativeSession } from "../session";

type FeedEventRow = {
  id: string;
  user_id: string;
  workout_id: string | null;
  event_type: string;
  caption: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
};

type WorkoutRow = {
  id: string;
  title: string;
  workout_type: string;
  started_at: string;
};

interface FeedCardItem {
  id: string;
  actorLabel: string;
  caption: string | null;
  workoutTitle: string | null;
  workoutType: string | null;
  createdAt: string;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function FeedScreen() {
  const { supabase, state, webAppUrl } = useNativeSession();
  const [items, setItems] = useState<FeedCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      setError(null);
      const { data: eventsData, error: eventsError } = await supabase
        .from("feed_events")
        .select("id,user_id,workout_id,event_type,caption,created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (eventsError) {
        throw new Error(eventsError.message || "Unable to load feed.");
      }

      const events = (eventsData as FeedEventRow[] | null) ?? [];
      const actorIds = Array.from(new Set(events.map((item) => item.user_id)));
      const workoutIds = Array.from(
        new Set(events.map((item) => item.workout_id).filter((value): value is string => Boolean(value)))
      );

      const [{ data: profilesData }, { data: workoutsData }] = await Promise.all([
        actorIds.length > 0
          ? supabase.from("profiles").select("id,display_name,username").in("id", actorIds)
          : Promise.resolve({ data: [] as ProfileRow[] | null }),
        workoutIds.length > 0
          ? supabase.from("workouts").select("id,title,workout_type,started_at").in("id", workoutIds)
          : Promise.resolve({ data: [] as WorkoutRow[] | null })
      ]);

      const profileMap = new Map<string, ProfileRow>(
        (((profilesData ?? []) as ProfileRow[]) ?? []).map((profile) => [profile.id, profile])
      );
      const workoutMap = new Map<string, WorkoutRow>(
        (((workoutsData ?? []) as WorkoutRow[]) ?? []).map((workout) => [workout.id, workout])
      );

      setItems(
        events.map((event) => {
          const actor = profileMap.get(event.user_id);
          const workout = event.workout_id ? workoutMap.get(event.workout_id) : null;
          return {
            id: event.id,
            actorLabel: actor?.display_name || actor?.username || "KRUXT Athlete",
            caption: event.caption,
            workoutTitle: workout?.title ?? null,
            workoutType: workout?.workout_type ?? null,
            createdAt: workout?.started_at ?? event.created_at
          };
        })
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load feed.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const hasWebWorkspace = state.access.platformRole === "founder" || state.access.staffGymIds.length > 0;
  const workspaceLabel = state.access.platformRole === "founder" ? "Open founder workspace" : "Open org workspace";
  const workspacePath = state.access.platformRole === "founder" ? "/admin" : "/org";

  if (loading) {
    return (
      <ScreenScroll>
        <Heading eyebrow="Feed" title="Loading your proof feed" subtitle="Pulling latest workout events and role context." />
      </ScreenScroll>
    );
  }

  return (
    <ScrollView
      style={styles.shell}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
        setRefreshing(true);
        void loadFeed();
      }} tintColor={palette.primary} />}
    >
      <Heading
        eyebrow="Proof Feed"
        title="Your training record"
        subtitle="Recent workouts, proof events, and visibility into what the gym is logging."
      />

      {hasWebWorkspace ? (
        <Card>
          <View style={styles.workspaceHeader}>
            <Pill tone="primary">{state.access.platformRole === "founder" ? "Founder" : "Gym staff"}</Pill>
            <InlineButton onPress={() => void Linking.openURL(`${webAppUrl}${workspacePath}`)}>
              {workspaceLabel}
            </InlineButton>
          </View>
          <Text style={styles.note}>
            Founder and organization operations remain on web. Mobile keeps the member-facing flow focused.
          </Text>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <Text style={styles.error}>{error}</Text>
        </Card>
      ) : null}

      <SectionTitle>Latest proof</SectionTitle>
      {items.length === 0 ? (
        <Card>
          <Text style={styles.note}>No feed activity yet. Once workouts are logged, they will land here.</Text>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <View style={styles.feedMeta}>
              <Text style={styles.actor}>{item.actorLabel}</Text>
              <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
            </View>
            {item.workoutTitle ? <Text style={styles.workoutTitle}>{item.workoutTitle}</Text> : null}
            {item.workoutType ? <Pill>{item.workoutType}</Pill> : null}
            {item.caption ? <Text style={styles.note}>{item.caption}</Text> : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: palette.background
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md
  },
  workspaceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  feedMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  actor: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700"
  },
  timestamp: {
    color: palette.textMuted,
    fontSize: 12
  },
  workoutTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "700"
  },
  note: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  error: {
    color: palette.danger,
    fontSize: 14,
    lineHeight: 20
  }
});
