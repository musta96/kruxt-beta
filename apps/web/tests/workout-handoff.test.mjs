import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildPlanWorkoutHref,
  buildTemplateWorkoutHref,
  parseWorkoutHandoff
} from "../src/lib/public/workout-handoff.ts";

const templateId = "11111111-2222-4333-8444-555555555555";
const planId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const exercise = {
  exerciseId: templateId, exerciseName: "Row", exerciseSlug: "row", category: "conditioning",
  equipment: "erg", stationLabel: "Station A", notes: "Keep pace", blockType: "straight_set",
  reps: "3 x 10", weightKg: 20, distanceM: 500, durationSeconds: 120
};
const template = {
  id: templateId, name: "Repeatable session", description: null, workoutType: "strength", source: "manual",
  days: [
    { id: "day-a", label: "Day A", notes: "First", exercises: [exercise] },
    { id: "day-b&next=https://example.test/#?%", label: "Day B", notes: "Second", exercises: [exercise] }
  ]
};
const plan = {
  id: planId, title: "Coach plan & 100% effort", coachNotes: "No invented loads\nAsk your coach.",
  days: [
    { id: "0_day_a", label: "Day A", focus: "Strength", notes: null,
      blocks: [{ id: "0_squat", exercise: "Squat", target: "Sets 3 · Reps 8 · Load 70%",
        notes: "Rest 90s", tags: ["Sets 3", "Reps 8", "Load 70%"] }] },
    { id: "1_day_b", label: "Day B", focus: null, notes: "Steady & controlled",
      blocks: [{ id: "0_row", exercise: "Row", target: "Duration 10 min", notes: null, tags: ["Duration 10 min"] }] }
  ]
};
const parseHref = (href) => parseWorkoutHandoff(new URL(href, "https://app.test").searchParams);

test("persisted template links carry exactly the selected day without copying workout data", () => {
  for (const day of template.days) {
    const href = buildTemplateWorkoutHref(template, day.id);
    const url = new URL(href, "https://app.test");
    assert.equal(url.pathname, "/log");
    assert.equal(url.origin, "https://app.test");
    assert.equal(url.hash, "");
    assert.deepEqual([...url.searchParams.keys()], ["templateId", "dayId"]);
    assert.deepEqual(parseHref(href), { kind: "template", templateId, dayId: day.id });
    assert.ok(!href.includes("Keep"));
  }
});

test("template builders reject non-UUIDs, absent, empty and ambiguous days", () => {
  assert.equal(buildTemplateWorkoutHref({ ...template, id: "/evil?x=1" }, "day-a"), null);
  assert.equal(buildTemplateWorkoutHref(template, "missing"), null);
  assert.equal(buildTemplateWorkoutHref({ ...template, days: [{ ...template.days[0], exercises: [] }] }, "day-a"), null);
  assert.equal(buildTemplateWorkoutHref({ ...template, days: [template.days[0], template.days[0]] }, "day-a"), null);
  for (const id of ["", " ", "bad\nvalue", "bad\0value", "a".repeat(201)]) {
    assert.equal(buildTemplateWorkoutHref({ ...template, days: [{ ...template.days[0], id }] }, id), null);
  }
});

test("plan handoffs carry only the exact selected plan and day references", () => {
  for (const day of plan.days) {
    const href = buildPlanWorkoutHref(plan, day.id);
    const url = new URL(href, "https://app.test");
    assert.deepEqual(parseHref(href), { kind: "plan", planId, dayId: day.id });
    assert.equal(url.pathname, "/log");
    assert.deepEqual([...url.searchParams], [["planId", planId], ["dayId", day.id]]);
    assert.equal(href, `/log?planId=${planId}&dayId=${day.id}`);
  }
});

test("preview reordering does not change the selected day or mutate the source", () => {
  const original = structuredClone(plan);
  const reordered = { ...plan, days: [...plan.days].reverse() };
  assert.equal(buildPlanWorkoutHref(plan, plan.days[1].id), buildPlanWorkoutHref(reordered, plan.days[1].id));
  assert.deepEqual(plan, original);
  assert.equal(buildPlanWorkoutHref(plan, "unknown-day"), null);
  assert.equal(buildPlanWorkoutHref({ ...plan, days: [plan.days[0], plan.days[0]] }, plan.days[0].id), null);
});

test("plan builders reject invalid references and empty days", () => {
  assert.equal(buildPlanWorkoutHref({ ...plan, id: "invalid" }, plan.days[0].id), null);
  assert.equal(buildPlanWorkoutHref({ ...plan, days: [{ ...plan.days[0], blocks: [] }] }, plan.days[0].id), null);
  for (const id of ["", " ", "bad\nvalue", "bad\0value", "a".repeat(201)]) {
    assert.equal(buildPlanWorkoutHref({ ...plan, days: [{ ...plan.days[0], id }] }, id), null);
    assert.equal(parseWorkoutHandoff(new URLSearchParams({ planId, dayId: id })), null);
  }
});

test("conflicting, duplicate and incomplete navigation parameters fail closed", () => {
  const valid = new URL(buildPlanWorkoutHref(plan, plan.days[0].id), "https://app.test").searchParams;
  for (const params of [
    new URLSearchParams(), new URLSearchParams({ templateId }), new URLSearchParams({ planId }),
    new URLSearchParams({ dayId: "day-a" }), new URLSearchParams({ planId: "invalid", dayId: "day-a" }),
    new URLSearchParams({ templateId: "not-a-uuid", dayId: "day-a" }),
    new URLSearchParams(`${valid}&templateId=${templateId}`), new URLSearchParams(`${valid}&dayId=day-a`),
    new URLSearchParams(`${valid}&${valid}`),
    new URLSearchParams(`planId=${planId}&planId=${planId}&dayId=day-a`),
    new URLSearchParams(`templateId=${templateId}&templateId=${templateId}&dayId=day-a`),
    new URLSearchParams(`templateId=${templateId}&dayId=day-a&dayId=day-b`)
  ]) assert.equal(parseWorkoutHandoff(params), null);
});

test("private training content never affects or appears in the generated plan URL", () => {
  const original = buildPlanWorkoutHref(plan, plan.days[0].id);
  const privatePlan = structuredClone(plan);
  privatePlan.title = "PRIVATE TITLE";
  privatePlan.coachNotes = "PRIVATE COACH NOTES".repeat(10_000);
  privatePlan.days[0].label = "PRIVATE LABEL";
  privatePlan.days[0].focus = "PRIVATE FOCUS";
  privatePlan.days[0].notes = "PRIVATE DAY NOTES";
  privatePlan.days[0].blocks[0] = {
    id: "private-block", exercise: "PRIVATE EXERCISE", target: "PRIVATE TARGET",
    notes: "PRIVATE BLOCK NOTES", tags: ["PRIVATE TAG"]
  };
  assert.equal(buildPlanWorkoutHref(privatePlan, plan.days[0].id), original);
  assert.ok(!original.includes("PRIVATE"));
  assert.equal(new URL(original, "https://app.test").searchParams.has("session"), false);
});

test("legacy session payloads are rejected, including alongside valid references", () => {
  for (const session of ["", "{", JSON.stringify(plan), "x".repeat(12_001)]) {
    for (const reference of [{}, { planId, dayId: "day-a" }, { templateId, dayId: "day-a" }]) {
      assert.equal(parseWorkoutHandoff(new URLSearchParams({ ...reference, session })), null);
    }
  }
});

test("plan day references are encoded safely and decoded only once", () => {
  const id = "day&next=https://example.test/#?%2F+";
  const href = buildPlanWorkoutHref({ ...plan, days: [{ ...plan.days[0], id }] }, id);
  const url = new URL(href, "https://app.test");
  assert.equal(url.origin, "https://app.test");
  assert.equal(url.pathname, "/log");
  assert.equal(url.hash, "");
  assert.deepEqual([...url.searchParams.keys()], ["planId", "dayId"]);
  assert.deepEqual(parseHref(href), { kind: "plan", planId, dayId: id });
});

test("screens wire contextual actions without unsaved planning controls", () => {
  const planScreen = readFileSync(new URL("../src/components/public/PlanScreen.tsx", import.meta.url), "utf8");
  const libraryScreen = readFileSync(new URL("../src/components/public/LibraryScreen.tsx", import.meta.url), "utf8");
  assert.match(planScreen, /buildPlanWorkoutHref\(snapshot\.activePlan, selectedDay\.id\)/);
  assert.match(planScreen, /href=\{workoutHref\}/);
  assert.doesNotMatch(planScreen, /Preview plan outline|Preview week order|Future weeks|setSetupPreviewed|handleMoveDay/);
  assert.match(libraryScreen, /loadWorkoutTemplates\(supabase\)/);
  assert.match(libraryScreen, /buildTemplateWorkoutHref\(persistedTemplate, dayId\)/);
  assert.match(libraryScreen, /value=\{dayId\}/);
  assert.doesNotMatch(libraryScreen, /Start program|Try session/);
  for (const screen of [planScreen, libraryScreen]) assert.doesNotMatch(screen, /localStorage|sessionStorage/);
});
