import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { darkTheme, Button, Card } from "@kruxt/ui";
import { useSupabase } from "../../contexts/supabase-context";
import { useAuth } from "../../contexts/auth-context";
import { GymService, PolicyService, ProfileService } from "../../services";

const theme = darkTheme;

interface ReviewSummary {
  displayName: string;
  consentStatus: string;
  gymStatus: string;
}

export default function ReviewScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { user, loading: authLoading } = useAuth();

  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setLoadingSummary(false);
      setLoadError("You need to be signed in to review onboarding.");
      return;
    }

    setLoadingSummary(true);
    setLoadError(null);
    setSummary(null);
    try {
      const profiles = new ProfileService(supabase);
      const policies = new PolicyService(supabase);
      const gyms = new GymService(supabase);
      const [profile, consentGaps, memberships] = await Promise.all([
        profiles.getProfileById(user.id),
        policies.listRequiredConsentGaps(user.id),
        gyms.listMyMemberships(user.id),
      ]);

      if (!profile || profile.displayName.trim().length < 2) {
        throw new Error("Your profile is incomplete. Go back and save a display name.");
      }
      if (consentGaps.length > 0) {
        throw new Error("Required policy consent is missing or out of date. Go back and review it.");
      }

      const pendingMembership = memberships.find(
        (membership) => membership.membershipStatus === "pending",
      );
      const gymId = profile.homeGymId ?? pendingMembership?.gymId;
      const gym = gymId ? await gyms.getGymById(gymId) : null;
      const gymStatus = profile.homeGymId
        ? gym?.name ?? "Home gym selected"
        : pendingMembership
          ? `${gym?.name ?? "Selected gym"} - request pending`
          : "Skipped for now";

      setSummary({
        displayName: profile.displayName,
        consentStatus: "All required current policies accepted",
        gymStatus,
      });
    } catch (loadFailure: unknown) {
      setLoadError(
        loadFailure instanceof Error
          ? loadFailure.message
          : "Unable to validate your onboarding details.",
      );
    } finally {
      setLoadingSummary(false);
    }
  }, [authLoading, supabase, user]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const handleComplete = useCallback(async () => {
    if (loading) return;
    if (!user) {
      setError("You need to be signed in to complete onboarding.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const profile = await new ProfileService(supabase).getProfileById(user.id);
      if (!profile || profile.displayName.trim().length < 2) {
        throw new Error("Your profile is incomplete. Go back and save a display name.");
      }

      await new PolicyService(supabase).assertRequiredConsents(user.id);

      const { error: updateError } = await supabase.auth.updateUser({
        data: { onboarded: true },
      });
      if (updateError) throw updateError;

      router.replace("/(tabs)");
    } catch (completeFailure: unknown) {
      setError(
        completeFailure instanceof Error
          ? completeFailure.message
          : "Unable to complete onboarding. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [loading, router, supabase, user]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          Review & Confirm
        </Text>
        <Text style={styles.subtitle}>
          Confirm the information saved to your account before finishing setup.
        </Text>

        {(error || loadError) && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{error ?? loadError}</Text>
            {loadError && user && !authLoading ? (
              <Pressable
                onPress={() => void loadSummary()}
                accessibilityLabel="Retry onboarding review"
                accessibilityRole="button"
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {loadingSummary || authLoading ? (
          <View style={styles.loadingContainer} accessibilityLabel="Loading onboarding review">
            <ActivityIndicator color="#35D0FF" />
          </View>
        ) : null}

        {summary ? (
          <>
            <Card theme={theme} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Profile</Text>
                <Text style={styles.cardValue}>{summary.displayName}</Text>
              </View>
            </Card>

            <Card theme={theme} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Consents</Text>
                <Text style={[styles.cardValue, styles.consentStatus]}>
                  {summary.consentStatus}
                </Text>
              </View>
            </Card>

            <Card theme={theme} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Gym</Text>
                <Text style={styles.cardValue}>{summary.gymStatus}</Text>
              </View>
            </Card>
          </>
        ) : null}

        <View style={styles.actions}>
          <Button
            theme={theme}
            variant="primary"
            size="lg"
            label="Complete Setup"
            onPress={handleComplete}
            loading={loading}
            disabled={!user || authLoading || loadingSummary || Boolean(loadError) || !summary || loading}
            accessibilityLabel="Validate and complete onboarding setup"
            style={styles.completeButton}
          />
          <Button
            theme={theme}
            variant="ghost"
            size="md"
            label="Go Back & Edit"
            onPress={() => router.back()}
            disabled={loading || authLoading}
            accessibilityLabel="Go back to edit"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E1116",
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
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
    marginBottom: 24,
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: "rgba(255, 107, 107, 0.12)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.4)",
  },
  errorText: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#FF6B6B",
    lineHeight: 18,
  },
  retryText: {
    fontFamily: "Sora",
    fontSize: 13,
    fontWeight: "600",
    color: "#35D0FF",
    marginTop: 10,
  },
  loadingContainer: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: {
    fontFamily: "Sora",
    fontSize: 14,
    fontWeight: "600",
    color: "#F4F6F8",
  },
  cardValue: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#A7B1C2",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
  },
  consentStatus: {
    color: "#4BD59C",
  },
  actions: {
    marginTop: 20,
    gap: 12,
    alignItems: "center",
  },
  completeButton: {
    width: "100%",
  },
});
