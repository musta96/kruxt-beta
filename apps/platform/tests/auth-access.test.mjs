import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");
const origin = process.env.PLATFORM_TEST_URL ?? "http://127.0.0.1:3112";
const authOrigin = "http://127.0.0.1:39999";
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

function session() {
  const payload = Buffer.from(JSON.stringify({ sub: "operator-test", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return {
    access_token: `e30.${payload}.test`, refresh_token: "local-test-refresh", token_type: "bearer",
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "operator-test", email: "operator@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
  };
}

async function fixture(t, { signedIn = false, role = null, roleFailure = false, enabled = false } = {}) {
  const context = await browser.newContext();
  t.after(() => context.close());
  if (signedIn) await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: "kruxt-auth:127.0.0.1:39999", value: JSON.stringify(session()),
  });
  const requests = [];
  let fail = roleFailure;
  await context.route(`${authOrigin}/**`, async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    let body = {};
    let status = 200;
    if (url.pathname.endsWith("/settings")) body = { external: { google: enabled, apple: enabled } };
    else if (url.pathname.includes("platform_operator_accounts")) {
      status = fail ? 503 : 200;
      body = fail ? { message: "sensitive database failure detail" } : role ? { role, is_active: true } : null;
    } else if (url.pathname.endsWith("/token")) {
      status = 400;
      body = { code: "invalid_credentials", error_code: "invalid_credentials", msg: "sensitive auth failure detail" };
    } else if (url.pathname.endsWith("/logout")) { status = 204; body = undefined; }
    else if (url.pathname.endsWith("/authorize")) {
      await route.fulfill({ status: 200, contentType: "text/html", body: "Local OAuth redirect intercepted" });
      return;
    }
    await route.fulfill({ status, contentType: "application/json", body: body === undefined ? undefined : JSON.stringify(body) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  return { page, context, requests, recover: () => { fail = false; } };
}

test("signed-out form has password visibility, busy states and destination links", async (t) => {
  const { page } = await fixture(t);
  await page.goto(`${origin}/login`);
  await page.getByRole("button", { name: "Sign in to platform" }).waitFor({ state: "visible" });
  await page.waitForFunction(() => !document.querySelector("fieldset").disabled);
  await page.getByLabel("Show password").check();
  assert.equal(await page.getByLabel("Password", { exact: true }).getAttribute("type"), "text");
  const member = new URL(await page.getByRole("link", { name: "Member sign-in" }).getAttribute("href"));
  assert.equal(member.pathname + member.hash, "/#member-login");
  const gym = new URL(await page.getByRole("link", { name: "Gym admin sign-in" }).getAttribute("href"));
  assert.equal(gym.pathname, "/login");
  await page.getByLabel("Operator email").fill("operator@example.test");
  await page.getByLabel("Password", { exact: true }).fill("local-test-password");
  await page.getByRole("button", { name: "Sign in to platform" }).click();
  await page.getByRole("alert").filter({ hasText: "Email or password isn't correct" }).waitFor();
  assert.equal(await page.getByLabel("Operator email").inputValue(), "operator@example.test");
  assert.ok(!(await page.content()).includes("sensitive auth failure detail"));
});

for (const provider of ["Google", "Apple"]) test(`${provider} disabled: preflight blocks redirect`, async (t) => {
  const { page, requests } = await fixture(t);
  await page.goto(`${origin}/login`);
  await page.getByRole("button", { name: `Continue with ${provider}` }).click();
  await page.getByRole("alert").filter({ hasText: `${provider} sign-in isn't available` }).waitFor();
  assert.ok(requests.some((url) => url.pathname.endsWith("/settings")));
  assert.ok(!requests.some((url) => url.pathname.endsWith("/authorize")));
  assert.equal(new URL(page.url()).pathname, "/login");
});

test("enabled OAuth uses PKCE and fixed same-origin login redirect", async (t) => {
  const { page, requests } = await fixture(t, { enabled: true });
  await page.goto(`${origin}/login?next=https://attacker.example`);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.waitForURL((url) => url.origin === authOrigin);
  const request = requests.find((url) => url.pathname.endsWith("/authorize"));
  assert.ok(request);
  assert.equal(request.searchParams.get("redirect_to"), `${origin}/login`);
  assert.equal(request.searchParams.get("code_challenge_method"), "s256");
  assert.ok(request.searchParams.get("code_challenge"));
});

test("non-operator OAuth/restored session stays denied and can sign out", async (t) => {
  const { page, requests } = await fixture(t, { signedIn: true });
  await page.goto(`${origin}/login`);
  await page.getByRole("heading", { name: "Platform access required" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/login");
  assert.ok(requests.some((url) => url.searchParams.get("is_active") === "eq.true" && url.searchParams.get("user_id") === "eq.operator-test"));
  await page.getByRole("button", { name: "Sign out and use another account" }).click();
  await page.getByRole("button", { name: "Sign in to platform" }).waitFor();
});

test("role query failure is not denial; retry recovers and signout remains available", async (t) => {
  const f = await fixture(t, { signedIn: true, roleFailure: true });
  await f.page.goto(`${origin}/login`);
  await f.page.getByRole("heading", { name: "Access check unavailable" }).waitFor();
  assert.ok(!(await f.page.content()).includes("sensitive database failure detail"));
  f.recover();
  await f.page.getByRole("button", { name: "Retry access check" }).click();
  await f.page.getByRole("heading", { name: "Platform access required" }).waitFor();
});

test("dashboard access denial has the same signout recovery", async (t) => {
  const { page } = await fixture(t, { signedIn: true });
  await page.goto(origin);
  await page.getByRole("heading", { name: "Platform access required" }).waitFor();
  await page.getByRole("button", { name: "Sign out and use another account" }).click();
  await page.waitForURL(`${origin}/login`);
});

test("active founder reaches dashboard after operator lookup", async (t) => {
  const { page } = await fixture(t, { signedIn: true, role: "founder" });
  await page.goto(`${origin}/login`);
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/");
});

test("stalled role check exits loading; late founder result cannot restore a signed-out session", async (t) => {
  const { page, context } = await fixture(t, { signedIn: true });
  let release;
  let started;
  const requested = new Promise((resolve) => { started = resolve; });
  const held = new Promise((resolve) => { release = resolve; });
  await context.route(`${authOrigin}/rest/v1/platform_operator_accounts*`, async (route) => {
    started();
    await held;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ role: "founder", is_active: true }) }).catch(() => {});
  });
  await page.clock.install();
  await page.goto(`${origin}/login`);
  await requested;
  await page.clock.fastForward(16000);
  await page.getByRole("heading", { name: "Access check unavailable" }).waitFor();
  await page.getByRole("button", { name: "Sign out and use another account" }).click();
  await page.getByRole("button", { name: "Sign in to platform" }).waitFor();
  release();
  await page.waitForFunction(() => !document.querySelector("fieldset").disabled);
  assert.equal(new URL(page.url()).pathname, "/login");
  assert.equal(await page.getByRole("heading", { name: "Overview", exact: true }).count(), 0);
});

test("provider callback error is safe and sensitive URL details are removed", async (t) => {
  const { page } = await fixture(t);
  await page.goto(`${origin}/login?error=access_denied&error_description=private-provider-detail`);
  await page.getByRole("alert").filter({ hasText: "Provider sign-in could not finish" }).waitFor();
  assert.ok(!page.url().includes("private-provider-detail"));
  assert.ok(!(await page.locator("body").innerText()).includes("private-provider-detail"));
});

test("desktop and mobile form fit without horizontal overflow", async (t) => {
  const { page } = await fixture(t);
  for (const [width, height] of [[1280, 900], [390, 844], [320, 640]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${origin}/login`);
    await page.waitForFunction(() => !document.querySelector("fieldset").disabled);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    if (process.env.PLATFORM_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.PLATFORM_SCREENSHOT_DIR}/platform-login-${width}.png`, fullPage: true });
  }
});
