import { expect, test, type Page } from "@playwright/test";

// Run against a local fixture build configured with Supabase at http://127.0.0.1:9.
const origin = process.env.WORKOUT_DRAFT_TEST_ORIGIN || "http://127.0.0.1:3296";
const owner = "73000000-0000-4000-8000-000000000001";
const other = "73000000-0000-4000-8000-000000000002";
const workout = "73000000-0000-4000-8000-000000000003";
const key = `kruxt:workout-draft:v1:${owner}`;

async function fixture(page: Page) {
  const user = { id: owner, aud: "authenticated", role: "authenticated", email: "draft@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  await page.context().route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.addInitScript(({ user, owner }) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem("kruxt-auth:127.0.0.1:9", JSON.stringify({ access_token: `e30.${btoa(JSON.stringify({ sub: owner, aud: "authenticated", exp }))}.fixture`, refresh_token: "fixture", expires_at: exp, token_type: "bearer", user }));
  }, { user, owner });
  await page.route("http://127.0.0.1:9/auth/v1/user", route => route.fulfill({ json: user }));
  await page.route("http://127.0.0.1:9/rest/v1/**", route => {
    const table = new URL(route.request().url()).pathname.split("/").at(-1);
    if (table === "ensure_self_profile") return route.fulfill({ json: { id: owner } });
    if (table === "user_has_required_consents") return route.fulfill({ json: true });
    if (table === "profiles") return route.fulfill({ json: { id: owner, activation_status: "active", display_name: "Draft athlete", xp_total: 10, level: 1, chain_days: 0, rank_tier: "initiate", home_gym_id: null } });
    if (table === "platform_operator_accounts") return route.fulfill({ json: null });
    if (table === "exercises") return route.fulfill({ json: [{ id: other, name: "Squat", slug: "squat", category: "strength", equipment: "barbell", movement_pattern: null }] });
    if (table === "workouts") return route.fulfill({ json: { id: workout, title: "Private recovery", visibility: "private", gym_id: null } });
    return route.fulfill({ json: [] });
  });
  await page.goto(`${origin}/log`);
  await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
}

test("recovery is opt-in, explicit, private, and discardable on each viewport", async ({ page }, info) => {
  await fixture(page);
  const toggle = page.getByRole("checkbox", { name: "Keep a recovery draft in this tab" });
  await expect(toggle).not.toBeChecked();
  await page.getByLabel("Title", { exact: true }).fill("Sensitive session");
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull();
  await toggle.check();
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) || "null")?.data.title, key)).toBe("Sensitive session");
  const originalRequest = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).data.request, key);
  await page.reload();
  await expect(page.getByRole("button", { name: "Restore draft", exact: true })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("draft-recovery.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Sensitive session");
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).data.request, key)).toEqual(originalRequest);
  await toggle.uncheck();
  await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull();
  await toggle.check();
  await expect.poll(() => page.evaluate(key => !!sessionStorage.getItem(key), key)).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Discard draft", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Workout Session");
  await expect(toggle).not.toBeChecked();
});

test("uncertain retries reuse identity, confirmation clears draft before failed media", async ({ page }) => {
  await fixture(page);
  await page.getByRole("checkbox", { name: "Keep a recovery draft in this tab" }).check();
  await page.getByLabel("Title", { exact: true }).fill("Private recovery");
  await page.getByLabel("Search exercise catalogue", { exact: true }).fill("Squat");
  await expect(page.getByRole("heading", { name: "Squat", exact: true })).toBeVisible();
  await page.getByLabel("Reps", { exact: true }).fill("5");
  const attempts: Array<{ idempotency_key: string; started_at: string }> = [];
  await page.route("**/rest/v1/rpc/log_workout_atomic", route => {
    attempts.push(route.request().postDataJSON().p_workout);
    return attempts.length === 1 ? route.abort("failed") : route.fulfill({ json: workout });
  });
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByRole("button", { name: "I checked my activity" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save workout", exact: true })).toBeDisabled();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "I checked my activity" }).click();
  await page.getByLabel("Proof files").setInputFiles({ name: "secret.jpg", mimeType: "image/jpeg", buffer: Buffer.from("private-proof") });
  await page.route("http://127.0.0.1:9/storage/v1/**", route => route.fulfill({ status: 503, json: { message: "offline" } }));
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workout saved", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry attachments", exact: true })).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1].idempotency_key).toBe(attempts[0].idempotency_key);
  expect(attempts[1].started_at).toBe(attempts[0].started_at);
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Workout saved", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore draft", exact: true })).toHaveCount(0);
});

test("another viewer's storage key and mismatched verified auth cannot reveal a draft", async ({ page }) => {
  await fixture(page);
  await page.getByRole("checkbox", { name: "Keep a recovery draft in this tab" }).check();
  await page.getByLabel("Title", { exact: true }).fill("PRIVATE-OWNER-TEXT");
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) || "null")?.data.title, key)).toBe("PRIVATE-OWNER-TEXT");
  await page.evaluate(({ key, other }) => {
    sessionStorage.setItem(`kruxt:workout-draft:v1:${other}`, sessionStorage.getItem(key)!);
    sessionStorage.removeItem(key);
  }, { key, other });
  await page.reload();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Workout Session");
  await expect(page.locator("body")).not.toContainText("PRIVATE-OWNER-TEXT");
});
