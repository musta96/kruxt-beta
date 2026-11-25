import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");
let origin = process.env.PLATFORM_TEST_URL;
const authOrigin = process.env.PLATFORM_TEST_AUTH_URL ?? "http://127.0.0.1:9";
const storageKey = `kruxt-auth:${new URL(authOrigin).host}`;
const roles = ["founder", "ops_admin", "support_admin", "compliance_admin", "analyst", "read_only"];
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const permissions = ["platform.fixture.view", "platform.fixture.edit", "platform.fixture.export"];
const labels = ["View fixture", "Edit fixture", "Export fixture"];
let browser;
let server;
let serverStopped;
before(async () => {
  if (!origin) {
    const listener = createServer();
    await new Promise((resolve, reject) => {
      listener.once("error", reject);
      listener.listen(0, "127.0.0.1", resolve);
    });
    const port = listener.address().port;
    await new Promise((resolve) => listener.close(resolve));
    origin = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: authOrigin, NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-fixture-only" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let logs = "";
    let stopped = false;
    serverStopped = new Promise((resolve) => {
      server.once("error", (error) => { logs += error.message; stopped = true; resolve(); });
      server.once("exit", () => { stopped = true; resolve(); });
    });
    const record = (chunk) => { logs = (logs + chunk.toString()).slice(-4000); };
    server.stdout.on("data", record);
    server.stderr.on("data", record);
    let ready = false;
    for (let attempt = 0; attempt < 150 && !stopped; attempt += 1) {
      try {
        const response = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(1000) });
        if (response.ok) { ready = true; break; }
      } catch { /* Wait for the test-only production server. */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, "Build apps/platform with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 before running this suite. Server output: " + logs);
  }
  browser = await chromium.launch({ headless: true, args: ["--explicitly-allowed-ports=9"] });
});
after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    const timer = setTimeout(() => server.kill("SIGKILL"), 5000);
    await serverStopped;
    clearTimeout(timer);
  }
});

function session(userId = id(1), aal = "aal2") {
  const payload = Buffer.from(JSON.stringify({ sub: userId, aal, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return {
    access_token: `e30.${payload}.fixture`, refresh_token: "local-fixture-refresh", token_type: "bearer",
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, email: "founder@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
  };
}

async function fixture(t, { viewerRole = "founder", aal = "aal2", inactive = false, failWrite = 0, reloadFailure = false, holdWrite = false } = {}) {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey, value: JSON.stringify(session(id(1), aal)),
  });
  const operators = roles.map((role, index) => ({
    user_id: id(index + 1), role: index === 0 ? viewerRole : role, display_name: `${role} operator`,
    email: `${role}@example.test`, username: null, is_active: !(inactive && index === 3),
    mfa_required: true, last_login_at: null, created_at: "2026-01-01T00:00:00Z", override_count: 0,
  }));
  const catalog = permissions.map((key, index) => ({
    permission_key: key, category: "Fixture controls", label: labels[index],
    description: "Local fixture permission.", is_sensitive: index === 1, is_active: true, metadata: {},
  }));
  const defaults = roles.flatMap((role) => [
    { role, permission_key: permissions[0], is_allowed: role !== "founder", metadata: {} },
    { role, permission_key: permissions[1], is_allowed: false, metadata: {} },
  ]);
  const overrides = new Map();
  const writes = [];
  let loads = 0;
  let releaseWrite;
  const held = new Promise((resolve) => { releaseWrite = resolve; });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.origin !== authOrigin) return route.abort();
    let body = {};
    let status = 200;
    const path = url.pathname;
    const projection = url.searchParams.get("select");
    if (path.endsWith("/user")) body = session().user;
    else if (path.endsWith("/platform_list_operator_accounts")) {
      loads += 1;
      status = reloadFailure && writes.length > 0 ? 503 : 200;
      body = status === 200 ? operators : { message: "private fixture failure" };
    } else if (path.includes("/rpc/platform_set_operator_permission_override") || path.includes("/rpc/platform_clear_operator_permission_override")) {
      const input = request.postDataJSON();
      writes.push(input);
      if (holdWrite) await held;
      if (writes.length === failWrite) {
        status = 503; body = { message: "private write failure" };
      } else if (path.includes("clear_operator")) {
        overrides.delete(input.p_permission_key);
        body = { userId: input.p_user_id, permissionKey: input.p_permission_key, cleared: true };
      } else {
        overrides.set(input.p_permission_key, { user_id: input.p_user_id, permission_key: input.p_permission_key, is_allowed: input.p_is_allowed, reason: input.p_reason });
        body = { userId: input.p_user_id, permissionKey: input.p_permission_key, isAllowed: input.p_is_allowed };
      }
    } else if (path.endsWith("/platform_operator_accounts")) {
      body = projection === "role,is_active" ? { role: viewerRole, is_active: true } : operators;
    } else if (path.endsWith("/platform_permission_catalog")) body = catalog;
    else if (path.endsWith("/platform_role_permissions")) body = defaults;
    else if (path.endsWith("/platform_operator_permission_overrides")) {
      const key = url.searchParams.get("permission_key");
      const rows = [...overrides.values()].filter((row) => !key?.startsWith("eq.") || row.permission_key === key.slice(3));
      body = request.headers().accept?.includes("application/vnd.pgrst.object+json") ? rows[0] ?? null : rows;
    }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(`${origin}/operators`);
  await page.getByRole("button", { name: "compliance_admin operator", exact: false }).waitFor();
  const open = async (role = "compliance_admin") => {
    await page.getByRole("button", { name: `${role} operator`, exact: false }).click();
    await page.getByRole("dialog").waitFor();
    return page.getByRole("dialog");
  };
  return { page, context, writes, open, overrides, releaseWrite, get loads() { return loads; } };
}

async function review(dialog, count = 1) {
  await dialog.getByLabel("Reason for changes").fill("Fixture-only access review");
  await dialog.getByRole("button", { name: `Review ${count} changes`, exact: true }).click();
  await dialog.getByRole("checkbox").check();
}

test("all six exact roles and actual catalog defaults remain distinct; founder is not assumed full", async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await f.page.getByLabel("Built-in role", { exact: true }).locator("option").evaluateAll((options) => options.map((option) => option.value)), ["all", ...roles]);
  await f.page.getByText("Built-in role defaults", { exact: true }).click();
  await f.page.getByLabel("Inspect built-in role").selectOption("founder");
  const defaults = f.page.locator("details li");
  assert.match(await defaults.nth(0).innerText(), /Deny/);
  assert.match(await defaults.nth(2).innerText(), /Not configured/);
  const dialog = await f.open("founder");
  assert.match(await dialog.innerText(), /immutable/);
  assert.match(await dialog.innerText(), /MFA policy/);
  assert.match(await dialog.innerText(), /not enrollment status/);
  assert.equal(await dialog.getByLabel("Override for View fixture", { exact: true }).isDisabled(), true);
  assert.equal(f.writes.length, 0);
});

test("review and reason precede submission; close protects drafts and restores trigger focus", async (t) => {
  const f = await fixture(t);
  const dialog = await f.open();
  await dialog.getByLabel("Override for Edit fixture", { exact: true }).selectOption("allow");
  assert.equal(await dialog.getByRole("button", { name: "Review 1 changes", exact: true }).isDisabled(), true);
  await f.page.keyboard.press("Escape");
  await dialog.getByRole("heading", { name: "Discard unsaved changes?" }).waitFor();
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  assert.equal(await dialog.getByLabel("Override for Edit fixture", { exact: true }).inputValue(), "allow");
  await review(dialog);
  assert.equal(f.writes.length, 0);
  await dialog.getByRole("button", { name: "Confirm permission changes" }).click();
  await f.page.getByRole("status").filter({ hasText: "1 confirmed; 0 unconfirmed" }).first().waitFor();
  await dialog.getByLabel("Override for Edit fixture", { exact: true }).waitFor();
  assert.equal(await dialog.getByLabel("Override for Edit fixture", { exact: true }).inputValue(), "allow");
  assert.equal(f.writes.length, 1);
  assert.ok(f.loads >= 2);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  assert.equal(await f.page.getByRole("dialog").count(), 0);
  assert.equal(await f.page.evaluate(() => document.activeElement?.textContent?.includes("compliance_admin operator")), true);
});

test("partial outcomes clear all drafts and show confirmed and unknown counts after authoritative reload", async (t) => {
  const f = await fixture(t, { failWrite: 2 });
  const dialog = await f.open();
  await dialog.getByLabel("Override for Edit fixture", { exact: true }).selectOption("allow");
  await dialog.getByLabel("Override for Export fixture", { exact: true }).selectOption("allow");
  await review(dialog, 2);
  await dialog.getByRole("button", { name: "Confirm permission changes" }).click();
  await dialog.getByRole("status").filter({ hasText: "1 confirmed; 1 unconfirmed" }).waitFor();
  assert.equal(await dialog.getByLabel("Override for Edit fixture", { exact: true }).inputValue(), "allow");
  assert.equal(await dialog.getByLabel("Override for Export fixture", { exact: true }).inputValue(), "inherit");
  assert.equal(await dialog.getByLabel("Reason for changes").inputValue(), "");
  assert.equal(await dialog.getByText("Unsaved change", { exact: true }).count(), 0);
  assert.equal(f.writes.length, 2);
});

test("unknown outcomes are not successful saves; MFA recovery is actionable", async (t) => {
  const f = await fixture(t, { failWrite: 1 });
  const dialog = await f.open();
  await dialog.getByLabel("Override for Edit fixture", { exact: true }).selectOption("allow");
  await review(dialog);
  await dialog.getByRole("button", { name: "Confirm permission changes" }).click();
  await dialog.getByRole("status").filter({ hasText: "0 confirmed; 1 unconfirmed" }).waitFor();
  assert.match(await dialog.innerText(), /required MFA/);
  assert.equal(await dialog.getByLabel("Reason for changes").inputValue(), "");
  assert.ok(f.loads >= 2);
});

test("MFA prevalidation error stays visible inside the modal and retains the unsent draft", async (t) => {
  const f = await fixture(t, { aal: "aal1" });
  const dialog = await f.open();
  await dialog.getByLabel("Override for Edit fixture", { exact: true }).selectOption("allow");
  await review(dialog);
  await dialog.getByRole("button", { name: "Confirm permission changes" }).click();
  await dialog.getByRole("alert").waitFor();
  assert.match(await dialog.getByRole("alert").innerText(), /MFA|verification|factor/i);
  assert.equal(await dialog.getByLabel("Override for Edit fixture", { exact: true }).inputValue(), "allow");
  assert.equal(f.writes.length, 0);
});

test("post-write reload failure preserves mutation counts without claiming mutation failure or stale access", async (t) => {
  const f = await fixture(t, { reloadFailure: true });
  const dialog = await f.open();
  await dialog.getByLabel("Override for Edit fixture", { exact: true }).selectOption("allow");
  await review(dialog);
  await dialog.getByRole("button", { name: "Confirm permission changes" }).click();
  await f.page.getByRole("status").filter({ hasText: "Authoritative reload failed" }).waitFor();
  assert.match(await f.page.getByRole("status").innerText(), /1 confirmed; 0 unconfirmed/);
  assert.equal(await f.page.getByRole("dialog").count(), 0);
  assert.equal(await f.page.getByText("No verified snapshot available.", { exact: false }).count(), 1);
  assert.equal(f.writes.length, 1);
});

test("inactive operator remains denied and non-founder viewer has read-only overrides", async (t) => {
  const f = await fixture(t, { inactive: true, viewerRole: "analyst" });
  const dialog = await f.open();
  assert.match(await dialog.innerText(), /effective access is denied/);
  assert.equal(await dialog.getByLabel("Override for View fixture", { exact: true }).isDisabled(), true);
  assert.equal(await dialog.getByLabel("Reason for changes").count(), 0);
  assert.equal(f.writes.length, 0);
});

test("busy guard prevents duplicate submission and dismissal while RPC is pending", async (t) => {
  const f = await fixture(t, { holdWrite: true });
  t.after(f.releaseWrite);
  const dialog = await f.open();
  await dialog.getByLabel("Override for Edit fixture", { exact: true }).selectOption("allow");
  await review(dialog);
  await dialog.getByRole("button", { name: "Confirm permission changes" }).evaluate((button) => { button.click(); button.click(); });
  await f.page.waitForFunction(() => document.querySelector("dialog[open] button")?.disabled);
  await f.page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), true);
  await assertEventually(() => f.writes.length === 1);
  f.releaseWrite();
  await dialog.getByRole("status").filter({ hasText: "1 confirmed; 0 unconfirmed" }).waitFor();
  assert.equal(f.writes.length, 1);
});

async function assertEventually(predicate) {
  for (let i = 0; i < 100; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(predicate());
}

test("late write completion cannot restore a signed-out viewer's editor or success", async (t) => {
  const f = await fixture(t, { holdWrite: true });
  t.after(f.releaseWrite);
  const dialog = await f.open();
  await dialog.getByLabel("Override for Edit fixture", { exact: true }).selectOption("allow");
  await review(dialog);
  await dialog.getByRole("button", { name: "Confirm permission changes" }).click();
  await assertEventually(() => f.writes.length === 1);
  await f.page.evaluate(async () => {
    const clients = window.__kruxtPlatformSupabaseBrowserClients;
    await [...clients.values()][0].auth.signOut({ scope: "local" });
  });
  await f.page.waitForURL("**/login");
  f.releaseWrite();
  await f.page.getByRole("button", { name: "Sign in to platform" }).waitFor();
  assert.equal(await f.page.getByRole("dialog").count(), 0);
  assert.equal(await f.page.getByText("1 confirmed; 0 unconfirmed", { exact: false }).count(), 0);
});

test("draft allow never gives an inactive operator effective access", async (t) => {
  const f = await fixture(t, { inactive: true });
  const dialog = await f.open();
  await dialog.getByLabel("Override for Edit fixture", { exact: true }).selectOption("allow");
  const row = dialog.locator("li").filter({ has: f.page.getByRole("heading", { name: "Edit fixture", exact: true }) });
  assert.match(await row.innerText(), /Effective preview: Deny \(inactive\)/);
  assert.equal(f.writes.length, 0);
});

test("desktop and mobile editor fit; keyboard focus stays in the modal", async (t) => {
  const f = await fixture(t);
  for (const width of [1280, 390, 320]) {
    await f.page.setViewportSize({ width, height: 844 });
    const dialog = await f.open();
    await f.page.keyboard.press("Shift+Tab");
    assert.equal(await f.page.evaluate(() => document.querySelector("dialog[open]")?.contains(document.activeElement)), true);
    assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
    if (process.env.PLATFORM_SCREENSHOT_DIR) await f.page.screenshot({ path: `${process.env.PLATFORM_SCREENSHOT_DIR}/operator-editor-${width}.png` });
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
  }
});
