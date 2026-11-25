import { expect, test } from "@playwright/test";

const origins = ["http://127.0.0.1:3293", "http://127.0.0.1:3294", "http://127.0.0.1:3295"];
const authOrigin = "http://127.0.0.1:9";
const privateMarker = "PRIVATE_AUTH_PROTECTION_UPSTREAM_DETAILS";
const email = "protection-fixture@example.test";
const password = "Fixture-password-42!";
// The SDK reads this cross-origin header before accepting modern error codes.
const authErrorHeaders = { "X-Supabase-Api-Version": "2024-01-01", "Access-Control-Expose-Headers": "X-Supabase-Api-Version" };
const failures = [
  { name: "CAPTCHA failed", status: 400, code: "captcha_failed", copy: /^Security verification/, action: /refresh.*try again/i },
  // An unrecognized code makes this exercise HTTP status mapping, not known rate-limit codes.
  { name: "HTTP 429", status: 429, code: "unrecognized_fixture_code", copy: /^Too many attempts/, action: /wait.*try again/i }
];
const loginRoutes = [
  { name: "member", url: `${origins[0]}/#member-login`, form: "#member-login form" },
  { name: "admin", url: `${origins[1]}/login`, form: "form" },
  { name: "platform", url: `${origins[2]}/login`, form: "form" }
];

test.beforeEach(async ({ context }) => {
  // Only the application origins can reach the network; Auth is fulfilled by page routes below.
  await context.route("**/*", route => origins.includes(new URL(route.request().url()).origin)
    ? route.continue() : route.abort());
});

for (const target of loginRoutes) {
  for (const failure of failures) {
    test(`${target.name} login safely handles ${failure.name} and permits retry without navigation`, async ({ page }, testInfo) => {
      let requests = 0;
      let releaseFirst!: () => void;
      const firstResponse = new Promise<void>(resolve => { releaseFirst = resolve; });
      await page.route(`${authOrigin}/auth/v1/token?grant_type=password`, async route => {
        expect(route.request().method()).toBe("POST");
        expect(route.request().postDataJSON()).toMatchObject({ email, password });
        requests++;
        if (requests === 1) await firstResponse;
        await route.fulfill({ status: failure.status, headers: authErrorHeaders, json: {
          code: failure.code, msg: privateMarker, message: privateMarker, error_description: privateMarker
        } });
      });
      await page.goto(target.url);
      const form = page.locator(target.form);
      const emailField = form.locator('input[type="email"]');
      const passwordField = form.locator('input[autocomplete="current-password"]');
      const submit = form.locator('button[type="submit"]');
      const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
      await expect(submit).toBeEnabled();
      await emailField.fill(email);
      await passwordField.fill(password);
      try {
        await submit.click();
        await expect.poll(() => requests).toBe(1);
        await expect(submit).toBeDisabled();
        await expect(emailField).toBeDisabled();
        await expect(passwordField).toBeDisabled();
      } finally { releaseFirst(); }

      await expect(alert).toContainText(failure.copy);
      await expect(alert).toContainText(failure.action);
      await expect(page.locator("body")).not.toContainText(privateMarker);
      await expect(page).toHaveURL(target.url);
      await expect(emailField).toBeEnabled();
      await expect(passwordField).toBeEnabled();
      await expect(submit).toBeEnabled();
      for (const provider of ["Google", "Apple"]) {
        await expect(page.getByRole("button", { name: `Continue with ${provider}`, exact: true })).toBeEnabled();
      }

      if (target.name === "admin" && failure.name === "CAPTCHA failed") {
        await alert.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`admin-captcha-${testInfo.project.name}.png`), fullPage: false });
      }

      await submit.click();
      await expect.poll(() => requests).toBe(2);
      await expect(alert).toContainText(failure.copy);
      await expect(submit).toBeEnabled();
      await expect(emailField).toBeEnabled();
      await expect(passwordField).toBeEnabled();
      await expect(page.locator("body")).not.toContainText(privateMarker);
      await expect(page).toHaveURL(target.url);
      expect(requests).toBe(2);
    });
  }
}

for (const [name, origin] of [["admin", origins[1]], ["platform", origins[2]]]) {
  for (const failure of failures) {
    test(`${name} recovery safely handles ${failure.name}, retries and keeps success non-enumerating`, async ({ page }) => {
      let requests = 0;
      let releaseFirst!: () => void;
      const firstResponse = new Promise<void>(resolve => { releaseFirst = resolve; });
      await page.route(`${authOrigin}/auth/v1/recover*`, async route => {
        expect(route.request().method()).toBe("POST");
        expect(route.request().postDataJSON()).toMatchObject({ email, code_challenge_method: "s256" });
        expect(new URL(route.request().url()).searchParams.get("redirect_to")).toBe(`${origin}/reset-password`);
        requests++;
        if (requests === 1) {
          await firstResponse;
          await route.fulfill({ status: failure.status, headers: authErrorHeaders, json: {
            code: failure.code, msg: privateMarker, message: privateMarker, error_description: privateMarker
          } });
        } else await route.fulfill({ json: {} });
      });
      const url = `${origin}/forgot-password`;
      await page.goto(url);
      const emailField = page.locator('input[type="email"]');
      const submit = page.locator("form").getByRole("button");
      const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
      await emailField.fill(email);
      try {
        await submit.click();
        await expect.poll(() => requests).toBe(1);
        await expect(submit).toBeDisabled();
        await expect(emailField).toBeDisabled();
      } finally { releaseFirst(); }

      await expect(alert).toContainText(failure.copy);
      await expect(alert).toContainText(failure.action);
      await expect(page.locator("body")).not.toContainText(privateMarker);
      await expect(page.getByRole("status").filter({ hasText: /if an account exists/i })).toHaveCount(0);
      await expect(submit).toBeEnabled();
      await expect(emailField).toBeEnabled();
      await expect(page).toHaveURL(url);

      await submit.click();
      await expect.poll(() => requests).toBe(2);
      await expect(page.getByRole("status").filter({ hasText: /if an account exists/i })).toBeVisible();
      await expect(alert).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText(privateMarker);
      await expect(page.locator("body")).not.toContainText(/account (?:not found|does not exist)|email (?:not found|is not registered)/i);
      await expect(page).toHaveURL(url);
      expect(requests).toBe(2);
    });
  }
}
