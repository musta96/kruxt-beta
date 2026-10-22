import { expect, test } from "@playwright/test";

const origins = ["http://127.0.0.1:3293", "http://127.0.0.1:3294", "http://127.0.0.1:3295"];

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => origins.includes(new URL(route.request().url()).origin)
    ? route.continue() : route.abort());
});

for (const [name, url] of [
  ["member", `${origins[0]}/#member-login`],
  ["gym admin", `${origins[1]}/login`],
  ["platform", `${origins[2]}/login`]
]) {
  test(`${name} social sign-in remains on the app when providers are disabled`, async ({ page }, testInfo) => {
    await page.route("http://127.0.0.1:9/auth/v1/settings", route => route.fulfill({
      json: { external: { google: false, apple: false, email: true } }
    }));
    await page.goto(url);
    for (const provider of ["Google", "Apple"]) {
      const button = page.getByRole("button", { name: `Continue with ${provider}`, exact: true });
      await expect(button).toBeVisible();
      await button.click();
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText(/not.*(configured|enabled|available)|unavailable|isn't available/i);
      await expect(page).toHaveURL(url);
      await expect(button).toBeEnabled();
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${name.replaceAll(" ", "-")}-auth.png`), fullPage: false });
  });

  test(`${name} provider failures never display upstream error details`, async ({ page }) => {
    const callback = new URL(url);
    callback.searchParams.set("error", "access_denied");
    callback.searchParams.set("error_description", "private-provider-token-marker");
    await page.goto(callback.href);
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toBeVisible();
    await expect(page.locator("body")).not.toContainText("private-provider-token-marker");
  });

  for (const provider of ["Google", "Apple"]) {
    test(`${name} starts ${provider} with PKCE and a same-origin callback`, async ({ page }) => {
      let authorization: URL | undefined;
      await page.route("http://127.0.0.1:9/auth/v1/settings", route => route.fulfill({
        json: { external: { google: true, apple: true } }
      }));
      await page.route("http://127.0.0.1:9/auth/v1/authorize*", route => {
        authorization = new URL(route.request().url());
        return route.fulfill({ contentType: "text/html", body: "<title>Local OAuth Fixture</title>Local fixture" });
      });
      await page.goto(url);
      await page.getByRole("button", { name: `Continue with ${provider}`, exact: true }).click();
      await expect.poll(() => authorization?.searchParams.get("provider")).toBe(provider.toLowerCase());
      expect(authorization?.searchParams.get("code_challenge_method")).toBe("s256");
      expect(authorization?.searchParams.get("code_challenge")).toBeTruthy();
      const callback = new URL(authorization!.searchParams.get("redirect_to")!);
      expect(callback.origin).toBe(new URL(url).origin);
      expect(callback.pathname).toBe(name === "member" ? "/" : "/login");
    });
  }
}
