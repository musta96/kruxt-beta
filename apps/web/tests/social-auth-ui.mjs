import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Run against local builds configured with https://auth.fixture.invalid.
const browser = await chromium.launch({ headless: true });
try {
  for (const app of ["web", "admin"]) {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      let checks = 0;
      let authSubmissions = 0;
      await context.route("https://auth.fixture.invalid/**", async (route) => {
        if (new URL(route.request().url()).pathname === "/auth/v1/settings") {
          checks++;
          await new Promise((resolve) => setTimeout(resolve, 150));
          await route.fulfill({ json: { external: { google: false, apple: false } } });
        } else {
          authSubmissions++;
          await new Promise((resolve) => setTimeout(resolve, 150));
          await route.fulfill({ status: 400, json: { code: "invalid_credentials", msg: "DO_NOT_REFLECT_PRIVATE_ERROR" } });
        }
      });
      const page = await context.newPage();
      const base = app === "web" ? "http://127.0.0.1:3270/" : "http://127.0.0.1:3271/login";
      await page.goto(base + "?error_description=DO_NOT_REFLECT_SECRET");
      const scope = app === "web" ? page.locator(".marketing-auth-card") : page.locator("form").locator("..");
      const google = page.getByRole("button", { name: "Continue with Google", exact: true });
      await google.waitFor();
      await page.getByRole("alert").filter({ hasText: "Social sign-in could not be completed" }).waitFor();
      assert.ok(!page.url().includes("DO_NOT_REFLECT_SECRET"));
      assert.ok(!(await page.locator("body").innerText()).includes("DO_NOT_REFLECT_SECRET"));
      for (const mode of ["signin", "signup"]) {
        if (mode === "signup") {
          await page.getByRole("button", { name: app === "web" ? "Create account" : "Sign up", exact: true }).click();
        }
        for (const provider of ["Google", "Apple"]) {
          const button = page.getByRole("button", { name: "Continue with " + provider, exact: true });
          await button.click();
          assert.equal(await google.isDisabled(), true);
          await page.getByRole("alert").filter({ hasText: provider + " sign-in is not configured yet" }).waitFor();
          assert.equal(new URL(page.url()).origin, new URL(base).origin);
          assert.equal(await google.isEnabled(), true);
        }
      }
      const password = page.locator('input[autocomplete="new-password"]');
      await password.fill("fixture-password");
      await page.getByRole("button", { name: "Show password", exact: true }).click();
      assert.equal(await password.getAttribute("type"), "text");
      await page.getByRole("button", { name: "Hide password", exact: true }).click();
      assert.equal(await password.getAttribute("type"), "password");
      assert.equal(checks, 4);
      assert.equal(authSubmissions, 0);
      const overflow = await scope.evaluate((element) => element.scrollWidth > element.clientWidth);
      assert.equal(overflow, false);
      await scope.screenshot({ path: new URL("./" + app + "-auth-" + width + ".png", import.meta.url).pathname });
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.locator('input[type="email"]').fill("fixture@example.invalid");
      await page.locator("form").evaluate((form) => {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      await page.getByRole("alert").filter({ hasText: /Authentication could not be completed|Email or password is incorrect/ }).waitFor();
      assert.equal(authSubmissions, 1, "synchronous duplicate submits must share one busy guard");
      assert.ok(!(await page.locator("body").innerText()).includes("DO_NOT_REFLECT_PRIVATE_ERROR"));
      await page.goto(base + "?code=LOCAL_CODE_SECRET&token_hash=KEEP_INVITE&type=invite");
      await page.getByRole("alert").filter({ hasText: "Social sign-in could not be completed" }).waitFor();
      assert.ok(!page.url().includes("LOCAL_CODE_SECRET"));
      assert.equal(new URL(page.url()).searchParams.get("token_hash"), "KEEP_INVITE");
      console.log(app + " " + width + ": modes, retries, duplicate guard, safe callbacks, invite preservation, password toggle, no overflow passed");
      await context.close();
    }
  }
} finally {
  await browser.close();
}
