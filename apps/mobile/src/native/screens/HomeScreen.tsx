import React, { useMemo } from "react";

import { useNativeSession } from "../session";
import { Banner, Button, Card, Heading, Pill, ScreenScroll, SectionTitle, StatGrid } from "../ui";

function accessSummary(platformRole: string | null, gymCount: number): string {
  if (platformRole === "founder") return "Founder";
  if (platformRole === "ops_admin") return "Ops admin";
  if (platformRole === "support_admin") return "Support admin";
  if (platformRole === "compliance_admin") return "Compliance admin";
  if (platformRole === "analyst") return "Analyst";
  if (platformRole === "read_only") return "Read only";
  if (gymCount > 0) return "Member";
  return "Guest";
}

function toneForMembership(status: "trial" | "active" | "paused" | "canceled"): "default" | "danger" | "success" {
  if (status === "active" || status === "trial") return "success";
  if (status === "paused" || status === "canceled") return "danger";
  return "default";
}

export function HomeScreen(): React.JSX.Element {
  const { state, refresh } = useNativeSession();
  const profile = state.profile;
  const memberships = profile?.memberships ?? [];
  const activeMemberships = memberships.filter(
    (membership) => membership.membershipStatus === "active" || membership.membershipStatus === "trial"
  );
  const greeting = profile?.displayName?.trim() || state.access.user?.email?.trim() || "Athlete";

  const stats = useMemo(
    () => [
      { label: "Joined gyms", value: String(memberships.length) },
      { label: "Active access", value: String(activeMemberships.length) },
      { label: "Launch role", value: accessSummary(state.access.platformRole, memberships.length) },
      { label: "Staff gyms", value: String(state.access.staffGymIds.length) }
    ],
    [activeMemberships.length, memberships.length, state.access.platformRole, state.access.staffGymIds.length]
  );

  return (
    <ScreenScroll>
      <Heading
        eyebrow="Home"
        title={`Welcome back, ${greeting}`}
        subtitle="Today-first command center for the App Store launch wave."
      />

      {activeMemberships.length === 0 ? (
        <Banner
          message="You are not connected to a gym yet. Join BZone or Wellness to unlock bookings and weekly planning."
          tone="danger"
        />
      ) : null}

      <StatGrid items={stats} />

      <Card>
        <SectionTitle>Launch loop</SectionTitle>
        <Pill tone="primary">App Store</Pill>
        <Pill tone="success">BZone</Pill>
        <Pill tone="success">Wellness</Pill>
        <Heading
          title="What users need to complete"
          subtitle="The native app should cover the daily member loop without pushing people into admin tooling."
        />
        <Banner
          message="Open the weekly plan, book or check in at the gym, log the workout, then post proof when the session is done."
          tone="success"
        />
        <Button tone="secondary" onPress={() => void refresh()}>
          Refresh state
        </Button>
      </Card>

      <Card>
        <SectionTitle>Today</SectionTitle>
        <Heading
          title="Training and gym actions"
          subtitle="Use this screen as the command center for what matters right now."
        />
        <Banner
          message="1. Check your week. 2. Confirm your gym context. 3. Record the session. 4. Share proof."
        />
      </Card>

      <Card>
        <SectionTitle>Connected gyms</SectionTitle>
        {memberships.length === 0 ? (
          <Heading
            title="No gyms linked yet"
            subtitle="The first live launch should support BZone Fitness and Wellness Fitness in Pavia."
          />
        ) : (
          memberships.map((membership) => (
            <Card key={`${membership.gymId}-${membership.role}`}>
              <Heading
                title={membership.gymName ?? membership.gymId}
                subtitle="Gym access connected to your account."
              />
              <Pill tone="primary">{membership.role}</Pill>
              <Pill tone={toneForMembership(membership.membershipStatus)}>{membership.membershipStatus}</Pill>
            </Card>
          ))
        )}
      </Card>

      {state.access.platformRole ? (
        <Card>
          <SectionTitle>Operator context</SectionTitle>
          <Heading
            title="Gym launch mode"
            subtitle="This account can validate the launch wave from inside the native app without exposing unfinished admin flows."
          />
        </Card>
      ) : null}
    </ScreenScroll>
  );
}
