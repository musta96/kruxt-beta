import React, { useState, useCallback } from "react";
import {
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

const theme = darkTheme;

export default function ReviewScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Mark onboarding as complete in user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { onboarded: true },
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      // Navigation will be handled by the root layout auth redirect
      router.replace("/(tabs)");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }, [user, supabase, router]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          Review & Confirm
        </Text>
        <Text style={styles.subtitle}>
          Everything look good? You can always update these in your profile
          settings later.
        </Text>

        {error && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Summary cards -- values would come from onboarding state in production */}
        <Card theme={theme} style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Profile</Text>
            <Text style={styles.cardValue}>
              {user?.email ?? "Your profile"}
            </Text>
          </View>
        </Card>

        <Card theme={theme} style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Fitness Level</Text>
            <Text style={styles.cardValue}>Set during profile step</Text>
          </View>
        </Card>

        <Card theme={theme} style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Consents</Text>
            <Text style={[styles.cardValue, styles.consentStatus]}>
              All required accepted
            </Text>
          </View>
        </Card>

        <Card theme={theme} style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Gym</Text>
            <Text style={styles.cardValue}>Selected during gym step</Text>
          </View>
        </Card>

        <View style={styles.actions}>
          <Button
            theme={theme}
            variant="primary"
            size="lg"
            label="Complete Setup"
            onPress={handleComplete}
            loading={loading}
            disabled={loading}
            accessibilityLabel="Complete onboarding setup"
            style={styles.completeButton}
          />
          <Button
            theme={theme}
            variant="ghost"
            size="md"
            label="Go Back & Edit"
            onPress={() => router.back()}
            disabled={loading}
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
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.3)",
  },
  errorText: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#FF6B6B",
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
