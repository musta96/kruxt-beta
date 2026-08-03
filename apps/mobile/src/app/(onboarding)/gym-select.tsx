import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { darkTheme, Button, Input } from "@kruxt/ui";
import type { Gym as GymRecord } from "@kruxt/types";
import { useSupabase } from "../../contexts/supabase-context";
import { useAuth } from "../../contexts/auth-context";
import { GymService, ProfileService } from "../../services";
import { homeGymIdForEligibleMembership } from "../../services/onboarding-semantics";

const theme = darkTheme;
const PAGE_SIZE = 20;

interface GymListItem {
  id: string;
  name: string;
  location: string;
}

interface PendingRequest {
  gymName: string;
}

function toListItem(gym: GymRecord): GymListItem {
  const location = [gym.city, gym.countryCode].filter(Boolean).join(", ");
  return {
    id: gym.id,
    name: gym.name,
    location: location || gym.motto || gym.description || "Location not provided",
  };
}

export default function GymSelectScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { user, loading: authLoading } = useAuth();
  const searchGeneration = useRef(0);

  const [search, setSearch] = useState("");
  const [gyms, setGyms] = useState<GymListItem[]>([]);
  const [selectedGym, setSelectedGym] = useState<GymListItem | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingGyms, setLoadingGyms] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);

  useEffect(() => {
    const generation = searchGeneration.current + 1;
    searchGeneration.current = generation;
    setGyms([]);
    setSelectedGym(null);
    setPage(0);
    setHasMore(false);
    setLoadError(null);
    setLoadMoreError(null);
    setLoadingGyms(true);

    if (authLoading) return;
    if (!user) {
      setLoadingGyms(false);
      setLoadError("You need to be signed in to find or skip a gym.");
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await new GymService(supabase).searchVisibleGyms({
            query: search,
            page: 0,
            pageSize: PAGE_SIZE,
          });
          if (searchGeneration.current !== generation) return;
          setGyms(result.gyms.map(toListItem));
          setHasMore(result.hasMore);
        } catch (loadFailure: unknown) {
          if (searchGeneration.current !== generation) return;
          setLoadError(
            loadFailure instanceof Error ? loadFailure.message : "Unable to load gyms.",
          );
        } finally {
          if (searchGeneration.current === generation) {
            setLoadingGyms(false);
          }
        }
      })();
    }, search.trim() ? 300 : 0);

    return () => clearTimeout(timer);
  }, [authLoading, retryKey, search, supabase, user]);

  const loadNextPage = useCallback(async () => {
    if (!user || loadingGyms || loadingMore || !hasMore || loadError) return;

    const generation = searchGeneration.current;
    const nextPage = page + 1;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await new GymService(supabase).searchVisibleGyms({
        query: search,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      if (searchGeneration.current !== generation) return;
      setGyms((current) => {
        const existingIds = new Set(current.map((gym) => gym.id));
        return [
          ...current,
          ...result.gyms.map(toListItem).filter((gym) => !existingIds.has(gym.id)),
        ];
      });
      setPage(nextPage);
      setHasMore(result.hasMore);
    } catch (loadFailure: unknown) {
      if (searchGeneration.current === generation) {
        setLoadMoreError(
          loadFailure instanceof Error ? loadFailure.message : "Unable to load more gyms.",
        );
      }
    } finally {
      if (searchGeneration.current === generation) {
        setLoadingMore(false);
      }
    }
  }, [hasMore, loadError, loadingGyms, loadingMore, page, search, supabase, user]);

  const handleJoin = useCallback(async () => {
    if (saving || !selectedGym || loadingGyms || loadError) return;
    if (!user) {
      setError("You need to be signed in to join a gym.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const membership = await new GymService(supabase).joinGym(user.id, {
        gymId: selectedGym.id,
      });

      const eligibleHomeGymId = homeGymIdForEligibleMembership(membership);
      if (eligibleHomeGymId) {
        await new ProfileService(supabase).setHomeGym(user.id, eligibleHomeGymId);
        router.push("/(onboarding)/review");
        return;
      }

      if (membership.membershipStatus === "pending") {
        setPendingRequest({ gymName: selectedGym.name });
        return;
      }

      setError(
        `Your membership is ${membership.membershipStatus}. This gym cannot be set as your home gym yet.`,
      );
    } catch (joinFailure: unknown) {
      setError(
        joinFailure instanceof Error
          ? joinFailure.message
          : "Unable to submit your gym request. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }, [loadError, loadingGyms, router, saving, selectedGym, supabase, user]);

  const handleSkip = useCallback(() => {
    if (authLoading || saving) return;
    if (!user) {
      setError("You need to be signed in to continue without a gym.");
      return;
    }
    router.push("/(onboarding)/review");
  }, [authLoading, router, saving, user]);

  const renderGym = useCallback(
    ({ item }: { item: GymListItem }) => {
      const isSelected = selectedGym?.id === item.id;
      return (
        <Pressable
          onPress={() => {
            setSelectedGym(item);
            setError(null);
          }}
          disabled={saving || Boolean(pendingRequest)}
          style={[styles.gymCard, isSelected && styles.gymCardSelected]}
          accessibilityLabel={`Select ${item.name}`}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected, disabled: saving || Boolean(pendingRequest) }}
        >
          <View style={styles.gymIcon}>
            <Text style={styles.gymIconText}>G</Text>
          </View>
          <View style={styles.gymInfo}>
            <Text style={[styles.gymName, isSelected && styles.gymNameSelected]}>
              {item.name}
            </Text>
            <Text style={styles.gymLocation}>{item.location}</Text>
          </View>
          {isSelected ? <Text style={styles.checkmark}>{"\u2713"}</Text> : null}
        </Pressable>
      );
    },
    [pendingRequest, saving, selectedGym],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading} accessibilityRole="header">
          Find Your Gym
        </Text>
        <Text style={styles.subtitle}>
          Search by gym name. Membership requests may require gym approval.
        </Text>

        {(error || pendingRequest) && (
          <View
            style={[styles.statusBanner, pendingRequest ? styles.successBanner : styles.errorBanner]}
            accessibilityRole="alert"
          >
            <Text style={pendingRequest ? styles.successText : styles.errorText}>
              {pendingRequest
                ? `Request submitted to ${pendingRequest.gymName}. It is pending gym approval and has not been set as your home gym.`
                : error}
            </Text>
          </View>
        )}

        <Input
          theme={theme}
          placeholder="Search gyms..."
          value={search}
          onChangeText={setSearch}
          editable={!pendingRequest && !saving}
          autoCapitalize="none"
          accessibilityLabel="Search gyms by name"
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={gyms}
        keyExtractor={(item) => item.id}
        renderItem={renderGym}
        contentContainerStyle={styles.list}
        onEndReached={() => void loadNextPage()}
        onEndReachedThreshold={0.35}
        ListEmptyComponent={
          loadingGyms || authLoading ? (
            <View style={styles.emptyContainer} accessibilityLabel="Loading gyms">
              <ActivityIndicator color="#35D0FF" />
            </View>
          ) : loadError ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{loadError}</Text>
              {user ? (
                <Pressable
                  onPress={() => setRetryKey((current) => current + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading gyms"
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {search.trim()
                  ? "No gyms match that name."
                  : "No gyms are currently available to join."}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color="#35D0FF" style={styles.listFooter} />
          ) : loadMoreError ? (
            <Pressable
              onPress={() => void loadNextPage()}
              style={styles.listFooter}
              accessibilityRole="button"
              accessibilityLabel="Retry loading more gyms"
            >
              <Text style={styles.retryText}>{loadMoreError} Retry</Text>
            </Pressable>
          ) : null
        }
      />

      <View style={styles.footer}>
        {pendingRequest ? (
          <Button
            theme={theme}
            variant="primary"
            size="lg"
            label="Continue to Review"
            onPress={handleSkip}
            disabled={!user || authLoading || saving}
            accessibilityLabel="Continue after submitting gym request"
            style={styles.continueButton}
          />
        ) : (
          <>
            <Button
              theme={theme}
              variant="primary"
              size="lg"
              label="Continue with Selected Gym"
              onPress={handleJoin}
              loading={saving}
              disabled={
                !user ||
                authLoading ||
                loadingGyms ||
                Boolean(loadError) ||
                !selectedGym ||
                saving
              }
              accessibilityLabel="Submit selected gym and continue"
              style={styles.continueButton}
            />
            <Button
              theme={theme}
              variant="ghost"
              size="md"
              label="Skip Gym for Now"
              onPress={handleSkip}
              disabled={!user || authLoading || saving}
              accessibilityLabel="Continue onboarding without a gym"
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E1116",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  heading: {
    fontFamily: "Oswald",
    fontSize: 28,
    fontWeight: "700",
    color: "#F4F6F8",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Sora",
    fontSize: 15,
    color: "#A7B1C2",
    marginBottom: 16,
    lineHeight: 22,
  },
  statusBanner: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  errorBanner: {
    backgroundColor: "rgba(255, 107, 107, 0.12)",
    borderColor: "rgba(255, 107, 107, 0.4)",
  },
  successBanner: {
    backgroundColor: "rgba(75, 213, 156, 0.1)",
    borderColor: "rgba(75, 213, 156, 0.4)",
  },
  errorText: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#FF6B6B",
    lineHeight: 18,
  },
  successText: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#4BD59C",
    lineHeight: 18,
  },
  searchInput: {
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    flexGrow: 1,
  },
  gymCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#171C24",
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(141, 153, 174, 0.15)",
  },
  gymCardSelected: {
    borderColor: "#35D0FF",
    backgroundColor: "rgba(53, 208, 255, 0.08)",
  },
  gymIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "rgba(141, 153, 174, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  gymIconText: {
    fontFamily: "Oswald",
    fontSize: 18,
    color: "#A7B1C2",
  },
  gymInfo: {
    flex: 1,
  },
  gymName: {
    fontFamily: "Sora",
    fontSize: 15,
    fontWeight: "600",
    color: "#F4F6F8",
    marginBottom: 2,
  },
  gymNameSelected: {
    color: "#35D0FF",
  },
  gymLocation: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#A7B1C2",
  },
  checkmark: {
    fontSize: 18,
    color: "#35D0FF",
    fontWeight: "700",
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 180,
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#A7B1C2",
    textAlign: "center",
    lineHeight: 20,
  },
  retryText: {
    fontFamily: "Sora",
    fontSize: 13,
    fontWeight: "600",
    color: "#35D0FF",
    marginTop: 10,
    textAlign: "center",
  },
  listFooter: {
    marginVertical: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 8,
    gap: 8,
    alignItems: "center",
  },
  continueButton: {
    width: "100%",
  },
});
