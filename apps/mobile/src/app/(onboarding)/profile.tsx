import React, { useState, useCallback } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { darkTheme, Button, Input, Chip } from "@kruxt/ui";

const theme = darkTheme;

const FITNESS_LEVELS = ["Beginner", "Intermediate", "Advanced", "Elite"] as const;
type FitnessLevel = (typeof FITNESS_LEVELS)[number];

export default function ProfileSetupScreen() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null);

  const canContinue = displayName.trim().length >= 2 && fitnessLevel !== null;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    // Store values in onboarding state (to be committed at review step)
    router.push("/(onboarding)/consents");
  }, [canContinue, router]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading} accessibilityRole="header">
          Set Up Your Profile
        </Text>
        <Text style={styles.subtitle}>
          Tell us a bit about yourself so we can personalize your experience.
        </Text>

        {/* Avatar placeholder */}
        <Pressable
          style={styles.avatarContainer}
          accessibilityLabel="Choose profile photo"
          accessibilityRole="button"
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarIcon}>{"\uD83D\uDCF7"}</Text>
          </View>
          <Text style={styles.avatarLabel}>Add Photo</Text>
        </Pressable>

        <Input
          theme={theme}
          label="Display Name"
          placeholder="What should we call you?"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          accessibilityLabel="Display name"
          style={styles.input}
        />

        <Text style={styles.sectionLabel}>Fitness Level</Text>
        <View style={styles.chipRow}>
          {FITNESS_LEVELS.map((level) => (
            <Chip
              key={level}
              theme={theme}
              label={level}
              selected={fitnessLevel === level}
              onPress={() => setFitnessLevel(level)}
              style={styles.chip}
            />
          ))}
        </View>

        <Button
          theme={theme}
          variant="primary"
          size="lg"
          label="Continue"
          onPress={handleContinue}
          disabled={!canContinue}
          accessibilityLabel="Continue to next step"
          style={styles.continueButton}
        />
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
    marginBottom: 32,
    lineHeight: 22,
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#1D2430",
    borderWidth: 2,
    borderColor: "rgba(53, 208, 255, 0.3)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarIcon: {
    fontSize: 32,
  },
  avatarLabel: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#35D0FF",
    fontWeight: "500",
  },
  input: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: "Sora",
    fontSize: 13,
    fontWeight: "500",
    color: "#A7B1C2",
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 32,
  },
  chip: {
    marginBottom: 4,
  },
  continueButton: {
    width: "100%",
  },
});
