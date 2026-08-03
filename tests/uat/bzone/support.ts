import { expect, test, type Page, type Response } from "@playwright/test";

export type UatRole = "platform" | "owner" | "staff" | "member";

export interface Credentials {
  email: string;
  password: string;
}

const ROLE_ENV: Record<UatRole, readonly [string, string]> = {
  platform: ["KRUXT_UAT_PLATFORM_EMAIL", "KRUXT_UAT_PLATFORM_PASSWORD"],
  owner: ["KRUXT_UAT_OWNER_EMAIL", "KRUXT_UAT_OWNER_PASSWORD"],
  staff: ["KRUXT_UAT_STAFF_EMAIL", "KRUXT_UAT_STAFF_PASSWORD"],
  member: ["KRUXT_UAT_MEMBER_EMAIL", "KRUXT_UAT_MEMBER_PASSWORD"],
};

export const CANONICAL_SUPABASE_REF = "hgomsmhsybrxjdxbgkjy";
export const PRODUCTION_CONFIRMATION = "I_CONFIRM_DISPOSABLE_PRODUCTION_UAT";
export const EXACT_BULK_TARGET_ENV = [
  "KRUXT_UAT_GYM_ID",
  "KRUXT_UAT_GYM_SLUG",
  "KRUXT_UAT_BULK_MEMBERSHIP_ID",
  "KRUXT_UAT_BULK_USER_ID",
  "KRUXT_UAT_BULK_MEMBER_MARKER",
  "KRUXT_UAT_BULK_EXPECTED_STATUS",
  "KRUXT_UAT_BULK_EXPECTED_ROLE",
] as const;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const disposableMarkerPattern = /(\.test\b|uat)/i;

function configuredUrl(name: string, fallback: string): string {
  const value = process.env[name]?.trim() || fallback;
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must use http or https.`);
  }
  return url.toString().replace(/\/$/, "");
}

function enabled(name: string): boolean {
  return /^(1|true|yes)$/i.test(process.env[name]?.trim() ?? "");
}

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function isProductionLike(baseUrl: string): boolean {
  const url = new URL(baseUrl);
  return !new Set(["localhost", "127.0.0.1", "::1"]).has(url.hostname);
}

export const uatSettings = {
  platformUrl: configuredUrl("KRUXT_UAT_PLATFORM_URL", "https://kruxt-platform.vercel.app"),
  adminUrl: configuredUrl("KRUXT_UAT_ADMIN_URL", "https://kruxt-admin.vercel.app"),
  webUrl: configuredUrl("KRUXT_UAT_WEB_URL", "https://kruxt-beta.vercel.app"),
  gymName: env("KRUXT_UAT_GYM_NAME") || "BZone Fitness",
  gymId: env("KRUXT_UAT_GYM_ID"),
  gymSlug: env("KRUXT_UAT_GYM_SLUG"),
  allowMutations: enabled("KRUXT_UAT_ALLOW_MUTATIONS"),
};

export function appUrl(baseUrl: string, pathname: string): string {
  return new URL(pathname, `${baseUrl}/`).toString();
}

export function requireRoleCredentials(role: UatRole): Credentials {
  const [emailName, passwordName] = ROLE_ENV[role];
  const email = env(emailName);
  const password = process.env[passwordName];
  const missing = [email ? null : emailName, password ? null : passwordName].filter(Boolean) as string[];

  test.skip(
    missing.length > 0,
    `Missing ${missing.join(", ")}. Set the ${role} UAT account variables; see tests/uat/bzone/README.md.`,
  );

  if (!email || !password) {
    throw new Error(`Missing ${role} credentials after readiness check.`);
  }

  return { email, password };
}

export function requireExactEnv(names: readonly string[], purpose: string): Record<string, string> {
  const missing = names.filter((name) => !env(name));
  test.skip(
    missing.length > 0,
    `${purpose} requires exact target variables: ${missing.join(", ")}. See tests/uat/bzone/README.md.`,
  );

  return Object.fromEntries(names.map((name) => [name, env(name)!]));
}

export function requireMutationOptIn(): Record<string, string> {
  const values = requireExactEnv(EXACT_BULK_TARGET_ENV, "State-changing UAT");
  const reasons: string[] = [];

  if (!uatSettings.allowMutations) reasons.push("set KRUXT_UAT_ALLOW_MUTATIONS=1");
  if (
    [uatSettings.platformUrl, uatSettings.adminUrl, uatSettings.webUrl].some(isProductionLike) &&
    env("KRUXT_UAT_PRODUCTION_CONFIRMATION") !== PRODUCTION_CONFIRMATION
  ) {
    reasons.push(`set KRUXT_UAT_PRODUCTION_CONFIRMATION=${PRODUCTION_CONFIRMATION}`);
  }

  test.skip(
    reasons.length > 0,
    `State-changing UAT is disabled: ${reasons.join(" and ")}. Use only exact disposable BZone UAT records.`,
  );

  for (const name of ["KRUXT_UAT_GYM_ID", "KRUXT_UAT_BULK_MEMBERSHIP_ID", "KRUXT_UAT_BULK_USER_ID"]) {
    if (!uuidPattern.test(values[name])) throw new Error(`${name} must be an exact UUID.`);
  }
  if (!disposableMarkerPattern.test(values.KRUXT_UAT_BULK_MEMBER_MARKER)) {
    throw new Error("KRUXT_UAT_BULK_MEMBER_MARKER must contain an explicit .test or UAT marker.");
  }
  if (values.KRUXT_UAT_BULK_EXPECTED_STATUS !== "active") {
    throw new Error("KRUXT_UAT_BULK_EXPECTED_STATUS must be active for an idempotent mutation.");
  }
  if (values.KRUXT_UAT_BULK_EXPECTED_ROLE !== "member") {
    throw new Error("KRUXT_UAT_BULK_EXPECTED_ROLE must be member for the disposable target.");
  }

  return values;
}

export function assertConfiguredEmailsAreDistinct(): void {
  const configured = Object.entries(ROLE_ENV)
    .map(([role, [emailName]]) => ({ role, emailName, email: env(emailName)?.toLowerCase() }))
    .filter((item): item is { role: string; emailName: string; email: string } => Boolean(item.email));
  const duplicateVariables = configured
    .filter((item, index) => configured.findIndex((candidate) => candidate.email === item.email) !== index)
    .map((item) => item.emailName);

  expect(
    duplicateVariables,
    `Four-account UAT requires distinct emails; duplicate variables: ${duplicateVariables.join(", ")}`,
  ).toEqual([]);
}

function refsFromText(text: string): string[] {
  return [...text.matchAll(/https:\/\/([a-z0-9]+)\.supabase\.co/gi)].map((match) => match[1]);
}

function refFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1];
  } catch {
    return undefined;
  }
}

export async function assertDeployedSupabaseRuntime(
  page: Page,
  baseUrl: string,
  surface: string,
): Promise<void> {
  const observed = new Map<string, Set<string>>();
  const scriptReads: Promise<void>[] = [];
  const record = (ref: string | undefined, source: string) => {
    if (!ref) return;
    const sources = observed.get(ref) ?? new Set<string>();
    sources.add(source);
    observed.set(ref, sources);
  };

  const onResponse = (response: Response) => {
    record(refFromUrl(response.url()), "request host");
    if (response.request().resourceType() === "script") {
      scriptReads.push(
        response
          .text()
          .then((body) => refsFromText(body).forEach((ref) => record(ref, "loaded runtime bundle")))
          .catch(() => undefined),
      );
    }
  };

  page.on("response", onResponse);
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await Promise.allSettled(scriptReads);
  } finally {
    page.off("response", onResponse);
  }

  const refs = [...observed.keys()].sort();
  expect(
    refs,
    `${surface} exposed no Supabase project ref in a request host or loaded runtime bundle.`,
  ).toContain(CANONICAL_SUPABASE_REF);
  expect(
    refs.filter((ref) => ref !== CANONICAL_SUPABASE_REF),
    `${surface} runtime referenced a non-canonical Supabase project.`,
  ).toEqual([]);

  const sources = [...(observed.get(CANONICAL_SUPABASE_REF) ?? [])].join(" + ");
  console.log(`[UAT runtime evidence] ${surface}: ${CANONICAL_SUPABASE_REF} via ${sources}`);
}

async function signInFailure(page: Page, surface: string): Promise<Error> {
  const messages = await page.locator(".text-kruxt-danger, [role='alert']").allTextContents();
  const detail = messages.map((message) => message.trim()).filter(Boolean).join(" ");
  return new Error(
    detail
      ? `${surface} sign-in failed: ${detail}`
      : `${surface} sign-in did not leave /login. Verify the account, password, role, and shared Supabase environment.`,
  );
}

function assertCanonicalAuthRequest(requestUrl: string, surface: string): void {
  const ref = refFromUrl(requestUrl);
  expect(ref, `${surface} password sign-in must call the canonical Supabase project.`).toBe(CANONICAL_SUPABASE_REF);
}

async function signInDedicatedApp(
  page: Page,
  baseUrl: string,
  credentials: Credentials,
  nextPath: string,
  surface: string,
): Promise<void> {
  const loginPath = `/login?next=${encodeURIComponent(nextPath)}`;
  await page.goto(appUrl(baseUrl, loginPath), { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  const authRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname.startsWith("/auth/v1/token"),
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  let authRequestUrl = "";
  try {
    const request = await authRequest;
    authRequestUrl = request.url();
    await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
  } catch {
    throw await signInFailure(page, surface);
  }
  assertCanonicalAuthRequest(authRequestUrl, surface);
}

export async function signInPlatform(page: Page, credentials: Credentials): Promise<void> {
  await signInDedicatedApp(page, uatSettings.platformUrl, credentials, "/", "Platform");
}

export async function signInAdmin(
  page: Page,
  credentials: Credentials,
  nextPath = "/",
): Promise<void> {
  await signInDedicatedApp(page, uatSettings.adminUrl, credentials, nextPath, "Gym admin");
}

export async function signInMember(page: Page, credentials: Credentials): Promise<void> {
  await page.goto(uatSettings.webUrl, { waitUntil: "domcontentloaded" });
  const form = page.locator("#member-login form");
  await form.getByLabel("Email", { exact: true }).fill(credentials.email);
  await form.getByLabel("Password", { exact: true }).fill(credentials.password);
  const authRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname.startsWith("/auth/v1/token"),
    { timeout: 30_000 },
  );
  await form.getByRole("button", { name: "Sign in", exact: true }).click();

  let authRequestUrl = "";
  try {
    const request = await authRequest;
    authRequestUrl = request.url();
    await page.waitForURL((url) => url.pathname !== "/", { timeout: 30_000 });
  } catch {
    throw await signInFailure(page, "Member web");
  }
  assertCanonicalAuthRequest(authRequestUrl, "Member web");
}

export async function assertAdminIdentity(page: Page, email: string): Promise<void> {
  const accountButton = page.getByRole("button", { name: "Account menu", exact: true });
  await accountButton.click();
  const menu = page.locator("div.absolute").filter({ has: page.getByText("Signed in as", { exact: true }) });
  await expect(menu.getByText(email, { exact: true })).toBeVisible();
  await accountButton.click();
}

export async function assertAdminGymIdentity(page: Page): Promise<void> {
  const targets = requireExactEnv(["KRUXT_UAT_GYM_ID"], "Exact admin gym assertion");
  await expect(page.getByRole("heading", { name: uatSettings.gymName, exact: true })).toBeVisible();
  await expect(page.getByText(`Gym ID: ${targets.KRUXT_UAT_GYM_ID.slice(0, 8)}`, { exact: true })).toBeVisible();
}

export async function assertMemberProfileIdentity(
  page: Page,
  email: string,
  role: "Platform" | "Gym staff" | "Member",
): Promise<void> {
  await openRouteWithHeading(page, uatSettings.webUrl, "/profile", "Profile");
  const accountPanel = page.locator("article").filter({ has: page.getByText("ACCOUNT", { exact: true }) });
  await expect(accountPanel.getByText(email, { exact: true })).toBeVisible();
  const roleValue = accountPanel.locator("dt", { hasText: "Role" }).locator("xpath=..").locator("dd");
  await expect(roleValue).toHaveText(role);
}

export async function openRouteWithHeading(
  page: Page,
  baseUrl: string,
  pathname: string,
  heading: string,
): Promise<void> {
  await page.goto(appUrl(baseUrl, pathname), { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
}
