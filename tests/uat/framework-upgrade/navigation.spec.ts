import { expect, test } from "@playwright/test";

const web = "http://127.0.0.1:3293";
const admin = "http://127.0.0.1:3294";

test.beforeEach(async ({ context }) => {
  // These smoke tests cannot send credentials or traffic to hosted services.
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    return [web, admin].includes(url.origin) ? route.continue() : route.abort();
  });
});

test("product assets and delayed member-login anchor", async ({ page }, testInfo) => {
  await page.goto(`${web}/product`);
  await expect(page).toHaveTitle("Product | KRUXT");
  const productImage = page.locator("main img").first();
  await productImage.scrollIntoViewIfNeeded();
  await expect.poll(() => productImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("product.png"), fullPage: true });

  const desktopSignIn = page.locator("a.marketing-text-link");
  if (await desktopSignIn.isVisible()) {
    await desktopSignIn.click();
  } else {
    await page.getByLabel("Open navigation").click();
    await page.locator(".marketing-mobile-menu").getByRole("link", { name: "Member sign in", exact: true }).click();
  }
  await expect(page).toHaveURL(`${web}/#member-login`);
  await expect(page.locator("#member-login form")).toBeVisible();
  await expect.poll(() => page.locator("#member-login").evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(2);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("admin login renders without overflow", async ({ page }) => {
  await page.goto(`${admin}/login`);
  await expect(page).toHaveTitle("KRUXT Admin");
  await expect(page.locator("input[type=password]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
