import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Button, CardSkeleton, ErrorState, Input } from "@kruxt/ui";
import { darkTheme } from "@kruxt/ui/theme";
import type { Profile } from "@kruxt/types";
import { createMobileSupabaseClient, ProfileService } from "../services";

const theme = darkTheme;

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function EditProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const supabase = createMobileSupabaseClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error("You need to be signed in to edit your profile.");
      }
      const me = await new ProfileService(supabase).getProfileById(authData.user.id);
      if (!me) {
        throw new Error("Profile not found.");
      }
      setProfile(me);
      setDisplayName(me.displayName);
      setUsername(me.username);
      setBio(me.bio ?? "");
      setIsPublic(me.isPublic);
      setUnitSystem(me.preferredUnits);
      setLoading(false);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Failed to load profile");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trimmedName = displayName.trim();
  const trimmedHandle = username.trim();
  const canSave =
    !saving &&
    trimmedName.length >= 2 &&
    trimmedHandle.length >= 3 &&
    USERNAME_PATTERN.test(trimmedHandle);

  const handleSave = useCallback(async () => {
    if (!profile || !canSave) return;
    setSaving(true);
    setFormError(null);
    setUsernameError(null);
    try {
      const supabase = createMobileSupabaseClient();
      const profiles = new ProfileService(supabase);

      // Preserve avatar + locale — upsertProfile would null any field we omit.
      await profiles.upsertProfile(profile.id, {
        username: trimmedHandle,
        displayName: trimmedName,
        bio: bio.trim() || undefined,
        avatarUrl: profile.avatarUrl ?? undefined,
        locale: profile.locale ?? undefined,
        preferredUnits: unitSystem,
      });

      // is_public isn't part of UpsertProfileInput; persist it separately.
      if (isPublic !== profile.isPublic) {
        await profiles.setVisibility(profile.id, isPublic);
      }

      router.back();
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "PROFILE_USERNAME_COLLISION" || code === "PROFILE_UPSERT_FAILED") {
        setUsernameError("That username is taken. Try another.");
      } else {
        setFormError(e instanceof Error ? e.message : "Unable to save changes.");
      }
      setSaving(false);
    }
  }, [profile, canSave, trimmedHandle, trimmedName, bio, unitSystem, isPublic, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.back()} />
        <View style={styles.skeletonList}>
          <CardSkeleton theme={theme} style={{ height: 70 }} />
          <CardSkeleton theme={theme} style={{ height: 70 }} />
          <CardSkeleton theme={theme} style={{ height: 120 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.back()} />
        <ErrorState
          theme={theme}
          title="Couldn't load profile"
          message={loadError}
          onRetry={load}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            theme={theme}
            label="Display Name"
            placeholder="What should we call you?"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            maxLength={50}
            style={styles.field}
          />

          <Input
            theme={theme}
            label="Username"
            placeholder="username"
            value={username}
            onChangeText={(t) => {
              setUsername(t);
              if (usernameError) setUsernameError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            error={usernameError ?? undefined}
            helperText="Letters, numbers, and underscores. Min 3 characters."
            style={styles.field}
          />

          <Input
            theme={theme}
            label="Bio"
            placeholder="Tell the guild who you are."
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
            maxLength={160}
            style={styles.field}
            inputStyle={styles.bioInput}
          />

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Public Profile</Text>
              <Text style={styles.rowHint}>
                When off, only you can see your proof and stats.
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: "#3e3e3e", true: "#35D0FF" }}
              thumbColor="#F4F6F8"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Unit System</Text>
            <View style={styles.unitToggle}>
              {(["metric", "imperial"] as const).map((u) => (
                <Pressable
                  key={u}
                  style={[styles.unitOption, unitSystem === u && styles.unitOptionActive]}
                  onPress={() => setUnitSystem(u)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: unitSystem === u }}
                >
                  <Text
                    style={[styles.unitText, unitSystem === u && styles.unitTextActive]}
                  >
                    {u === "metric" ? "kg" : "lbs"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {formError && <Text style={styles.formError}>{formError}</Text>}

          <Button
            theme={theme}
            variant="primary"
            size="lg"
            label="Save Changes"
            onPress={handleSave}
            loading={saving}
            disabled={!canSave}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.headerBack}>{"‹"}</Text>
      </Pressable>
      <Text style={styles.headerTitle}>EDIT PROFILE</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E1116" },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(141,153,174,0.1)",
  },
  headerBack: { fontSize: 30, color: "#35D0FF", width: 32, lineHeight: 32 },
  headerTitle: {
    flex: 1,
    fontFamily: "Oswald",
    fontSize: 20,
    fontWeight: "700",
    color: "#F4F6F8",
    letterSpacing: 2,
    textAlign: "center",
  },
  headerSpacer: { width: 32 },
  scroll: { padding: 20, paddingBottom: 48 },
  field: { marginBottom: 20 },
  bioInput: { minHeight: 72, textAlignVertical: "top" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(141,153,174,0.08)",
    gap: 16,
  },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: "Sora", fontSize: 15, color: "#F4F6F8", fontWeight: "600" },
  rowHint: { fontFamily: "Sora", fontSize: 12, color: "#A7B1C2", marginTop: 2 },
  unitToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(141,153,174,0.1)",
    borderRadius: 8,
    overflow: "hidden",
  },
  unitOption: { paddingHorizontal: 16, paddingVertical: 6 },
  unitOptionActive: { backgroundColor: "#35D0FF", borderRadius: 8 },
  unitText: { fontFamily: "Roboto Mono", fontSize: 13, fontWeight: "600", color: "#A7B1C2" },
  unitTextActive: { color: "#0E1116" },
  formError: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#FF6B6B",
    marginTop: 16,
    marginBottom: 4,
  },
  saveButton: { width: "100%", marginTop: 24 },
  skeletonList: { padding: 20, gap: 16 },
});
