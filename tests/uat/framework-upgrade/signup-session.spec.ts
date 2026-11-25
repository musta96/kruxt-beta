import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:3293";
const authOrigin = "http://127.0.0.1:9";
const subject = "73000000-0000-4000-8000-000000000091";
const email = "signup-fixture@example.test";
const password = "Fixture-password-42!";
const user = { id: subject, aud: "authenticated", role: "authenticated", email,
  app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };

function sessionResponse() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = Buffer.from(JSON.stringify({ sub: subject, aud: "authenticated", exp })).toString("base64url");
  return { access_token: `e30.${payload}.fixture`, refresh_token: "local-fixture", expires_in: 3600, token_type: "bearer", user };
}

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
});

test("member signup without a session stops at confirmation, clears password and does not probe credentials", async ({ page }, info) => {
  let signups = 0;
  const unexpected: string[] = [];
  let release!: () => void;
  const response = new Promise<void>(resolve => { release = resolve; });
  await page.route(`${authOrigin}/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/v1/signup") {
      signups++;
      expect(route.request().postDataJSON()).toMatchObject({ email, password });
      await response;
      return route.fulfill({ json: { ...user, identities: [] } });
    }
    unexpected.push(url.pathname);
    return route.abort();
  });
  await page.goto(`${origin}/#member-login`);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const form = page.locator("#member-login form");
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Password", { exact: true }).fill(password);
  const submit = form.locator('button[type="submit"]');
  try {
    await submit.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await expect.poll(() => signups).toBe(1);
    await expect(submit).toBeDisabled();
  } finally { release(); }
  const status = page.getByRole("status").filter({ hasText: "Check your email" });
  await expect(status).toBeVisible();
  await expect(status).not.toContainText("Account created");
  await expect(form.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(form.getByLabel("Email", { exact: true })).toHaveValue(email);
  await expect(submit).toHaveText("Sign in to KRUXT");
  await expect(submit).toBeEnabled();
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveCount(0);
  await status.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath(`signup-confirmation-${info.project.name}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(status).toHaveCount(0);
  expect(signups).toBe(1);
  expect(unexpected).toEqual([]);
});

test("member signup with a session continues once into required policy review without password login", async ({ page }) => {
  let signups = 0;
  let profiles = 0;
  let passwordLogins = 0;
  let consentWrites = 0;
  await page.route(`${authOrigin}/auth/v1/signup*`, route => {
    signups++;
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = Buffer.from(JSON.stringify({ sub: subject, aud: "authenticated", exp })).toString("base64url");
    return route.fulfill({ json: { access_token: `e30.${payload}.fixture`, refresh_token: "local-fixture",
      expires_in: 3600, token_type: "bearer", user } });
  });
  await page.route(`${authOrigin}/auth/v1/token*`, route => { passwordLogins++; return route.abort(); });
  await page.route(`${authOrigin}/auth/v1/user`, route => route.fulfill({ json: user }));
  await page.route(`${authOrigin}/rest/v1/**`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1);
    if (name === "ensure_self_profile") { profiles++; return route.fulfill({ json: { id: subject } }); }
    if (name === "profiles") return route.fulfill({ json: !profiles && new URL(route.request().url()).searchParams.get("select") === "id" ? null : { id: subject, activation_status: "active" } });
    if (name === "platform_operator_accounts") return route.fulfill({ json: null });
    if (name === "gym_memberships") return route.fulfill({ json: [] });
    if (name === "user_has_required_consents") return route.fulfill({ json: false });
    // A missing published policy must block entry; signup never accepts policies on the user's behalf.
    if (name === "list_missing_required_consents") return route.fulfill({ json: [{ consent_type: "terms", required_policy_version_id: null }] });
    if (name === "accept_required_consents") consentWrites++;
    return route.abort();
  });
  await page.goto(`${origin}/#member-login`);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const form = page.locator("#member-login form");
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Password", { exact: true }).fill(password);
  await form.locator('button[type="submit"]').click();
  await expect(page.getByText(/no approved, consent-ready Terms of Service is published/).first()).toBeVisible();
  await expect(form).toHaveCount(0);
  expect(signups).toBe(1);
  expect(profiles).toBe(1);
  expect(passwordLogins).toBe(0);
  expect(consentWrites).toBe(0);
  await expect(page).toHaveURL(`${origin}/#member-login`);
});

test("member signup rejection stays sanitized and can retry without a second login", async ({ page }) => {
  let signups = 0;
  let passwordLogins = 0;
  await page.route(`${authOrigin}/auth/v1/token*`, route => { passwordLogins++; return route.abort(); });
  await page.route(`${authOrigin}/auth/v1/signup*`, route => {
    signups++;
    return signups === 1 ? route.fulfill({ status: 400, headers: {
      "X-Supabase-Api-Version": "2024-01-01", "Access-Control-Expose-Headers": "X-Supabase-Api-Version"
    }, json: { code: "captcha_failed", msg: "PRIVATE_SIGNUP_PROVIDER_DETAILS" } })
      : route.fulfill({ json: user });
  });
  await page.goto(`${origin}/#member-login`);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const form = page.locator("#member-login form");
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Password", { exact: true }).fill(password);
  const submit = form.locator('button[type="submit"]');
  await submit.click();
  await expect(page.getByRole("alert").filter({ hasText: "Security verification" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("PRIVATE_SIGNUP_PROVIDER_DETAILS");
  await expect(submit).toHaveText("Create my account");
  await expect(submit).toBeEnabled();
  await expect(form.getByLabel("Password", { exact: true })).toHaveValue(password);
  await submit.click();
  await expect(page.getByRole("status").filter({ hasText: "Check your email" })).toBeVisible();
  await expect(form.getByLabel("Password", { exact: true })).toHaveValue("");
  expect(signups).toBe(2);
  expect(passwordLogins).toBe(0);
});

test("an existing member reaches policy review without the missing profile-creation RPC", async ({ page }, info) => {
  let creations = 0;
  let consentWrites = 0;
  await page.addInitScript(({ user, subject }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ sub: subject, aud: "authenticated", role: "authenticated", exp: expires }));
    localStorage.setItem("kruxt-auth:127.0.0.1:9", JSON.stringify({ access_token: `e30.${payload}.fixture`, refresh_token: "local-fixture", expires_at: expires, expires_in: 3600, token_type: "bearer", user }));
  }, { user, subject });
  await page.route(`${authOrigin}/auth/v1/user`, route => route.fulfill({ json: user }));
  await page.route(`${authOrigin}/rest/v1/**`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1);
    if (name === "ensure_self_profile") { creations++; return route.fulfill({ status: 404, json: { code: "PGRST202", message: "private schema details" } }); }
    if (name === "profiles") return route.fulfill({ json: { id: subject, activation_status: "active" } });
    if (name === "platform_operator_accounts") return route.fulfill({ json: null });
    if (name === "gym_memberships") return route.fulfill({ json: [] });
    if (name === "user_has_required_consents") return route.fulfill({ json: false });
    if (name === "list_missing_required_consents") return route.fulfill({ json: [{ consent_type: "terms", required_policy_version_id: null }] });
    if (name === "accept_required_consents") consentWrites++;
    return route.abort();
  });
  await page.goto(`${origin}/#member-login`);
  await expect(page.getByRole("heading", { name: "Review the current policies" })).toBeVisible();
  await expect(page.getByText(/no approved, consent-ready Terms of Service is published/).first()).toBeVisible();
  await expect(page.getByText("Authentication could not be completed. Try again or contact support.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept and enter KRUXT" })).toHaveCount(0);
  expect(creations).toBe(0); expect(consentWrites).toBe(0);
  await page.screenshot({ path: info.outputPath("existing-member-policy-gate.png") });
});

test("privacy sign-in returns to data requests without accepting policies", async ({ page }) => {
  let consentWrites = 0;
  await page.route(`${authOrigin}/auth/v1/token*`, route => route.fulfill({ json: sessionResponse() }));
  await page.route(`${authOrigin}/auth/v1/user`, route => route.fulfill({ json: user }));
  await page.route(`${authOrigin}/rest/v1/**`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1);
    if (name === "profiles") return route.fulfill({ json: { id: subject, activation_status: "active" } });
    if (name === "platform_operator_accounts") return route.fulfill({ json: null });
    if (name === "gym_memberships" || name === "privacy_requests") return route.fulfill({ json: [] });
    if (name === "user_has_required_consents") return route.fulfill({ json: false });
    if (name === "list_missing_required_consents") return route.fulfill({ json: [{ consent_type: "terms", required_policy_version_id: null, required_policy_version: null, reason: "missing_consent_ready_policy" }] });
    if (name === "accept_required_consents") consentWrites++;
    return route.abort();
  });
  await page.goto(`${origin}/privacy`);
  await page.getByRole("button", { name: "Go to sign in", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/?returnTo=%2Fprivacy#member-login`);
  const form = page.locator("#member-login form");
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Password", { exact: true }).fill(password);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(`${origin}/privacy`);
  await expect(page.getByRole("heading", { name: "Submit a data request" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  expect(consentWrites).toBe(0);
});

test("account-check outages offer retry rather than falsely showing signed out", async ({ page }) => {
  await page.addInitScript(value => localStorage.setItem("kruxt-auth:127.0.0.1:9", JSON.stringify({ ...value,
    expires_at: Math.floor(Date.now() / 1000) + 3600 })), sessionResponse());
  await page.route(`${authOrigin}/auth/v1/user`, route => route.fulfill({ json: user }));
  await page.route(`${authOrigin}/rest/v1/**`, route => route.fulfill({ status: 503, json: { message: "PRIVATE_ACCOUNT_CHECK_FAILURE" } }));
  await page.goto(`${origin}/privacy`);
  await expect(page.getByRole("heading", { name: "Account setup unavailable" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in required" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("PRIVATE_ACCOUNT_CHECK_FAILURE");
});
