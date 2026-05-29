import { Linking, StyleSheet, Text, View } from "react-native";

import { Button, Card, Heading, Pill, ScreenScroll, SectionTitle, StatGrid } from "../ui";
import { palette, spacing } from "../theme";
import { useNativeSession } from "../session";

function workspaceUrl(baseUrl: string, path: "/admin" | "/org"): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function WorkModeScreen() {
  const { state, webAppUrl } = useNativeSession();
  const profile = state.profile;
  const staffMemberships =
    profile?.memberships.filter((membership) => state.access.staffGymIds.includes(membership.gymId)) ?? [];
  const hasPlatformAccess = Boolean(state.access.platformRole);
  const hasStaffAccess = staffMemberships.length > 0;

  return (
    <ScreenScroll>
      <Heading
        eyebrow="Work"
        title="Switch workspace"
        subtitle="Open the platform or gym backoffice from the same account you use as a member."
      />

      <Card>
        <SectionTitle>Available modes</SectionTitle>
        <View style={styles.pillWrap}>
          <Pill tone="default">Member app</Pill>
          {hasPlatformAccess ? <Pill tone="primary">Platform</Pill> : null}
          {hasStaffAccess ? <Pill tone="success">Gym staff</Pill> : null}
        </View>
        <Text style={styles.note}>
          Your mobile tabs stay member-first. Operational work opens in the web workspace where larger tables,
          approvals, and configuration screens are easier to manage.
        </Text>
      </Card>

      {hasPlatformAccess ? (
        <Card>
          <SectionTitle>Platform console</SectionTitle>
          <Text style={styles.note}>Manage KRUXT clients, support access, tenant checks, and platform operations.</Text>
          <Button onPress={() => void Linking.openURL(workspaceUrl(webAppUrl, "/admin"))}>Open platform console</Button>
        </Card>
      ) : null}

      {hasStaffAccess ? (
        <Card>
          <SectionTitle>Gym backoffice</SectionTitle>
          {staffMemberships.map((membership) => (
            <View key={membership.gymId} style={styles.gymRow}>
              <View style={styles.gymCopy}>
                <Text style={styles.gymName}>{membership.gymName ?? membership.gymId}</Text>
                <Text style={styles.note}>
                  {membership.role} / {membership.membershipStatus}
                </Text>
              </View>
              <Pill tone="success">staff</Pill>
            </View>
          ))}
          <Button tone="secondary" onPress={() => void Linking.openURL(workspaceUrl(webAppUrl, "/org"))}>
            Open gym workspace
          </Button>
        </Card>
      ) : null}

      {!hasPlatformAccess && !hasStaffAccess ? (
        <Card>
          <SectionTitle>Member mode</SectionTitle>
          <Text style={styles.note}>This account does not have platform or gym staff access yet.</Text>
        </Card>
      ) : null}

      <StatGrid
        items={[
          { label: "Platform", value: hasPlatformAccess ? state.access.platformRole ?? "active" : "none" },
          { label: "Staff gyms", value: String(staffMemberships.length) },
          { label: "Member gyms", value: String(profile?.memberships.length ?? 0) }
        ]}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
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
  gymRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border
  },
  gymCopy: {
    flex: 1,
    gap: 4
  },
  gymName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700"
  }
});
