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
import { darkTheme, Button, Input } from "@kruxt/ui";
import { useSupabase } from "../../contexts/supabase-context";
import { useAuth } from "../../contexts/auth-context";
import { ProfileService } from "../../services";

const theme = darkTheme;

export default function ProfileSetupScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { user, loading: authLoading } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setLoadingProfile(false);
      setLoadError("You need to be signed in to set up your profile.");
      return;
    }

    setLoadingProfile(true);
    setLoadError(null);
    try {
      const profile = await new ProfileService(supabase).getProfileById(user.id);
      if (profile) {
        setDisplayName(profile.displayName);
      }
    } catch (loadFailure: unknown) {
      setLoadError(
        loadFailure instanceof Error ? loadFailure.message : "Unable to load your profile.",
      );
    } finally {
      setLoadingProfile(false);
    }
  }, [authLoading, supabase, user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const canContinue =
    Boolean(user) &&
    !authLoading &&
    !loadingProfile &&
    !loadError &&
    !saving &&
    displayName.trim().length >= 2;

  const handleContinue = useCallback(async () => {
    if (!canContinue || !user) return;

    setSaving(true);
    setError(null);
    try {
      await new ProfileService(supabase).ensureProfile(user.id, user.email ?? "", {
        displayName: displayName.trim(),
      });
      router.push("/(onboarding)/consents");
    } catch (saveFailure: unknown) {
      setError(
        saveFailure instanceof Error
          ? saveFailure.message
          : "Unable to save your profile. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }, [canContinue, displayName, router, supabase, user]);

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
          Choose the name other athletes will see across KRUXT.
        </Text>

        {(error || loadError) && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{error ?? loadError}</Text>
            {loadError && user && !authLoading ? (
              <Pressable
                onPress={() => void loadProfile()}
                accessibilityLabel="Retry loading profile"
                accessibilityRole="button"
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {loadingProfile || authLoading ? (
          <View style={styles.loadingContainer} accessibilityLabel="Loading profile">
            <ActivityIndicator color="#35D0FF" />
          </View>
        ) : (
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
        )}

        <Button
          theme={theme}
          variant="primary"
          size="lg"
          label="Save & Continue"
          onPress={handleContinue}
          loading={saving}
          disabled={!canContinue}
          accessibilityLabel="Save profile and continue"
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
    marginBottom: 24,
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: "rgba(255, 107, 107, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.4)",
    padding: 12,
    marginBottom: 16,
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
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    marginBottom: 24,
  },
  continueButton: {
    width: "100%",
  },
});
