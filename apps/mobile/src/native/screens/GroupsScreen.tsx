import React, { useMemo } from "react";

import { useNativeSession } from "../session";
import { Banner, Button, Card, Heading, Pill, ScreenScroll, SectionTitle } from "../ui";

function toneForMembership(status: "trial" | "active" | "paused" | "canceled"): "default" | "danger" | "success" {
  if (status === "active" || status === "trial") return "success";
  if (status === "paused" || status === "canceled") return "danger";
  return "default";
}

export function GroupsScreen(): React.JSX.Element {
  const { state, refresh } = useNativeSession();
  const memberships = state.profile?.memberships ?? [];
  const joinedGyms = useMemo(
    () =>
      memberships.map((membership) => ({
        key: `${membership.gymId}-${membership.role}`,
        name: membership.gymName ?? membership.gymId,
        role: membership.role,
        status: membership.membershipStatus
      })),
    [memberships]
  );

  return (
    <ScreenScroll>
      <Heading
        eyebrow="Groups"
        title="Your gyms and launch communities"
        subtitle="Schedules, gym context, and lightweight challenge surfaces for the first rollout."
      />

      <Card>
        <SectionTitle>Launch partners</SectionTitle>
        <Heading
          title="BZone Fitness + Wellness Fitness"
          subtitle="The first live App Store wave should feel complete for these gyms before we widen the rollout."
        />
        <Pill tone="success">Pavia</Pill>
        <Pill tone="primary">Launch gym wave</Pill>
        <Button tone="secondary" onPress={() => void refresh()}>
          Refresh gyms
        </Button>
      </Card>

      {joinedGyms.length === 0 ? (
        <Banner
          message="You do not have a gym linked yet. BZone and Wellness should be the first live communities for launch."
          tone="danger"
        />
      ) : null}

      <Card>
        <SectionTitle>Joined gyms</SectionTitle>
        {joinedGyms.length === 0 ? (
          <Heading
            title="No gyms linked"
            subtitle="Gym overview, booking access, and challenge participation should appear here once your launch gym is connected."
          />
        ) : (
          joinedGyms.map((gym) => (
            <Card key={gym.key}>
              <Heading
                title={gym.name}
                subtitle="Schedule, roster, and booking context should live under this surface."
              />
              <Pill tone="primary">{gym.role}</Pill>
              <Pill tone={toneForMembership(gym.status)}>{gym.status}</Pill>
            </Card>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>Challenges</SectionTitle>
        <Heading
          title="Keep this lightweight for launch"
          subtitle="Users need enough group context to join a gym, see the weekly loop, and understand rank/challenge momentum. Full challenge creation can wait."
        />
      </Card>
    </ScreenScroll>
  );
}
