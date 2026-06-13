import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useNativeSession } from "../session";
import { palette, spacing } from "../theme";
import { Banner, Button, Field, Heading, Pill, ScreenScroll, StatGrid, SwitchRow } from "../ui";

type OnboardingGateScreenProps = { onComplete: () => void | Promise<void> };

function normalizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function deriveDefaultDisplayName(email?: string | null): string {
  const source = email?.split("@")[0]?.trim() || "KRUXT Member";
  const cleaned = source.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "KRUXT Member";
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveDefaultUsername(displayName: string, email?: string | null): string {
  const fromDisplayName = normalizeUsername(displayName);
  if (fromDisplayName.length >= 3) return fromDisplayName;
  return normalizeUsername(email?.split("@")[0] || "kruxt_member");
}

export function OnboardingGateScreen({ onComplete }: OnboardingGateScreenProps) {
  const { state, saveProfile, refresh } = useNativeSession();
  const user = state.access.user;
  const profile = state.profile;

  const fallbackDisplayName = useMemo(
    () => profile?.displayName?.trim() || deriveDefaultDisplayName(user?.email),
    [profile?.displayName, user?.email]
  );

  const [displayName, setDisplayName] = useState(fallbackDisplayName);
  const [username, setUsername] = useState(
    profile?.username || deriveDefaultUsername(fallbackDisplayName, user?.email)
  );
  const [bio, setBio] = useState(profile?.bio || "");
  const [isPublic, setIsPublic] = useState(profile?.isPublic ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberships = profile?.memberships ?? [];
  const roleSummary = memberships.length
    ? Array.from(new Set(memberships.map((membership) => membership.role.replace(/_/g, " ")))).slice(0, 3).join(", ")
    : "No gym roles yet";

  async function handleContinue() {
    const trimmedDisplayName = displayName.trim();
    const normalizedUsername = normalizeUsername(username);

    if (!trimmedDisplayName) {
      setError("Display name is required.");
      return;
    }

    if (normalizedUsername.length < 3) {
      setError("Username must have at least 3 valid characters.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await saveProfile({
        displayName: trimmedDisplayName,
        username: normalizedUsername,
        bio: bio.trim(),
        isPublic
      });
      await refresh();
      await onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to finish setup right now.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll>
      <Heading
        eyebrow="KRUXT Setup"
        title="Finish your member setup"
        subtitle="Set your profile before entering Home, Plan, Record, Groups, and You."
      />

      <View style={styles.pills}>
        <Pill tone="primary">Home</Pill>
        <Pill>Plan</Pill>
        <Pill>Record</Pill>
        <Pill>Groups</Pill>
        <Pill>You</Pill>
      </View>

      {error ? <Banner tone="danger" message={error} /> : null}
      {!memberships.length ? (
        <Banner message="You can continue without a gym, but booking and gym-linked access will unlock after you join one." />
      ) : null}

      <StatGrid
        items={[
          { label: "Memberships", value: String(memberships.length) },
          { label: "Visibility", value: isPublic ? "Public" : "Private" },
          { label: "Roles", value: roleSummary || "Member" }
        ]}
      />

      <Field
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="How your name appears in KRUXT"
        autoCapitalize="words"
      />

      <Field
        label="Username"
        value={username}
        onChangeText={(value) => setUsername(normalizeUsername(value))}
        placeholder="your_handle"
        autoCapitalize="none"
      />
      <Text style={styles.helper}>Letters, numbers, and underscores only.</Text>

      <Field
        label="Bio"
        value={bio}
        onChangeText={setBio}
        placeholder="What should other KRUXT members know about you?"
        multiline
      />

      <SwitchRow
        label="Public profile"
        value={isPublic}
        onValueChange={setIsPublic}
        description="Let other KRUXT members discover your profile and proof."
      />

      <Button onPress={handleContinue} disabled={saving} loading={saving}>
        {saving ? "Saving..." : "Continue to KRUXT"}
      </Button>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  helper: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md
  }
});
