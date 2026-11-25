import { expect, test } from "@playwright/test";

const origins = ["http://127.0.0.1:3294", "http://127.0.0.1:3295"];
const subject = "72000000-0000-4000-8000-000000000001";
const user = { id: subject, aud: "authenticated", role: "authenticated", email: "recovery@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const token = () => `e30.${Buffer.from(JSON.stringify({ sub: subject, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => origins.includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
});

for (const origin of origins) {
  test(`${origin} requests a reset email through Auth, without exposing account existence`, async ({ page }) => {
    let requested = false;
    await page.route("http://127.0.0.1:9/auth/v1/recover*", route => {
      requested = true;
      expect(route.request().postDataJSON()).toMatchObject({ email: "recovery@example.test", code_challenge_method: "s256" });
      expect(new URL(route.request().url()).searchParams.get("redirect_to")).toBe(`${origin}/reset-password`);
      return route.fulfill({ json: {} });
    });
    await page.goto(`${origin}/forgot-password`);
    await page.locator("input[type=email]").fill("recovery@example.test");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect.poll(() => requested).toBe(true);
    await expect(page.getByRole("status").filter({ hasText: /if an account exists/i })).toBeVisible();
  });

  test(`${origin} rejects missing recovery proof`, async ({ page }) => {
    await page.goto(`${origin}/reset-password`);
    await expect(page.getByRole("alert").filter({ hasText: /invalid|expired/i })).toBeVisible();
    await expect(page.locator('input[autocomplete="new-password"]')).toHaveCount(0);
  });

  test(`${origin} does not treat an ordinary signed-in session as password recovery`, async ({ page }) => {
    await page.addInitScript(({ access, user }) => localStorage.setItem("kruxt-auth:127.0.0.1:9", JSON.stringify({
      access_token: access, refresh_token: "local-fixture-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600, token_type: "bearer", user
    })), { access: token(), user });
    await page.route("http://127.0.0.1:9/rest/v1/**", route => route.fulfill({ json: null }));
    await page.goto(`${origin}/reset-password`);
    await expect(page.getByRole("alert").filter({ hasText: /invalid|expired/i })).toBeVisible();
    await expect(page.locator('input[autocomplete="new-password"]')).toHaveCount(0);
  });

  test(`${origin} exchanges a recovery code, confirms the password, then signs out`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("kruxt-auth:127.0.0.1:9-code-verifier", JSON.stringify("local-verifier/PASSWORD_RECOVERY")));
    const access = token();
    let updates = 0;
    let signOuts = 0;
    await page.route("http://127.0.0.1:9/auth/v1/token?grant_type=pkce", route => route.fulfill({ json: {
      access_token: access, refresh_token: "local-recovery-refresh", expires_in: 3600, token_type: "bearer", user
    } }));
    await page.route("http://127.0.0.1:9/rest/v1/**", route => route.fulfill({ json: null }));
    await page.route("http://127.0.0.1:9/auth/v1/user", route => {
      if (route.request().method() === "PUT") {
        updates++;
        expect(route.request().postDataJSON()).toMatchObject({ password: "Fixture-password-42!" });
      }
      return route.fulfill({ json: user });
    });
    await page.route("http://127.0.0.1:9/auth/v1/logout*", route => { signOuts++; return route.fulfill({ status: 204 }); });
    await page.goto(`${origin}/reset-password?code=local-recovery-code`);
    const fields = page.locator('input[autocomplete="new-password"]');
    await expect(fields).toHaveCount(2);
    await fields.nth(0).fill("Fixture-password-42!");
    await fields.nth(1).fill("Different-password-42!");
    await page.getByRole("button", { name: "Update password", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /match/i })).toBeVisible();
    expect(updates).toBe(0);
    await fields.nth(1).fill("Fixture-password-42!");
    await page.getByRole("button", { name: "Update password", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: /password updated/i })).toBeVisible();
    await expect.poll(() => signOuts).toBe(1);
    expect(updates).toBe(1);
    await expect(page).toHaveURL(`${origin}/reset-password`);
  });
}
