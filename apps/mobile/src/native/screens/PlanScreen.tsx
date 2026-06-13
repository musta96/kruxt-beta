import React from "react";

import { Card, Heading, Pill, ScreenScroll, SectionTitle, StatGrid } from "../ui";

const weekPlan = [
  { day: "Mon", title: "Upper Strength", state: "completed", note: "Heavy compounds plus accessories." },
  { day: "Tue", title: "Mobility and Recovery", state: "recovery", note: "Low-load reset and movement prep." },
  {
    day: "Wed",
    title: "Guild Class / Conditioning",
    state: "scheduled",
    note: "Book or check in from your gym schedule."
  },
  { day: "Thu", title: "Lower Strength", state: "scheduled", note: "Volume block with a finisher." },
  { day: "Fri", title: "Skill and Core", state: "scheduled", note: "Technique and trunk work." },
  { day: "Sat", title: "Open Session", state: "scheduled", note: "Free workout or benchmark trial." },
  { day: "Sun", title: "Rest", state: "rest", note: "Recovery and reset." }
] as const;

function toneForState(state: (typeof weekPlan)[number]["state"]): "default" | "primary" | "success" {
  if (state === "completed") return "success";
  if (state === "scheduled") return "primary";
  return "default";
}

export function PlanScreen(): React.JSX.Element {
  const completedCount = weekPlan.filter((session) => session.state === "completed").length;
  const scheduledCount = weekPlan.filter((session) => session.state === "scheduled").length;
  const recoveryCount = weekPlan.filter((session) => session.state === "recovery" || session.state === "rest").length;
  const todaySession = weekPlan[2];
  const nextSession = weekPlan.find((session) => session.state === "scheduled");

  return (
    <ScreenScroll>
      <Heading
        eyebrow="Plan"
        title="Your weekly training plan"
        subtitle="A launch-ready weekly view that tells members what is happening now, what is next, and what still needs action."
      />

      <Card>
        <Heading
          title="Week of 9 Mar"
          subtitle="Your plan stays native for the whole core loop: review the week, open today, then jump straight into class, free workout, or logging."
        />
        <StatGrid
          items={[
            { label: "Completed", value: String(completedCount) },
            { label: "Upcoming", value: String(scheduledCount) },
            { label: "Recovery", value: String(recoveryCount) }
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>Today</SectionTitle>
        <Heading
          title={todaySession.title}
          subtitle={todaySession.note}
        />
        <Pill tone={toneForState(todaySession.state)}>{todaySession.state}</Pill>
      </Card>

      {nextSession ? (
        <Card>
          <SectionTitle>Next up</SectionTitle>
          <Heading
            title={`${nextSession.day} · ${nextSession.title}`}
            subtitle="The next scheduled session should be one tap away from booking, starting, or checking in."
          />
          <Pill tone={toneForState(nextSession.state)}>{nextSession.state}</Pill>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Weekly overview</SectionTitle>
        {weekPlan.map((session) => (
          <Card key={`${session.day}-${session.title}`}>
            <Heading title={`${session.day} · ${session.title}`} subtitle={session.note} />
            <Pill tone={toneForState(session.state)}>{session.state}</Pill>
          </Card>
        ))}
      </Card>

      <Card>
        <SectionTitle>Launch boundary</SectionTitle>
        <Heading
          title="Weekly clarity first, advanced controls later"
          subtitle="The public launch should let members understand the week, open today, and complete sessions without confusion. Advanced plan editing stays out until the core loop is stable."
        />
      </Card>
    </ScreenScroll>
  );
}
