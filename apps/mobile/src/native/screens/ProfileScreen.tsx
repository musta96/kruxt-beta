import { useEffect, useState } from "react";
import { Image, Linking, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { Banner, Button, Card, Field, Heading, InlineButton, Pill, ScreenScroll, SectionTitle, StatGrid, SwitchRow } from "../ui";
import { palette, spacing } from "../theme";
import { useNativeSession } from "../session";

export function ProfileScreen() {
  const { state, saveProfile, signOut, uploadAvatar, removeAvatar, webAppUrl } = useNativeSession();
  const profile = state.profile;

  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [isPublic, setIsPublic] = useState(profile?.isPublic ?? true);
  const [saving, setSaving] = useState(false);
  const [avatarPending, setAvatarPending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
    setUsername(profile?.username ?? "");
    setBio(profile?.bio ?? "");
    setIsPublic(profile?.isPublic ?? true);
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await saveProfile({ displayName, username, bio, isPublic });
      setSuccess("Profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarPick() {
    setAvatarPending(true);
    setError(null);
    setSuccess(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Photo library permission is required to upload an avatar.");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset?.uri) {
        throw new Error("No image was selected.");
      }

      await uploadAvatar({
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName
      });
      setSuccess("Avatar updated.");
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : "Unable to update avatar.");
    } finally {
      setAvatarPending(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarPending(true);
    setError(null);
    setSuccess(null);

    try {
      await removeAvatar();
      setSuccess("Avatar removed.");
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : "Unable to remove avatar.");
    } finally {
      setAvatarPending(false);
    }
  }

  async function handleSignOut() {
    setError(null);
    setSuccess(null);
    try {
      await signOut();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Unable to sign out.");
    }
  }

  return (
    <ScreenScroll>
      <Heading
        eyebrow="Profile"
        title={profile?.displayName ?? "Member profile"}
        subtitle={state.access.user?.email ?? "Signed-in account"}
      />

      {success ? <Banner message={success} tone="success" /> : null}
      {error ? <Banner message={error} tone="danger" /> : null}

      <Card>
        <View style={styles.headerRow}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarLabel}>
                {(profile?.displayName || profile?.username || "K").slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.headerCopy}>
            <Text style={styles.handle}>@{profile?.username ?? "member"}</Text>
            <Text style={styles.note}>Storage-backed avatar uploads are enabled on native now.</Text>
          </View>
        </View>
        <View style={styles.avatarActions}>
          <Button onPress={handleAvatarPick} loading={avatarPending}>Upload avatar</Button>
          {profile?.avatarPath ? (
            <Button tone="secondary" onPress={handleAvatarRemove} disabled={avatarPending}>Remove avatar</Button>
          ) : null}
        </View>
      </Card>

      <Card>
        <SectionTitle>Identity</SectionTitle>
        <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Display name" />
        <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="username" />
        <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Short athlete bio" multiline />
        <SwitchRow
          label="Public profile"
          description="Controls whether your member profile can appear publicly."
          value={isPublic}
          onValueChange={setIsPublic}
        />
        <Button onPress={handleSave} loading={saving}>Save profile</Button>
      </Card>

      <Card>
        <SectionTitle>Progress</SectionTitle>
        <Heading
          title="Launch-safe member progress"
          subtitle="Progress, streaks, and rank stay visible in the app even while heavier admin operations remain outside the first native release."
        />
        <StatGrid
          items={[
            { label: "Gyms", value: String(profile?.memberships.length ?? 0) },
            { label: "Profile", value: profile?.isPublic ? "Public" : "Private" }
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>Account</SectionTitle>
        <Heading
          title="Membership and access status"
          subtitle="Use KRUXT to stay on top of access and eligibility. Edge-case admin tasks can stay with reception during the first launch wave."
        />
        {profile?.memberships.length ? (
          profile.memberships.map((membership) => (
            <View key={`${membership.gymId}:${membership.role}`} style={styles.membershipRow}>
              <View style={styles.membershipCopy}>
                <Text style={styles.membershipGym}>{membership.gymName ?? membership.gymId}</Text>
                <Text style={styles.note}>
                  {membership.role} · {membership.membershipStatus}
                </Text>
              </View>
              <Pill tone={membership.membershipStatus === "active" ? "success" : "default"}>
                {membership.membershipStatus}
              </Pill>
            </View>
          ))
        ) : (
          <Text style={styles.note}>No gym memberships linked yet.</Text>
        )}
        <Card>
          <Heading
            title="Payments and certificates are managed manually for launch"
            subtitle="If something blocks your access, the app should show the status clearly while BZone and Wellness still handle the underlying admin steps directly."
          />
        </Card>
      </Card>

      <Card>
        <SectionTitle>Access</SectionTitle>
        <View style={styles.pillWrap}>
          {state.access.platformRole ? <Pill tone="primary">{state.access.platformRole}</Pill> : <Pill>member</Pill>}
          {state.access.staffGymIds.length > 0 ? <Pill tone="success">gym staff</Pill> : null}
        </View>
        {(state.access.platformRole || state.access.staffGymIds.length > 0) ? (
          <InlineButton onPress={() => void Linking.openURL(`${webAppUrl}${state.access.platformRole === "founder" ? "/admin" : "/org"}`)}>
            Open web workspace
          </InlineButton>
        ) : null}
      </Card>

      <Button tone="danger" onPress={handleSignOut}>Sign out</Button>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center"
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(65, 211, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(65, 211, 255, 0.32)"
  },
  avatarLabel: {
    color: palette.primary,
    fontSize: 26,
    fontWeight: "800"
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(65, 211, 255, 0.32)"
  },
  headerCopy: {
    flex: 1,
    gap: 4
  },
  avatarActions: {
    gap: spacing.sm
  },
  handle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: "700"
  },
  note: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  membershipRow: {
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  membershipCopy: {
    gap: 4,
    flex: 1
  },
  membershipGym: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700"
  }
});
