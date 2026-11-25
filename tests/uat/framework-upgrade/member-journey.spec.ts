import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const origin = "http://127.0.0.1:3293";
const subject = "73000000-0000-4000-8000-000000000001";
const other = "73000000-0000-4000-8000-000000000002";
const templateId = "73000000-0000-4000-8000-000000000003";
const workoutId = "73000000-0000-4000-8000-000000000004";
const gymId = "73000000-0000-4000-8000-000000000005";
const user = { id: subject, aud: "authenticated", role: "authenticated", email: "journey@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };

async function fixtures(page: Page) {
  const calls = { saves: 0, shares: 0, media: 0, reports: 0, blocks: 0 };
  let failMedia = true;
  let audience = "private";
  await page.context().route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.addInitScript(({ user, subject }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ sub: subject, aud: "authenticated", role: "authenticated", exp: expires }));
    localStorage.setItem("kruxt-auth:127.0.0.1:9", JSON.stringify({ access_token: `e30.${payload}.fixture`, refresh_token: "local-fixture", expires_at: expires, expires_in: 3600, token_type: "bearer", user }));
  }, { user, subject });
  await page.route("http://127.0.0.1:9/auth/v1/user", route => route.fulfill({ json: user }));
  await page.route("http://127.0.0.1:9/storage/v1/**", route => {
    if (route.request().method() === "GET") return route.fulfill({ path: resolve("apps/web/public/marketing/kruxt-community.jpg"), contentType: "image/jpeg" });
    if (route.request().url().includes("/object/sign/")) return route.fulfill({ json: { signedURL: "/fixture-photo.jpg" } });
    return route.fulfill({ json: { Key: "fixture" } });
  });
  await page.route("http://127.0.0.1:9/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").at(-1);
    const method = route.request().method();
    if (table === "ensure_self_profile") return route.fulfill({ json: { id: subject } });
    if (table === "user_has_required_consents") return route.fulfill({ json: true });
    if (table === "log_workout_atomic") {
      calls.saves++;
      expect(route.request().postDataJSON().p_workout.visibility).toBe("private");
      return route.fulfill({ json: workoutId });
    }
    if (table === "profiles") {
      if (calls.saves && url.searchParams.get("select") === "xp_total,level,chain_days,rank_tier") return route.fulfill({ status: 503, json: { message: "fixture readback failure" } });
      if (url.searchParams.get("select") === "id,display_name,username") return route.fulfill({ json: [{ id: other, display_name: "Club athlete", username: "club-athlete" }] });
      return route.fulfill({ json: { id: subject, activation_status: "active", display_name: "Journey athlete", username: "journey", xp_total: 10, level: 1, chain_days: 0, rank_tier: "initiate", home_gym_id: gymId } });
    }
    if (table === "platform_operator_accounts") return route.fulfill({ json: null });
    if (table === "gym_memberships") return route.fulfill({ json: url.searchParams.has("role") ? [] : [{ gym_id: gymId, membership_status: "active", role: "member", gyms: { name: "Local club" } }] });
    if (table === "gyms") return route.fulfill({ json: [{ id: gymId, name: "Local club" }] });
    if (table === "gym_member_workout_plans") return route.fulfill({ json: { id: templateId, gym_id: gymId, title: "Coach plan", status: "active", gyms: { name: "Local club" }, plan_json: { coachNotes: "private-coach-instruction", days: [{ label: "Strength", notes: "private-day-instruction", blocks: [{ exercise: "Squat", sets: 3, reps: 5, notes: "private-block-instruction" }] }] } } });
    if (table === "exercises") return route.fulfill({ json: [{ id: other, name: "Squat", slug: "squat", category: "strength", equipment: "barbell" }] });
    if (table === "user_workout_templates") return route.fulfill({ json: [{ id: templateId, name: "Club session", description: "Private program note", workout_type: "strength", source: "manual", template_days: [{ id: "day-one", label: "Session one", notes: "Technique first", exercises: [{ exerciseId: other, exerciseName: "Squat", exerciseSlug: "squat", category: "strength", equipment: "barbell", stationLabel: "Squat", notes: "Controlled", blockType: "straight_set", reps: "5", weightKg: 20 }] }] }] });
    if (table === "workout_proof_media") {
      if (method === "POST") { calls.media++; if (failMedia) { failMedia = false; return route.fulfill({ status: 503, json: { message: "fixture insert unavailable" } }); } return route.fulfill({ status: 201, json: {} }); }
      return route.fulfill({ json: url.searchParams.has("uploader_user_id") ? [] : [{ id: "media-fixture", workout_id: workoutId, storage_bucket: "workout-proof-media", storage_path: "fixture.jpg", media_kind: "image", mime_type: "image/jpeg", sort_order: 1 }] });
    }
    if (table === "workouts") {
      if (method === "PATCH") { calls.shares++; audience = route.request().postDataJSON().visibility; return route.fulfill({ json: { id: workoutId, visibility: audience } }); }
      if (url.searchParams.has("user_id")) return route.fulfill({ json: { id: workoutId, user_id: subject, gym_id: gymId, visibility: audience } });
      if (url.searchParams.get("select") === "id") return route.fulfill({ json: [{ id: workoutId }] });
      return route.fulfill({ json: [{ id: workoutId, gym_id: gymId, title: "Community session", workout_type: "strength", started_at: "2026-10-23T09:00:00Z", visibility: "public", total_sets: 3, total_volume_kg: 300, is_pr: false }] });
    }
    if (table === "user_blocks") { if (method === "POST") { calls.blocks++; return route.fulfill({ status: 201, json: {} }); } return route.fulfill({ json: [] }); }
    if (table === "user_reports") { calls.reports++; return route.fulfill({ status: 201, json: {} }); }
    if (table === "social_connections") return route.fulfill({ json: [{ followed_user_id: other }] });
    if (table === "feed_events") return route.fulfill({ json: [{ id: "event-1", user_id: other, workout_id: workoutId, event_type: "workout_logged", caption: "A good session", created_at: "2026-10-23T09:00:00Z" }] });
    return route.fulfill({ json: [] });
  });
  return calls;
}

test("selected session saves once, retries media independently, and shares only deliberately", async ({ page }, info) => {
  const calls = await fixtures(page);
  await page.goto(`${origin}/log?templateId=${templateId}&dayId=day-one`);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Club session · Session one");
  await page.getByLabel("Proof files").setInputFiles({ name: "session.jpg", mimeType: "image/jpeg", buffer: Buffer.from("disposable-fixture") });
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workout saved", exact: true })).toBeVisible();
  await expect(page.getByText(/progress totals are temporarily unavailable/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry attachments", exact: true })).toBeVisible();
  expect(calls.saves).toBe(1); expect(calls.shares).toBe(0);
  await page.getByRole("button", { name: "Retry attachments", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry attachments", exact: true })).toHaveCount(0);
  expect(calls.saves).toBe(1); expect(calls.media).toBe(2);
  await page.getByLabel("Audience", { exact: true }).selectOption("followers");
  await page.getByRole("button", { name: "Share workout", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Audience updated: followers");
  expect(calls.shares).toBe(1); expect(calls.saves).toBe(1);
  await page.screenshot({ path: info.outputPath("member-session-complete.png"), fullPage: true });
  await page.reload();
  await expect(page.getByLabel("Audience", { exact: true })).toHaveValue("followers");
  expect(calls.saves).toBe(1);
});

test("member navigation and social views keep safety actions usable on each viewport", async ({ page }, info) => {
  const calls = await fixtures(page);
  await page.goto(`${origin}/feed`);
  await expect(page.getByRole("heading", { name: "Feed", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link")).toHaveCount(5);
  await page.getByRole("button", { name: "My gym", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Community session" })).toBeVisible();
  await expect.poll(() => page.getByRole("img", { name: "Club athlete workout proof" }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByText("Account & safety", { exact: true }).click();
  await page.getByRole("button", { name: "Report workout", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Report submitted");
  expect(calls.reports).toBe(1);
  await page.screenshot({ path: info.outputPath("member-feed.png"), fullPage: true });
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Block account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Community session" })).toHaveCount(0);
  expect(calls.blocks).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("invalid private-data handoff is rejected instead of silently changing the workout", async ({ page }) => {
  await fixtures(page);
  await page.goto(`${origin}/log?session=%7B%22coachNotes%22%3A%22private-marker%22%7D`);
  await expect(page.getByRole("alert").filter({ hasText: "session link is invalid" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("private-marker");
});

async function trainingFixtures(page: Page, mode: "assigned" | "empty" | "error" = "assigned") {
  await fixtures(page);
  let unavailable = mode === "error";
  const plan = {
    id: templateId, gym_id: gymId, title: "Strength & conditioning", status: "active", goal: "Build strength. Stay consistent.",
    gyms: { name: "Local club" }, plan_json: { coachNotes: "Keep two reps in reserve.", days: [
      { label: "Lower body", focus: "Squat and hinge", blocks: [{ exercise: "Back squat", sets: 3, reps: 5 }, { exercise: "Romanian deadlift", sets: 3, reps: 8 }, { exercise: "Walking lunge", sets: 2, reps: 12 }] },
      { label: "Upper body", focus: "Push and pull", blocks: [{ exercise: "Bench press", sets: 3, reps: 6 }, { exercise: "Cable row", sets: 3, reps: 10 }] }
    ] }
  };
  await page.route("**/rest/v1/gym_member_workout_plans?**", route => {
    if (unavailable) { unavailable = false; return route.fulfill({ status: 400, json: { message: "Plan temporarily unavailable" } }); }
    const single = new URL(route.request().url()).searchParams.has("id");
    return route.fulfill({ json: mode === "empty" ? [] : single ? plan : [plan] });
  });
  await page.route("**/rest/v1/workouts?**", route => route.fulfill({ json: [] }));
}

test("training workspace keeps session selection and starting a workout direct", async ({ page }, info) => {
  await trainingFixtures(page);
  await page.goto(`${origin}/plan`);
  await expect(page.getByRole("heading", { name: "Strength & conditioning", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Back squat", exact: true })).toBeVisible();
  const primary = page.getByRole("navigation", { name: "Primary", exact: true });
  await expect(primary.getByRole("link", { name: "Plan", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(primary.getByRole("link")).toHaveCount(5);
  await expect(page.getByRole("link", { name: "Start workout", exact: true })).toHaveAttribute("href", `/log?planId=${templateId}&dayId=0_lower_body`);
  await expect(page.getByText("Preview plan outline")).toHaveCount(0);
  await expect(page.getByText("Future weeks", { exact: true })).toHaveCount(0);
  const content = await page.locator("#member-content").boundingBox();
  const navigation = await primary.boundingBox();
  expect(content).not.toBeNull(); expect(navigation).not.toBeNull();
  if (info.project.name === "mobile") {
    expect(navigation!.y).toBeGreaterThan(500);
    await page.getByLabel("Your session", { exact: true }).selectOption("1_upper_body");
    await page.getByText("More", { exact: true }).click();
    await expect(page.getByRole("link", { name: "Privacy", exact: true })).toBeVisible();
    await page.getByText("More", { exact: true }).click();
  } else {
    expect(navigation!.x + navigation!.width).toBeLessThan(content!.x);
    await page.getByRole("button", { name: /Upper body/ }).click();
    await expect(page.getByRole("link", { name: "Privacy", exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Bench press", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start workout", exact: true })).toHaveAttribute("href", `/log?planId=${templateId}&dayId=1_upper_body`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("member-plan.png"), fullPage: true });
  await page.getByRole("link", { name: "Start workout", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Strength & conditioning · Upper body");
  await page.screenshot({ path: info.outputPath("member-workout.png"), fullPage: true });
});

test("a member without a plan gets real training choices instead of unsaved setup", async ({ page }, info) => {
  await trainingFixtures(page, "empty");
  await page.goto(`${origin}/plan`);
  await expect(page.getByRole("heading", { name: "No assigned plan yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse sessions", exact: true })).toHaveAttribute("href", "/library");
  await expect(page.getByRole("link", { name: "Log a workout", exact: true })).toHaveAttribute("href", "/log");
  await expect(page.getByRole("button", { name: /Preview/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("member-plan-empty.png"), fullPage: true });
});

test("plan loading errors stay distinct from no plan and can be retried", async ({ page }) => {
  await trainingFixtures(page, "error");
  await page.goto(`${origin}/plan`);
  await expect(page.getByRole("heading", { name: "Your plan could not load" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No assigned plan yet" })).toHaveCount(0);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Strength & conditioning", exact: true })).toBeVisible();
});

test("member navigation remains reachable at narrow mobile widths", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Narrow mobile breakpoint only");
  await page.setViewportSize({ width: 320, height: 740 });
  await trainingFixtures(page);
  await page.goto(`${origin}/plan`);
  await expect(page.getByRole("heading", { name: "Back squat", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const nav = page.getByRole("navigation", { name: "Primary", exact: true });
  for (const link of await nav.getByRole("link").all()) {
    const box = await link.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: info.outputPath("member-plan-narrow.png"), fullPage: true });
});

test("rapid saves and reload retain the saved receipt without logging again", async ({ page }) => {
  const calls = await fixtures(page);
  await page.goto(`${origin}/log?templateId=${templateId}&dayId=day-one`);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Club session · Session one");
  await page.getByRole("button", { name: "Save workout", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByRole("heading", { name: "Workout saved", exact: true })).toBeVisible();
  expect(calls.saves).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Workout saved", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save workout", exact: true })).toHaveCount(0);
  expect(calls.saves).toBe(1); expect(calls.shares).toBe(0);
});

test("lost save response blocks blind retry even after reload", async ({ page }) => {
  await fixtures(page);
  let attempts = 0;
  await page.route("**/rest/v1/rpc/log_workout_atomic", route => { attempts++; return route.abort("failed"); });
  await page.goto(`${origin}/log?templateId=${templateId}&dayId=day-one`);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Club session · Session one");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByRole("button", { name: "I checked my activity" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save workout", exact: true })).toBeDisabled();
  expect(attempts).toBe(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "I checked my activity" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save workout", exact: true })).toBeDisabled();
  expect(attempts).toBe(1);
});

test("assigned plan guidance stays available without being copied into shareable notes", async ({ page }) => {
  await fixtures(page);
  let payload: { p_workout: { notes: string | null }; p_exercises: Array<{ notes: string | null }> } | undefined;
  await page.route("**/rest/v1/rpc/log_workout_atomic", route => { payload = route.request().postDataJSON(); return route.fulfill({ json: workoutId }); });
  await page.goto(`${origin}/log?planId=${templateId}&dayId=0_strength`);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Coach plan · Strength");
  await expect(page.getByText(/private-coach-instruction/)).toBeVisible();
  await expect(page.getByText(/Sets 3.*Reps 5/)).toBeVisible();
  await page.getByLabel("Reps", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workout saved", exact: true })).toBeVisible();
  expect(payload?.p_workout.notes).toBeNull();
  expect(payload?.p_exercises.every((exercise) => !exercise.notes?.includes("private-"))).toBe(true);
  expect(JSON.stringify(payload)).not.toContain("private-");
});

test("a delayed save cannot restore the previous athlete's editor or upload their files after an account switch", async ({ page }) => {
  const calls = await fixtures(page);
  let attempted = false;
  let release!: () => void;
  const responseReady = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/rest/v1/rpc/log_workout_atomic", async route => {
    attempted = true;
    await responseReady;
    await route.fulfill({ json: workoutId });
  });
  await page.goto(`${origin}/log?templateId=${templateId}&dayId=day-one`);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Club session · Session one");
  await page.getByLabel("Proof files").setInputFiles({ name: "athlete-a.jpg", mimeType: "image/jpeg", buffer: Buffer.from("private-athlete-a") });
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect.poll(() => attempted).toBe(true);
  await page.route("http://127.0.0.1:9/auth/v1/user", route => route.fulfill({ json: { ...user, id: other, email: "second@example.test" } }));
  await page.route("**/rest/v1/rpc/ensure_self_profile", route => route.fulfill({ json: { id: other } }));
  await page.route("**/rest/v1/profiles?**", route => route.fulfill({ json: { id: other, activation_status: "active", display_name: "Second athlete", username: "second", xp_total: 0, level: 1, chain_days: 0, rank_tier: "initiate", home_gym_id: gymId } }));
  await page.route("**/rest/v1/user_workout_templates**", route => route.fulfill({ json: [] }));
  await page.evaluate(async ({ user, other }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const session = { access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: other, aud: "authenticated", role: "authenticated", exp: expires })}.c2ln`, refresh_token: "second-fixture", expires_at: expires, expires_in: 3600, token_type: "bearer", user: { ...user, id: other, email: "second@example.test" } };
    const scope = globalThis as typeof globalThis & { __kruxtWebSupabaseClients?: Map<string, { auth: { setSession: (session: { access_token: string; refresh_token: string }) => Promise<{ error: { message: string } | null }> } }> };
    const client = scope.__kruxtWebSupabaseClients?.values().next().value;
    if (!client) throw new Error("Fixture client unavailable");
    const result = await client.auth.setSession(session);
    if (result.error) throw new Error(result.error.message);
  }, { user, other });
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Workout Session");
  await expect(page.getByText("Technique first", { exact: true })).toHaveCount(0);
  release();
  await expect.poll(() => page.evaluate(subject => sessionStorage.getItem(`kruxt:workout-receipt:${subject}`), subject)).toBe(workoutId);
  await expect(page.getByRole("heading", { name: "Workout saved", exact: true })).toHaveCount(0);
  expect(calls.media).toBe(0);
});
