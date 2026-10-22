import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:3295";
const subject = "71000000-0000-4000-8000-000000000001";
const user = { id: subject, aud: "authenticated", role: "authenticated", email: "fixture@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
});

for (const outcome of ["founder", "denied", "unavailable"]) {
  test(`platform session resolves ${outcome} without a login loop`, async ({ page }) => {
    await page.addInitScript(({ user, subject }) => {
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const payload = btoa(JSON.stringify({ sub: subject, aud: "authenticated", role: "authenticated", exp: expires }));
      localStorage.setItem("kruxt-auth:127.0.0.1:9", JSON.stringify({
        access_token: `${btoa('{"alg":"HS256","typ":"JWT"}')}.${payload}.fixture`,
        refresh_token: "disposable-local-fixture", token_type: "bearer", expires_at: expires,
        expires_in: 3600, user
      }));
    }, { user, subject });
    await page.route("http://127.0.0.1:9/auth/v1/user", route => route.fulfill({ json: user }));
    await page.route("http://127.0.0.1:9/rest/v1/platform_operator_accounts*", route => route.fulfill({
      status: outcome === "unavailable" ? 503 : 200,
      json: outcome === "founder" ? { role: "founder", is_active: true }
        : outcome === "denied" ? null : { message: "private-upstream-error-marker" }
    }));
    await page.goto(`${origin}/login`);
    if (outcome === "founder") {
      await expect(page).toHaveURL(`${origin}/`);
    } else {
      const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(outcome === "denied"
        ? /access|operator/i : /verify|connection|try again/i);
      await expect(page.locator("body")).not.toContainText("private-upstream-error-marker");
      await expect(page).toHaveURL(`${origin}/login`);
    }
  });
}

test("platform PKCE callback exchanges the code but does not create operator access", async ({ page }) => {
  const writes: string[] = [];
  let exchanged = false;
  await page.addInitScript(() => localStorage.setItem("kruxt-auth:127.0.0.1:9-code-verifier", "local-browser-verifier"));
  await page.route("http://127.0.0.1:9/auth/v1/token?grant_type=pkce", async route => {
    expect(route.request().postDataJSON()).toMatchObject({ auth_code: "local-test-code", code_verifier: "local-browser-verifier" });
    exchanged = true;
    const exp = Math.floor(Date.now() / 1000) + 3600;
    await route.fulfill({ json: {
      access_token: `e30.${Buffer.from(JSON.stringify({ sub: subject, exp })).toString("base64url")}.fixture`,
      refresh_token: "local-fixture-refresh", expires_in: 3600, token_type: "bearer", user
    } });
  });
  await page.route("http://127.0.0.1:9/auth/v1/user", route => route.fulfill({ json: user }));
  await page.route("http://127.0.0.1:9/rest/v1/**", route => {
    if (route.request().method() !== "GET") writes.push(route.request().url());
    return route.fulfill({ json: null });
  });
  await page.goto(`${origin}/login?code=local-test-code`);
  await expect.poll(() => exchanged).toBe(true);
  await expect(page.getByRole("heading", { name: "Platform access required" })).toBeVisible();
  await expect(page).toHaveURL(`${origin}/login`);
  expect(writes).toEqual([]);
});
