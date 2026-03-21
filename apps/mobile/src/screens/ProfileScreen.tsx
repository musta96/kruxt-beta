import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardSkeleton,
  Divider,
  ErrorState,
  ListRow,
  StatCard,
} from "@kruxt/ui";
import { darkTheme } from "@kruxt/ui/theme";
import { useAuth } from "../contexts/auth-context";

const theme = darkTheme;

interface ProfileData {
  displayName: string;
  handle: string;
  avatarUrl?: string;
  bio?: string;
  tier: string;
  chainDays: number;
  totalWorkouts: number;
  totalVolumeKg: number;
  xpTotal: number;
  memberSince: string;
  gymName?: string;
}

type SettingsSection = "account" | "preferences" | "security" | "support";

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<SettingsSection | null>(null);

  // Preferences state
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric");
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [chainReminders, setChainReminders] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Will wire to ProfileService once available
      setLoading(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSignOut = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => signOut() },
    ]);
  }, [signOut]);

  const toggleSection = useCallback((section: SettingsSection) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PROFILE</Text>
        </View>
        <View style={styles.skeletonList}>
          <CardSkeleton theme={theme} style={{ height: 180 }} />
          <CardSkeleton theme={theme} style={{ height: 80 }} />
          <CardSkeleton theme={theme} style={{ height: 80 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PROFILE</Text>
        </View>
        <ErrorState
          theme={theme}
          title="Profile unavailable"
          message={error}
          onRetry={loadProfile}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PROFILE</Text>
        </View>

        {/* Profile card */}
        <Card theme={theme} style={styles.profileCard}>
          <View style={styles.profileTop}>
            <Avatar
              theme={theme}
              name={profile?.displayName ?? user?.email ?? "Athlete"}
              uri={profile?.avatarUrl}
              size="lg"
            />
            <View style={styles.profileInfo}>
              <Text style={styles.displayName}>
                {profile?.displayName ?? user?.user_metadata?.display_name ?? "Athlete"}
              </Text>
              <Text style={styles.handle}>
                @{profile?.handle ?? user?.email?.split("@")[0] ?? "user"}
              </Text>
              {profile?.tier && (
                <Badge theme={theme} label={profile.tier} variant="accent" />
              )}
            </View>
          </View>
          {profile?.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}
        </Card>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard
            theme={theme}
            label="Chain"
            value={String(profile?.chainDays ?? 0)}
            unit="days"
            style={styles.statItem}
            variant="compact"
          />
          <StatCard
            theme={theme}
            label="Workouts"
            value={String(profile?.totalWorkouts ?? 0)}
            style={styles.statItem}
            variant="compact"
          />
          <StatCard
            theme={theme}
            label="Volume"
            value={formatVolume(profile?.totalVolumeKg ?? 0)}
            unit="kg"
            style={styles.statItem}
            variant="compact"
          />
          <StatCard
            theme={theme}
            label="XP"
            value={formatXP(profile?.xpTotal ?? 0)}
            style={styles.statItem}
            variant="compact"
          />
        </View>

        {/* Guild info */}
        {profile?.gymName && (
          <Card theme={theme} style={styles.guildCard}>
            <View style={styles.guildRow}>
              <Text style={styles.guildLabel}>Guild</Text>
              <Text style={styles.guildValue}>{profile.gymName}</Text>
            </View>
            <View style={styles.guildRow}>
              <Text style={styles.guildLabel}>Member Since</Text>
              <Text style={styles.guildValue}>{profile.memberSince}</Text>
            </View>
          </Card>
        )}

        <Divider theme={theme} style={styles.divider} />

        {/* Settings sections */}
        <Text style={styles.sectionHeader}>SETTINGS</Text>

        {/* Account */}
        <SettingsGroup
          title="Account"
          icon={"\u{1F464}"}
          expanded={expandedSection === "account"}
          onToggle={() => toggleSection("account")}
        >
          <ListRow
            theme={theme}
            label="Email"
            value={user?.email ?? "—"}
          />
          <ListRow
            theme={theme}
            label="Edit Profile"
            chevron
            onPress={() => {/* TODO: navigate to edit profile */}}
          />
          <ListRow
            theme={theme}
            label="Connected Devices"
            chevron
            onPress={() => {/* TODO: navigate to integrations */}}
          />
        </SettingsGroup>

        {/* Preferences */}
        <SettingsGroup
          title="Preferences"
          icon={"\u2699\uFE0F"}
          expanded={expandedSection === "preferences"}
          onToggle={() => toggleSection("preferences")}
        >
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Unit System</Text>
            <View style={styles.unitToggle}>
              <Pressable
                style={[
                  styles.unitOption,
                  unitSystem === "metric" && styles.unitOptionActive,
                ]}
                onPress={() => setUnitSystem("metric")}
              >
                <Text
                  style={[
                    styles.unitText,
                    unitSystem === "metric" && styles.unitTextActive,
                  ]}
                >
                  kg
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.unitOption,
                  unitSystem === "imperial" && styles.unitOptionActive,
                ]}
                onPress={() => setUnitSystem("imperial")}
              >
                <Text
                  style={[
                    styles.unitText,
                    unitSystem === "imperial" && styles.unitTextActive,
                  ]}
                >
                  lbs
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Dark Mode</Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: "#3e3e3e", true: "#35D0FF" }}
              thumbColor="#F4F6F8"
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: "#3e3e3e", true: "#35D0FF" }}
              thumbColor="#F4F6F8"
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Chain Reminders</Text>
            <Switch
              value={chainReminders}
              onValueChange={setChainReminders}
              trackColor={{ false: "#3e3e3e", true: "#35D0FF" }}
              thumbColor="#F4F6F8"
            />
          </View>
        </SettingsGroup>

        {/* Security */}
        <SettingsGroup
          title="Security & Privacy"
          icon={"\u{1F512}"}
          expanded={expandedSection === "security"}
          onToggle={() => toggleSection("security")}
        >
          <ListRow
            theme={theme}
            label="Change Password"
            chevron
            onPress={() => {/* TODO */}}
          />
          <ListRow
            theme={theme}
            label="Two-Factor Authentication"
            value="Off"
            chevron
            onPress={() => {/* TODO */}}
          />
          <ListRow
            theme={theme}
            label="Privacy Settings"
            chevron
            onPress={() => {/* TODO */}}
          />
          <ListRow
            theme={theme}
            label="Download My Data"
            chevron
            onPress={() => {/* TODO */}}
          />
          <ListRow
            theme={theme}
            label="Delete Account"
            labelStyle={{ color: "#FF6B6B" }}
            chevron
            onPress={() =>
              Alert.alert(
                "Delete Account",
                "This action is permanent and cannot be undone. All your data will be deleted.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive" },
                ],
              )
            }
          />
        </SettingsGroup>

        {/* Support */}
        <SettingsGroup
          title="Support"
          icon={"\u{1F4AC}"}
          expanded={expandedSection === "support"}
          onToggle={() => toggleSection("support")}
        >
          <ListRow
            theme={theme}
            label="Help Center"
            chevron
            onPress={() => {/* TODO */}}
          />
          <ListRow
            theme={theme}
            label="Report a Bug"
            chevron
            onPress={() => {/* TODO */}}
          />
          <ListRow
            theme={theme}
            label="Contact Support"
            chevron
            onPress={() => {/* TODO */}}
          />
          <ListRow
            theme={theme}
            label="Terms of Service"
            chevron
            onPress={() => {/* TODO */}}
          />
          <ListRow
            theme={theme}
            label="Privacy Policy"
            chevron
            onPress={() => {/* TODO */}}
          />
        </SettingsGroup>

        {/* Sign Out */}
        <Button
          theme={theme}
          variant="danger"
          label="Sign Out"
          onPress={handleSignOut}
          style={styles.signOutBtn}
        />

        {/* App version */}
        <Text style={styles.version}>KRUXT v0.1.0 Beta</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Settings group component
// ---------------------------------------------------------------------------

function SettingsGroup({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.settingsGroup}>
      <Pressable
        style={styles.settingsGroupHeader}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title} settings`}
      >
        <Text style={styles.settingsGroupIcon}>{icon}</Text>
        <Text style={styles.settingsGroupTitle}>{title}</Text>
        <Text style={styles.chevron}>{expanded ? "\u25B2" : "\u25BC"}</Text>
      </Pressable>
      {expanded && (
        <View style={styles.settingsGroupContent}>{children}</View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatVolume(kg: number): string {
  if (kg >= 1000000) return `${(kg / 1000000).toFixed(1)}M`;
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
  return String(Math.round(kg));
}

function formatXP(xp: number): string {
  if (xp >= 10000) return `${(xp / 1000).toFixed(1)}k`;
  return String(xp);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E1116" },
  scrollContent: { paddingBottom: 120 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(141,153,174,0.1)",
  },
  headerTitle: {
    fontFamily: "Oswald",
    fontSize: 28,
    fontWeight: "700",
    color: "#F4F6F8",
    letterSpacing: 2,
  },
  // Profile card
  profileCard: { margin: 16, marginBottom: 0 },
  profileTop: { flexDirection: "row", alignItems: "center" },
  profileInfo: { flex: 1, marginLeft: 14, gap: 4 },
  displayName: {
    fontFamily: "Oswald",
    fontSize: 22,
    fontWeight: "700",
    color: "#F4F6F8",
    letterSpacing: 0.5,
  },
  handle: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#A7B1C2",
  },
  bio: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#A7B1C2",
    marginTop: 12,
    lineHeight: 18,
  },
  // Stats
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  statItem: { flex: 1, minWidth: "45%" },
  // Guild
  guildCard: { marginHorizontal: 16, marginTop: 12 },
  guildRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(141,153,174,0.06)",
  },
  guildLabel: { fontFamily: "Sora", fontSize: 13, color: "#A7B1C2" },
  guildValue: { fontFamily: "Sora", fontSize: 13, color: "#F4F6F8", fontWeight: "600" },
  // Divider
  divider: { marginVertical: 20, marginHorizontal: 16 },
  sectionHeader: {
    fontFamily: "Oswald",
    fontSize: 14,
    fontWeight: "600",
    color: "#A7B1C2",
    letterSpacing: 2,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  // Settings groups
  settingsGroup: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#171C24",
    borderRadius: 14,
    overflow: "hidden",
  },
  settingsGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsGroupIcon: { fontSize: 18, marginRight: 10 },
  settingsGroupTitle: {
    fontFamily: "Sora",
    fontSize: 15,
    fontWeight: "600",
    color: "#F4F6F8",
    flex: 1,
  },
  chevron: { fontSize: 10, color: "#A7B1C2" },
  settingsGroupContent: {
    borderTopWidth: 1,
    borderTopColor: "rgba(141,153,174,0.08)",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  // Setting rows
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(141,153,174,0.06)",
  },
  settingLabel: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#F4F6F8",
  },
  // Unit toggle
  unitToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(141,153,174,0.1)",
    borderRadius: 8,
    overflow: "hidden",
  },
  unitOption: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  unitOptionActive: {
    backgroundColor: "#35D0FF",
    borderRadius: 8,
  },
  unitText: {
    fontFamily: "Roboto Mono",
    fontSize: 13,
    fontWeight: "600",
    color: "#A7B1C2",
  },
  unitTextActive: { color: "#0E1116" },
  // Sign out
  signOutBtn: { marginHorizontal: 16, marginTop: 24 },
  // Version
  version: {
    fontFamily: "Sora",
    fontSize: 11,
    color: "#5A6376",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  // Skeleton
  skeletonList: { padding: 16, gap: 12 },
});
