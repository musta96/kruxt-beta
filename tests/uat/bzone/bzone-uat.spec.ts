import { expect, test, type Locator, type Page, type Response } from "@playwright/test";

import {
  appUrl,
  assertAdminGymIdentity,
  assertAdminIdentity,
  assertConfiguredEmailsAreDistinct,
  assertDeployedSupabaseRuntime,
  assertMemberProfileIdentity,
  openRouteWithHeading,
  requireExactEnv,
  requireMutationOptIn,
  requireRoleCredentials,
  signInAdmin,
  signInMember,
  signInPlatform,
  uatSettings,
} from "./support";

type JsonRecord = Record<string, unknown>;

function captureJsonResponses(page: Page, matches: (response: Response) => boolean): unknown[] {
  const payloads: unknown[] = [];
  page.on("response", (response) => {
    if (!matches(response)) return;
    void response
      .json()
      .then((payload: unknown) => payloads.push(payload))
      .catch(() => undefined);
  });
  return payloads;
}

function rowsFrom(payloads: unknown[]): JsonRecord[] {
  return payloads.flatMap((payload) => {
    if (Array.isArray(payload)) return payload.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object");
    return [];
  });
}

function supabasePath(response: Response, pathname: string): boolean {
  try {
    return new URL(response.url()).pathname === pathname;
  } catch {
    return false;
  }
}

async function exactBzoneTenantRow(page: Page): Promise<Locator> {
  const targets = requireExactEnv(
    ["KRUXT_UAT_GYM_ID", "KRUXT_UAT_GYM_SLUG"],
    "Exact BZone tenant selection",
  );
  await page.getByPlaceholder("Search gyms...").fill(targets.KRUXT_UAT_GYM_SLUG);
  const row = page.getByRole("row").filter({
    has: page.getByText(targets.KRUXT_UAT_GYM_SLUG, { exact: true }),
  });
  await expect(row, "The exact UAT gym slug must resolve to one tenant row.").toHaveCount(1);

  await row.getByRole("button", { name: "Features", exact: true }).click();
  const drawer = page.locator("section").filter({
    has: page.getByRole("heading", { name: uatSettings.gymName, exact: true }),
  });
  await expect(drawer.getByText(targets.KRUXT_UAT_GYM_ID, { exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: "Close", exact: true }).click();
  return row;
}

test("public route smoke proves deployed Supabase refs and login gates without credentials", async ({ page }) => {
  assertConfiguredEmailsAreDistinct();

  await assertDeployedSupabaseRuntime(page, uatSettings.webUrl, "member web");
  await expect(page.getByRole("heading", { name: "KRUXT", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Member login", exact: true })).toBeVisible();

  await assertDeployedSupabaseRuntime(page, appUrl(uatSettings.adminUrl, "/members"), "gym admin");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByText("Admin Dashboard", { exact: true })).toBeVisible();

  await assertDeployedSupabaseRuntime(page, uatSettings.platformUrl, "platform");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Super-admin control plane", { exact: true })).toBeVisible();

  await page.goto(appUrl(uatSettings.webUrl, "/join"), { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Join a gym on KRUXT", exact: true })).toBeVisible();
  await expect(page.getByLabel("Invite code", { exact: true })).toBeVisible();
});

test.describe("platform admin account", () => {
  test("displays the exact operator identity/role and exact BZone tenant", async ({ page }) => {
    const credentials = requireRoleCredentials("platform");
    const targets = requireExactEnv(
      ["KRUXT_UAT_PLATFORM_EXPECTED_ROLE", "KRUXT_UAT_GYM_ID", "KRUXT_UAT_GYM_SLUG"],
      "Platform identity and tenant assertions",
    );
    await signInPlatform(page, credentials);

    const topBar = page.locator("header");
    await expect(topBar.getByText(credentials.email, { exact: true })).toBeVisible();
    await expect(topBar.getByText(targets.KRUXT_UAT_PLATFORM_EXPECTED_ROLE, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();

    await openRouteWithHeading(page, uatSettings.platformUrl, "/tenants", "Gym Tenants");
    const row = await exactBzoneTenantRow(page);
    await expect(row.getByRole("button", { name: "Features", exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Open Admin", exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Invite Profile", exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Preview", exact: true })).toBeVisible();
  });

  test("can open only the exact BZone admin workspace through the gated handoff", async ({ page }) => {
    const credentials = requireRoleCredentials("platform");
    requireMutationOptIn();
    await signInPlatform(page, credentials);
    await openRouteWithHeading(page, uatSettings.platformUrl, "/tenants", "Gym Tenants");
    const row = await exactBzoneTenantRow(page);

    await row.getByRole("button", { name: "Open Admin", exact: true }).click();
    await page.waitForURL((url) => url.origin === new URL(uatSettings.adminUrl).origin, { timeout: 45_000 });
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await assertAdminGymIdentity(page);
    await assertAdminIdentity(page, credentials.email);
  });
});

test.describe("BZone owner/admin account", () => {
  test("displays the owner identity/role and reaches core route-smoke surfaces", async ({ page }) => {
    const credentials = requireRoleCredentials("owner");
    await signInAdmin(page, credentials, "/members");

    await expect(page.getByRole("heading", { name: "Members", exact: true })).toBeVisible();
    await assertAdminGymIdentity(page);
    await assertAdminIdentity(page, credentials.email);
    await expect(page.getByRole("button", { name: "+ Add Existing", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pending Gym Access", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Invite Link / QR", exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Search members, PTs, plans...")).toBeVisible();

    await openRouteWithHeading(page, uatSettings.adminUrl, "/staff", "Staff");
    await expect(page.getByRole("heading", { name: "Create Shift", exact: true })).toBeVisible();

    await openRouteWithHeading(page, uatSettings.adminUrl, "/classes", "Classes");
    await expect(page.getByRole("button", { name: "+ Create Class", exact: true })).toBeVisible();

    await openRouteWithHeading(page, uatSettings.adminUrl, "/checkins", "Check-ins");
    await expect(page.getByRole("heading", { name: "Live Feed", exact: true })).toBeVisible();

    await openRouteWithHeading(page, uatSettings.adminUrl, "/waivers", "Waivers & Contracts");
    await expect(page.getByRole("button", { name: "New Template", exact: true })).toBeVisible();

    await openRouteWithHeading(page, uatSettings.adminUrl, "/billing", "Billing");
    await expect(page.getByRole("heading", { name: "Member Payment Instructions", exact: true })).toBeVisible();

    await openRouteWithHeading(page, uatSettings.adminUrl, "/compliance", "Compliance");
    await openRouteWithHeading(page, uatSettings.adminUrl, "/support", "Support");

    await signInMember(page, credentials);
    await assertMemberProfileIdentity(page, credentials.email, "Gym staff");
  });

  test("mutates only the exact active disposable membership and verifies the RPC body", async ({ page }) => {
    const credentials = requireRoleCredentials("owner");
    const targets = requireMutationOptIn();
    const membershipPayloads = captureJsonResponses(page, (response) =>
      supabasePath(response, "/rest/v1/gym_memberships"),
    );
    const profilePayloads = captureJsonResponses(page, (response) =>
      supabasePath(response, "/rest/v1/profiles"),
    );

    await signInAdmin(page, credentials, "/members");
    await expect(page.getByRole("heading", { name: "Members", exact: true })).toBeVisible();
    await assertAdminGymIdentity(page);
    await assertAdminIdentity(page, credentials.email);

    const exactMembership = () => rowsFrom(membershipPayloads).find((row) =>
      row.id === targets.KRUXT_UAT_BULK_MEMBERSHIP_ID &&
      row.user_id === targets.KRUXT_UAT_BULK_USER_ID &&
      row.gym_id === targets.KRUXT_UAT_GYM_ID &&
      row.membership_status === targets.KRUXT_UAT_BULK_EXPECTED_STATUS &&
      row.role === targets.KRUXT_UAT_BULK_EXPECTED_ROLE,
    );
    await expect.poll(exactMembership, {
      message: "The loaded directory must contain the exact disposable membership UUID/user UUID/gym/status/role.",
    }).toBeTruthy();

    const exactProfile = () => rowsFrom(profilePayloads).find((row) => row.id === targets.KRUXT_UAT_BULK_USER_ID);
    await expect.poll(exactProfile, {
      message: "The loaded profile response must contain the exact disposable user UUID.",
    }).toBeTruthy();
    const profile = exactProfile()!;
    const displayName = typeof profile.display_name === "string" ? profile.display_name.trim() : "Unnamed member";
    const username = typeof profile.username === "string" ? profile.username.trim() : "";
    const renderedLabel = username ? `${displayName} (@${username})` : displayName;
    expect(renderedLabel, "The exact UUID-backed profile must match the configured disposable marker.").toBe(
      targets.KRUXT_UAT_BULK_MEMBER_MARKER,
    );

    await page.getByPlaceholder("Search members, PTs, plans...").fill(targets.KRUXT_UAT_BULK_MEMBER_MARKER);
    const memberRow = page.getByRole("row").filter({
      has: page.getByText(targets.KRUXT_UAT_BULK_MEMBER_MARKER, { exact: true }),
    });
    await expect(memberRow, "No first-result fallback is permitted for mutation targets.").toHaveCount(1);
    await expect(memberRow.getByText(targets.KRUXT_UAT_BULK_EXPECTED_ROLE, { exact: true })).toBeVisible();
    await expect(memberRow.getByText(targets.KRUXT_UAT_BULK_EXPECTED_STATUS, { exact: true })).toBeVisible();
    await memberRow
      .getByRole("checkbox", { name: `Select ${targets.KRUXT_UAT_BULK_MEMBER_MARKER}`, exact: true })
      .check();
    await page.getByRole("button", { name: "Bulk update", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Update 1 member", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.locator("select").selectOption(`status:${targets.KRUXT_UAT_BULK_EXPECTED_STATUS}`);
    await dialog.getByPlaceholder("Why this access or role change is being made").fill(
      "Issue #96 route-smoke UAT: exact disposable membership active-status verification",
    );

    let intercepted = false;
    let rejectedRequest: string | undefined;
    await page.route("**/rest/v1/rpc/bulk_update_gym_memberships", async (route) => {
      const body = route.request().postDataJSON() as JsonRecord;
      const ids = Array.isArray(body.p_membership_ids) ? body.p_membership_ids : [];
      const exact =
        body.p_gym_id === targets.KRUXT_UAT_GYM_ID &&
        ids.length === 1 &&
        ids[0] === targets.KRUXT_UAT_BULK_MEMBERSHIP_ID &&
        body.p_membership_status === targets.KRUXT_UAT_BULK_EXPECTED_STATUS &&
        body.p_role === null;
      intercepted = true;
      if (!exact) {
        rejectedRequest = "Blocked a bulk RPC whose exact gym, membership, status, or role did not match the UAT target.";
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });

    await dialog.getByRole("button", { name: "Apply update", exact: true }).click();
    await expect.poll(() => intercepted, { message: "Expected the guarded bulk RPC request." }).toBe(true);
    if (rejectedRequest) throw new Error(rejectedRequest);
    await expect(dialog.getByText("1 succeeded / 0 failed", { exact: true })).toBeVisible();
  });
});

test.describe("BZone PT/staff account", () => {
  test("proves the exact assignment, displayed staff role, and owner-action denial", async ({ page }) => {
    const credentials = requireRoleCredentials("staff");
    const targets = requireExactEnv(
      [
        "KRUXT_UAT_ASSIGNED_MEMBERSHIP_ID",
        "KRUXT_UAT_ASSIGNED_MEMBER_USER_ID",
        "KRUXT_UAT_ASSIGNED_MEMBER_MARKER",
        "KRUXT_UAT_ASSIGNED_EXPECTED_STATUS",
      ],
      "Exact PT assignment",
    );
    const athletePayloads = captureJsonResponses(page, (response) =>
      supabasePath(response, "/rest/v1/rpc/coach_list_my_athletes"),
    );

    await signInAdmin(page, credentials, "/coaching");
    await expect(page.getByRole("heading", { name: "Coaching", exact: true })).toBeVisible();
    await assertAdminGymIdentity(page);
    await assertAdminIdentity(page, credentials.email);
    await expect(page.getByRole("heading", { name: "My athletes", exact: true })).toBeVisible();

    const exactAthlete = () => rowsFrom(athletePayloads).find((row) =>
      row.membership_id === targets.KRUXT_UAT_ASSIGNED_MEMBERSHIP_ID &&
      row.member_user_id === targets.KRUXT_UAT_ASSIGNED_MEMBER_USER_ID &&
      row.membership_status === targets.KRUXT_UAT_ASSIGNED_EXPECTED_STATUS,
    );
    await expect.poll(exactAthlete, {
      message: "The coaching RPC must return the exact assigned membership/user/status target.",
    }).toBeTruthy();
    const athlete = exactAthlete()!;
    const renderedMarkers = [
      typeof athlete.display_name === "string" ? athlete.display_name : undefined,
      typeof athlete.username === "string" ? `@${athlete.username}` : undefined,
    ].filter(Boolean);
    expect(renderedMarkers).toContain(targets.KRUXT_UAT_ASSIGNED_MEMBER_MARKER);

    const roster = page.locator("aside").filter({
      has: page.getByRole("heading", { name: "My athletes", exact: true }),
    });
    const athleteButton = roster.getByRole("button").filter({
      has: page.getByText(targets.KRUXT_UAT_ASSIGNED_MEMBER_MARKER, { exact: true }),
    });
    await expect(athleteButton).toHaveCount(1);
    await expect(
      athleteButton.getByText(targets.KRUXT_UAT_ASSIGNED_EXPECTED_STATUS, { exact: true }),
    ).toBeVisible();

    await openRouteWithHeading(page, uatSettings.adminUrl, "/classes", "Classes");
    await openRouteWithHeading(page, uatSettings.adminUrl, "/checkins", "Check-ins");
    await openRouteWithHeading(page, uatSettings.adminUrl, "/members", "Members");
    await expect(
      page.getByRole("button", { name: "+ Add Existing", exact: true }),
      "A PT/staff account must not receive the owner-only existing-member action.",
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Create profile & invite", exact: true }),
      "A PT/staff account must not receive the owner-only profile invitation form.",
    ).toHaveCount(0);

    await signInMember(page, credentials);
    await assertMemberProfileIdentity(page, credentials.email, "Gym staff");
  });
});

test("normal member displays the exact identity/role and traverses member route smoke", async ({ page }) => {
  const credentials = requireRoleCredentials("member");
  await signInMember(page, credentials);

  await openRouteWithHeading(page, uatSettings.webUrl, "/plan", "Plan");
  await openRouteWithHeading(page, uatSettings.webUrl, "/feed", "Proof Feed");
  await expect(page.getByRole("link", { name: "Log workout", exact: true })).toBeVisible();

  await openRouteWithHeading(page, uatSettings.webUrl, "/gyms", "Gyms");
  await page.getByPlaceholder("Search by gym name, city, or description").fill(uatSettings.gymName);
  await expect(page.getByText(uatSettings.gymName, { exact: true }).first()).toBeVisible();

  await openRouteWithHeading(page, uatSettings.webUrl, "/guild", "Guild Hall");
  await expect(page.getByText(uatSettings.gymName, { exact: true }).first()).toBeVisible();

  await openRouteWithHeading(page, uatSettings.webUrl, "/rank", "Rank Ladder");
  await assertMemberProfileIdentity(page, credentials.email, "Member");
  const memberships = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Linked memberships", exact: true }),
  });
  const bzoneMembership = memberships.locator("li").filter({
    has: page.getByText(uatSettings.gymName, { exact: true }),
  });
  await expect(bzoneMembership).toHaveCount(1);
  await expect(bzoneMembership.getByText("member · active", { exact: true })).toBeVisible();

  await page.goto(appUrl(uatSettings.webUrl, "/join"), { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Join a gym on KRUXT", exact: true })).toBeVisible();
  const signedInBanner = page.locator("p").filter({ hasText: "Signed in as" });
  await expect(signedInBanner.getByText(credentials.email, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Invite code", { exact: true })).toBeVisible();
});
