#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const requireCredentials = strict || args.has("--require-credentials");
const requireMutations = strict || args.has("--require-mutations");
const requireEnvironmentAlignment = strict || args.has("--require-environment-alignment");
const canonicalSupabaseRef = "hgomsmhsybrxjdxbgkjy";
const productionConfirmation = "I_CONFIRM_DISPOSABLE_PRODUCTION_UAT";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const disposableMarkerPattern = /(\.test\b|uat)/i;

const urls = [
  ["KRUXT_UAT_PLATFORM_URL", "https://kruxt-platform.vercel.app"],
  ["KRUXT_UAT_ADMIN_URL", "https://kruxt-admin.vercel.app"],
  ["KRUXT_UAT_WEB_URL", "https://kruxt-beta.vercel.app"],
];

const roles = [
  ["platform admin", "KRUXT_UAT_PLATFORM_EMAIL", "KRUXT_UAT_PLATFORM_PASSWORD"],
  ["BZone owner/admin", "KRUXT_UAT_OWNER_EMAIL", "KRUXT_UAT_OWNER_PASSWORD"],
  ["BZone PT/staff", "KRUXT_UAT_STAFF_EMAIL", "KRUXT_UAT_STAFF_PASSWORD"],
  ["normal member", "KRUXT_UAT_MEMBER_EMAIL", "KRUXT_UAT_MEMBER_PASSWORD"],
];

const exactBulkTarget = [
  "KRUXT_UAT_GYM_ID",
  "KRUXT_UAT_GYM_SLUG",
  "KRUXT_UAT_BULK_MEMBERSHIP_ID",
  "KRUXT_UAT_BULK_USER_ID",
  "KRUXT_UAT_BULK_MEMBER_MARKER",
  "KRUXT_UAT_BULK_EXPECTED_STATUS",
  "KRUXT_UAT_BULK_EXPECTED_ROLE",
];

const exactAssignmentTarget = [
  "KRUXT_UAT_ASSIGNED_MEMBERSHIP_ID",
  "KRUXT_UAT_ASSIGNED_MEMBER_USER_ID",
  "KRUXT_UAT_ASSIGNED_MEMBER_MARKER",
  "KRUXT_UAT_ASSIGNED_EXPECTED_STATUS",
];

let failed = false;
const parsedUrls = new Map();

function value(name) {
  return process.env[name]?.trim();
}

function enabled(name) {
  return /^(1|true|yes)$/i.test(value(name) ?? "");
}

function fail(message) {
  failed = true;
  console.error(`[FAIL] ${message}`);
}

function isProductionLike(url) {
  return !new Set(["localhost", "127.0.0.1", "::1"]).has(url.hostname);
}

function parseEnvFile(contents) {
  const parsed = new Map();
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separator = withoutExport.indexOf("=");
    if (separator < 1) continue;
    const name = withoutExport.slice(0, separator).trim();
    let envValue = withoutExport.slice(separator + 1).trim();
    if (
      envValue.length >= 2 &&
      ((envValue.startsWith('"') && envValue.endsWith('"')) ||
        (envValue.startsWith("'") && envValue.endsWith("'")))
    ) {
      envValue = envValue.slice(1, -1);
    }
    parsed.set(name, envValue);
  }
  return parsed;
}

function validateUuid(name) {
  const actual = value(name);
  if (!actual) return;
  if (!uuidPattern.test(actual)) fail(`${name}: expected an exact UUID`);
}

function validateMarker(name) {
  const actual = value(name);
  if (!actual) return;
  if (!disposableMarkerPattern.test(actual)) {
    fail(`${name}: must contain an explicit .test or UAT disposable-record marker`);
  }
}

console.log(`BZone four-account route-smoke UAT preflight${strict ? " (strict)" : ""}\n`);

for (const [name, fallback] of urls) {
  const actual = value(name) || fallback;
  try {
    const parsed = new URL(actual);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("expected http or https");
    }
    parsedUrls.set(name, parsed);
    console.log(`[PASS] ${name}: ${parsed.origin}`);
  } catch (error) {
    fail(`${name}: ${error instanceof Error ? error.message : "invalid URL"}`);
  }
}

console.log(
  `\n[RUNTIME] deployed app refs are proved by Playwright Supabase request hosts and loaded runtime bundles; expected ${canonicalSupabaseRef}`,
);

const mobileEnvPath = value("KRUXT_UAT_MOBILE_ENV_FILE");
if (!mobileEnvPath) {
  if (requireEnvironmentAlignment) {
    fail("mobile local: set KRUXT_UAT_MOBILE_ENV_FILE to the actual Expo env file");
  } else {
    console.log("[TARGET] mobile local: set KRUXT_UAT_MOBILE_ENV_FILE to validate actual Expo config");
  }
} else {
  const absolutePath = resolve(mobileEnvPath);
  if (!existsSync(absolutePath)) {
    fail(`mobile local: KRUXT_UAT_MOBILE_ENV_FILE does not exist (${absolutePath})`);
  } else {
    const mobileEnv = parseEnvFile(readFileSync(absolutePath, "utf8"));
    const supabaseUrl = mobileEnv.get("EXPO_PUBLIC_SUPABASE_URL")?.trim();
    if (!supabaseUrl) {
      fail("mobile local: EXPO_PUBLIC_SUPABASE_URL is absent from KRUXT_UAT_MOBILE_ENV_FILE");
    } else {
      try {
        const ref = new URL(supabaseUrl).hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1];
        if (ref !== canonicalSupabaseRef) {
          fail(`mobile local: observed Supabase ref ${ref ?? "unknown"}; expected ${canonicalSupabaseRef}`);
        } else {
          console.log(`[PASS] mobile local: actual env file points to ${canonicalSupabaseRef}`);
        }
      } catch {
        fail("mobile local: EXPO_PUBLIC_SUPABASE_URL is not a valid URL");
      }
    }
  }
}

console.log("");
const configuredEmails = [];
for (const [label, emailName, passwordName] of roles) {
  const email = value(emailName);
  const passwordSet = Boolean(process.env[passwordName]);
  const missing = [email ? null : emailName, passwordSet ? null : passwordName].filter(Boolean);

  if (email) configuredEmails.push([emailName, email.toLowerCase()]);

  if (missing.length === 0) {
    console.log(`[PASS] ${label}: credential pair configured`);
  } else if (Boolean(email) !== passwordSet || requireCredentials) {
    fail(`${label}: missing ${missing.join(", ")}`);
  } else {
    console.log(`[SKIP] ${label}: set ${missing.join(", ")} to enable this journey`);
  }
}

const duplicateEmailVariables = configuredEmails
  .filter(([, email], index, all) => all.findIndex(([, candidate]) => candidate === email) !== index)
  .map(([name]) => name);
if (duplicateEmailVariables.length > 0) {
  fail(`four-account identity: email variables must be distinct (duplicate at ${duplicateEmailVariables.join(", ")})`);
} else if (configuredEmails.length === roles.length) {
  console.log("[PASS] four-account identity: all emails are distinct");
}

const expectedPlatformRole = value("KRUXT_UAT_PLATFORM_EXPECTED_ROLE");
const platformRoles = new Set(["founder", "ops_admin", "support_admin", "compliance_admin", "analyst", "read_only"]);
if (!expectedPlatformRole && strict) {
  fail("KRUXT_UAT_PLATFORM_EXPECTED_ROLE: required for an exact displayed-role assertion");
} else if (expectedPlatformRole && !platformRoles.has(expectedPlatformRole)) {
  fail("KRUXT_UAT_PLATFORM_EXPECTED_ROLE: unsupported platform role");
}

const mutationsEnabled = enabled("KRUXT_UAT_ALLOW_MUTATIONS");
console.log("");
if (!mutationsEnabled) {
  if (requireMutations) {
    fail("mutation gate: strict UAT requires KRUXT_UAT_ALLOW_MUTATIONS=1");
  } else {
    console.log("[SKIP] mutation gate: state-changing checks remain disabled by default");
  }
} else {
  console.log("[PASS] mutation gate: explicit mutation opt-in is set");
}

const requireExactBulkTarget = requireMutations || mutationsEnabled;
for (const name of exactBulkTarget) {
  if (!value(name) && requireExactBulkTarget) fail(`${name}: required for the exact disposable bulk target`);
}
validateUuid("KRUXT_UAT_GYM_ID");
validateUuid("KRUXT_UAT_BULK_MEMBERSHIP_ID");
validateUuid("KRUXT_UAT_BULK_USER_ID");
validateMarker("KRUXT_UAT_BULK_MEMBER_MARKER");

if (value("KRUXT_UAT_GYM_SLUG")?.match(/\s/)) {
  fail("KRUXT_UAT_GYM_SLUG: expected an exact slug without whitespace");
}
if (value("KRUXT_UAT_BULK_EXPECTED_STATUS") && value("KRUXT_UAT_BULK_EXPECTED_STATUS") !== "active") {
  fail("KRUXT_UAT_BULK_EXPECTED_STATUS: must be active so the audited mutation is idempotent");
}
if (value("KRUXT_UAT_BULK_EXPECTED_ROLE") && value("KRUXT_UAT_BULK_EXPECTED_ROLE") !== "member") {
  fail("KRUXT_UAT_BULK_EXPECTED_ROLE: disposable bulk target must currently be a member");
}

const requireAssignmentTarget = strict;
for (const name of exactAssignmentTarget) {
  if (!value(name) && requireAssignmentTarget) fail(`${name}: required for the exact assigned-member target`);
}
validateUuid("KRUXT_UAT_ASSIGNED_MEMBERSHIP_ID");
validateUuid("KRUXT_UAT_ASSIGNED_MEMBER_USER_ID");
validateMarker("KRUXT_UAT_ASSIGNED_MEMBER_MARKER");
if (
  value("KRUXT_UAT_ASSIGNED_EXPECTED_STATUS") &&
  value("KRUXT_UAT_ASSIGNED_EXPECTED_STATUS") !== "active"
) {
  fail("KRUXT_UAT_ASSIGNED_EXPECTED_STATUS: assigned UAT member must currently be active");
}

if (!strict && exactAssignmentTarget.every((name) => !value(name))) {
  console.log("[SKIP] exact PT assignment: configure the four KRUXT_UAT_ASSIGNED_* target variables");
}

const productionTargets = [...parsedUrls.values()].filter(isProductionLike);
if ((mutationsEnabled || strict) && productionTargets.length > 0) {
  if (value("KRUXT_UAT_PRODUCTION_CONFIRMATION") !== productionConfirmation) {
    fail(`production mutation gate: set KRUXT_UAT_PRODUCTION_CONFIRMATION=${productionConfirmation}`);
  } else {
    console.log("[PASS] production mutation gate: separate explicit confirmation token matches");
  }
}

console.log("");
if (failed) {
  console.error("Preflight failed. Fix the variables above; no browser tests were started.");
  process.exitCode = 2;
} else {
  console.log("Preflight passed. Run `pnpm uat:bzone` or the fully gated `pnpm uat:bzone:strict`.");
}
