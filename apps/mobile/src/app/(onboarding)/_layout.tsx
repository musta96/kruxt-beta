import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack, useSegments } from "expo-router";
import { ProgressBar, darkTheme } from "@kruxt/ui";

const theme = darkTheme;

const STEPS = ["profile", "consents", "gym-select", "review"] as const;

export default function OnboardingLayout() {
  const segments = useSegments();
  // The onboarding screen name is the last segment
  const currentScreen = segments[segments.length - 1] ?? "profile";
  const stepIndex = STEPS.indexOf(currentScreen as (typeof STEPS)[number]);
  const progress = stepIndex >= 0 ? (stepIndex + 1) / STEPS.length : 0.25;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepLabel}>
          Step {Math.max(stepIndex + 1, 1)} of {STEPS.length}
        </Text>
        <ProgressBar
          theme={theme}
          progress={progress}
          height={4}
          style={styles.progress}
        />
      </View>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0E1116" },
          animation: "slide_from_right",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E1116",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  stepLabel: {
    fontFamily: "Sora",
    fontSize: 12,
    color: "#A7B1C2",
    marginBottom: 8,
    fontWeight: "500",
  },
  progress: {
    marginBottom: 4,
  },
});
